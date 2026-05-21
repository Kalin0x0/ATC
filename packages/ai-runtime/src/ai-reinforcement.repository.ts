import type { RowDataPacket } from 'mysql2/promise'
import { generateId } from './id.js'
import { DuplicateReinforcementNonceError, ReinforcementNotFoundError } from './errors.js'
import type { AiRuntimePool } from './pool.js'

export type AtcReinforcementType = 'ground' | 'air' | 'vehicle' | 'special_ops' | 'medical' | 'support' | 'custom'
export type AtcReinforcementStatus = 'requested' | 'dispatched' | 'arrived' | 'withdrawn' | 'cancelled'

export interface AtcAiReinforcement {
  id: string
  reinforcementId: string
  reinforcementNonce: string
  requestingEntityId: string | null
  reinforcementType: AtcReinforcementType
  status: AtcReinforcementStatus
  quantity: number
  ownerServerId: string | null
  dispatchedAt: Date | null
  arrivedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface AtcAiReinforcementRow extends RowDataPacket {
  id: string
  reinforcement_id: string
  reinforcement_nonce: string
  requesting_entity_id: string | null
  reinforcement_type: string
  status: string
  quantity: number
  owner_server_id: string | null
  dispatched_at: Date | null
  arrived_at: Date | null
  created_at: Date
  updated_at: Date
}

function rowToReinforcement(row: AtcAiReinforcementRow): AtcAiReinforcement {
  return {
    id: row.id,
    reinforcementId: row.reinforcement_id,
    reinforcementNonce: row.reinforcement_nonce,
    requestingEntityId: row.requesting_entity_id,
    reinforcementType: row.reinforcement_type as AtcReinforcementType,
    status: row.status as AtcReinforcementStatus,
    quantity: row.quantity,
    ownerServerId: row.owner_server_id,
    dispatchedAt: row.dispatched_at,
    arrivedAt: row.arrived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateReinforcementParams {
  reinforcementNonce: string
  requestingEntityId?: string
  reinforcementType: AtcReinforcementType
  quantity?: number
  ownerServerId?: string
}

export class AiReinforcementRepository {
  constructor(private readonly pool: AiRuntimePool) {}

  async findById(reinforcementId: string): Promise<AtcAiReinforcement | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AtcAiReinforcementRow[]>(
        'SELECT * FROM atc_ai_reinforcements WHERE reinforcement_id = ?',
        [reinforcementId],
      )
      const row = rows[0]
      return row !== undefined ? rowToReinforcement(row) : null
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcAiReinforcement[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AtcAiReinforcementRow[]>(
        "SELECT * FROM atc_ai_reinforcements WHERE status IN ('requested', 'dispatched', 'arrived')",
        [],
      )
      return rows.map(rowToReinforcement)
    } finally {
      conn.release()
    }
  }

  async create(params: CreateReinforcementParams): Promise<AtcAiReinforcement> {
    const {
      reinforcementNonce,
      reinforcementType,
      quantity = 1,
      ownerServerId = null,
    } = params

    const requestingEntityId = params.requestingEntityId ?? null
    const id = generateId()
    const reinforcementId = generateId()

    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_ai_reinforcements
           (id, reinforcement_id, reinforcement_nonce, requesting_entity_id, reinforcement_type, status, quantity, owner_server_id, dispatched_at, arrived_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'requested', ?, ?, NULL, NULL, NOW(3), NOW(3))`,
        [id, reinforcementId, reinforcementNonce, requestingEntityId, reinforcementType, quantity, ownerServerId],
      )
      const result = await this.findById(reinforcementId)
      return result!
    } catch (err: unknown) {
      if (isDbError(err) && err.code === 'ER_DUP_ENTRY') {
        throw new DuplicateReinforcementNonceError(reinforcementNonce)
      }
      throw err
    } finally {
      conn.release()
    }
  }

  async transition(reinforcementId: string, status: AtcReinforcementStatus): Promise<AtcAiReinforcement> {
    const conn = await this.pool.getConnection()
    let committed = false
    try {
      await conn.beginTransaction()
      const [rows] = await conn.execute<AtcAiReinforcementRow[]>(
        'SELECT * FROM atc_ai_reinforcements WHERE reinforcement_id = ? FOR UPDATE',
        [reinforcementId],
      )
      if (rows.length === 0) {
        throw new ReinforcementNotFoundError(reinforcementId)
      }

      if (status === 'dispatched') {
        await conn.execute(
          'UPDATE atc_ai_reinforcements SET status = ?, dispatched_at = NOW(3), updated_at = NOW(3) WHERE reinforcement_id = ?',
          [status, reinforcementId],
        )
      } else if (status === 'arrived') {
        await conn.execute(
          'UPDATE atc_ai_reinforcements SET status = ?, arrived_at = NOW(3), updated_at = NOW(3) WHERE reinforcement_id = ?',
          [status, reinforcementId],
        )
      } else {
        await conn.execute(
          'UPDATE atc_ai_reinforcements SET status = ?, updated_at = NOW(3) WHERE reinforcement_id = ?',
          [status, reinforcementId],
        )
      }

      await conn.commit()
      committed = true
      const result = await this.findById(reinforcementId)
      return result!
    } catch (err) {
      if (!committed) await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  async deleteById(reinforcementId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        'DELETE FROM atc_ai_reinforcements WHERE reinforcement_id = ?',
        [reinforcementId],
      )
    } finally {
      conn.release()
    }
  }
}

function isDbError(err: unknown): err is { code: string } {
  return typeof err === 'object' && err !== null && 'code' in err
}
