import type { RowDataPacket } from 'mysql2/promise'
import type { CraftingRuntimePool } from './pool.js'
import { generateId } from './id.js'

export interface AtcCraftingAudit {
  id: string
  auditId: string
  jobId: string
  action: string
  performedByPrincipalId: string | null
  note: string | null
  createdAt: Date
}

interface CraftingAuditRow extends RowDataPacket {
  id: string
  audit_id: string
  job_id: string
  action: string
  performed_by_principal_id: string | null
  note: string | null
  created_at: Date
}

function rowToAudit(row: CraftingAuditRow): AtcCraftingAudit {
  return {
    id: row.id,
    auditId: row.audit_id,
    jobId: row.job_id,
    action: row.action,
    performedByPrincipalId: row.performed_by_principal_id,
    note: row.note,
    createdAt: row.created_at,
  }
}

export class CraftingAuditRepository {
  constructor(private readonly pool: CraftingRuntimePool) {}

  async record(
    jobId: string,
    action: string,
    performedByPrincipalId?: string,
    note?: string,
  ): Promise<AtcCraftingAudit> {
    const id = generateId()
    const auditId = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_crafting_audit
           (id, audit_id, job_id, action, performed_by_principal_id, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          id,
          auditId,
          jobId,
          action,
          performedByPrincipalId ?? null,
          note ?? null,
        ],
      )
      const [rows] = await conn.execute<CraftingAuditRow[]>(
        'SELECT * FROM atc_crafting_audit WHERE id = ? LIMIT 1',
        [id],
      )
      if (!rows[0]) throw new Error(`Audit record not found after insert: ${id}`)
      return rowToAudit(rows[0])
    } finally {
      conn.release()
    }
  }

  async listByJob(jobId: string): Promise<AtcCraftingAudit[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<CraftingAuditRow[]>(
        'SELECT * FROM atc_crafting_audit WHERE job_id = ? ORDER BY created_at ASC',
        [jobId],
      )
      return rows.map(rowToAudit)
    } finally {
      conn.release()
    }
  }
}
