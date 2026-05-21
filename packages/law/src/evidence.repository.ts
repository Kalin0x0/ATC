import { createHash } from 'node:crypto'
import type { RowDataPacket } from 'mysql2/promise'
import type { AtcEvidenceRecord, AtcCustodyEntry } from '@atc/shared-types'
import type { LawPool } from './pool.js'
import { generateId } from './id.js'
import { EvidenceNotFoundError } from './errors.js'

interface EvidenceRow extends RowDataPacket {
  id: string
  case_id: string | null
  collected_by_principal_id: string
  label: string
  metadata_json: string | null
  content_hash: string
  chain_of_custody_json: string
  created_at: Date
}

function rowToEvidence(row: EvidenceRow): AtcEvidenceRecord {
  return {
    id: row.id,
    caseId: row.case_id,
    collectedByPrincipalId: row.collected_by_principal_id,
    label: row.label,
    metadata: row.metadata_json ? (JSON.parse(row.metadata_json) as Record<string, unknown>) : null,
    contentHash: row.content_hash,
    chainOfCustody: JSON.parse(row.chain_of_custody_json) as AtcCustodyEntry[],
    createdAt: row.created_at,
  }
}

export interface CollectEvidenceParams {
  caseId?: string | null | undefined
  collectedByPrincipalId: string
  label: string
  content: string | Buffer
  metadata?: Record<string, unknown> | null | undefined
}

export interface ListEvidenceParams {
  caseId?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface EvidencePage {
  items: AtcEvidenceRecord[]
  total: number
  offset: number
  limit: number
}

export class EvidenceRepository {
  constructor(private readonly pool: LawPool) {}

  async collect(params: CollectEvidenceParams): Promise<AtcEvidenceRecord> {
    const id = generateId()
    const contentHash = createHash('sha256')
      .update(params.content)
      .digest('hex')
    const initialCustody: AtcCustodyEntry[] = [{
      principalId: params.collectedByPrincipalId,
      transferredAt: new Date(),
      notes: 'Initial collection',
    }]

    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_evidence_records
           (id, case_id, collected_by_principal_id, label, metadata_json, content_hash, chain_of_custody_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          id,
          params.caseId ?? null,
          params.collectedByPrincipalId,
          params.label,
          params.metadata ? JSON.stringify(params.metadata) : null,
          contentHash,
          JSON.stringify(initialCustody),
        ],
      )
      const [rows] = await conn.execute<EvidenceRow[]>(
        'SELECT * FROM atc_evidence_records WHERE id = ? LIMIT 1',
        [id],
      )
      if (!rows[0]) throw new EvidenceNotFoundError(id)
      return rowToEvidence(rows[0])
    } finally {
      conn.release()
    }
  }

  async transferCustody(
    id: string,
    toPrincipalId: string,
    notes?: string | null,
  ): Promise<AtcEvidenceRecord> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<EvidenceRow[]>(
        'SELECT * FROM atc_evidence_records WHERE id = ? LIMIT 1',
        [id],
      )
      const row = rows[0]
      if (!row) throw new EvidenceNotFoundError(id)

      const custody = JSON.parse(row.chain_of_custody_json) as AtcCustodyEntry[]
      custody.push({
        principalId: toPrincipalId,
        transferredAt: new Date(),
        notes: notes ?? null,
      })

      await conn.execute(
        'UPDATE atc_evidence_records SET chain_of_custody_json = ? WHERE id = ?',
        [JSON.stringify(custody), id],
      )

      const [updated] = await conn.execute<EvidenceRow[]>(
        'SELECT * FROM atc_evidence_records WHERE id = ? LIMIT 1',
        [id],
      )
      if (!updated[0]) throw new EvidenceNotFoundError(id)
      return rowToEvidence(updated[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcEvidenceRecord | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<EvidenceRow[]>(
        'SELECT * FROM atc_evidence_records WHERE id = ? LIMIT 1',
        [id],
      )
      return rows[0] ? rowToEvidence(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async list(params: ListEvidenceParams = {}): Promise<EvidencePage> {
    const limit = Math.min(params.limit ?? 20, 100)
    const offset = params.offset ?? 0
    const conditions: string[] = []
    const args: (string | number | null)[] = []
    if (params.caseId) { conditions.push('case_id = ?'); args.push(params.caseId) }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const conn = await this.pool.getConnection()
    try {
      const [countRows] = await conn.execute<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM atc_evidence_records ${where}`, args,
      )
      const total = countRows[0]?.total ?? 0
      const [rows] = await conn.execute<EvidenceRow[]>(
        `SELECT * FROM atc_evidence_records ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...args, limit, offset],
      )
      return { items: rows.map(rowToEvidence), total, offset, limit }
    } finally {
      conn.release()
    }
  }
}
