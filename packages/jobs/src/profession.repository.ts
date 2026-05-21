import type { RowDataPacket } from 'mysql2/promise'
import type { AtcProfession } from '@atc/shared-types'
import type { JobsPool } from './pool.js'
import { generateId } from './id.js'
import { JobsValidationError } from './errors.js'

interface ProfessionRow extends RowDataPacket {
  id: string
  character_id: string
  job_id: string
  grade_id: string
  level: number
  experience_points: number
  created_at: Date
  updated_at: Date
}

function rowToProfession(row: ProfessionRow): AtcProfession {
  return {
    id: row.id,
    characterId: row.character_id,
    jobId: row.job_id,
    gradeId: row.grade_id,
    level: row.level,
    experiencePoints: row.experience_points,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface UpsertProfessionParams {
  characterId: string
  jobId: string
  gradeId: string
  level?: number
  experiencePoints?: number
}

export class ProfessionRepository {
  constructor(private readonly pool: JobsPool) {}

  async upsert(params: UpsertProfessionParams): Promise<AtcProfession> {
    const level = params.level ?? 1
    const xp = params.experiencePoints ?? 0
    if (level < 1) throw new JobsValidationError('Profession level must be >= 1')
    if (xp < 0)   throw new JobsValidationError('Experience points must be non-negative')

    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_professions (id, character_id, job_id, grade_id, level, experience_points, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE grade_id = VALUES(grade_id), level = VALUES(level),
           experience_points = VALUES(experience_points), updated_at = NOW(3)`,
        [id, params.characterId, params.jobId, params.gradeId, level, xp],
      )
      const [rows] = await conn.execute<ProfessionRow[]>(
        'SELECT * FROM atc_professions WHERE character_id = ? AND job_id = ? LIMIT 1',
        [params.characterId, params.jobId],
      )
      if (!rows[0]) throw new Error('Profession upsert failed unexpectedly')
      return rowToProfession(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByCharacterAndJob(characterId: string, jobId: string): Promise<AtcProfession | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ProfessionRow[]>(
        'SELECT * FROM atc_professions WHERE character_id = ? AND job_id = ? LIMIT 1',
        [characterId, jobId],
      )
      return rows[0] ? rowToProfession(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listByCharacter(characterId: string): Promise<AtcProfession[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ProfessionRow[]>(
        'SELECT * FROM atc_professions WHERE character_id = ? ORDER BY created_at ASC',
        [characterId],
      )
      return rows.map(rowToProfession)
    } finally {
      conn.release()
    }
  }

  async addExperience(characterId: string, jobId: string, xpDelta: number): Promise<AtcProfession | null> {
    if (xpDelta <= 0) throw new JobsValidationError('XP delta must be positive')
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<import('mysql2/promise').ResultSetHeader>(
        `UPDATE atc_professions SET experience_points = experience_points + ?, updated_at = NOW(3)
         WHERE character_id = ? AND job_id = ?`,
        [xpDelta, characterId, jobId],
      )
      if (result.affectedRows === 0) return null
      const [rows] = await conn.execute<ProfessionRow[]>(
        'SELECT * FROM atc_professions WHERE character_id = ? AND job_id = ? LIMIT 1',
        [characterId, jobId],
      )
      return rows[0] ? rowToProfession(rows[0]) : null
    } finally {
      conn.release()
    }
  }
}
