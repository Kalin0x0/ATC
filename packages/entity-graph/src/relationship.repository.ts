import type { RowDataPacket } from 'mysql2/promise'
import type {
  AtcRelationshipEdge,
  AtcRelationshipKind,
  AtcEntityReference,
  AtcEntityType,
} from '@atc/shared-types'
import { ATC_ENTITY_TYPES } from '@atc/shared-types'
import type { EntityGraphPool } from './pool.js'
import { generateId } from './id.js'
import { InvalidEntityTypeError } from './errors.js'

interface EdgeRow extends RowDataPacket {
  id: string
  from_entity_id: string
  to_entity_id: string
  relationship: string
  weight: string
  source_system: string
  attribution: string | null
  metadata_json: string | null
  observed_at: Date
  ended_at: Date | null
  created_at: Date
}

interface EdgeRowWithRefs extends EdgeRow {
  from_type: string
  from_external_id: string
  to_type: string
  to_external_id: string
}

interface CountRow extends RowDataPacket {
  total: number
}

function isType(t: string): t is AtcEntityType {
  return (ATC_ENTITY_TYPES as readonly string[]).includes(t)
}

function rowToEdge(row: EdgeRowWithRefs): AtcRelationshipEdge {
  if (!isType(row.from_type)) throw new InvalidEntityTypeError(row.from_type)
  if (!isType(row.to_type)) throw new InvalidEntityTypeError(row.to_type)
  const from: AtcEntityReference = {
    id: row.from_entity_id,
    externalId: row.from_external_id,
    type: row.from_type,
  }
  const to: AtcEntityReference = {
    id: row.to_entity_id,
    externalId: row.to_external_id,
    type: row.to_type,
  }
  return {
    id: row.id,
    from,
    to,
    relationship: row.relationship as AtcRelationshipKind,
    weight: parseFloat(row.weight),
    sourceSystem: row.source_system,
    attribution: row.attribution,
    metadata: row.metadata_json ? (JSON.parse(row.metadata_json) as Record<string, unknown>) : null,
    observedAt: row.observed_at,
    endedAt: row.ended_at,
    isActive: row.ended_at === null,
  }
}

const SELECT_EDGE_WITH_REFS = `
  SELECT
    r.*,
    f.entity_type AS from_type, f.external_id AS from_external_id,
    t.entity_type AS to_type,   t.external_id AS to_external_id
  FROM atc_entity_relationships r
  JOIN atc_entity_registry f ON f.id = r.from_entity_id
  JOIN atc_entity_registry t ON t.id = r.to_entity_id
`

// ── Params ───────────────────────────────────────────────────────────────────

export interface RecordEdgeParams {
  fromEntityId: string
  toEntityId: string
  relationship: AtcRelationshipKind
  weight?: number
  sourceSystem: string
  attribution?: string | null
  metadata?: Record<string, unknown> | null
  observedAt?: Date | null
}

export interface ListEdgesParams {
  entityId: string
  direction?: 'outbound' | 'inbound' | 'both' | undefined
  relationship?: AtcRelationshipKind | undefined
  includeEnded?: boolean | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface EdgePage {
  items: AtcRelationshipEdge[]
  total: number
  offset: number
  limit: number
}

const MAX_LIMIT = 100
const DEFAULT_LIMIT = 20

function clamp(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit) || limit <= 0) return DEFAULT_LIMIT
  return Math.min(Math.floor(limit), MAX_LIMIT)
}

// ── Repository ───────────────────────────────────────────────────────────────

export class RelationshipRepository {
  constructor(private readonly pool: EntityGraphPool) {}

