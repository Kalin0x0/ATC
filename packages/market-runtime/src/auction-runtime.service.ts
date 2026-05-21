import type { AtcEventBus } from '@atc/events'
import type { MarketPool } from './pool.js'
import type { MarketAuctionRepository, CreateAuctionParams } from './market-auction.repository.js'
import type { TaxRecordRepository } from './tax-record.repository.js'
import type { AtcMarketAuction } from './market-auction.repository.js'
import type { BankingRuntimeService } from './banking-runtime.service.js'
const AUCTION_TAX_RATE = 0.05

export class AuctionRuntimeService {
  constructor(
    private readonly auctionRepo: MarketAuctionRepository,
    private readonly bankingService: BankingRuntimeService,
    private readonly taxRepo: TaxRecordRepository,
    private readonly eventBus: AtcEventBus,
    private readonly pool: MarketPool,
  ) {}

  async createAuction(params: CreateAuctionParams): Promise<AtcMarketAuction> {
    const auction = await this.auctionRepo.create(params)

    this.eventBus
      .emit('atc:market:auction:created', {
        auctionId: auction.id,
        sellerPrincipalId: auction.sellerPrincipalId,
        itemName: auction.itemName,
      })
      .catch(() => undefined)

    return auction
  }

  async placeBid(
    auctionId: string,
    bidderPrincipalId: string,
    bidAmount: bigint,
    idempotencyKey: string,
  ): Promise<AtcMarketAuction> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      const auction = await this.auctionRepo.placeBid(
        auctionId,
        bidderPrincipalId,
        bidAmount,
        conn,
      )
      await conn.commit()
      return auction
    } catch (err) {
      try {
        await conn.rollback()
      } catch {
      }
      throw err
    } finally {
      conn.release()
    }
  }

  async settleAuction(auctionId: string): Promise<AtcMarketAuction> {
    const conn = await this.pool.getConnection()
    let settled: AtcMarketAuction
    try {
      await conn.beginTransaction()
      settled = await this.auctionRepo.complete(auctionId, conn)
      await conn.commit()
    } catch (err) {
      try {
        await conn.rollback()
      } catch {
      }
      throw err
    } finally {
      conn.release()
    }

    if (
      settled.status === 'completed' &&
      settled.currentBidderPrincipalId !== null
    ) {
      const winnerId = settled.currentBidderPrincipalId
      const finalBid = settled.currentBid
      const taxAmount = BigInt(Math.floor(Number(finalBid) * AUCTION_TAX_RATE))
      const sellerProceeds = finalBid - taxAmount

      await this.bankingService.ensureAccount(winnerId)
      await this.bankingService.ensureAccount(settled.sellerPrincipalId)

      await this.bankingService.transfer(
        winnerId,
        settled.sellerPrincipalId,
        sellerProceeds,
        `auction:${auctionId}:payment`,
        `Auction settlement: ${settled.itemName}`,
        { auctionId: settled.id },
      )

      if (taxAmount > 0n) {
        const taxRecord = await this.taxRepo.record({
          principalId: winnerId,
          taxType: 'transaction',
          amount: taxAmount,
          sourceTransactionId: auctionId,
          periodLabel: null,
        })

        await this.bankingService
          .transfer(
            winnerId,
            'government',
            taxAmount,
            `auction:${auctionId}:tax`,
            `Auction tax: ${settled.itemName}`,
            { auctionId: settled.id, taxRecordId: taxRecord.id },
          )
          .catch(async () => {
            await this.taxRepo.markCollected(taxRecord.id, auctionId).catch(() => undefined)
          })
      }

      this.eventBus
        .emit('atc:market:auction:completed', {
          auctionId: settled.id,
          winnerId,
          finalBid: finalBid.toString(),
        })
        .catch(() => undefined)
    } else {
      this.eventBus
        .emit('atc:market:auction:completed', {
          auctionId: settled.id,
          winnerId: null,
          finalBid: null,
        })
        .catch(() => undefined)
    }

    return settled
  }

  async processExpiredAuctions(): Promise<void> {
    const expired = await this.auctionRepo.listExpiredUnprocessed()
    for (const auction of expired) {
      await this.settleAuction(auction.id).catch(() => undefined)
    }
  }
}
