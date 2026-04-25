#!/usr/bin/env bash
# 与 package.json engines.node 及 .nvmrc 一致
set -euo pipefail
MIN_MAJOR=20
MAJOR=$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || echo 0)
if [ "$MAJOR" -lt "$MIN_MAJOR" ]; then
  echo "gbf-erp: 需要 Node.js >= ${MIN_MAJOR}，当前为 $(node -v 2>/dev/null || echo 未知)。"
  echo "  使用 nvm:  nvm install && nvm use   （本仓库 .nvmrc 为 20）"
  echo "  然后:     npm run rebuild:native"
  exit 1
fi
