#!/usr/bin/env bash
# 构建并临时启动 compose，跑 smoke + e2e，最后 tear down。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! docker info >/dev/null 2>&1; then
  echo "[docker-smoke] 无法连接 Docker 守护进程（常见原因：当前用户无权访问 /var/run/docker.sock）。"
  echo ""
  echo "  处理方式（任选其一）："
  echo "    1) 将用户加入 docker 组后重新登录，或执行: newgrp docker"
  echo "       sudo usermod -aG docker \"\$USER\""
  echo "    2) 临时用 root 跑 compose: sudo docker compose up --build -d"
  echo "    3) 确认 Docker 服务已启动: sudo systemctl status docker"
  echo ""
  exit 1
fi

echo "[docker-smoke] compose up --build -d"
docker compose up --build -d

cleanup() {
  echo "[docker-smoke] compose down"
  docker compose down
}
trap cleanup EXIT

echo "[docker-smoke] wait for /health"
for _ in $(seq 1 90); do
  if curl -fsS "http://127.0.0.1:3100/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

bash scripts/smoke.sh "http://127.0.0.1:3100"
bash scripts/e2e.sh "http://127.0.0.1:3100"
echo "[docker-smoke] OK"
