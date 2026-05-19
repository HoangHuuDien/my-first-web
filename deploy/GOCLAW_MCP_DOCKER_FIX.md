# Sửa goClaw + MCP trên VPS (Docker)

## Khởi động goClaw đúng cách

Luôn dùng **cả hai** file compose:

```bash
cd /opt/goclaw
# .env phải có: POSTGRES_PASSWORD=goclaw (không để trống)
docker compose -f docker-compose.yml -f docker-compose.postgres.yml up -d
```

## MCP stdio (website trên host)

1. Copy script entrypoint (hoặc dùng file trong repo `deploy/goclaw/`):

```bash
mkdir -p /opt/goclaw/scripts
cp /opt/my-website/deploy/goclaw/entrypoint-with-node.sh /opt/goclaw/scripts/
chmod +x /opt/goclaw/scripts/entrypoint-with-node.sh
cp /opt/my-website/deploy/goclaw/docker-compose.mcp.yml /opt/goclaw/
```

2. Chạy với overlay MCP:

```bash
cd /opt/goclaw
docker compose -f docker-compose.yml -f docker-compose.postgres.yml -f docker-compose.mcp.yml up -d
```

3. **Quyền file** (goClaw chạy user `goclaw` uid 1000 — phải đọc được `.env`):

```bash
chgrp 1000 /opt/my-website/.env && chmod 640 /opt/my-website/.env
chgrp 1000 /opt/my-website/index.html && chmod 664 /opt/my-website/index.html
```

4. Kiểm tra:

```bash
docker exec goclaw-goclaw-1 node -v
docker exec goclaw-goclaw-1 ls /opt/my-website/mcp-server/index.js
docker exec -u 1000:1000 goclaw-goclaw-1 test -r /opt/my-website/.env && echo ENV_READ_OK
```

## Dashboard MCP

Xem `deploy/GOCLAW_DASHBOARD_MCP.md` — transport **stdio**, command `node`, args `/opt/my-website/mcp-server/index.js`.
