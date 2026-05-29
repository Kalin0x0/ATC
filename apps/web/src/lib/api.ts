import { useAuthStore } from '../store/auth'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function getAuthHeaders(): Record<string, string> {
  const { token } = useAuthStore.getState()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

function buildUrl(path: string): string {
  const { apiUrl } = useAuthStore.getState()
  // If proxied (path starts with /api or /health) use relative path in dev
  // Otherwise build absolute from stored apiUrl
  if (apiUrl && !path.startsWith('/api') && !path.startsWith('/health')) {
    return `${apiUrl.replace(/\/$/, '')}${path}`
  }
  return path
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = buildUrl(path)
  const res = await fetch(url, {
    method,
    headers: getAuthHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const data = (await res.json()) as { message?: string; error?: string }
      message = data.message ?? data.error ?? message
    } catch {
      // ignore parse errors
    }
    throw new ApiError(res.status, message)
  }

  // 204 No Content
  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>('GET', path)
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('POST', path, body)
  },
  del<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('DELETE', path, body)
  },
  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('PATCH', path, body)
  },
}
