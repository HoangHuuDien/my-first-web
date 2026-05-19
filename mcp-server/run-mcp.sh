#!/bin/sh
set -e
cd /opt/my-website/mcp-server
export DOTENV_PATH="${DOTENV_PATH:-/opt/my-website/.env}"
export SITE_ROOT="${SITE_ROOT:-/opt/my-website}"
export NODE_ENV="${NODE_ENV:-production}"
exec node "$(dirname "$0")/index.js"
