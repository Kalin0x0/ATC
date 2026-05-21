import { describe, it, expect, vi } from 'vitest'
import { AtcVitalsSDK } from '@atc/sdk'

const CHAR_ID = '01HZ9XVFG3QKJM5N8P2R4T6WYZ'

const MOCK_VITALS = {
  characterId: CHAR_ID,
  health: 100, hunger: 80, thirst: 60, stamina: 90, stress: 10, armor: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function makeHttp(ok: boolean, data: unknown = MOCK_VITALS) {
  return {
    get:   vi.fn().mockResolvedValue({ ok, data }),
    post:  vi.fn().mockResolvedValue({ ok, data }),
    patch: vi.fn().mockResolvedValue({ ok, data }),
  }
}

// ── get ───────────────────────────────────────────────────────────────────────

describe('AtcVitalsSDK — get', () => {
  it('GETs correct path and returns vitals on success', async () => {
    const http = makeHttp(true)
    const sdk = new AtcVitalsSDK(http as never)
    const result = await sdk.get(CHAR_ID)
    expect(http.get).toHaveBeenCalledWith(`/api/v1/vitals/character/${CHAR_ID}`)
    expect(result).toEqual(MOCK_VITALS)
  })

  it('returns null on HTTP error', async () => {
    const http = makeHttp(false)
    const sdk = new AtcVitalsSDK(http as never)
    expect(await sdk.get(CHAR_ID)).toBeNull()
  })
})

// ── patch ─────────────────────────────────────────────────────────────────────

describe('AtcVitalsSDK — patch', () => {
  it('PATCHes correct path with patch body', async () => {
    const http = makeHttp(true)
    const sdk = new AtcVitalsSDK(http as never)
    const patch = { health: 50 }
    const result = await sdk.patch(CHAR_ID, patch)
    expect(http.patch).toHaveBeenCalledWith(`/api/v1/vitals/character/${CHAR_ID}`, patch)
    expect(result).toEqual(MOCK_VITALS)
  })

  it('returns null on HTTP error', async () => {
    const http = makeHttp(false)
    const sdk = new AtcVitalsSDK(http as never)
    expect(await sdk.patch(CHAR_ID, { hunger: 40 })).toBeNull()
  })
})

// ── mutate ────────────────────────────────────────────────────────────────────

describe('AtcVitalsSDK — mutate', () => {
  it('POSTs to /mutate with correct body', async () => {
    const http = makeHttp(true)
    const sdk = new AtcVitalsSDK(http as never)
    const req = { vital: 'thirst' as const, mode: 'increment' as const, amount: 25 }
    const result = await sdk.mutate(CHAR_ID, req)
    expect(http.post).toHaveBeenCalledWith(
      `/api/v1/vitals/character/${CHAR_ID}/mutate`,
      req,
    )
    expect(result).toEqual(MOCK_VITALS)
  })

  it('returns null on HTTP error — no retry', async () => {
    const http = makeHttp(false)
    const sdk = new AtcVitalsSDK(http as never)
    const result = await sdk.mutate(CHAR_ID, { vital: 'health', mode: 'set', amount: 0 })
    expect(result).toBeNull()
    expect(http.post).toHaveBeenCalledTimes(1)
  })
})

// ── reset ─────────────────────────────────────────────────────────────────────

describe('AtcVitalsSDK — reset', () => {
  it('POSTs to /reset and returns vitals on success', async () => {
    const http = makeHttp(true)
    const sdk = new AtcVitalsSDK(http as never)
    const result = await sdk.reset(CHAR_ID)
    expect(http.post).toHaveBeenCalledWith(
      `/api/v1/vitals/character/${CHAR_ID}/reset`,
      {},
    )
    expect(result).toEqual(MOCK_VITALS)
  })

  it('returns null on HTTP error — no retry', async () => {
    const http = makeHttp(false)
    const sdk = new AtcVitalsSDK(http as never)
    expect(await sdk.reset(CHAR_ID)).toBeNull()
    expect(http.post).toHaveBeenCalledTimes(1)
  })
})
