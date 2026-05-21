import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeProtocolPool } from './pool.js'
import { generateId } from './id.js'
import { FederationContractNotFoundError, DuplicateFederationContractError } from './errors.js'

export type AtcFederationContractType = 'peer' | 'subordinate' | 'primary' | 'relay' | 'custom'
export type AtcFederationContractStatus = 'pending' | 'active' | 'expired' | 'revoked'

export interface AtcFederationContract {
  id: string
  contractId: string
  contractType: AtcFederationContractType
  status: AtcFederationContractStatus
  ownerServerId: string
  targetServerId: string
  contractNonce: string
  contractData: Record<string, unknown>
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateContractParams {
  contractId: string
  contractType: AtcFederationContractType
  ownerServerId: string
  targetServerId: string
  contractNonce: string
  contractData?: Record<string, unknown> | undefined
  expiresAt?: Date | null | undefined
}

interface FederationContractRow extends RowDataPacket {
  id: string
  contract_id: string
  contract_type: string
  status: string
  owner_server_id: string
  target_server_id: string
  contract_nonce: string
  contract_data: string | null
  expires_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: FederationContractRow): AtcFederationContract {
  let contractData: Record<string, unknown> = {}
  if (row.contract_data) {
    try { contractData = JSON.parse(row.contract_data) as Record<string, unknown> } catch { contractData = {} }
  }
  return {
    id: row.id,
    contractId: row.contract_id,
    contractType: row.contract_type as AtcFederationContractType,
    status: row.status as AtcFederationContractStatus,
    ownerServerId: row.owner_server_id,
    targetServerId: row.target_server_id,
    contractNonce: row.contract_nonce,
    contractData,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class FederationContractRepository {
  constructor(private readonly pool: RuntimeProtocolPool) {}

  async create(params: CreateContractParams): Promise<AtcFederationContract> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const dataJson = JSON.stringify(params.contractData ?? {})
      const expiresAt = params.expiresAt != null
        ? params.expiresAt.toISOString().replace('T', ' ').replace('Z', '')
        : null

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_federation_contracts
             (id, contract_id, contract_type, status, owner_server_id, target_server_id,
              contract_nonce, contract_data, expires_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
          [id, params.contractId, params.contractType, params.ownerServerId,
           params.targetServerId, params.contractNonce, dataJson, expiresAt],
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateFederationContractError(params.contractNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<FederationContractRow[]>(
        `SELECT id, contract_id, contract_type, status, owner_server_id, target_server_id,
                contract_nonce, contract_data, expires_at, created_at, updated_at
         FROM atc_federation_contracts WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new Error(`Federation contract not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcFederationContract | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<FederationContractRow[]>(
        `SELECT id, contract_id, contract_type, status, owner_server_id, target_server_id,
                contract_nonce, contract_data, expires_at, created_at, updated_at
         FROM atc_federation_contracts WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcFederationContractStatus): Promise<AtcFederationContract> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<FederationContractRow[]>(
          `SELECT id, contract_id, contract_type, status, owner_server_id, target_server_id,
                  contract_nonce, contract_data, expires_at, created_at, updated_at
           FROM atc_federation_contracts WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        if (!lockRows[0]) throw new FederationContractNotFoundError(id)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_federation_contracts SET status = ?, updated_at = NOW(3) WHERE id = ?`,
          [status, id],
        )

        const [rows] = await conn.execute<FederationContractRow[]>(
          `SELECT id, contract_id, contract_type, status, owner_server_id, target_server_id,
                  contract_nonce, contract_data, expires_at, created_at, updated_at
           FROM atc_federation_contracts WHERE id = ? LIMIT 1`,
          [id],
        )
        if (!rows[0]) throw new FederationContractNotFoundError(id)
        await conn.commit()
        return mapRow(rows[0])
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_federation_contracts
         WHERE status IN ('expired', 'revoked')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
