#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${1:-/opt/gbf-erp}"
SERVICE_NAME="gbf-erp.service"

if [[ $EUID -ne 0 ]]; then
  echo "[systemd] please run as root (sudo)"
  exit 1
fi

mkdir -p /etc/systemd/system
mkdir -p /var/log/gbf-erp
chown -R www-data:www-data /var/log/gbf-erp

sed "s|WorkingDirectory=/opt/gbf-erp|WorkingDirectory=${PROJECT_DIR}|g; s|ReadWritePaths=/opt/gbf-erp /opt/gbf-erp/data|ReadWritePaths=${PROJECT_DIR} ${PROJECT_DIR}/data|g" \
  "${PROJECT_DIR}/deploy/gbf-erp.service" > "/etc/systemd/system/${SERVICE_NAME}"

cp "${PROJECT_DIR}/deploy/logrotate-gbf-erp" /etc/logrotate.d/gbf-erp

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"
systemctl status "${SERVICE_NAME}" --no-pager

echo "[systemd] installed and started ${SERVICE_NAME}"
