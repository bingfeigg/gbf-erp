#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${1:-/opt/gbf-erp}"
CRON_SCHEDULE="${2:-0 2 * * *}"
DATA_DIR="${3:-${PROJECT_DIR}/data}"
BACKUP_DIR="${4:-${PROJECT_DIR}/backups}"

LINE="${CRON_SCHEDULE} cd ${PROJECT_DIR} && /usr/bin/bash scripts/backup.sh ${DATA_DIR} ${BACKUP_DIR} >> /var/log/gbf-erp/backup.log 2>&1"

TMP_FILE="$(mktemp)"
crontab -l 2>/dev/null | rg -v "scripts/backup.sh" > "$TMP_FILE" || true
echo "$LINE" >> "$TMP_FILE"
crontab "$TMP_FILE"
rm -f "$TMP_FILE"

echo "[cron] backup job installed:"
echo "$LINE"
