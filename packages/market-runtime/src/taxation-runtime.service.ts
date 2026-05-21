import type { AtcEventBus } from '@atc/events'
import type { TaxRecordRepository, RecordTaxParams, AtcTaxType } from './tax-record.repository.js'
import type { AtcTaxRecord } from './tax-record.repository.js'
import type { BankingRuntimeService } from './banking-runtime.service.js'
import { TaxRecordNotFoundError } from './errors.js'

export class TaxationRuntimeService {
  constructor(
    private readonly taxRepo: TaxRecordRepository,
    private readonly bankingService: BankingRuntimeService,
    private readonly eventBus: AtcEventBus,
  ) {}

  async calculateAndCollect(
    principalId: string,
    taxType: AtcTaxType,
    amount: bigint,
    sourceTransactionId?: string | null | undefined,
    periodLabel?: string | null | undefined,
  ): Promise<AtcTaxRecord> {
    const taxRecord = await this.taxRepo.record({
      principalId,
      taxType,
      amount,
      sourceTransactionId: sourceTransactionId ?? null,
      periodLabel: periodLabel ?? null,
    })

    const idempotencyKey = `tax:collect:${taxRecord.id}`
    await this.bankingService
      .transfer(
        principalId,
        'government',
        amount,
        idempotencyKey,
        `Tax collection: ${taxType}`,
        { taxRecordId: taxRecord.id },
      )
      .then(async (transactionId) => {
        await this.taxRepo.markCollected(taxRecord.id, transactionId).catch(() => undefined)
      })
      .catch(() => undefined)

    return taxRecord
  }

  async collectPending(principalId: string): Promise<AtcTaxRecord[]> {
    const pending = await this.taxRepo.listPendingByPrincipal(principalId)
    const collected: AtcTaxRecord[] = []

    for (const record of pending) {
      const idempotencyKey = `tax:collect:${record.id}`
      await this.bankingService
        .transfer(
          principalId,
          'government',
          record.amount,
          idempotencyKey,
          `Tax collection: ${record.taxType}`,
          { taxRecordId: record.id },
        )
        .then(async (transactionId) => {
          await this.taxRepo.markCollected(record.id, transactionId).catch(() => undefined)
          collected.push(record)
        })
        .catch(() => undefined)
    }

    return collected
  }

  async waiveTax(taxRecordId: string): Promise<void> {
    const record = await this.taxRepo.findById(taxRecordId)
    if (!record) throw new TaxRecordNotFoundError(taxRecordId)
    await this.taxRepo.waive(taxRecordId)
  }
}
