import type { ResultSetHeader } from 'mysql2/promise'
import type { RuntimeGatewayPool } from './pool.js'
import { generateId } from './id.js'

export class GatewayAuditRepository {
  constructor(private readonly pool: RuntimeGatewayPool) {}

  async append(gatewayId: string, eventType: string, eventData: Record<string, unknown>): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_gateway_audit (id, gateway_id, event_type, event_data, occurred_at) VALUES (?, ?, ?, ?, NOW(3))`,
        [generateId(), gatewayId, eventType, JSON.stringify(eventData)] as unknown[]
      )
    } finally { conn.release() }
  }
}
