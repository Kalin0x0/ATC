import { describe, it, expect, vi } from 'vitest'
import { AtcWalletsSDK } from '@atc/sdk'
import type { AtcHttpClient } from '@atc/sdk'

const CHAR_ID   = '01HZ9XVFG3QKJM5N8P2R4T6WYZ'
const WALLET_ID = '01WALLETID000000000000000W1'

function makeMockHttp(): AtcHttpClient {
  return {
    get:    vi.fn(),
    post:   vi.fn(),
    delete: vi.fn(),
    patch:  vi.fn(),
  } as unknown as AtcHttpClient
}

const mockBalanceResponse = {
  characterId: CHAR_ID,
  currency: 'ATC',
  cashBalance: 1000,
  bankBalance: 5000,
  status: 'active',
}

const mockMutationResponse = {
  transactionId: '01TX0000000000000000000TX1',
  walletId: WALLET_ID,
  characterId: CHAR_ID,
  currency: 'ATC',
  cashBalance: 1500,
  bankBalance: 5000,
  amount: 500,
  type: 'credit',
  account: 'cash',
  idempotent: false,
}

describe('AtcWalletsSDK.getBalance', () => {
  it('calls GET /api/v1/wallets/character/:characterId with default currency', async () => {
    const http = makeMockHttp()
    ;(http.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      data: mockBalanceResponse,
      error: null,
    })

    const sdk = new AtcWalletsSDK(http)
    const result = await sdk.getBalance(CHAR_ID)

    expect(http.get).toHaveBeenCalledWith(expect.stringContaining(CHAR_ID))
    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('currency=ATC'))
    expect(result).not.toBeNull()
    expect(result!.cashBalance).toBe(1000)
    expect(result!.bankBalance).toBe(5000)
  })

  it('passes custom currency in the query string', async () => {
    const http = makeMockHttp()
    ;(http.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      data: { ...mockBalanceResponse, currency: 'USD' },
      error: null,
    })

    const sdk = new AtcWalletsSDK(http)
    await sdk.getBalance(CHAR_ID, 'USD')
    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('currency=USD'))
  })

  it('returns null on API failure', async () => {
    const http = makeMockHttp()
    ;(http.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
      data: null,
      error: 'Not found',
    })

    const sdk = new AtcWalletsSDK(http)
    const result = await sdk.getBalance(CHAR_ID)
    expect(result).toBeNull()
  })
})

describe('AtcWalletsSDK.credit', () => {
  const creditParams = {
    account: 'cash' as const,
    amount: 500,
    currency: 'ATC',
    reason: 'reward',
    source: 'system' as const,
    idempotencyKey: 'idem-001',
  }

  it('calls POST /api/v1/wallets/character/:characterId/credit', async () => {
    const http = makeMockHttp()
    ;(http.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 201,
      data: mockMutationResponse,
      error: null,
    })

    const sdk = new AtcWalletsSDK(http)
    const result = await sdk.credit(CHAR_ID, creditParams)

    expect(http.post).toHaveBeenCalledWith(
      expect.stringContaining('/credit'),
      creditParams,
    )
    expect(result).not.toBeNull()
    expect(result!.amount).toBe(500)
    expect(result!.idempotent).toBe(false)
  })

  it('returns null on API failure', async () => {
    const http = makeMockHttp()
    ;(http.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 422,
      data: null,
      error: 'Wallet is frozen',
    })

    const sdk = new AtcWalletsSDK(http)
    const result = await sdk.credit(CHAR_ID, creditParams)
    expect(result).toBeNull()
  })

  it('does not retry on failure', async () => {
    const http = makeMockHttp()
    ;(http.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false, status: 500, data: null, error: 'error',
    })
    const sdk = new AtcWalletsSDK(http)
    await sdk.credit(CHAR_ID, creditParams)
    expect(http.post).toHaveBeenCalledTimes(1)
  })
})

describe('AtcWalletsSDK.debit', () => {
  const debitParams = {
    account: 'cash' as const,
    amount: 200,
    currency: 'ATC',
    reason: 'purchase',
    source: 'gameplay' as const,
    idempotencyKey: 'idem-debit-001',
  }

  it('calls POST /api/v1/wallets/character/:characterId/debit', async () => {
    const http = makeMockHttp()
    ;(http.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 201,
      data: { ...mockMutationResponse, type: 'debit', cashBalance: 800, amount: 200 },
      error: null,
    })

    const sdk = new AtcWalletsSDK(http)
    const result = await sdk.debit(CHAR_ID, debitParams)

    expect(http.post).toHaveBeenCalledWith(expect.stringContaining('/debit'), debitParams)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('debit')
  })

  it('returns null on insufficient funds (422)', async () => {
    const http = makeMockHttp()
    ;(http.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false, status: 422, data: null, error: 'Insufficient funds',
    })
    const sdk = new AtcWalletsSDK(http)
    const result = await sdk.debit(CHAR_ID, debitParams)
    expect(result).toBeNull()
  })
})

describe('AtcWalletsSDK.transfer', () => {
  const transferParams = {
    fromAccount: 'cash' as const,
    toAccount: 'bank' as const,
    amount: 1000,
    currency: 'ATC',
    reason: 'deposit',
    idempotencyKey: 'idem-transfer-001',
  }

  it('calls POST /api/v1/wallets/character/:characterId/transfer', async () => {
    const http = makeMockHttp()
    ;(http.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 201,
      data: { ...mockMutationResponse, type: 'transfer', cashBalance: 0, bankBalance: 6000 },
      error: null,
    })

    const sdk = new AtcWalletsSDK(http)
    const result = await sdk.transfer(CHAR_ID, transferParams)

    expect(http.post).toHaveBeenCalledWith(expect.stringContaining('/transfer'), transferParams)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('transfer')
  })

  it('returns null on failure', async () => {
    const http = makeMockHttp()
    ;(http.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false, status: 422, data: null, error: 'Insufficient funds',
    })
    const sdk = new AtcWalletsSDK(http)
    expect(await sdk.transfer(CHAR_ID, transferParams)).toBeNull()
  })
})

describe('AtcWalletsSDK.listTransactions', () => {
  it('calls GET /transactions with default params', async () => {
    const http = makeMockHttp()
    ;(http.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      data: { transactions: [], total: 0 },
      error: null,
    })

    const sdk = new AtcWalletsSDK(http)
    const result = await sdk.listTransactions(CHAR_ID)

    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('/transactions'))
    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('currency=ATC'))
    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('limit=20'))
    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('offset=0'))
    expect(result).not.toBeNull()
    expect(result!.total).toBe(0)
  })

  it('passes custom pagination params', async () => {
    const http = makeMockHttp()
    ;(http.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      data: { transactions: [], total: 50 },
      error: null,
    })

    const sdk = new AtcWalletsSDK(http)
    await sdk.listTransactions(CHAR_ID, 'USD', 10, 20)

    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('currency=USD'))
    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('limit=10'))
    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('offset=20'))
  })

  it('returns null on API failure', async () => {
    const http = makeMockHttp()
    ;(http.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false, status: 404, data: null, error: 'Not found',
    })
    const sdk = new AtcWalletsSDK(http)
    expect(await sdk.listTransactions(CHAR_ID)).toBeNull()
  })
})
