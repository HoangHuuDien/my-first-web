#!/bin/sh
# Chạy trên VPS: bash /opt/my-website/mcp-server/check-startup.sh
set -e
cd /opt/my-website/mcp-server
export DOTENV_PATH=/opt/my-website/.env
export SITE_ROOT=/opt/my-website
export NODE_ENV=production

echo "=== node ==="
node -v

echo "=== sdk import ==="
node --input-type=module -e "import('@modelcontextprotocol/sdk/server/mcp.js').then(()=>console.log('SDK_OK')).catch(e=>{console.error(e);process.exit(1)})"

echo "=== index import (2s) ==="
timeout 2 node index.js 2>&1 || true
echo "=== neu tren khong co fatal = process cho stdin (OK) ==="
