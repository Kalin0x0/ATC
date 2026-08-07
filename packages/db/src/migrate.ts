import { readdir, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { RowDataPacket } from 'mysql2/promise'
import type { DbPool } from './client.js'

const _dir = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(_dir, '..', 'migrations')

const CREATE_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS atc_migrations (
    id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    filename           VARCHAR(255) NOT NULL UNIQUE,
    applied_at         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    -- How many of the file's statements have run. Only meaningful while
    -- completed = 0; see the note on partial application in runMigrations.
    statements_applied INT UNSIGNED NOT NULL DEFAULT 0,
    completed          TINYINT(1) NOT NULL DEFAULT 1
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

/**
 * Columns added to atc_migrations after it first shipped.
 *
 * The table is created by this file rather than by a migration, so an existing
 * database has the original two-column version and no migration will ever add
 * to it. ADD COLUMN IF NOT EXISTS is MariaDB-only, so existence is checked
 * against information_schema instead, which both engines answer the same way.
 */
const ADDED_COLUMNS: ReadonlyArray<{ name: string; ddl: string }> = [
  { name: 'statements_applied', ddl: 'ADD COLUMN statements_applied INT UNSIGNED NOT NULL DEFAULT 0' },
  { name: 'completed', ddl: 'ADD COLUMN completed TINYINT(1) NOT NULL DEFAULT 1' },
]

interface MigrationRow extends RowDataPacket {
  filename: string
  applied_at: Date
  statements_applied: number
  completed: number
}

interface ColumnRow extends RowDataPacket {
  COLUMN_NAME: string
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

/** Bring atc_migrations up to the current shape on a database that predates it. */
async function _ensureMigrationsTable(conn: Awaited<ReturnType<DbPool['getConnection']>>): Promise<void> {
  await conn.query(CREATE_MIGRATIONS_TABLE)
  const [cols] = await conn.query<ColumnRow[]>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'atc_migrations'`,
  )
  const present = new Set(cols.map((c) => c.COLUMN_NAME))
  for (const col of ADDED_COLUMNS) {
    if (!present.has(col.name)) {
      await conn.query(`ALTER TABLE atc_migrations ${col.ddl}`)
    }
  }
}

/**
 * Apply every migration that has not run yet.
 *
 * ## On partial application
 *
 * There used to be a transaction around each file, with a rollback on failure.
 * It did nothing. MySQL and MariaDB commit implicitly on DDL, so a file that
 * created three tables and failed on the fourth left three tables behind and no
 * row in atc_migrations — and the next run started that file from the top and
 * died on "table already exists", with no way forward but hand-editing the
 * database. The appearance of a rollback was worse than no rollback, because it
 * suggested the failure had been contained.
 *
 * So there is no transaction here now, and progress is recorded instead: the
 * row is written before the file runs, its statement counter is advanced as
 * statements succeed, and it is marked completed at the end. A rerun resumes at
 * the statement that failed.
 *
 * Resuming is sound because each statement is individually atomic — a CREATE
 * TABLE or a multi-clause ALTER either applies whole or not at all — so the
 * statement that failed changed nothing and is safe to repeat.
 */
export async function runMigrations(pool: DbPool): Promise<void> {
  const conn = await pool.getConnection()
  try {
    await _ensureMigrationsTable(conn)

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql'))
      .sort()

    const [rows] = await conn.query<MigrationRow[]>(
      'SELECT filename, statements_applied, completed FROM atc_migrations'
    )
    const state = new Map(rows.map((r) => [r.filename, r]))

    for (const file of files) {
      const prior = state.get(file)
      if (prior && prior.completed === 1) continue

      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf-8')
      const statements = splitSqlStatements(sql)

      // Where to pick up. Non-zero only after a run that stopped part-way.
      const from = prior ? Number(prior.statements_applied) : 0
      if (from > 0) {
        console.log(`[db:migrate] Resuming ${file} at statement ${from + 1}/${statements.length}`)
      }

      await conn.query(
        `INSERT INTO atc_migrations (filename, statements_applied, completed)
         VALUES (?, ?, 0)
         ON DUPLICATE KEY UPDATE completed = 0`,
        [file, from],
      )

      let i = from
      try {
        for (; i < statements.length; i++) {
          // query, not execute: these are DDL with no placeholders, and the
          // prepared-statement protocol refuses some of it outright.
          await conn.query(statements[i] as string)
          await conn.query(
            'UPDATE atc_migrations SET statements_applied = ? WHERE filename = ?',
            [i + 1, file],
          )
        }
      } catch (err) {
        // Statement i failed and did nothing; 0..i-1 are applied and recorded.
        const firstLine = (statements[i] ?? '').split('\n')[0]?.trim() ?? ''
        throw new Error(
          `Migration failed (${file}) at statement ${i + 1}/${statements.length}: ${String(err)}\n` +
          `  statement began: ${firstLine.slice(0, 120)}\n` +
          `  ${i} statement(s) from this file are applied and recorded; rerunning resumes here.`,
        )
      }

      await conn.query(
        'UPDATE atc_migrations SET completed = 1, applied_at = NOW(3) WHERE filename = ?',
        [file],
      )
      console.log(`[db:migrate] Applied: ${file}`)
    }
  } finally {
    conn.release()
  }
}

export async function getMigrationStatus(pool: DbPool): Promise<void> {
  const conn = await pool.getConnection()
  try {
    await _ensureMigrationsTable(conn)

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql'))
      .sort()

    const [rows] = await conn.query<MigrationRow[]>(
      'SELECT filename, applied_at, statements_applied, completed FROM atc_migrations ORDER BY filename'
    )
    const state = new Map(rows.map((r) => [r.filename, r]))

    for (const file of files) {
      const row = state.get(file)
      if (!row) {
        console.log(`[ ] ${file} — pending`)
      } else if (row.completed === 1) {
        console.log(`[✓] ${file} — applied at ${row.applied_at.toISOString()}`)
      } else {
        // A file that stopped part-way. Shown distinctly because the database
        // is neither at the old shape nor the new one.
        console.log(`[!] ${file} — partial, ${row.statements_applied} statement(s) applied`)
      }
    }
  } finally {
    conn.release()
  }
}