  async recordEdge(params: RecordEdgeParams): Promise<AtcRelationshipEdge> {
    if (params.fromEntityId === params.toEntityId) {
      throw new InvalidEntityTypeError('self-loops are not permitted')
    }
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_entity_relationships
           (id, from_entity_id, to_entity_id, relationship, weight, source_system,
            attribution, metadata_json, observed_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          id,
          params.fromEntityId,
          params.toEntityId,
          params.relationship,
          (params.weight ?? 1).toFixed(2),
          params.sourceSystem,
          params.attribution ?? null,
          params.metadata ? JSON.stringify(params.metadata) : null,
          params.observedAt ?? new Date(),
        ],
      )
      const [rows] = await conn.execute<EdgeRowWithRefs[]>(
        `${SELECT_EDGE_WITH_REFS} WHERE r.id = ? LIMIT 1`,
        [id],
      )
      const row = rows[0]
      if (!row) throw new Error(`Edge insert failed: ${id}`)
      return rowToEdge(row)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcRelationshipEdge | null> {
    if (!id) return null
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<EdgeRowWithRefs[]>(
        `${SELECT_EDGE_WITH_REFS} WHERE r.id = ? LIMIT 1`,
        [id],
      )
      return rows[0] ? rowToEdge(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async list(params: ListEdgesParams): Promise<EdgePage> {
    const limit = clamp(params.limit)
    const offset = Math.max(0, params.offset ?? 0)
    const direction = params.direction ?? 'both'
    const includeEnded = params.includeEnded ?? false

    if (!params.entityId) {
      return { items: [], total: 0, offset, limit }
    }

    const conds: string[] = []
    const args: (string | number)[] = []
    if (direction === 'outbound')      { conds.push('r.from_entity_id = ?'); args.push(params.entityId) }
    else if (direction === 'inbound')  { conds.push('r.to_entity_id = ?');   args.push(params.entityId) }
    else                                { conds.push('(r.from_entity_id = ? OR r.to_entity_id = ?)'); args.push(params.entityId, params.entityId) }

    if (params.relationship) { conds.push('r.relationship = ?'); args.push(params.relationship) }
    if (!includeEnded)        { conds.push('r.ended_at IS NULL') }

    const where = `WHERE ${conds.join(' AND ')}`

    const conn = await this.pool.getConnection()
    try {
      const [countRows] = await conn.execute<CountRow[]>(
        `SELECT COUNT(*) AS total FROM atc_entity_relationships r ${where}`,
        args,
      )
      const total = countRows[0]?.total ?? 0

      const [rows] = await conn.execute<EdgeRowWithRefs[]>(
        `${SELECT_EDGE_WITH_REFS} ${where} ORDER BY r.observed_at DESC, r.id ASC LIMIT ? OFFSET ?`,
        [...args, limit, offset],
      )
      return { items: rows.map(rowToEdge), total, offset, limit }
    } finally {
      conn.release()
    }
  }

  /**
   * Fetches the *neighbour* edges of a set of entity IDs in one indexed query.
   * Used by the breadth-first graph traversal in RelationshipGraphService to
   * avoid N+1 query patterns.
   */
  async listForEntities(
    entityIds: string[],
    options: { includeEnded?: boolean; maxFanOutPerNode?: number } = {},
  ): Promise<AtcRelationshipEdge[]> {
    if (entityIds.length === 0) return []
    const fanOut = Math.min(Math.max(1, options.maxFanOutPerNode ?? MAX_LIMIT), MAX_LIMIT)
    const includeEnded = options.includeEnded ?? false
    const placeholders = entityIds.map(() => '?').join(',')

    const endedClause = includeEnded ? '' : ' AND r.ended_at IS NULL'

    // Two parallel queries (outbound + inbound) keep the SQL simple and lets
    // us cap fan-out per node via window functions on MariaDB 10.6+.
    //
    // To stay broadly compatible we use a flat LIMIT here based on total
    // input size — callers must already enforce a sensible breadth cap.
    const totalLimit = fanOut * entityIds.length

    const conn = await this.pool.getConnection()
    try {
      const [outbound] = await conn.execute<EdgeRowWithRefs[]>(
        `${SELECT_EDGE_WITH_REFS}
         WHERE r.from_entity_id IN (${placeholders})${endedClause}
         ORDER BY r.observed_at DESC LIMIT ?`,
        [...entityIds, totalLimit],
      )
      const [inbound] = await conn.execute<EdgeRowWithRefs[]>(
        `${SELECT_EDGE_WITH_REFS}
         WHERE r.to_entity_id IN (${placeholders})${endedClause}
         ORDER BY r.observed_at DESC LIMIT ?`,
        [...entityIds, totalLimit],
      )
      const seen = new Set<string>()
      const out: AtcRelationshipEdge[] = []
      for (const r of [...outbound, ...inbound]) {
        if (seen.has(r.id)) continue
        seen.add(r.id)
        out.push(rowToEdge(r))
      }
      return out
    } finally {
      conn.release()
    }
  }

  async endEdge(id: string, endedAt: Date = new Date()): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_entity_relationships SET ended_at = ? WHERE id = ? AND ended_at IS NULL`,
        [endedAt, id],
      )
    } finally {
      conn.release()
    }
  }
}
