import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js'

const poolData = {
  UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? '',
  ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? '',
}

const userPool = new CognitoUserPool(poolData)

export interface AuthTokens {
  idToken: string
  accessToken: string
  refreshToken: string
}

export interface NewPasswordRequired {
  type: 'NEW_PASSWORD_REQUIRED'
  cognitoUser: CognitoUser
  userAttributes: Record<string, string>
}

export interface SoftwareTokenMfaRequired {
  type: 'SOFTWARE_TOKEN_MFA'
  /** Pass back to `completeMfaChallenge()` with the user's 6-digit
   *  authenticator code to finish sign-in. */
  cognitoUser: CognitoUser
}

export interface SignInSuccess {
  type: 'SUCCESS'
  tokens: AuthTokens
}

export type SignInResult =
  | SignInSuccess
  | NewPasswordRequired
  | SoftwareTokenMfaRequired

export function signIn(identifier: string, password: string): Promise<SignInResult> {
  const username = identifier.trim()

  return new Promise((resolve, reject) => {
    const authDetails = new AuthenticationDetails({
      Username: username,
      Password: password,
    })

    const cognitoUser = new CognitoUser({
      Username: username,
      Pool: userPool,
    })

    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session: CognitoUserSession) => {
        resolve({
          type: 'SUCCESS',
          tokens: {
            idToken: session.getIdToken().getJwtToken(),
            accessToken: session.getAccessToken().getJwtToken(),
            refreshToken: session.getRefreshToken().getToken(),
          },
        })
      },
      onFailure: (err) => {
        reject(err)
      },
      newPasswordRequired: (userAttributes: Record<string, string>) => {
        // Remove immutable attributes Cognito doesn't allow in challenge response
        delete userAttributes.email_verified
        delete userAttributes.email
        resolve({
          type: 'NEW_PASSWORD_REQUIRED',
          cognitoUser,
          userAttributes,
        })
      },
      // TOTP MFA challenge — user has enrolled an authenticator app
      // and Cognito needs the 6-digit code to complete sign-in.
      totpRequired: () => {
        resolve({
          type: 'SOFTWARE_TOKEN_MFA',
          cognitoUser,
        })
      },
    })
  })
}

/** Respond to the TOTP MFA challenge returned by `signIn`.
 *
 *  The caller passes the `cognitoUser` handle from the
 *  SoftwareTokenMfaRequired result and the 6-digit code the user
 *  read from their authenticator app. On success Cognito issues
 *  tokens just like a normal sign-in — no further challenges.
 */
export function completeMfaChallenge(
  cognitoUser: CognitoUser,
  code: string,
): Promise<AuthTokens> {
  return new Promise((resolve, reject) => {
    cognitoUser.sendMFACode(
      code,
      {
        onSuccess: (session: CognitoUserSession) => {
          resolve({
            idToken: session.getIdToken().getJwtToken(),
            accessToken: session.getAccessToken().getJwtToken(),
            refreshToken: session.getRefreshToken().getToken(),
          })
        },
        onFailure: (err) => reject(err),
      },
      'SOFTWARE_TOKEN_MFA',
    )
  })
}

export function completeNewPassword(
  cognitoUser: CognitoUser,
  newPassword: string,
  userAttributes: Record<string, string> = {},
): Promise<AuthTokens> {
  return new Promise((resolve, reject) => {
    cognitoUser.completeNewPasswordChallenge(newPassword, userAttributes, {
      onSuccess: (session: CognitoUserSession) => {
        resolve({
          idToken: session.getIdToken().getJwtToken(),
          accessToken: session.getAccessToken().getJwtToken(),
          refreshToken: session.getRefreshToken().getToken(),
        })
      },
      onFailure: (err) => {
        reject(err)
      },
    })
  })
}

export function forgotPassword(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({ Username: email, Pool: userPool })
    cognitoUser.forgotPassword({
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
      inputVerificationCode: () => resolve(),
    })
  })
}

export function confirmForgotPassword(email: string, code: string, newPassword: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({ Username: email, Pool: userPool })
    cognitoUser.confirmPassword(code, newPassword, {
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    })
  })
}

/** Force Cognito to re-issue the ID token using the stored refresh
 * token. Used after a role edit so `custom:roleId` + `custom:systemRole`
 * claims in the token reflect the current DB state without requiring
 * the user to sign out and back in.
 *
 * Returns the new id-token string on success. Falls back to rejecting
 * if there's no refresh token cached (user needs a full sign-in).
 */
