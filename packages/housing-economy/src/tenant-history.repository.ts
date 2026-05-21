import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { HousingEconomyPool } from './pool.js'
import { generateId } from './id.js'
import { TenantHistoryNotFoundError } from './errors.js'

export interface AtcTenantHistory {
  id: string
  contractId: string
  propertyId: string
  tenantPrincipalId: string
  action: string
  performedByPrincipalId: string | null
  notes: string | null
  createdAt: Date
}

export interface RecordTenantHistoryParams {
  contractId: string
  propertyId: string
  tenantPrincipalId: string
  action: string
  performedByPrincipalId?: string | null | undefined
  notes?: string | null | undefined
}

interface TenantHistoryRow extends RowDataPacket {
  id: string
  contract_id: string
  property_id: string
  tenant_principal_id: string
  action: string
  performed_by_principal_id: string | null
  notes: string | null
  created_at: Date
}

function rowToHistory(row: TenantHistoryRow): AtcTenantHistory {
  return {
    id: row.id,
    contractId: row.contract_id,
    propertyId: row.property_id,
    tenantPrincipalId: row.tenant_principal_id,
    action: row.action,
    performedByPrincipalId: row.performed_by_principal_id,
    notes: row.notes,
    createdAt: row.created_at,
  }
}

export class TenantHistoryRepository {
  constructor(private readonly pool: HousingEconomyPool) {}

  async record(params: RecordTenantHistoryParams): Promise<AtcTenantHistory> {
    const id = generateId()
    const performedByPrincipalId = params.performedByPrincipalId ?? null
    const notes = params.notes ?? null

    const conn = await this.pool.getConnection()
    try {
      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_tenant_history
           (id, contract_id, property_id, tenant_principal_id, action,
            performed_by_principal_id, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          id,
          params.contractId,
          params.propertyId,
          params.tenantPrincipalId,
          params.action,
          performedByPrincipalId,
          notes,
        ],
      )

      const [rows] = await conn.execute<TenantHistoryRow[]>(
        'SELECT * FROM atc_tenant_history WHERE id = ? LIMIT 1',
        [id],
      )
      if (!rows[0]) throw new TenantHistoryNotFoundError(id)
      return rowToHistory(rows[0])
    } finally {
      conn.release()
    }
  }

  async listByContract(contractId: string): Promise<AtcTenantHistory[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<TenantHistoryRow[]>(
        `SELECT * FROM atc_tenant_history
         WHERE contract_id = ?
         ORDER BY created_at ASC`,
        [contractId],
      )
      return rows.map(rowToHistory)
    } finally {
      conn.release()
    }
  }

  async listByProperty(propertyId: string): Promise<AtcTenantHistory[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<TenantHistoryRow[]>(
        `SELECT * FROM atc_tenant_history
         WHERE property_id = ?
         ORDER BY created_at ASC`,
        [propertyId],
      )
      return rows.map(rowToHistory)
    } finally {
      conn.release()
    }
  }
}
