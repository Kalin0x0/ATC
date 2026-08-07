import { createPool, runSeed } from '@atc/db'
import { dbConfig } from './db-config.js'

async function main() {
  const pool = createPool(dbConfig)
  try {
    const result = await runSeed(pool)
    console.log(
      `Seed complete: ${result.items} item definition(s), ` +
      `${result.recipes} recipe(s), ${result.ingredients} ingredient row(s)`,
    )
  } finally {
    await pool.end()
  }
}

main().catch((err: unknown) => {
  console.error('Seed error:', err)
  process.exit(1)
})
