#!/bin/sh
set -e

echo "[ATC] Running database migrations..."
cd /app

node -e "
  import('./apps/api/dist/index.js').then(m => {
    if (m.runMigrations) return m.runMigrations()
  }).catch(e => { console.error(e); process.exit(1) })
"

echo "[ATC] Migrations complete."
