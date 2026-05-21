import type { ResultSetHeader } from 'mysql2/promise'
import type { EvolutionRuntimePool } from './pool.js'
import { generateId } from './id.js'

export interface AppendEvolutionAuditParams {
  eventType: string
  evolutionId?: string | undefined
  entityId?: string | undefined
  ownerServerId?: string | undefined
  auditData?: Record<string, unknown> | undefined
}

export class EvolutionAuditRepository {
  constructor(private readonly pool: EvolutionRuntimePool) {}

  async append(params: AppendEvolutionAuditParams): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_evolution_audit
           (id, event_type, evolution_id, entity_id, owner_server_id, audit_data, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          id,
          params.eventType,
          params.evolutionId ?? null,
          params.entityId ?? null,
          params.ownerServerId ?? null,
          JSON.stringify(params.auditData ?? {}),
        ] as (string | null)[],
      )
    } finally {
      conn.release()
    }
  }
}
