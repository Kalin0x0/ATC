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

/**
 * Split a migration file into statements.
 *
 * Not `sql.split(';')`, which was what stood here: a semicolon inside a comment
 * or a string literal cut the statement it sat in, and the halves were then
 * executed as if they were whole. Eight of the migrations in this directory have
 * one in a comment — plain English punctuation — and each of them failed with a
 * syntax error pointing at the comment line, which is a confusing way to be told
 * that the splitter is wrong.
 *
 * So comments are removed first, quoting respected, and only the semicolons that
 * really terminate a statement are treated as separators.
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let i = 0

  while (i < sql.length) {
    const ch = sql[i] as string
    const next = sql[i + 1]

    // Line comment: -- to end of line, and # to end of line (MySQL accepts both).
    if ((ch === '-' && next === '-') || ch === '#') {
      while (i < sql.length && sql[i] !== '\n') i++
      continue
    }

    // Block comment. /*! ... */ is an executable hint, not a comment, so it is
    // kept — stripping it would silently drop whatever it guards.
    if (ch === '/' && next === '*' && sql[i + 2] !== '!') {
      i += 2
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++
      i += 2
      continue
    }

    // Quoted text, including backtick identifiers. Copied through verbatim so a
    // semicolon or a comment marker inside one is never interpreted.
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch
      current += ch
      i++
      while (i < sql.length) {
        const c = sql[i] as string
        current += c
        // Backslash escapes apply inside ' and " but not inside backticks.
        if (c === '\\' && quote !== '`' && i + 1 < sql.length) {
          current += sql[i + 1] as string
          i += 2
          continue
        }
        i++
        if (c === quote) {
          // A doubled quote is an escaped quote, not the end of the literal.
          if (sql[i] === quote) { current += quote; i++; continue }
          break
        }
      }
      continue
    }

    if (ch === ';') {
      statements.push(current)
      current = ''
      i++
      continue
    }

    current += ch
    i++
  }

  statements.push(current)
  return statements.map((s) => s.trim()).filter((s) => s.length > 0)
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
      const statements = splitSqlStatements(sql)

      await conn.beginTransaction()
      try {
        for (const statement of statements) {
          // query, not execute: these are DDL with no placeholders, and the
          // prepared-statement protocol refuses some of it outright.
          await conn.query(statement)
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
