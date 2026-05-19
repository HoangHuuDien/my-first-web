# goClaw MCP — Thuận Thiên website

MCP server chạy **stdio** trên cùng VPS với website (`/opt/my-website`).

## Cài dependency (trên VPS)

```bash
cd /opt/my-website
bash deploy/mcp-install.sh
```

Hoặc thủ công: `git pull` → `cd mcp-server && npm install`.

**Dashboard goClaw:** xem `deploy/GOCLAW_DASHBOARD_MCP.md` (copy từng field).

## Cấu hình goClaw

Gộp vào `config.json` (xem mẫu `deploy/goclaw-mcp.example.json`):

- `command`: `node`
- `args`: `["/opt/my-website/mcp-server/index.js"]`
- `env`: `DOTENV_PATH`, `SITE_ROOT`, `NODE_ENV=production`
- `tool_prefix`: `tt_` → tool `tt_get_daily_ops_briefing`, …

Bật quyền MCP server cho agent trong dashboard goClaw.

## Test nhanh (SSH)

```bash
cd /opt/my-website/mcp-server
DOTENV_PATH=/opt/my-website/.env SITE_ROOT=/opt/my-website node index.js
```

Hoặc MCP Inspector (máy có npm):

```bash
npm run inspect --prefix mcp-server
```

## 3 tools (phase 1)

| Tool | Mô tả |
|------|--------|
| `get_daily_ops_briefing` | Pending/paid hôm nay, pending >24h, email 2/3 queue |
| `lookup_order` | Tra đơn theo id / mã CK / SĐT / email |
| `edit_landing_page` | `confirm=false` preview, `confirm=true` ghi `index.html` hoặc `.env` giá |

Telegram: map intent theo `mcp_functions_draft.md`.
