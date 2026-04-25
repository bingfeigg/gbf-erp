#!/bin/sh
set -e
cd /app
echo "[entrypoint] running database migrations..."
node dist/migrate.js
echo "[entrypoint] starting API..."
exec "$@"
