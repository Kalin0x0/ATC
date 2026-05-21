import type { AtcBlackMarketTransaction } from '@atc/shared-types'
import { ATC_CRIMINAL_EVENTS } from '@atc/shared-types'
import type { AtcEventBus } from '@atc/events'
import type { BlackMarketRepository } from './black-market.repository.js'
export interface BlackMarketDeps {
  blackMarketRepo: BlackMarketRepository
  eventBus: AtcEventBus | undefined
}

export interface RecordTradeServiceParams {
  sellerPrincipalId: string
  buyerPrincipalId: string
  itemName: string
  quantity: number
  price: number
  locationLabel?: string | undefined
}

export class BlackMarketService {
  private readonly blackMarketRepo: BlackMarketRepository
  private readonly eventBus: AtcEventBus | undefined

  constructor(deps: BlackMarketDeps) {
    this.blackMarketRepo = deps.blackMarketRepo
    this.eventBus        = deps.eventBus
  }

  async recordTrade(params: RecordTradeServiceParams): Promise<AtcBlackMarketTransaction> {
    const tx = await this.blackMarketRepo.record({
      sellerPrincipalId: params.sellerPrincipalId,
      buyerPrincipalId: params.buyerPrincipalId,
      itemName: params.itemName,
      quantity: params.quantity,
      price: params.price,
      locationLabel: params.locationLabel,
    })

    // Immediately complete the transaction
    await this.blackMarketRepo.complete(tx.id)

    // Re-fetch with the updated completed_at
    const completed = await this.blackMarketRepo.findById(tx.id)
    const result = completed ?? tx

    this.eventBus?.emit(ATC_CRIMINAL_EVENTS.BLACK_MARKET_TRADE, {
      transactionId: result.id,
      sellerPrincipalId: result.sellerPrincipalId,
      buyerPrincipalId: result.buyerPrincipalId,
      itemName: result.itemName,
      quantity: result.quantity,
      price: result.price,
      locationLabel: result.locationLabel,
    }).catch(() => undefined)

    return result
  }

  async findById(id: string): Promise<AtcBlackMarketTransaction | null> {
    return this.blackMarketRepo.findById(id)
  }

  async listBySeller(principalId: string, limit?: number): Promise<AtcBlackMarketTransaction[]> {
    return this.blackMarketRepo.listBySeller(principalId, limit)
  }

  async listByBuyer(principalId: string, limit?: number): Promise<AtcBlackMarketTransaction[]> {
    return this.blackMarketRepo.listByBuyer(principalId, limit)
  }
}
