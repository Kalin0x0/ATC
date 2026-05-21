import { readdir, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { RowDataPacket } from 'mysql2/promise'
import type { DbPool } from './client.js'

const _dir = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(_dir, '..', 'migrations')

const CREATE_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS atc_migrations (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    filename    VARCHAR(255) NOT NULL UNIQUE,
    applied_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

interface MigrationRow extends RowDataPacket {
  filename: string
  applied_at: Date
}

export async function runMigrations(pool: DbPool): Promise<void> {
  const conn = await pool.getConnection()
  try {
    await conn.execute(CREATE_MIGRATIONS_TABLE)

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql'))
      .sort()

    const [rows] = await conn.execute<MigrationRow[]>(
      'SELECT filename FROM atc_migrations'
    )
    const applied = new Set(rows.map((r) => r.filename))

    for (const file of files) {
      if (applied.has(file)) continue

      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf-8')
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)

      await conn.beginTransaction()
      try {
        for (const statement of statements) {
          await conn.execute(statement)
        }
        await conn.execute('INSERT INTO atc_migrations (filename) VALUES (?)', [file])
        await conn.commit()
        console.log(`[db:migrate] Applied: ${file}`)
      } catch (err) {
        await conn.rollback()
        throw new Error(`Migration failed (${file}): ${String(err)}`)
      }
    }
  } finally {
    conn.release()
  }
}

export async function getMigrationStatus(pool: DbPool): Promise<void> {
  const conn = await pool.getConnection()
  try {
    await conn.execute(CREATE_MIGRATIONS_TABLE)

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql'))
      .sort()

    const [rows] = await conn.execute<MigrationRow[]>(
      'SELECT filename, applied_at FROM atc_migrations ORDER BY filename'
    )
    const applied = new Map(rows.map((r) => [r.filename, r.applied_at]))

    for (const file of files) {
      const appliedAt = applied.get(file)
      if (appliedAt) {
        console.log(`[✓] ${file} — applied at ${appliedAt.toISOString()}`)
      } else {
        console.log(`[ ] ${file} — pending`)
      }
    }
  } finally {
    conn.release()
  }
}
