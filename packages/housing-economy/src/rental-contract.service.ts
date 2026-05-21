import type { AtcEventBus } from '@atc/events'
import type { HousingEconomyPool } from './pool.js'
import type {
  RentalContractRepository,
  AtcRentalContract,
  CreateContractParams,
} from './rental-contract.repository.js'
import type {
  HousingPaymentRepository,
  AtcHousingPayment,
} from './housing-payment.repository.js'
import type { TenantHistoryRepository } from './tenant-history.repository.js'
import {
  RentalContractNotFoundError,
  RentalContractTerminatedError,
  DuplicatePaymentError,
} from './errors.js'

export class RentalContractService {
  constructor(
    private readonly contractRepo: RentalContractRepository,
    private readonly paymentRepo: HousingPaymentRepository,
    private readonly tenantHistoryRepo: TenantHistoryRepository,
    private readonly pool: HousingEconomyPool,
    private readonly eventBus: AtcEventBus,
  ) {}

  async createContract(params: CreateContractParams): Promise<AtcRentalContract> {
    const existing = await this.contractRepo.findByNonce(params.contractNonce)
    if (existing) return existing

    const contract = await this.contractRepo.create(params)

    await this.tenantHistoryRepo.record({
      contractId: contract.id,
      propertyId: contract.propertyId,
      tenantPrincipalId: contract.tenantPrincipalId,
      action: 'created',
      performedByPrincipalId: contract.landlordPrincipalId,
    })

    this.eventBus
      .emit('atc:housing:contract:created', {
        contractId: contract.id,
        propertyId: contract.propertyId,
        tenantPrincipalId: contract.tenantPrincipalId,
        landlordPrincipalId: contract.landlordPrincipalId,
        rentAmount: contract.rentAmount.toString(),
      })
      .catch(() => undefined)

    return contract
  }

  async renewContract(
    contractId: string,
    opts?: { newEndDate?: Date | undefined },
  ): Promise<AtcRentalContract> {
    const contract = await this.contractRepo.findById(contractId)
    if (!contract) throw new RentalContractNotFoundError(contractId)
    if (contract.status === 'terminated') {
      throw new RentalContractTerminatedError(contractId)
    }

    const updated = await this.contractRepo.transition(contractId, 'active', {
      notes: 'Contract renewed',
    })

    if (opts?.newEndDate !== undefined) {
      const conn = await this.pool.getConnection()
      try {
        await conn.execute(
          `UPDATE atc_rental_contracts SET end_date = ?, updated_at = NOW(3) WHERE id = ?`,
          [opts.newEndDate, contractId],
        )
      } finally {
        conn.release()
      }

      const refreshed = await this.contractRepo.findById(contractId)
      if (!refreshed) throw new RentalContractNotFoundError(contractId)

      this.eventBus
        .emit('atc:housing:contract:renewed', {
          contractId: refreshed.id,
          propertyId: refreshed.propertyId,
          newEndDate: refreshed.endDate?.toISOString() ?? null,
        })
        .catch(() => undefined)

      return refreshed
    }

    this.eventBus
      .emit('atc:housing:contract:renewed', {
        contractId: updated.id,
        propertyId: updated.propertyId,
        newEndDate: updated.endDate?.toISOString() ?? null,
      })
      .catch(() => undefined)

    return updated
  }

  async terminateContract(
    contractId: string,
    terminatedByPrincipalId: string,
    reason: string,
  ): Promise<AtcRentalContract> {
    const contract = await this.contractRepo.findById(contractId)
    if (!contract) throw new RentalContractNotFoundError(contractId)
    if (contract.status === 'terminated') {
      throw new RentalContractTerminatedError(contractId)
    }

    const updated = await this.contractRepo.transition(contractId, 'terminated', {
      notes: reason,
    })

    await this.tenantHistoryRepo.record({
      contractId: contract.id,
      propertyId: contract.propertyId,
      tenantPrincipalId: contract.tenantPrincipalId,
      action: 'terminated',
      performedByPrincipalId: terminatedByPrincipalId,
      notes: reason,
    })

    this.eventBus
      .emit('atc:housing:contract:terminated', {
        contractId: updated.id,
        propertyId: updated.propertyId,
        tenantPrincipalId: updated.tenantPrincipalId,
        terminatedByPrincipalId,
        reason,
      })
      .catch(() => undefined)

    return updated
  }

  async collectRent(
    contractId: string,
    idempotencyKey: string,
  ): Promise<AtcHousingPayment> {
    const contract = await this.contractRepo.findById(contractId)
    if (!contract) throw new RentalContractNotFoundError(contractId)
    if (contract.status !== 'active') {
      throw new RentalContractTerminatedError(contractId)
    }

    const existing = await this.paymentRepo.findByIdempotencyKey(idempotencyKey)
    if (existing) return existing

    const conn = await this.pool.getConnection()
    let payment: AtcHousingPayment
    try {
      await conn.beginTransaction()

      try {
        payment = await this.paymentRepo.record(
          {
            contractId: contract.id,
            fromPrincipalId: contract.tenantPrincipalId,
            toPrincipalId: contract.landlordPrincipalId,
            amount: contract.rentAmount,
            paymentType: 'rent',
            idempotencyKey,
            description: `Rent payment for property ${contract.propertyId}`,
          },
          conn,
        )
      } catch (err: unknown) {
        await conn.rollback()
        if (err instanceof DuplicatePaymentError) {
          const dup = await this.paymentRepo.findByIdempotencyKey(idempotencyKey)
          if (dup) return dup
        }
        throw err
      }

      payment = await this.paymentRepo.complete(payment.id, conn)

      await conn.commit()
    } catch (err) {
      try { await conn.rollback() } catch { /* ignore */ }
      throw err
    } finally {
      conn.release()
    }

    const now = new Date()
    const nextDue = new Date(now)
    nextDue.setDate(nextDue.getDate() + contract.rentCycledays)
    await this.contractRepo.updatePaymentDates(contract.id, now, nextDue)

    this.eventBus
      .emit('atc:housing:rent:collected', {
        paymentId: payment.id,
        contractId: contract.id,
        propertyId: contract.propertyId,
        fromPrincipalId: contract.tenantPrincipalId,
        toPrincipalId: contract.landlordPrincipalId,
        amount: contract.rentAmount.toString(),
      })
      .catch(() => undefined)

    return payment
  }

  async listOverdueContracts(): Promise<AtcRentalContract[]> {
    return this.contractRepo.listOverdue()
  }
}
