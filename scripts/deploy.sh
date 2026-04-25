#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${1:-$(pwd)}"
SERVICE_NAME="${2:-gbf-erp.service}"
ENV_FILE="${3:-.env}"

cd "$PROJECT_DIR"

echo "[deploy] validate env"
bash scripts/validate-env.sh "$ENV_FILE"

echo "[deploy] install dependencies"
npm ci

echo "[deploy] build"
npm run build

echo "[deploy] migrate"
npm run migrate

if systemctl list-unit-files | rg -q "^${SERVICE_NAME}"; then
  echo "[deploy] restart ${SERVICE_NAME}"
  sudo systemctl restart "${SERVICE_NAME}"
  sudo systemctl status "${SERVICE_NAME}" --no-pager
else
  echo "[deploy] ${SERVICE_NAME} not found, skipping restart"
fi

echo "[deploy] done"
