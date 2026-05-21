import type { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise'
import type { HousingEconomyPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicatePaymentError, HousingPaymentNotFoundError } from './errors.js'

export type AtcPaymentType = 'rent' | 'deposit' | 'tax' | 'penalty' | 'refund'
export type AtcPaymentStatus = 'pending' | 'completed' | 'failed' | 'reversed'

export interface AtcHousingPayment {
  id: string
  contractId: string | null
  fromPrincipalId: string
  toPrincipalId: string
  amount: bigint
  paymentType: AtcPaymentType
  status: AtcPaymentStatus
  idempotencyKey: string
  description: string | null
  createdAt: Date
  completedAt: Date | null
}

export interface RecordPaymentParams {
  contractId?: string | null | undefined
  fromPrincipalId: string
  toPrincipalId: string
  amount: bigint
  paymentType: AtcPaymentType
  idempotencyKey: string
  description?: string | null | undefined
}

interface HousingPaymentRow extends RowDataPacket {
  id: string
  contract_id: string | null
  from_principal_id: string
  to_principal_id: string
  amount: string
  payment_type: string
  status: string
  idempotency_key: string
  description: string | null
  created_at: Date
  completed_at: Date | null
}

function rowToPayment(row: HousingPaymentRow): AtcHousingPayment {
  return {
    id: row.id,
    contractId: row.contract_id,
    fromPrincipalId: row.from_principal_id,
    toPrincipalId: row.to_principal_id,
    amount: BigInt(row.amount),
    paymentType: row.payment_type as AtcPaymentType,
    status: row.status as AtcPaymentStatus,
    idempotencyKey: row.idempotency_key,
    description: row.description,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  }
}

export class HousingPaymentRepository {
  constructor(private readonly pool: HousingEconomyPool) {}

  async record(
    params: RecordPaymentParams,
    conn?: PoolConnection,
  ): Promise<AtcHousingPayment> {
    const ownConn = conn === undefined
    const c = conn ?? (await this.pool.getConnection())
    try {
      const id = generateId()
      const contractId = params.contractId ?? null
      const description = params.description ?? null

      try {
        await c.execute<ResultSetHeader>(
          `INSERT INTO atc_housing_payments
             (id, contract_id, from_principal_id, to_principal_id, amount,
              payment_type, status, idempotency_key, description, created_at, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, NOW(3), NULL)`,
          [
            id,
            contractId,
            params.fromPrincipalId,
            params.toPrincipalId,
            params.amount.toString(),
            params.paymentType,
            params.idempotencyKey,
            description,
          ],
        )
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicatePaymentError(params.idempotencyKey)
        }
        throw err
      }

      const [rows] = await c.execute<HousingPaymentRow[]>(
        'SELECT * FROM atc_housing_payments WHERE id = ? LIMIT 1',
        [id],
      )
      return rowToPayment(rows[0]!)
    } finally {
      if (ownConn) c.release()
    }
  }

  async complete(id: string, conn?: PoolConnection): Promise<AtcHousingPayment> {
    const ownConn = conn === undefined
    const c = conn ?? (await this.pool.getConnection())
    try {
      const [result] = await c.execute<ResultSetHeader>(
        `UPDATE atc_housing_payments
         SET status = 'completed', completed_at = NOW(3)
         WHERE id = ?`,
        [id],
      )
      if (result.affectedRows === 0) throw new HousingPaymentNotFoundError(id)

      const [rows] = await c.execute<HousingPaymentRow[]>(
        'SELECT * FROM atc_housing_payments WHERE id = ? LIMIT 1',
        [id],
      )
      if (!rows[0]) throw new HousingPaymentNotFoundError(id)
      return rowToPayment(rows[0])
    } finally {
      if (ownConn) c.release()
    }
  }

  async findByIdempotencyKey(key: string): Promise<AtcHousingPayment | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<HousingPaymentRow[]>(
        'SELECT * FROM atc_housing_payments WHERE idempotency_key = ? LIMIT 1',
        [key],
      )
      return rows[0] ? rowToPayment(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listByContract(contractId: string): Promise<AtcHousingPayment[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<HousingPaymentRow[]>(
        `SELECT * FROM atc_housing_payments
         WHERE contract_id = ?
         ORDER BY created_at DESC`,
        [contractId],
      )
      return rows.map(rowToPayment)
    } finally {
      conn.release()
    }
  }
}
