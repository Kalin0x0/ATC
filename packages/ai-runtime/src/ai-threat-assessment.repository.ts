import type { RowDataPacket } from 'mysql2/promise'
import { generateId } from './id.js'
import { ThreatAssessmentNotFoundError } from './errors.js'
import type { AiRuntimePool } from './pool.js'

export type AtcThreatType = 'player' | 'vehicle' | 'group' | 'zone' | 'faction' | 'unknown'
export type AtcThreatLevel = 'minimal' | 'low' | 'moderate' | 'high' | 'critical'

export interface AtcAiThreatAssessment {
  id: string
  assessmentId: string
  entityId: string
  threatSourceId: string | null
  threatLevel: AtcThreatLevel
  threatType: AtcThreatType
  assessmentData: Record<string, unknown>
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface AtcAiThreatAssessmentRow extends RowDataPacket {
  id: string
  assessment_id: string
  entity_id: string
  threat_source_id: string | null
  threat_level: string
  threat_type: string
  assessment_data: string
  expires_at: Date | null
  created_at: Date
  updated_at: Date
}

function rowToAssessment(row: AtcAiThreatAssessmentRow): AtcAiThreatAssessment {
  return {
    id: row.id,
    assessmentId: row.assessment_id,
    entityId: row.entity_id,
    threatSourceId: row.threat_source_id,
    threatLevel: row.threat_level as AtcThreatLevel,
    threatType: row.threat_type as AtcThreatType,
    assessmentData: JSON.parse(row.assessment_data || '{}') as Record<string, unknown>,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface UpsertThreatAssessmentParams {
  assessmentId?: string
  entityId: string
  threatSourceId?: string
  threatLevel: AtcThreatLevel
  threatType: AtcThreatType
  assessmentData?: Record<string, unknown>
  expiresAt?: Date
}

export class AiThreatAssessmentRepository {
  constructor(private readonly pool: AiRuntimePool) {}

  async findById(assessmentId: string): Promise<AtcAiThreatAssessment | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AtcAiThreatAssessmentRow[]>(
        'SELECT * FROM atc_ai_threat_assessment WHERE assessment_id = ?',
        [assessmentId],
      )
      const row = rows[0]
      return row !== undefined ? rowToAssessment(row) : null
    } finally {
      conn.release()
    }
  }

  async listByEntity(entityId: string): Promise<AtcAiThreatAssessment[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AtcAiThreatAssessmentRow[]>(
        'SELECT * FROM atc_ai_threat_assessment WHERE entity_id = ? ORDER BY created_at DESC',
        [entityId],
      )
      return rows.map(rowToAssessment)
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcAiThreatAssessment[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AtcAiThreatAssessmentRow[]>(
        'SELECT * FROM atc_ai_threat_assessment WHERE expires_at IS NULL OR expires_at > NOW(3)',
        [],
      )
      return rows.map(rowToAssessment)
    } finally {
      conn.release()
    }
  }

  async upsert(params: UpsertThreatAssessmentParams): Promise<AtcAiThreatAssessment> {
    const {
      assessmentId = generateId(),
      entityId,
      threatLevel,
      threatType,
      assessmentData = {},
      expiresAt,
    } = params

    const id = generateId()
    const dataJson = JSON.stringify(assessmentData)
    const threatSourceId = params.threatSourceId ?? null
    const expiresAtValue: string | null = expiresAt !== undefined ? expiresAt.toISOString() : null

    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_ai_threat_assessment
           (id, assessment_id, entity_id, threat_source_id, threat_level, threat_type, assessment_data, expires_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           threat_source_id = VALUES(threat_source_id),
           threat_level = VALUES(threat_level),
           threat_type = VALUES(threat_type),
           assessment_data = VALUES(assessment_data),
           expires_at = VALUES(expires_at),
           updated_at = NOW(3)`,
        [id, assessmentId, entityId, threatSourceId, threatLevel, threatType, dataJson, expiresAtValue],
      )
      const result = await this.findById(assessmentId)
      return result!
    } finally {
      conn.release()
    }
  }

  async expireStale(): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute(
        'DELETE FROM atc_ai_threat_assessment WHERE expires_at < NOW(3)',
        [],
      )
      return (result as { affectedRows: number }).affectedRows
    } finally {
      conn.release()
    }
  }

  async deleteById(assessmentId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        'DELETE FROM atc_ai_threat_assessment WHERE assessment_id = ?',
        [assessmentId],
      )
    } finally {
      conn.release()
    }
  }

  async deleteByEntity(entityId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        'DELETE FROM atc_ai_threat_assessment WHERE entity_id = ?',
        [entityId],
      )
    } finally {
      conn.release()
    }
  }
}

// Re-export for use in services
export { ThreatAssessmentNotFoundError }
