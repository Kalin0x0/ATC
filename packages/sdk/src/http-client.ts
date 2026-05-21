export interface HttpResponse<T> {
  ok: boolean
  status: number
  data: T | null
  error: string | null
}

export class AtcHttpClient {
  private readonly baseUrl: string
  private readonly token: string
  private readonly timeoutMs: number

  constructor(baseUrl: string, token: string, timeoutMs = 5000) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.token = token
    this.timeoutMs = timeoutMs
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.token) {
      h['Authorization'] = `Bearer ${this.token}`
    }
    return h
  }

  async get<T>(path: string): Promise<HttpResponse<T>> {
    return this._request<T>('GET', path, undefined)
  }

  async post<T>(path: string, body: unknown): Promise<HttpResponse<T>> {
    return this._request<T>('POST', path, body)
  }

  async delete<T>(path: string): Promise<HttpResponse<T>> {
    return this._request<T>('DELETE', path, undefined)
  }

  async patch<T>(path: string, body: unknown): Promise<HttpResponse<T>> {
    return this._request<T>('PATCH', path, body)
  }

  private async _request<T>(
    method: string,
    path: string,
    body: unknown
  ): Promise<HttpResponse<T>> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const fetchInit: RequestInit = {
        method,
        headers: this.headers(),
        signal: controller.signal,
      }
      if (body !== undefined) {
        fetchInit.body = JSON.stringify(body)
      }
      const response = await fetch(`${this.baseUrl}${path}`, fetchInit)

      const text = await response.text()
      let data: T | null = null

      if (text) {
        try {
          data = JSON.parse(text) as T
        } catch {
          // non-JSON body
        }
      }

      if (!response.ok) {
        const errData = data as Record<string, unknown> | null
        return {
          ok: false,
          status: response.status,
          data: null,
          error: String(errData?.['error'] ?? `HTTP ${response.status}`),
        }
      }

      return { ok: true, status: response.status, data, error: null }
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError'
      return {
        ok: false,
        status: 0,
        data: null,
        error: isAbort ? 'Request timed out' : String(err),
      }
    } finally {
      clearTimeout(timer)
    }
  }
}
