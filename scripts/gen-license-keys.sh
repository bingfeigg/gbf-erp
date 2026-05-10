#!/usr/bin/env bash
# 生成 Ed25519 许可证密钥对：私钥仅用于签发方保管，公钥给客户环境 LICENSE_PUBLIC_KEY_FILE。
set -euo pipefail
OUT_DIR="${1:-license-keys}"
mkdir -p "$OUT_DIR"
PRIV="$OUT_DIR/license_private.pem"
PUB="$OUT_DIR/license_public.pem"
openssl genpkey -algorithm ED25519 -out "$PRIV"
openssl pkey -in "$PRIV" -pubout -out "$PUB"
chmod 600 "$PRIV"
echo "已生成:"
echo "  私钥（保密）: $PRIV"
echo "  公钥（部署）: $PUB"
echo "客户环境设置 LICENSE_PUBLIC_KEY_FILE=$PUB（或复制公钥内容到 LICENSE_PUBLIC_KEY）"
