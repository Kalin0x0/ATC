import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { DeveloperPlatformPool } from './pool.js'
import { generateId } from './id.js'
import { ContractValidationNotFoundError, DuplicateContractValidationError } from './errors.js'

export type AtcContractType = 'api' | 'event' | 'schema' | 'interface' | 'custom'
export type AtcContractStatus = 'pending' | 'validating' | 'valid' | 'invalid' | 'failed'

export interface AtcContractValidation {
  id: string
  contractId: string
  contractType: AtcContractType
  status: AtcContractStatus
  ownerServerId: string
  contractNonce: string
  contractData: Record<string, unknown>
  validatedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateContractParams {
  contractType: AtcContractType
  ownerServerId: string
  contractNonce: string
  contractData?: Record<string, unknown> | undefined
}

interface ContractValidationRow extends RowDataPacket {
  id: string
  contract_id: string
  contract_type: string
  status: string
  owner_server_id: string
  contract_nonce: string
  contract_data: string | null
  validated_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: ContractValidationRow): AtcContractValidation {
  let contractData: Record<string, unknown> = {}
  if (row.contract_data) {
    try {
      contractData = JSON.parse(row.contract_data) as Record<string, unknown>
    } catch {
      contractData = {}
    }
  }
  return {
    id: row.id,
    contractId: row.contract_id,
    contractType: row.contract_type as AtcContractType,
    status: row.status as AtcContractStatus,
    ownerServerId: row.owner_server_id,
    contractNonce: row.contract_nonce,
    contractData,
    validatedAt: row.validated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ContractValidationRepository {
  constructor(private readonly pool: DeveloperPlatformPool) {}

  async create(params: CreateContractParams): Promise<AtcContractValidation> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const contractId = generateId()
      const contractDataJson = JSON.stringify(params.contractData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_contract_validation
             (id, contract_id, contract_type, status, owner_server_id,
              contract_nonce, contract_data, validated_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            contractId,
            params.contractType,
            params.ownerServerId,
            params.contractNonce,
            contractDataJson,
          ] as unknown[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateContractValidationError(params.contractNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<ContractValidationRow[]>(
        `SELECT id, contract_id, contract_type, status, owner_server_id,
                contract_nonce, contract_data, validated_at, created_at, updated_at
         FROM atc_contract_validation
         WHERE id = ?
         LIMIT 1`,
        [id] as unknown[]
      )
      if (!rows[0]) throw new Error(`Contract validation not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcContractValidation | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ContractValidationRow[]>(
        `SELECT id, contract_id, contract_type, status, owner_server_id,
                contract_nonce, contract_data, validated_at, created_at, updated_at
         FROM atc_contract_validation
         WHERE id = ?
         LIMIT 1`,
        [id] as unknown[]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    id: string,
    status: AtcContractStatus,
    validatedAt?: Date | undefined
  ): Promise<AtcContractValidation> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<ContractValidationRow[]>(
          `SELECT id, contract_id, contract_type, status, owner_server_id,
                  contract_nonce, contract_data, validated_at, created_at, updated_at
           FROM atc_contract_validation
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id] as unknown[]
        )
        if (!lockRows[0]) throw new ContractValidationNotFoundError(id)

        if (validatedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_contract_validation
             SET status = ?, validated_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, validatedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as unknown[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_contract_validation
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as unknown[]
          )
        }

        const [rows] = await conn.execute<ContractValidationRow[]>(
          `SELECT id, contract_id, contract_type, status, owner_server_id,
                  contract_nonce, contract_data, validated_at, created_at, updated_at
           FROM atc_contract_validation
           WHERE id = ?
           LIMIT 1`,
          [id] as unknown[]
        )
        if (!rows[0]) throw new ContractValidationNotFoundError(id)

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
        `DELETE FROM atc_contract_validation
         WHERE status IN ('invalid', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as unknown[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
