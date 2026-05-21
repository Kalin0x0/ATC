import type { AtcHttpClient } from './http-client.js'
import type {
  AtcWalletBalanceResponse,
  AtcWalletMutationResponse,
  AtcWalletTransactionListResponse,
  AtcWalletCreditRequest,
  AtcWalletDebitRequest,
  AtcWalletTransferRequest,
} from '@atc/shared-types'

export class AtcWalletsSDK {
  constructor(private readonly http: AtcHttpClient) {}

  async getBalance(characterId: string, currency = 'ATC'): Promise<AtcWalletBalanceResponse | null> {
    const res = await this.http.get<AtcWalletBalanceResponse>(
      `/api/v1/wallets/character/${characterId}?currency=${encodeURIComponent(currency)}`,
    )
    return res.ok ? res.data : null
  }

  async credit(
    characterId: string,
    params: AtcWalletCreditRequest,
  ): Promise<AtcWalletMutationResponse | null> {
    const res = await this.http.post<AtcWalletMutationResponse>(
      `/api/v1/wallets/character/${characterId}/credit`,
      params,
    )
    return res.ok ? res.data : null
  }

  async debit(
    characterId: string,
    params: AtcWalletDebitRequest,
  ): Promise<AtcWalletMutationResponse | null> {
    const res = await this.http.post<AtcWalletMutationResponse>(
      `/api/v1/wallets/character/${characterId}/debit`,
      params,
    )
    return res.ok ? res.data : null
  }

  async transfer(
    characterId: string,
    params: AtcWalletTransferRequest,
  ): Promise<AtcWalletMutationResponse | null> {
    const res = await this.http.post<AtcWalletMutationResponse>(
      `/api/v1/wallets/character/${characterId}/transfer`,
      params,
    )
    return res.ok ? res.data : null
  }

  async listTransactions(
    characterId: string,
    currency = 'ATC',
    limit = 20,
    offset = 0,
  ): Promise<AtcWalletTransactionListResponse | null> {
    const qs = new URLSearchParams({
      currency,
      limit: String(limit),
      offset: String(offset),
    })
    const res = await this.http.get<AtcWalletTransactionListResponse>(
      `/api/v1/wallets/character/${characterId}/transactions?${qs.toString()}`,
    )
    return res.ok ? res.data : null
  }
}
