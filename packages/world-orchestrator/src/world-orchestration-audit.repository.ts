import type { RowDataPacket } from 'mysql2/promise'
import type { WorldOrchestratorPool } from './pool.js'
import { generateId } from './id.js'

interface AtcWorldOrchestrationAuditRow extends RowDataPacket {
  id: string
  subject_id: string
  action: string
  server_id: string | null
  detail: string | null
  occurred_at: Date
}

export class WorldOrchestrationAuditRepository {
  constructor(private readonly pool: WorldOrchestratorPool) {}

  async record(
    subjectId: string,
    action: string,
    serverId?: string | undefined,
    detail?: Record<string, unknown> | undefined,
  ): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const detailJson = detail !== undefined ? JSON.stringify(detail) : null

      await conn.execute<AtcWorldOrchestrationAuditRow[]>(
        `INSERT INTO atc_world_orchestration_audit
           (id, subject_id, action, server_id, detail, occurred_at)
         VALUES (?, ?, ?, ?, ?, NOW(3))`,
        [id, subjectId, action, serverId ?? null, detailJson],
      )
    } finally {
      conn.release()
    }
  }
}
