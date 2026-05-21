import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { HousingEconomyPool } from './pool.js'
import { generateId } from './id.js'
import {
  RentalContractNotFoundError,
  RentalContractAlreadyActiveError,
} from './errors.js'

export type AtcRentalStatus = 'active' | 'expired' | 'terminated' | 'suspended'

export interface AtcRentalContract {
  id: string
  propertyId: string
  tenantPrincipalId: string
  landlordPrincipalId: string
  rentAmount: bigint
  depositAmount: bigint
  rentCycledays: number
  startDate: Date
  endDate: Date | null
  lastPaymentAt: Date | null
  nextPaymentDueAt: Date
  status: AtcRentalStatus
  contractNonce: string
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateContractParams {
  propertyId: string
  tenantPrincipalId: string
  landlordPrincipalId: string
  rentAmount: bigint
  depositAmount?: bigint | undefined
  rentCycleDays?: number | undefined
  startDate?: Date | undefined
  endDate?: Date | null | undefined
  contractNonce: string
  notes?: string | null | undefined
}

export interface TransitionContractOpts {
  notes?: string | null | undefined
}

interface RentalContractRow extends RowDataPacket {
  id: string
  property_id: string
  tenant_principal_id: string
  landlord_principal_id: string
  rent_amount: string
  deposit_amount: string
  rent_cycle_days: number
  start_date: Date
  end_date: Date | null
  last_payment_at: Date | null
  next_payment_due_at: Date
  status: string
  contract_nonce: string
  notes: string | null
  created_at: Date
  updated_at: Date
}

function rowToContract(row: RentalContractRow): AtcRentalContract {
  return {
    id: row.id,
    propertyId: row.property_id,
    tenantPrincipalId: row.tenant_principal_id,
    landlordPrincipalId: row.landlord_principal_id,
    rentAmount: BigInt(row.rent_amount),
    depositAmount: BigInt(row.deposit_amount),
    rentCycledays: Number(row.rent_cycle_days),
    startDate: row.start_date,
    endDate: row.end_date,
    lastPaymentAt: row.last_payment_at,
    nextPaymentDueAt: row.next_payment_due_at,
    status: row.status as AtcRentalStatus,
    contractNonce: row.contract_nonce,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const ALLOWED_CONTRACT_TRANSITIONS: Record<AtcRentalStatus, AtcRentalStatus[]> = {
  active: ['expired', 'terminated', 'suspended'],
  suspended: ['active', 'terminated'],
  expired: [],
  terminated: [],
}

export class RentalContractRepository {
  constructor(private readonly pool: HousingEconomyPool) {}

  async create(params: CreateContractParams): Promise<AtcRentalContract> {
    const id = generateId()
    const depositAmount = params.depositAmount ?? 0n
    const rentCycleDays = params.rentCycleDays ?? 7
    const startDate = params.startDate ?? new Date()
    const endDate = params.endDate ?? null
    const notes = params.notes ?? null

    const conn = await this.pool.getConnection()
    try {
      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_rental_contracts
             (id, property_id, tenant_principal_id, landlord_principal_id, rent_amount,
              deposit_amount, rent_cycle_days, start_date, end_date, last_payment_at,
              next_payment_due_at, status, contract_nonce, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'active', ?, ?, NOW(3), NOW(3))
           ON DUPLICATE KEY UPDATE id = id`,
          [
            id,
            params.propertyId,
            params.tenantPrincipalId,
            params.landlordPrincipalId,
            params.rentAmount.toString(),
            depositAmount.toString(),
            rentCycleDays,
            startDate,
            endDate,
            startDate,
            params.contractNonce,
            notes,
          ],
        )
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
          const existing = await this.findByNonce(params.contractNonce)
          if (existing) return existing
          throw new RentalContractAlreadyActiveError(params.contractNonce)
        }
        throw err
      }

      const existing = await this.findByNonce(params.contractNonce)
      if (existing) return existing

      const [rows] = await conn.execute<RentalContractRow[]>(
        'SELECT * FROM atc_rental_contracts WHERE id = ? LIMIT 1',
        [id],
      )
      if (!rows[0]) throw new RentalContractNotFoundError(id)
      return rowToContract(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcRentalContract | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RentalContractRow[]>(
        'SELECT * FROM atc_rental_contracts WHERE id = ? LIMIT 1',
        [id],
      )
      return rows[0] ? rowToContract(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findByPropertyId(propertyId: string): Promise<AtcRentalContract | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RentalContractRow[]>(
        "SELECT * FROM atc_rental_contracts WHERE property_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
        [propertyId],
      )
      return rows[0] ? rowToContract(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findByNonce(nonce: string): Promise<AtcRentalContract | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RentalContractRow[]>(
        'SELECT * FROM atc_rental_contracts WHERE contract_nonce = ? LIMIT 1',
        [nonce],
      )
      return rows[0] ? rowToContract(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async transition(
    id: string,
    status: AtcRentalStatus,
    opts?: TransitionContractOpts,
  ): Promise<AtcRentalContract> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      const [rows] = await conn.execute<RentalContractRow[]>(
        'SELECT * FROM atc_rental_contracts WHERE id = ? FOR UPDATE',
        [id],
      )
      const row = rows[0]
      if (!row) {
        await conn.rollback()
        throw new RentalContractNotFoundError(id)
      }

      const current = row.status as AtcRentalStatus
      const allowed = ALLOWED_CONTRACT_TRANSITIONS[current]
      if (!allowed.includes(status)) {
        await conn.rollback()
        throw new RentalContractNotFoundError(id)
      }

      const notes = opts?.notes ?? null

      await conn.execute(
        `UPDATE atc_rental_contracts
         SET status = ?, notes = COALESCE(?, notes), updated_at = NOW(3)
         WHERE id = ?`,
        [status, notes, id],
      )

      const [updated] = await conn.execute<RentalContractRow[]>(
        'SELECT * FROM atc_rental_contracts WHERE id = ? LIMIT 1',
        [id],
      )
      await conn.commit()
      return rowToContract(updated[0]!)
    } catch (err) {
      try { await conn.rollback() } catch { /* ignore */ }
      throw err
    } finally {
      conn.release()
    }
  }

  async updatePaymentDates(
    id: string,
    lastPaymentAt: Date,
    nextPaymentDueAt: Date,
  ): Promise<AtcRentalContract> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_rental_contracts
         SET last_payment_at = ?, next_payment_due_at = ?, updated_at = NOW(3)
         WHERE id = ?`,
        [lastPaymentAt, nextPaymentDueAt, id],
      )
      const [rows] = await conn.execute<RentalContractRow[]>(
        'SELECT * FROM atc_rental_contracts WHERE id = ? LIMIT 1',
        [id],
      )
      if (!rows[0]) throw new RentalContractNotFoundError(id)
      return rowToContract(rows[0])
    } finally {
      conn.release()
    }
  }

  async listOverdue(): Promise<AtcRentalContract[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RentalContractRow[]>(
        `SELECT * FROM atc_rental_contracts
         WHERE status = 'active' AND next_payment_due_at < NOW(3)
         ORDER BY next_payment_due_at ASC`,
      )
      return rows.map(rowToContract)
    } finally {
      conn.release()
    }
  }
}
