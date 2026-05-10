#!/usr/bin/env bash
# 签发工具静态页；默认 5175，冲突时可 LICENSE_MAKER_PORT=5176 npm run license:maker
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${LICENSE_MAKER_PORT:-5175}"
cd "$ROOT"
exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory tools/license-maker
