#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:4000}"
DATA_DIR="${2:-./data}"
BACKUP_DIR="${3:-./backups}"
SERVICE_NAME="${4:-}"
REPORT_DIR="${5:-./dr-reports}"

mkdir -p "$REPORT_DIR"
RUN_TS="$(date +%Y%m%d-%H%M%S)"
REPORT_FILE="${REPORT_DIR}/dr-drill-${RUN_TS}.log"

log() {
  local msg="$1"
  echo "$msg"
  echo "$msg" >> "$REPORT_FILE"
}

run_step() {
  local step_name="$1"
  shift
  local start end elapsed
  start="$(date +%s)"
  log "[dr][开始] ${step_name}"
  "$@"
  end="$(date +%s)"
  elapsed=$((end - start))
  log "[dr][完成] ${step_name} (${elapsed}s)"
}

restart_service_if_needed() {
  if [[ -n "$SERVICE_NAME" ]]; then
    log "[dr] 尝试恢复服务: $SERVICE_NAME"
    sudo systemctl restart "$SERVICE_NAME"
    sudo systemctl status "$SERVICE_NAME" --no-pager >/dev/null || true
  fi
}

trap 'restart_service_if_needed' EXIT

log "[dr] 灾备演练开始，报告文件: $REPORT_FILE"
run_step "创建备份" bash scripts/backup.sh "$DATA_DIR" "$BACKUP_DIR"
LATEST_BACKUP="$(ls -1t "$BACKUP_DIR"/erp-*.tar.gz 2>/dev/null | head -n 1 || true)"
if [[ -z "$LATEST_BACKUP" ]]; then
  log "[dr][失败] 备份目录无可用归档: $BACKUP_DIR"
  exit 1
fi

log "[dr] 本次恢复归档: $LATEST_BACKUP"
run_step "校验备份归档结构" tar -tzf "$LATEST_BACKUP" >/dev/null

run_step "恢复前冒烟检查" npm run smoke -- "$BASE_URL"

if [[ -n "$SERVICE_NAME" ]]; then
  run_step "恢复前停止服务 ${SERVICE_NAME}" sudo systemctl stop "$SERVICE_NAME"
fi

run_step "执行数据恢复" bash scripts/restore.sh "$LATEST_BACKUP" "$DATA_DIR"

if [[ ! -f "$DATA_DIR/erp.db" ]]; then
  log "[dr][失败] 恢复后未找到数据库文件: ${DATA_DIR}/erp.db"
  exit 1
fi
log "[dr] 恢复后数据库文件存在: ${DATA_DIR}/erp.db"

if [[ -n "$SERVICE_NAME" ]]; then
  run_step "恢复后启动服务 ${SERVICE_NAME}" sudo systemctl start "$SERVICE_NAME"
fi

run_step "恢复后健康检查" curl -fsS "$BASE_URL/health" >/dev/null

run_step "恢复后冒烟检查" npm run smoke -- "$BASE_URL"

trap - EXIT
log "[dr] 灾备演练完成（成功）"