export function refreshSession(): Promise<string> {
  return new Promise((resolve, reject) => {
    const currentUser = userPool.getCurrentUser()
    if (!currentUser) {
      reject(new Error('No user session found. Please sign in again.'))
      return
    }
    // getSession with `{}` options silently refreshes if the access
    // token is expired; passing refreshSession() directly forces it
    // even on non-expired tokens — which is what we want here.
    currentUser.getSession(
      (err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session) {
          reject(err ?? new Error('No active session.'))
          return
        }
        const refreshToken = session.getRefreshToken()
        currentUser.refreshSession(refreshToken, (e, newSession) => {
          if (e || !newSession) {
            reject(e ?? new Error('Failed to refresh session.'))
            return
          }
          const idToken = newSession.getIdToken().getJwtToken()
          if (typeof window !== 'undefined') {
            localStorage.setItem('auth_token', idToken)
          }
          resolve(idToken)
        })
      },
    )
  })
}

export function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const currentUser = userPool.getCurrentUser()
    if (!currentUser) {
      reject(new Error('No user session found. Please sign in again.'))
      return
    }

    currentUser.getSession((err: Error | null) => {
      if (err) {
        reject(new Error('Session expired. Please sign in again.'))
        return
      }

      currentUser.changePassword(oldPassword, newPassword, (err) => {
        if (err) {
          reject(err)
          return
        }
        resolve()
      })
    })
  })
}

/** Start a change-email flow.
 *
 *  Cognito's `updateAttributes` on the `email` attribute does three
 *  things in one call:
 *    1. Stages the new email on the user record
 *    2. Sets `email_verified=false` (the new address is unverified)
 *    3. Mails a 6-digit verification code to the NEW address
 *
 *  After a successful resolve, the caller has to show the user a code
 *  input and call `verifyEmailCode(code)` to commit the change. Until
 *  that code is verified, the user's sign-in email is STILL the old
 *  one — Cognito stages the change but doesn't swap until verification.
 *
 *  Rejects if the new email is already in use elsewhere in the pool
 *  (Cognito enforces global email uniqueness because email is a
 *  sign-in alias).
 */
export function requestEmailChange(newEmail: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const currentUser = userPool.getCurrentUser()
    if (!currentUser) {
      reject(new Error('No user session found. Please sign in again.'))
      return
    }
    currentUser.getSession((err: Error | null) => {
      if (err) {
        reject(new Error('Session expired. Please sign in again.'))
        return
      }
      const attributes = [
        {
          Name: 'email',
          Value: newEmail.trim().toLowerCase(),
        },
      ]
      // `amazon-cognito-identity-js` types want CognitoUserAttribute
      // instances here, but the SDK also accepts plain {Name,Value}
      // objects and that's what works at runtime. Cast through unknown
      // to keep TS happy.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      currentUser.updateAttributes(attributes as any, (e) => {
        if (e) {
          reject(e)
          return
        }
        resolve()
      })
    })
  })
}

/** Ask Cognito to email a 6-digit verification code to the current
 *  user's email address. Used by the /verify-email flow for accounts
 *  created via /signup (which deliberately leave `email_verified=false`).
 *
 *  Requires a live session — the user must have signed in first, which
 *  they can since Cognito lets unverified-email accounts authenticate.
 *  Only the attribute's verified state is false, not the account.
 */
export function sendEmailVerificationCode(): Promise<void> {
  return new Promise((resolve, reject) => {
    const currentUser = userPool.getCurrentUser()
    if (!currentUser) {
      reject(new Error('No user session found. Please sign in again.'))
      return
    }
    currentUser.getSession((err: Error | null) => {
      if (err) {
        reject(new Error('Session expired. Please sign in again.'))
        return
      }
      currentUser.getAttributeVerificationCode('email', {
        onSuccess: () => resolve(),
        onFailure: (e) => reject(e),
      })
    })
  })
}

/** Verify the current user's email attribute with the 6-digit code
 *  Cognito emailed in response to `sendEmailVerificationCode()`.
 *
 *  Success mutates `email_verified` to true in Cognito. The caller
 *  must then invoke `refreshSession()` to get a fresh ID token that
 *  reflects the new claim value, otherwise the frontend's local
 *  view stays stale for up to one ID-token TTL.
 */
export function verifyEmailCode(code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const currentUser = userPool.getCurrentUser()
    if (!currentUser) {
      reject(new Error('No user session found. Please sign in again.'))
      return
    }
    currentUser.getSession((err: Error | null) => {
      if (err) {
        reject(new Error('Session expired. Please sign in again.'))
        return
      }
      currentUser.verifyAttribute('email', code, {
        onSuccess: () => resolve(),
        onFailure: (e) => reject(e),
      })
    })
  })
}

// ──────────────────────────────────────────────────────────────────
// TOTP enrollment (Session 3)
// ──────────────────────────────────────────────────────────────────

/** Start TOTP enrollment. Returns the shared secret the authenticator
 *  app needs (scan the QR built from this + username, or enter
 *  manually). The associated token is NOT yet enabled — the caller
 *  must call `verifyTotpEnrollment()` with the first 6-digit code
 *  the app generates, which commits the enrollment. If the user
 *  abandons the flow before verifying, nothing changes server-side.
 */
