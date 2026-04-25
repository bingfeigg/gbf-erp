#!/usr/bin/env bash
# 本地功能验证：build → migrate → 临时端口起服务 → smoke + e2e（不依赖 Docker）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[verify-local] openapi:validate"
npm run openapi:validate

echo "[verify-local] npm test"
npm run test

PORT="${VERIFY_PORT:-4055}"
export PORT

echo "[verify-local] npm run build"
npm run build

echo "[verify-local] npm run migrate"
npm run migrate

if command -v bash >/dev/null 2>&1 && [[ -x scripts/free-port.sh ]]; then
  bash scripts/free-port.sh "$PORT" >/dev/null 2>&1 || true
fi

echo "[verify-local] start API on PORT=$PORT"
(PORT="$PORT" node dist/index.js) &
PID=$!
trap 'kill "$PID" 2>/dev/null || true' EXIT

echo "[verify-local] wait for /health"
for _ in $(seq 1 100); do
  if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.15
done

BASE="http://127.0.0.1:${PORT}"
echo "[verify-local] smoke $BASE"
bash scripts/smoke.sh "$BASE"

echo "[verify-local] e2e $BASE"
bash scripts/e2e.sh "$BASE"

echo "[verify-local] OK (all checks passed)"
