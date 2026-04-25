#!/usr/bin/env bash
set -euo pipefail

ARCHIVE_PATH="${1:-}"
DATA_DIR="${2:-./data}"
REPORT_DIR="${3:-}"

REPORT_FILE=""
if [[ -n "$REPORT_DIR" ]]; then
  mkdir -p "$REPORT_DIR"
  STAMP_FOR_REPORT="$(date +%Y%m%d-%H%M%S)"
  REPORT_FILE="${REPORT_DIR}/restore-${STAMP_FOR_REPORT}.log"
fi

log() {
  local msg="$1"
  echo "$msg"
  if [[ -n "$REPORT_FILE" ]]; then
    echo "$msg" >> "$REPORT_FILE"
  fi
}

if [[ -z "$ARCHIVE_PATH" ]]; then
  log "Usage: bash scripts/restore.sh <backup.tar.gz> [data_dir] [report_dir]"
  exit 1
fi

if [[ ! -f "$ARCHIVE_PATH" ]]; then
  log "[restore][失败] 备份归档不存在: $ARCHIVE_PATH"
  exit 1
fi

log "[restore] 校验归档结构: $ARCHIVE_PATH"
tar -tzf "$ARCHIVE_PATH" >/dev/null

mkdir -p "$DATA_DIR"
log "[restore] 清理旧数据库文件: $DATA_DIR"
rm -f "${DATA_DIR}/erp.db" "${DATA_DIR}/erp.db-wal" "${DATA_DIR}/erp.db-shm"
log "[restore] 开始恢复: $ARCHIVE_PATH -> $DATA_DIR"
tar -xzf "$ARCHIVE_PATH" -C "$DATA_DIR"

if [[ ! -f "${DATA_DIR}/erp.db" ]]; then
  log "[restore][失败] 恢复后缺少数据库文件: ${DATA_DIR}/erp.db"
  exit 1
fi

log "[restore] 恢复完成: $DATA_DIR"
if [[ -n "$REPORT_FILE" ]]; then
  log "[restore] 报告文件: $REPORT_FILE"
fi
