import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AtcHttpClient } from '@atc/sdk'

describe('AtcHttpClient', () => {
  const BASE_URL = 'http://localhost:3000'
  const TOKEN = 'test-token'

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mockFetch(status: number, body: unknown) {
    const mockedFetch = vi.mocked(fetch)
    mockedFetch.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(JSON.stringify(body)),
    } as Response)
  }

  it('sends GET with Bearer token', async () => {
    mockFetch(200, { hello: 'world' })
    const client = new AtcHttpClient(BASE_URL, TOKEN)
    const res = await client.get<{ hello: string }>('/health')

    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
    expect(res.data).toEqual({ hello: 'world' })
    expect(res.error).toBeNull()

    const mockedFetch = vi.mocked(fetch)
    const [url, init] = mockedFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:3000/health')
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token')
  })

  it('sends POST with JSON body', async () => {
    mockFetch(201, { accountId: 'abc' })
    const client = new AtcHttpClient(BASE_URL, TOKEN)
    const res = await client.post<{ accountId: string }>('/api/v1/accounts', {
      primaryIdentifier: 'license:xyz',
    })

    expect(res.ok).toBe(true)
    expect(res.data?.accountId).toBe('abc')

    const mockedFetch = vi.mocked(fetch)
    const [, init] = mockedFetch.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(init.body).toContain('license:xyz')
  })

  it('sends DELETE request', async () => {
    mockFetch(204, null)
    const client = new AtcHttpClient(BASE_URL, TOKEN)
    const res = await client.delete<null>('/api/v1/sessions/1')

    expect(res.ok).toBe(true)
    expect(res.status).toBe(204)
  })

  it('returns error on 4xx response', async () => {
    mockFetch(401, { error: 'Unauthorized' })
    const client = new AtcHttpClient(BASE_URL, TOKEN)
    const res = await client.get<unknown>('/api/v1/accounts')

    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
    expect(res.error).toBe('Unauthorized')
    expect(res.data).toBeNull()
  })

  it('returns error on 5xx response', async () => {
    mockFetch(500, { error: 'Internal server error' })
    const client = new AtcHttpClient(BASE_URL, TOKEN)
    const res = await client.get<unknown>('/api/v1/sessions/source/1')

    expect(res.ok).toBe(false)
    expect(res.status).toBe(500)
  })

  it('strips trailing slash from base URL', async () => {
    mockFetch(200, {})
    const client = new AtcHttpClient('http://localhost:3000/', TOKEN)
    await client.get('/health')

    const mockedFetch = vi.mocked(fetch)
    const [url] = mockedFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:3000/health')
  })

  it('returns timeout error on AbortError', async () => {
    const mockedFetch = vi.mocked(fetch)
    mockedFetch.mockRejectedValueOnce(Object.assign(new Error('AbortError'), { name: 'AbortError' }))

    const client = new AtcHttpClient(BASE_URL, TOKEN, 1)
    const res = await client.get<unknown>('/slow')

    expect(res.ok).toBe(false)
    expect(res.error).toBe('Request timed out')
  })
})
