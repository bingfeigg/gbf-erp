#!/usr/bin/env bash
# 在本地 HTTP 打开工具（默认 :5175；冲突则 LICENSE_MAKER_PORT=5176 ./serve.sh）
set -euo pipefail
cd "$(dirname "$0")"
PORT="${LICENSE_MAKER_PORT:-5175}"
exec python3 -m http.server "$PORT" --bind 127.0.0.1
