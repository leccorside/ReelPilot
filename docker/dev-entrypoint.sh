#!/bin/sh
# Development entrypoint: node_modules lives in a named volume, so it can fall behind
# package-lock.json. Reinstall only when the lock file changed.
set -e
cd /app
HASH=$(sha256sum package-lock.json | cut -d' ' -f1)
STAMP=node_modules/.lock-hash
if [ ! -f "$STAMP" ] || [ "$(cat "$STAMP")" != "$HASH" ]; then
  echo "[dev] package-lock.json mudou: instalando dependências..."
  # npm install (not npm ci): npm ci deletes node_modules, which is a mount point here.
  npm install --no-audit --no-fund
  echo "$HASH" > "$STAMP"
fi
exec "$@"
