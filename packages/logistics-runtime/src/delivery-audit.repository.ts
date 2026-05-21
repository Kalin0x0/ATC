import type { RowDataPacket } from 'mysql2'
import type { LogisticsRuntimePool } from './pool.js'
import { generateId } from './id.js'

export interface AtcDeliveryAudit {
  id: string
  auditId: string
  shipmentId: string
  action: string
  performedByPrincipalId: string | null
  note: string | null
  createdAt: Date
}

interface DeliveryAuditRow extends RowDataPacket {
  id: string
  audit_id: string
  shipment_id: string
  action: string
  performed_by_principal_id: string | null
  note: string | null
  created_at: Date
}

function rowToAudit(row: DeliveryAuditRow): AtcDeliveryAudit {
  return {
    id: row.id,
    auditId: row.audit_id,
    shipmentId: row.shipment_id,
    action: row.action,
    performedByPrincipalId: row.performed_by_principal_id,
    note: row.note,
    createdAt: row.created_at,
  }
}

export class DeliveryAuditRepository {
  constructor(private readonly pool: LogisticsRuntimePool) {}

  async record(
    shipmentId: string,
    action: string,
    performedByPrincipalId?: string,
    note?: string,
  ): Promise<AtcDeliveryAudit> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const binds: (string | number | boolean | null)[] = [
        id,
        id,
        shipmentId,
        action,
        performedByPrincipalId ?? null,
        note ?? null,
      ]
      await conn.query(
        `INSERT INTO atc_delivery_audit
          (id, audit_id, shipment_id, action, performed_by_principal_id, note)
         VALUES (?, ?, ?, ?, ?, ?)`,
        binds,
      )
      const [rows] = await conn.query<DeliveryAuditRow[]>(
        'SELECT * FROM atc_delivery_audit WHERE id = ? LIMIT 1',
        [id],
      )
      const row = rows[0]
      if (row === undefined) throw new Error(`Audit record not found after insert: ${id}`)
      return rowToAudit(row)
    } finally {
      conn.release()
    }
  }

  async listByShipment(shipmentId: string): Promise<AtcDeliveryAudit[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<DeliveryAuditRow[]>(
        'SELECT * FROM atc_delivery_audit WHERE shipment_id = ? ORDER BY created_at ASC',
        [shipmentId],
      )
      return rows.map(rowToAudit)
    } finally {
      conn.release()
    }
  }
}
