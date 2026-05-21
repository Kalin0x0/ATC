import type { AtcBlackMarketTransaction } from '@atc/shared-types'
import type { BlackMarketRepository } from './black-market.repository.js'

export interface IllegalTradeDeps {
  blackMarketRepo: BlackMarketRepository
}

export class IllegalTradeService {
  private readonly blackMarketRepo: BlackMarketRepository

  constructor(deps: IllegalTradeDeps) {
    this.blackMarketRepo = deps.blackMarketRepo
  }

  async getTradeHistory(
    principalId: string,
    role: 'seller' | 'buyer',
    limit?: number,
  ): Promise<AtcBlackMarketTransaction[]> {
    if (role === 'seller') {
      return this.blackMarketRepo.listBySeller(principalId, limit)
    }
    return this.blackMarketRepo.listByBuyer(principalId, limit)
  }

  async getTradeById(id: string): Promise<AtcBlackMarketTransaction | null> {
    return this.blackMarketRepo.findById(id)
  }
}
