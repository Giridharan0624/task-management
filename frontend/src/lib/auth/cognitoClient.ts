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

export interface SignInSuccess {
  type: 'SUCCESS'
  tokens: AuthTokens
}

export type SignInResult = SignInSuccess | NewPasswordRequired

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
    })
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
