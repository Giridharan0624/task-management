import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
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

export function signIn(email: string, password: string): Promise<AuthTokens> {
  return new Promise((resolve, reject) => {
    const authDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    })

    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    })

    cognitoUser.authenticateUser(authDetails, {
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

export function signUp(email: string, password: string, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const attributeList: CognitoUserAttribute[] = [
      new CognitoUserAttribute({ Name: 'email', Value: email }),
      new CognitoUserAttribute({ Name: 'name', Value: name }),
    ]

    userPool.signUp(email, password, attributeList, [], (err, _result) => {
      if (err) {
        reject(err)
        return
      }
      resolve()
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

export function getCurrentUser(): { userId: string; email: string; systemRole: string } | null {
  const token = getCurrentToken()
  if (!token) return null

  const decoded = decodeJwt(token)
  if (!decoded) return null

  return {
    userId: decoded.sub,
    email: decoded.email,
    systemRole: (decoded['custom:systemRole'] as string) ?? 'MEMBER',
  }
}
