#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${1:-/opt/gbf-erp}"
BACKUP_ARCHIVE="${2:-}"
SERVICE_NAME="${3:-gbf-erp.service}"

if [[ -z "$BACKUP_ARCHIVE" ]]; then
  echo "Usage: bash scripts/rollback.sh <project_dir> <backup_archive.tar.gz> [service_name]"
  exit 1
fi

cd "$PROJECT_DIR"

echo "[rollback] restore database from backup"
bash scripts/restore.sh "$BACKUP_ARCHIVE" "${PROJECT_DIR}/data"

if systemctl list-unit-files | rg -q "^${SERVICE_NAME}"; then
  echo "[rollback] restart ${SERVICE_NAME}"
  sudo systemctl restart "${SERVICE_NAME}"
  sudo systemctl status "${SERVICE_NAME}" --no-pager
fi

PORT_VALUE="${PORT:-3100}"
echo "[rollback] health check"
curl -fsS "http://localhost:${PORT_VALUE}/health" >/dev/null

echo "[rollback] done"
