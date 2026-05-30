#!/bin/bash
set -e
BACKUP_DIR="/opt/atc-backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "${BACKUP_DIR}"

echo "[ATC Backup] Starting backup ${DATE}"

# MariaDB dump
docker exec $(docker ps -qf "name=atc-db") \
    mysqldump -u atc -p"${DB_PASSWORD}" atc \
    > "${BACKUP_DIR}/atc_db_${DATE}.sql"

# Compress
gzip "${BACKUP_DIR}/atc_db_${DATE}.sql"

# Remove backups older than 7 days
find "${BACKUP_DIR}" -name "*.sql.gz" -mtime +7 -delete

echo "[ATC Backup] Done: ${BACKUP_DIR}/atc_db_${DATE}.sql.gz"
