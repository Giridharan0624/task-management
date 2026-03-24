import type { ApiError } from '@/types/api'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

class ApiClientError extends Error implements ApiError {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('auth_token')
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const init: RequestInit = {
    method,
    headers,
  }

  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }

  const url = `${BASE_URL}${path}`
  const response = await fetch(url, init)

  if (!response.ok) {
    let errorMessage = `HTTP error ${response.status}`
    let errorCode: string | undefined
    try {
      const errorBody = await response.json() as { message?: string; code?: string }
      if (errorBody.message) errorMessage = errorBody.message
      if (errorBody.code) errorCode = errorBody.code
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiClientError(errorMessage, response.status, errorCode)
  }

  if (response.status === 204) {
    return undefined as unknown as T
  }

  return response.json() as Promise<T>
}

export const apiClient = {
  get<T>(path: string): Promise<T> {
    return request<T>('GET', path)
  },
  post<T>(path: string, body: unknown): Promise<T> {
    return request<T>('POST', path, body)
  },
  put<T>(path: string, body: unknown): Promise<T> {
    return request<T>('PUT', path, body)
  },
  del<T>(path: string): Promise<T> {
    return request<T>('DELETE', path)
  },
}
