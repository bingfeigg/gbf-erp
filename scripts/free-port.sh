#!/usr/bin/env bash
# 释放本机 TCP 端口（默认 4000），解决 EADDRINUSE。
set -u
PORT="${1:-4000}"

if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" 2>/dev/null || true
elif command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -t -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
  if [[ -n "${PIDS}" ]]; then
    # shellcheck disable=SC2086
    kill ${PIDS} 2>/dev/null || true
  fi
else
  echo "[free-port] 需要 fuser 或 lsof，请先安装其一。" >&2
  exit 1
fi

echo "[free-port] 已尝试释放端口 ${PORT}（若无进程监听则无操作）。"
