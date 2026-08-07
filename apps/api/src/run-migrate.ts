import { createPool, runMigrations, getMigrationStatus } from '@atc/db'
import { dbConfig } from './db-config.js'

async function main() {
  const pool = createPool(dbConfig)
  const args = process.argv.slice(2)

  try {
    if (args.includes('--status')) {
      await getMigrationStatus(pool)
    } else {
      await runMigrations(pool)
      console.log('Migrations complete')
    }
  } finally {
    await pool.end()
  }
}

main().catch((err: unknown) => {
  console.error('Migration error:', err)
  process.exit(1)
})
