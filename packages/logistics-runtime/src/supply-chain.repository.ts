import type { RowDataPacket } from 'mysql2'
import type { LogisticsRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { SupplyChainNotFoundError } from './errors.js'

export type AtcChainStatus = 'active' | 'disrupted' | 'offline'

export interface AtcSupplyChain {
  id: string
  chainId: string
  chainName: string
  nodes: string[]
  edges: Array<{ from: string; to: string }>
  status: AtcChainStatus
  lastTickAt: Date
  createdAt: Date
  updatedAt: Date
}

interface SupplyChainRow extends RowDataPacket {
  id: string
  chain_id: string
  chain_name: string
  nodes: string
  edges: string
  status: AtcChainStatus
  last_tick_at: Date
  created_at: Date
  updated_at: Date
}

function rowToChain(row: SupplyChainRow): AtcSupplyChain {
  return {
    id: row.id,
    chainId: row.chain_id,
    chainName: row.chain_name,
    nodes: JSON.parse(row.nodes) as string[],
    edges: JSON.parse(row.edges) as Array<{ from: string; to: string }>,
    status: row.status,
    lastTickAt: row.last_tick_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class SupplyChainRepository {
  constructor(private readonly pool: LogisticsRuntimePool) {}

  async findByChainId(chainId: string): Promise<AtcSupplyChain | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<SupplyChainRow[]>(
        'SELECT * FROM atc_supply_chain_runtime WHERE chain_id = ? LIMIT 1',
        [chainId],
      )
      const row = rows[0]
      return row !== undefined ? rowToChain(row) : null
    } finally {
      conn.release()
    }
  }

  async listAll(): Promise<AtcSupplyChain[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<SupplyChainRow[]>(
        'SELECT * FROM atc_supply_chain_runtime ORDER BY chain_name ASC',
      )
      return rows.map(rowToChain)
    } finally {
      conn.release()
    }
  }

  async upsert(params: {
    chainId: string
    chainName: string
    nodes: string[]
    edges: Array<{ from: string; to: string }>
  }): Promise<AtcSupplyChain> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const nodes = JSON.stringify(params.nodes)
      const edges = JSON.stringify(params.edges)
      const binds: (string | number | boolean | null)[] = [
        id,
        params.chainId,
        params.chainName,
        nodes,
        edges,
        params.chainName,
        nodes,
        edges,
      ]
      await conn.query(
        `INSERT INTO atc_supply_chain_runtime
          (id, chain_id, chain_name, nodes, edges, status, last_tick_at)
         VALUES (?, ?, ?, ?, ?, 'active', NOW(3))
         ON DUPLICATE KEY UPDATE
           chain_name = ?,
           nodes = ?,
           edges = ?,
           updated_at = NOW(3)`,
        binds,
      )
      const [rows] = await conn.query<SupplyChainRow[]>(
        'SELECT * FROM atc_supply_chain_runtime WHERE chain_id = ? LIMIT 1',
        [params.chainId],
      )
      const row = rows[0]
      if (row === undefined) throw new SupplyChainNotFoundError(params.chainId)
      return rowToChain(row)
    } finally {
      conn.release()
    }
  }

  async updateStatus(chainId: string, status: AtcChainStatus): Promise<AtcSupplyChain> {
    const conn = await this.pool.getConnection()
    let committed = false
    try {
      await conn.beginTransaction()
      const [rows] = await conn.query<SupplyChainRow[]>(
        'SELECT * FROM atc_supply_chain_runtime WHERE chain_id = ? LIMIT 1 FOR UPDATE',
        [chainId],
      )
      const row = rows[0]
      if (row === undefined) {
        throw new SupplyChainNotFoundError(chainId)
      }

      const binds: (string | number | boolean | null)[] = [status, chainId]
      await conn.query(
        'UPDATE atc_supply_chain_runtime SET status = ?, updated_at = NOW(3) WHERE chain_id = ?',
        binds,
      )
      await conn.commit()
      committed = true

      const [updated] = await conn.query<SupplyChainRow[]>(
        'SELECT * FROM atc_supply_chain_runtime WHERE chain_id = ? LIMIT 1',
        [chainId],
      )
      const updatedRow = updated[0]
      if (updatedRow === undefined) throw new SupplyChainNotFoundError(chainId)
      return rowToChain(updatedRow)
    } catch (err) {
      if (!committed) await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }
}
