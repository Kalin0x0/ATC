import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { NarrativeRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { CampaignNotFoundError, DuplicateCampaignError } from './errors.js'

export type AtcCampaignType = 'main' | 'side' | 'faction' | 'dynamic' | 'world' | 'custom'
export type AtcCampaignStatus = 'active' | 'paused' | 'completed' | 'failed' | 'abandoned'

export interface AtcCampaignRecord {
  id: string
  campaignId: string
  campaignType: AtcCampaignType
  status: AtcCampaignStatus
  ownerServerId: string
  regionId: string | null
  campaignNonce: string
  campaignData: Record<string, unknown>
  startedAt: Date
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface CampaignRow extends RowDataPacket {
  id: string
  campaign_id: string
  campaign_type: string
  status: string
  owner_server_id: string
  region_id: string | null
  campaign_nonce: string
  campaign_data: string
  started_at: Date
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function rowToCampaign(row: CampaignRow): AtcCampaignRecord {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    campaignType: row.campaign_type as AtcCampaignType,
    status: row.status as AtcCampaignStatus,
    ownerServerId: row.owner_server_id,
    regionId: row.region_id,
    campaignNonce: row.campaign_nonce,
    campaignData: JSON.parse(row.campaign_data) as Record<string, unknown>,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateCampaignParams {
  campaignId: string
  campaignType: AtcCampaignType
  ownerServerId: string
  regionId?: string | null | undefined
  campaignNonce: string
  campaignData?: Record<string, unknown> | undefined
}

export class CampaignRuntimeRepository {
  constructor(private readonly pool: NarrativeRuntimePool) {}

  async create(params: CreateCampaignParams): Promise<AtcCampaignRecord> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      try {
        await conn.execute(
          `INSERT INTO atc_campaign_runtime
             (id, campaign_id, campaign_type, status, owner_server_id, region_id,
              campaign_nonce, campaign_data, started_at, created_at, updated_at)
           VALUES (?, ?, ?, 'active', ?, ?, ?, ?, NOW(3), NOW(3), NOW(3))`,
          [
            id,
            params.campaignId,
            params.campaignType,
            params.ownerServerId,
            params.regionId ?? null,
            params.campaignNonce,
            JSON.stringify(params.campaignData ?? {}),
          ],
        )
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateCampaignError(params.campaignNonce)
        }
        throw err
      }
      const [rows] = await conn.execute<CampaignRow[]>(
        `SELECT * FROM atc_campaign_runtime WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new CampaignNotFoundError(id)
      return rowToCampaign(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcCampaignRecord | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<CampaignRow[]>(
        `SELECT * FROM atc_campaign_runtime WHERE id = ? LIMIT 1`,
        [id],
      )
      return rows[0] ? rowToCampaign(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findByCampaignId(campaignId: string): Promise<AtcCampaignRecord | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<CampaignRow[]>(
        `SELECT * FROM atc_campaign_runtime WHERE campaign_id = ? LIMIT 1`,
        [campaignId],
      )
      return rows[0] ? rowToCampaign(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    id: string,
    status: AtcCampaignStatus,
    completedAt?: Date | undefined,
  ): Promise<AtcCampaignRecord> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<CampaignRow[]>(
          `SELECT * FROM atc_campaign_runtime WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        if (!rows[0]) throw new CampaignNotFoundError(id)
        await conn.execute(
          `UPDATE atc_campaign_runtime
           SET status = ?, completed_at = ?, updated_at = NOW(3)
           WHERE id = ?`,
          [status, completedAt ?? null, id],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const [rows] = await conn.execute<CampaignRow[]>(
        `SELECT * FROM atc_campaign_runtime WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new CampaignNotFoundError(id)
      return rowToCampaign(rows[0])
    } finally {
      conn.release()
    }
  }

  async listActive(ownerServerId?: string | undefined): Promise<AtcCampaignRecord[]> {
    const conn = await this.pool.getConnection()
    try {
      if (ownerServerId !== undefined) {
        const [rows] = await conn.execute<CampaignRow[]>(
          `SELECT * FROM atc_campaign_runtime
           WHERE status = 'active' AND owner_server_id = ?
           ORDER BY started_at DESC`,
          [ownerServerId],
        )
        return rows.map(rowToCampaign)
      }
      const [rows] = await conn.execute<CampaignRow[]>(
        `SELECT * FROM atc_campaign_runtime
         WHERE status = 'active'
         ORDER BY started_at DESC`,
      )
      return rows.map(rowToCampaign)
    } finally {
      conn.release()
    }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const thresholdSec = thresholdMs / 1000
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_campaign_runtime
         WHERE status = 'active'
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? SECOND)`,
        [thresholdSec],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
