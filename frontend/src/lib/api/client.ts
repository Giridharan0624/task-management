import type { ApiError } from '@/types/api'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function transformKeys(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(transformKeys)
  if (data !== null && typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>).map(([k, v]) => [snakeToCamel(k), transformKeys(v)])
    )
  }
  return data
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())
}

function transformKeysToSnake(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(transformKeysToSnake)
  if (data !== null && typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>).map(([k, v]) => [camelToSnake(k), transformKeysToSnake(v)])
    )
  }
  return data
}

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
    init.body = JSON.stringify(transformKeysToSnake(body))
  }

  const url = `${BASE_URL}${path}`
  const response = await fetch(url, init)

  if (!response.ok) {
    // Token expired — clear auth and redirect to login
    if (response.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('auth_token')
      window.location.replace('/login')
      throw new ApiClientError('Session expired. Please log in again.', 401)
    }

    let errorMessage = `HTTP error ${response.status}`
    let errorCode: string | undefined
    try {
      const errorBody = await response.json() as { message?: string; error?: string; code?: string }
      if (errorBody.error) errorMessage = errorBody.error
      else if (errorBody.message) errorMessage = errorBody.message
      if (errorBody.code) errorCode = errorBody.code
    } catch {
      // ignore JSON parse errors
    }

    // Platform operator suspended this tenant mid-session. Dispatch a
    // browser event so the TenantProvider refreshes /orgs/current and
    // the dashboard layout flips to the SuspendedScreen. Swallowing
    // nothing — the original error still propagates so callers see
    // the 403.
    if (errorCode === 'ORG_SUSPENDED' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('taskflow:org-suspended'))
    }

    throw new ApiClientError(errorMessage, response.status, errorCode)
  }

  if (response.status === 204) {
    return undefined as unknown as T
  }

  const json = await response.json()
  return transformKeys(json) as T
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
  patch<T>(path: string, body: unknown): Promise<T> {
    return request<T>('PATCH', path, body)
  },
  del<T>(path: string): Promise<T> {
    return request<T>('DELETE', path)
  },
}
