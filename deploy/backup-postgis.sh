#!/usr/bin/env bash
# =============================================================================
# Flipping Search Intelligence — Backup Automático PostGIS + Store JSON (IP-08)
# =============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/flipping-search-backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "${BACKUP_DIR}"

echo "==> Exportando base de datos PostGIS..."
docker exec flipping_search_postgis_prod pg_dump -U flipping -d flipping_search | gzip > "${BACKUP_DIR}/postgis_${TIMESTAMP}.sql.gz"

echo "==> Respaldando store persistente JSON de aplicación..."
docker cp flipping_search_app_prod:/app/data "${BACKUP_DIR}/app_data_${TIMESTAMP}" || true

# Retener últimos 14 días de backups
find "${BACKUP_DIR}" -type f -mtime +14 -delete

echo "✓ Backup completado en ${BACKUP_DIR}/postgis_${TIMESTAMP}.sql.gz"
