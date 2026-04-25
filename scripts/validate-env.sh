#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env}"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

PORT_VALUE="${PORT:-3100}"
if ! [[ "$PORT_VALUE" =~ ^[0-9]+$ ]] || (( PORT_VALUE < 1 || PORT_VALUE > 65535 )); then
  echo "[env] invalid PORT: ${PORT_VALUE}"
  exit 1
fi

NODE_ENV_VALUE="${NODE_ENV:-development}"
JWT_SECRET_VALUE="${JWT_SECRET:-}"
if [[ "$NODE_ENV_VALUE" == "production" ]]; then
  if [[ -z "$JWT_SECRET_VALUE" || "$JWT_SECRET_VALUE" == "change-this-in-production" || ${#JWT_SECRET_VALUE} -lt 32 ]]; then
    echo "[env] invalid JWT_SECRET for production (must be set and >= 32 chars)"
    exit 1
  fi
fi

echo "[env] validation passed (env=${NODE_ENV_VALUE}, port=${PORT_VALUE})"
