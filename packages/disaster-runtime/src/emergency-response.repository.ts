import type { RowDataPacket } from 'mysql2/promise'
import type { DisasterRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { EmergencyResponseNotFoundError } from './errors.js'

export type AtcResponseType =
  | 'fire_brigade'
  | 'medical'
  | 'police'
  | 'military'
  | 'hazmat'
  | 'search_rescue'
  | 'civil_defense'

export type AtcResponseStatus = 'dispatched' | 'on_scene' | 'withdrawn' | 'completed'

export interface AtcEmergencyResponse {
  id: string
  responseId: string
  disasterId: string | null
  responseType: AtcResponseType
  responderPrincipalId: string | null
  status: AtcResponseStatus
  dispatchedAt: Date
  arrivedAt: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface EmergencyResponseRow extends RowDataPacket {
  id: string
  response_id: string
  disaster_id: string | null
  response_type: string
  responder_principal_id: string | null
  status: string
  dispatched_at: Date
  arrived_at: Date | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function rowToEmergencyResponse(row: EmergencyResponseRow): AtcEmergencyResponse {
  return {
    id: row.id,
    responseId: row.response_id,
    disasterId: row.disaster_id,
    responseType: row.response_type as AtcResponseType,
    responderPrincipalId: row.responder_principal_id,
    status: row.status as AtcResponseStatus,
    dispatchedAt: row.dispatched_at,
    arrivedAt: row.arrived_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateEmergencyResponseParams {
  disasterId?: string | undefined
  responseType: AtcResponseType
  responderPrincipalId?: string | undefined
}

export class EmergencyResponseRepository {
  constructor(private readonly pool: DisasterRuntimePool) {}

  async findById(responseId: string): Promise<AtcEmergencyResponse | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<EmergencyResponseRow[]>(
        `SELECT * FROM atc_emergency_response WHERE response_id = ? LIMIT 1`,
        [responseId],
      )
      return rows[0] ? rowToEmergencyResponse(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listByDisaster(disasterId: string): Promise<AtcEmergencyResponse[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<EmergencyResponseRow[]>(
        `SELECT * FROM atc_emergency_response WHERE disaster_id = ? ORDER BY created_at DESC`,
        [disasterId],
      )
      return rows.map(rowToEmergencyResponse)
    } finally {
      conn.release()
    }
  }

  async create(params: CreateEmergencyResponseParams): Promise<AtcEmergencyResponse> {
    const id = generateId()
    const responseId = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_emergency_response
           (id, response_id, disaster_id, response_type, responder_principal_id, status,
            dispatched_at, arrived_at, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'dispatched', NOW(3), NULL, NULL, NOW(3), NOW(3))`,
        [
          id,
          responseId,
          params.disasterId ?? null,
          params.responseType,
          params.responderPrincipalId ?? null,
        ] as (string | number | boolean | null)[],
      )
      const [rows] = await conn.execute<EmergencyResponseRow[]>(
        `SELECT * FROM atc_emergency_response WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new EmergencyResponseNotFoundError(responseId)
      return rowToEmergencyResponse(rows[0])
    } finally {
      conn.release()
    }
  }

  async transition(responseId: string, status: AtcResponseStatus): Promise<AtcEmergencyResponse> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<EmergencyResponseRow[]>(
          `SELECT * FROM atc_emergency_response WHERE response_id = ? LIMIT 1 FOR UPDATE`,
          [responseId],
        )
        if (!rows[0]) {
          await conn.rollback()
          throw new EmergencyResponseNotFoundError(responseId)
        }

        const arrivedAtClause = status === 'on_scene' ? ', arrived_at = NOW(3)' : ''
        const completedAtClause = status === 'completed' ? ', completed_at = NOW(3)' : ''

        await conn.execute(
          `UPDATE atc_emergency_response
           SET status = ? ${arrivedAtClause}${completedAtClause}, updated_at = NOW(3)
           WHERE response_id = ?`,
          [status, responseId] as (string | number | boolean | null)[],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const [updated] = await conn.execute<EmergencyResponseRow[]>(
        `SELECT * FROM atc_emergency_response WHERE response_id = ? LIMIT 1`,
        [responseId],
      )
      if (!updated[0]) throw new EmergencyResponseNotFoundError(responseId)
      return rowToEmergencyResponse(updated[0])
    } finally {
      conn.release()
    }
  }
}
