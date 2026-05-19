#!/bin/sh
# Gắn vào goClaw container để có `node` cho MCP stdio (Alpine).
apk add --no-cache nodejs npm >/dev/null 2>&1 || true
exec /app/docker-entrypoint.sh "$@"
