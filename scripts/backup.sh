#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="${1:-./data}"
BACKUP_DIR="${2:-./backups}"
REPORT_DIR="${3:-}"
DB_FILE="${DATA_DIR}/erp.db"

mkdir -p "$BACKUP_DIR"

REPORT_FILE=""
if [[ -n "$REPORT_DIR" ]]; then
  mkdir -p "$REPORT_DIR"
  STAMP_FOR_REPORT="$(date +%Y%m%d-%H%M%S)"
  REPORT_FILE="${REPORT_DIR}/backup-${STAMP_FOR_REPORT}.log"
fi

log() {
  local msg="$1"
  echo "$msg"
  if [[ -n "$REPORT_FILE" ]]; then
    echo "$msg" >> "$REPORT_FILE"
  fi
}

if [[ ! -f "$DB_FILE" ]]; then
  log "[backup][失败] 数据库文件不存在: $DB_FILE"
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="${BACKUP_DIR}/erp-${STAMP}.tar.gz"

log "[backup] 开始创建备份: $TARGET"
tar -czf "$TARGET" -C "$DATA_DIR" erp.db erp.db-wal erp.db-shm 2>/dev/null || tar -czf "$TARGET" -C "$DATA_DIR" erp.db
tar -tzf "$TARGET" >/dev/null
log "[backup] 备份创建成功: $TARGET"
if [[ -n "$REPORT_FILE" ]]; then
  log "[backup] 报告文件: $REPORT_FILE"
fi
