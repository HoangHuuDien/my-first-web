#!/bin/bash
# Cho phép goClaw MCP (user goclaw, uid/gid 1000 trong container) đọc .env và ghi index.html.
set -euo pipefail
SITE="${SITE_ROOT:-/opt/my-website}"
GOCAW_GID="${GOCAW_GID:-1000}"

if [[ ! -d "$SITE" ]]; then
  echo "Không thấy thư mục: $SITE" >&2
  exit 1
fi

chgrp "$GOCAW_GID" "$SITE" || true
chmod 775 "$SITE"

for f in .env index.html; do
  if [[ -e "$SITE/$f" ]]; then
    chgrp "$GOCAW_GID" "$SITE/$f"
  fi
done

if [[ -f "$SITE/.env" ]]; then
  chmod 640 "$SITE/.env"
fi
if [[ -f "$SITE/index.html" ]]; then
  chmod 664 "$SITE/index.html"
fi

echo "OK — quyền đã chỉnh:"
ls -la "$SITE" "$SITE/.env" "$SITE/index.html" 2>/dev/null || ls -la "$SITE"
