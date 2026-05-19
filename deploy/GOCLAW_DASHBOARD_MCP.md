# Thêm MCP vào goClaw Dashboard (copy từng ô)

Sau khi chạy `bash deploy/mcp-install.sh` trên VPS.

| Trường | Giá trị |
|--------|---------|
| **Name / ID** | `thuan_thien_web` |
| **Transport** | `stdio` |
| **Command** | `/bin/sh` |
| **Args** | `/opt/my-website/mcp-server/run-mcp.sh` |

Sau khi `git pull`, trên VPS:

```bash
cd /opt/my-website && git pull && chmod +x mcp-server/run-mcp.sh mcp-server/check-startup.sh
bash mcp-server/check-startup.sh
```

Nếu `check-startup.sh` báo `fatal:` → gửi dòng lỗi đó. Nếu `SDK_OK` và không có `fatal` → thử **Kiểm tra kết nối** lại.

**Thử thêm nếu vẫn đỏ:** Lệnh `node`, Tham số `/opt/my-website/mcp-server/index.js` (giữ nguyên 3 env).
| **Tool prefix** | `tt_` |
| **Timeout** | `60` (giây) |

**Environment variables** (thêm từng cặp):

| Key | Value |
|-----|-------|
| `DOTENV_PATH` | `/opt/my-website/.env` |
| `SITE_ROOT` | `/opt/my-website` |
| `NODE_ENV` | `production` |

**Tools sau prefix** (agent sẽ thấy):

- `tt_get_daily_ops_briefing`
- `tt_lookup_order`
- `tt_edit_landing_page`

Bật quyền MCP server này cho agent Telegram của bạn.

**Không** dùng URL `http://127.0.0.1:3001` — MCP này không có HTTP.

### Lỗi `exec: "node"` khi Kiểm tra kết nối

goClaw chạy **Docker** — container không có `node` và chưa mount `/opt/my-website`.  
→ Làm theo **`deploy/GOCLAW_MCP_DOCKER_FIX.md`** trên VPS, rồi Kiểm tra kết nối lại.

## Test nhanh trên VPS

```bash
cd /opt/my-website/mcp-server
DOTENV_PATH=/opt/my-website/.env SITE_ROOT=/opt/my-website \
  node -e "import('./index.js')" 
# Process chờ stdin — Ctrl+C thoát; không lỗi MODULE_NOT_FOUND là OK
```

Hoặc test briefing (cần Supabase trong .env):

```bash
cd /opt/my-website/mcp-server
DOTENV_PATH=/opt/my-website/.env SITE_ROOT=/opt/my-website node --input-type=module <<'EOF'
import { loadProjectEnv } from './lib/env.js';
import { getDailyOpsBriefing } from './tools/briefing.js';
loadProjectEnv();
const r = await getDailyOpsBriefing({});
console.log(r.content[0].text.slice(0, 800));
EOF
```
