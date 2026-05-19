#!/bin/bash
# Cài MCP server (stdio) trên VPS — chạy sau git pull
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/my-website}"
cd "$APP_DIR"

echo "==> git pull..."
git pull origin main

echo "==> npm install mcp-server..."
cd "$APP_DIR/mcp-server"
npm install --omit=dev

echo "==> Kiểm tra..."
test -f "$APP_DIR/mcp-server/index.js"
test -d "$APP_DIR/mcp-server/node_modules/@modelcontextprotocol/sdk"
test -f "$APP_DIR/.env"

echo "==> Smoke test env..."
export DOTENV_PATH="$APP_DIR/.env"
export SITE_ROOT="$APP_DIR"
export NODE_ENV=production
cd "$APP_DIR/mcp-server"
node --input-type=module -e "
import { loadProjectEnv } from './lib/env.js';
const root = loadProjectEnv();
console.log('env OK root=', root);
"

echo ""
echo "==> MCP stdio — không cần systemd / port 3001."
echo "    goClaw: node $APP_DIR/mcp-server/index.js"
echo "    Xem: deploy/goclaw-mcp.example.json"
echo "Done."