export function associateTotp(): Promise<string> {
  return new Promise((resolve, reject) => {
    const currentUser = userPool.getCurrentUser()
    if (!currentUser) {
      reject(new Error('No user session found. Please sign in again.'))
      return
    }
    currentUser.getSession((err: Error | null) => {
      if (err) {
        reject(new Error('Session expired. Please sign in again.'))
        return
      }
      currentUser.associateSoftwareToken({
        associateSecretCode: (secretCode: string) => resolve(secretCode),
        onFailure: (e) => reject(e),
      })
    })
  })
}

/** Verify the first authenticator code + commit TOTP as the user's
 *  preferred MFA. After this, every future sign-in will return a
 *  `SOFTWARE_TOKEN_MFA` challenge that must be satisfied via
 *  `completeMfaChallenge()`.
 *
 *  `friendlyDeviceName` shows up in Cognito console and
 *  `listDevices` responses — pass something human-readable like
 *  "iPhone" or "Authy" so the user recognises it later.
 */
export function verifyTotpEnrollment(
  code: string,
  friendlyDeviceName: string = 'Authenticator',
): Promise<void> {
  return new Promise((resolve, reject) => {
    const currentUser = userPool.getCurrentUser()
    if (!currentUser) {
      reject(new Error('No user session found. Please sign in again.'))
      return
    }
    currentUser.getSession((err: Error | null) => {
      if (err) {
        reject(new Error('Session expired. Please sign in again.'))
        return
      }
      currentUser.verifySoftwareToken(code, friendlyDeviceName, {
        onSuccess: () => {
          // Flip the user's preferred MFA to TOTP so subsequent
          // sign-ins actually challenge. Without this call the
          // associated token sits unused.
          currentUser.setUserMfaPreference(
            null,
            { PreferredMfa: true, Enabled: true },
            (prefErr) => {
              if (prefErr) {
                reject(prefErr)
                return
              }
              resolve()
            },
          )
        },
        onFailure: (e) => reject(e),
      })
    })
  })
}

/** Turn off TOTP for the current user. Cognito leaves the associated
 *  software token in place but ignores it on future logins. The user
 *  can re-enable later without re-associating (calling
 *  `verifyTotpEnrollment` again with any valid code). */
export function disableTotp(): Promise<void> {
  return new Promise((resolve, reject) => {
    const currentUser = userPool.getCurrentUser()
    if (!currentUser) {
      reject(new Error('No user session found. Please sign in again.'))
      return
    }
    currentUser.getSession((err: Error | null) => {
      if (err) {
        reject(new Error('Session expired. Please sign in again.'))
        return
      }
      currentUser.setUserMfaPreference(
        null,
        { PreferredMfa: false, Enabled: false },
        (prefErr) => {
          if (prefErr) {
            reject(prefErr)
            return
          }
          resolve()
        },
      )
    })
  })
}

/** Read the current MFA status from Cognito. Returns true when the
 *  user has a TOTP factor actively enrolled and selected as their
 *  preferred MFA. Used by the settings page to branch between
 *  "Enable 2FA" and "Disable 2FA" UI. */
export function isTotpEnabled(): Promise<boolean> {
  return new Promise((resolve) => {
    const currentUser = userPool.getCurrentUser()
    if (!currentUser) {
      resolve(false)
      return
    }
    currentUser.getSession((err: Error | null) => {
      if (err) {
        resolve(false)
        return
      }
      currentUser.getUserData((dataErr, data) => {
        if (dataErr || !data) {
          resolve(false)
          return
        }
        const preferred = (data.PreferredMfaSetting || '').toUpperCase()
        const list = (data.UserMFASettingList || []).map((s) => s.toUpperCase())
        resolve(
          preferred === 'SOFTWARE_TOKEN_MFA' ||
            list.includes('SOFTWARE_TOKEN_MFA'),
        )
      })
    })
  })
}

// ──────────────────────────────────────────────────────────────────

export function signOut(): void {
  const currentUser = userPool.getCurrentUser()
  if (currentUser) {
    currentUser.signOut()
  }
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token')
  }
}

export function getCurrentToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('auth_token')
}

interface DecodedToken {
  sub: string
  email: string
  'custom:systemRole'?: string
  'custom:employeeId'?: string
  [key: string]: unknown
}

function decodeJwt(token: string): DecodedToken | null {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload) as DecodedToken
  } catch {
    return null
  }
}

export function getCurrentUser(): { userId: string; email: string; systemRole: string; employeeId: string } | null {
  const token = getCurrentToken()
  if (!token) return null

  const decoded = decodeJwt(token)
  if (!decoded) return null

  return {
    userId: decoded.sub,
    email: decoded.email,
    systemRole: (decoded['custom:systemRole'] as string) ?? 'MEMBER',
    employeeId: (decoded['custom:employeeId'] as string) ?? '',
  }
}
