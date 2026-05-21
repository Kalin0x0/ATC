import type { RowDataPacket } from 'mysql2/promise'
import type { PoolConnection, CombatSimulationPool } from './pool.js'
import { generateId } from './id.js'

interface CombatAuditRow extends RowDataPacket {
  id: string
  session_id: string | null
  event_type: string
  entity_id: string | null
  audit_data: string
  created_at: Date
}

export interface AtcCombatAuditRecord {
  id: string
  sessionId: string | null
  eventType: string
  entityId: string | null
  auditData: Record<string, unknown>
  createdAt: Date
}

export interface AppendAuditParams {
  sessionId?: string
  eventType: string
  entityId?: string
  auditData?: Record<string, unknown>
}

export class CombatAuditRepository {
  constructor(private pool: CombatSimulationPool) {}

  async append(params: AppendAuditParams): Promise<void> {
    const id = generateId()
    const auditData = JSON.stringify(params.auditData ?? {})
    const sessionId = params.sessionId ?? null
    const entityId = params.entityId ?? null
    let conn: PoolConnection | null = null
    try {
      conn = await this.pool.getConnection()
      await conn.execute(
        `INSERT INTO atc_combat_audit
          (id, session_id, event_type, entity_id, audit_data, created_at)
         VALUES (?, ?, ?, ?, ?, NOW(3))`,
        [id, sessionId, params.eventType, entityId, auditData]
      )
    } finally {
      conn?.release()
    }
  }
}
