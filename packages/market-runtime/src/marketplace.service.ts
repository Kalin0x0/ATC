import type { AtcEventBus } from '@atc/events'
import type { MarketListingRepository, CreateListingParams } from './market-listing.repository.js'
import type { TaxRecordRepository } from './tax-record.repository.js'
import type { AtcMarketListing } from './market-listing.repository.js'
import type { BankingRuntimeService } from './banking-runtime.service.js'
import { ListingNotFoundError } from './errors.js'

const MARKETPLACE_TAX_RATE = 0.05

export class MarketplaceService {
  constructor(
    private readonly listingRepo: MarketListingRepository,
    private readonly bankingService: BankingRuntimeService,
    private readonly taxRepo: TaxRecordRepository,
    private readonly eventBus: AtcEventBus,
  ) {}

  async createListing(params: CreateListingParams): Promise<AtcMarketListing> {
    const listing = await this.listingRepo.create(params)

    this.eventBus
      .emit('atc:market:listing:created', {
        listingId: listing.id,
        sellerPrincipalId: listing.sellerPrincipalId,
        itemName: listing.itemName,
      })
      .catch(() => undefined)

    return listing
  }

  async purchaseListing(
    listingId: string,
    buyerPrincipalId: string,
    idempotencyKey: string,
  ): Promise<AtcMarketListing> {
    const listing = await this.listingRepo.findById(listingId)
    if (!listing) throw new ListingNotFoundError(listingId)

    const totalPrice = listing.totalPrice
    const taxAmount = BigInt(Math.floor(Number(totalPrice) * MARKETPLACE_TAX_RATE))
    const sellerProceeds = totalPrice - taxAmount

    await this.bankingService.ensureAccount(buyerPrincipalId)
    await this.bankingService.ensureAccount(listing.sellerPrincipalId)

    await this.bankingService.transfer(
      buyerPrincipalId,
      listing.sellerPrincipalId,
      sellerProceeds,
      `${idempotencyKey}:seller`,
      `Marketplace purchase: ${listing.itemName}`,
      { listingId: listing.id },
    )

    if (taxAmount > 0n) {
      const taxRecord = await this.taxRepo.record({
        principalId: buyerPrincipalId,
        taxType: 'transaction',
        amount: taxAmount,
        sourceTransactionId: listingId,
        periodLabel: null,
      })

      await this.bankingService
        .transfer(
          buyerPrincipalId,
          'government',
          taxAmount,
          `${idempotencyKey}:tax`,
          `Marketplace tax: ${listing.itemName}`,
          { listingId: listing.id, taxRecordId: taxRecord.id },
        )
        .catch(async () => {
          await this.taxRepo.markCollected(taxRecord.id, listingId).catch(() => undefined)
        })
    }

    const sold = await this.listingRepo.purchase(listingId, buyerPrincipalId)

    this.eventBus
      .emit('atc:market:listing:sold', {
        listingId: sold.id,
        buyerPrincipalId,
        amount: totalPrice.toString(),
      })
      .catch(() => undefined)

    return sold
  }

  async cancelListing(listingId: string, sellerPrincipalId: string): Promise<void> {
    await this.listingRepo.cancel(listingId, sellerPrincipalId)
  }

  async getActiveListings(
    limit: number,
    offset: number,
  ): Promise<AtcMarketListing[]> {
    return this.listingRepo.listActive(limit, offset)
  }

  async pruneExpired(): Promise<number> {
    return this.listingRepo.pruneExpired()
  }
}
