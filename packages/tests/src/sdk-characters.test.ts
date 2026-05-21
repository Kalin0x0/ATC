import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AtcCharactersSDK } from '@atc/sdk'
import type { AtcHttpClient } from '@atc/sdk'

const CHAR_ID    = '01HZ9XVFG3QKJM5N8P2R4T6WYZ'
const ACCOUNT_ID = '01HZ9XVFG3QKJM5N8P2R4T6WXZ'
const SESSION_ID = '01HZ9XVFG3QKJM5N8P2R4T6WX1'

function makeMockHttp(): AtcHttpClient {
  return {
    get:    vi.fn(),
    post:   vi.fn(),
    delete: vi.fn(),
    patch:  vi.fn(),
  } as unknown as AtcHttpClient
}

describe('AtcCharactersSDK.create', () => {
  it('calls POST /api/v1/characters with the request body', async () => {
    const http = makeMockHttp()
    ;(http.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 201,
      data: {
        characterId: CHAR_ID,
        slot: 1,
        firstName: 'John',
        lastName: 'Doe',
        status: 'active',
        created: true,
      },
      error: null,
    })

    const sdk = new AtcCharactersSDK(http)
    const result = await sdk.create({
      accountId: ACCOUNT_ID,
      slot: 1,
      firstName: 'John',
      lastName: 'Doe',
      gender: 'male',
    })

    expect(http.post).toHaveBeenCalledWith('/api/v1/characters', expect.objectContaining({
      accountId: ACCOUNT_ID,
      slot: 1,
      firstName: 'John',
      lastName: 'Doe',
    }))
    expect(result).not.toBeNull()
    expect(result!.characterId).toBe(CHAR_ID)
    expect(result!.created).toBe(true)
  })

  it('returns null on API failure', async () => {
    const http = makeMockHttp()
    ;(http.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 422,
      data: null,
      error: 'Character limit reached',
    })

    const sdk = new AtcCharactersSDK(http)
    const result = await sdk.create({
      accountId: ACCOUNT_ID,
      slot: 1,
      firstName: 'John',
      lastName: 'Doe',
      gender: 'male',
    })
    expect(result).toBeNull()
  })

  it('does not retry on failure (single POST only)', async () => {
    const http = makeMockHttp()
    ;(http.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      data: null,
      error: 'Internal server error',
    })

    const sdk = new AtcCharactersSDK(http)
    await sdk.create({ accountId: ACCOUNT_ID, slot: 1, firstName: 'A', lastName: 'B', gender: 'other' })
    expect(http.post).toHaveBeenCalledTimes(1)
  })
})

describe('AtcCharactersSDK.listByAccount', () => {
  it('calls GET /api/v1/characters/account/:accountId', async () => {
    const http = makeMockHttp()
    ;(http.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      data: { characters: [] },
      error: null,
    })

    const sdk = new AtcCharactersSDK(http)
    const result = await sdk.listByAccount(ACCOUNT_ID)

    expect(http.get).toHaveBeenCalledWith(expect.stringContaining(ACCOUNT_ID))
    expect(result).not.toBeNull()
    expect(result!.characters).toEqual([])
  })

  it('returns null on API failure', async () => {
    const http = makeMockHttp()
    ;(http.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
      data: null,
      error: 'Not found',
    })

    const sdk = new AtcCharactersSDK(http)
    const result = await sdk.listByAccount(ACCOUNT_ID)
    expect(result).toBeNull()
  })
})

describe('AtcCharactersSDK.get', () => {
  it('calls GET /api/v1/characters/:characterId', async () => {
    const http = makeMockHttp()
    ;(http.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        characterId: CHAR_ID,
        accountId: ACCOUNT_ID,
        slot: 1,
        firstName: 'John',
        lastName: 'Doe',
        gender: 'male',
        dateOfBirth: null,
        nationality: null,
        metadata: {},
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      error: null,
    })

    const sdk = new AtcCharactersSDK(http)
    const result = await sdk.get(CHAR_ID)

    expect(http.get).toHaveBeenCalledWith(expect.stringContaining(CHAR_ID))
    expect(result).not.toBeNull()
  })

  it('returns null when character not found', async () => {
    const http = makeMockHttp()
    ;(http.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
      data: null,
      error: 'Not found',
    })

    const sdk = new AtcCharactersSDK(http)
    const result = await sdk.get(CHAR_ID)
    expect(result).toBeNull()
  })
})

describe('AtcCharactersSDK.selectForSession', () => {
  it('calls PATCH /api/v1/sessions/:sessionId/character with the characterId body', async () => {
    const http = makeMockHttp()
    ;(http.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        sessionId: SESSION_ID,
        characterId: CHAR_ID,
        accountId: ACCOUNT_ID,
        firstName: 'John',
        lastName: 'Doe',
        status: 'active',
      },
      error: null,
    })

    const sdk = new AtcCharactersSDK(http)
    const result = await sdk.selectForSession(SESSION_ID, CHAR_ID)

    expect(http.patch).toHaveBeenCalledWith(
      expect.stringContaining(SESSION_ID),
      { characterId: CHAR_ID }
    )
    expect(result).not.toBeNull()
    expect(result!.characterId).toBe(CHAR_ID)
  })

  it('returns null when session not found', async () => {
    const http = makeMockHttp()
    ;(http.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
      data: null,
      error: 'Session not found',
    })

    const sdk = new AtcCharactersSDK(http)
    const result = await sdk.selectForSession(SESSION_ID, CHAR_ID)
    expect(result).toBeNull()
  })
})
