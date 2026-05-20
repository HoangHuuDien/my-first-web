# goClaw — cron nhắn Telegram tự động

MCP tool: **`tt_get_business_alerts`** (đọc Supabase `orders`, không ghi DB).

Agent **tự gửi tin** cho bạn khi `should_notify: true` — MCP chỉ trả JSON.

## Tín hiệu (đã chốt)

| ID | `signals` | Khi nào |
|----|-----------|---------|
| 01 | `new_pending` | Đơn pending **mới** trong cửa sổ thời gian |
| 02 | `new_paid` | Đơn **vừa thanh toán** trong cửa sổ |
| 03 | `daily_summary` | **Tổng kết 24h** — đơn, khách (email/SĐT), doanh thu |

## Cron poll 01 + 02 — **đã chốt: 30 phút**

goClaw gọi MCP **2 lần/giờ**. Mỗi lần xem đơn mới / vừa paid trong **30 phút qua**.

**Cấu hình goClaw:** Scheduled task → lặp **mỗi 30 phút** (timezone `Asia/Ho_Chi_Minh`).

### Prompt copy vào task 30 phút

```
Gọi tt_get_business_alerts với:
- signals: ["new_pending", "new_paid"]
- lookback_minutes: 30

Nếu should_notify === true → nhắn chủ 1 tin ngắn tiếng Việt (tối đa 5 dòng, ưu tiên đơn mới và vừa paid).
Nếu should_notify === false → không gửi tin (im lặng).
```

(Tuỳ chọn nâng cao: lưu `checked_at` lần trước trong memory và truyền `since` thay cho `lookback_minutes`.)

## Cron 8h sáng (tổng kết 24h — tín hiệu 03)

Timezone VPS / goClaw: **Asia/Ho_Chi_Minh**.

```
Gọi tt_get_business_alerts với signals ["daily_summary"] và lookback_hours: 24.
Luôn nhắn chủ 1 tin tổng kết sáng (đơn pending mới, paid, doanh thu, số khách, link admin).
```

## Sau deploy code

```bash
cd /opt/my-website && git pull
# Dashboard goClaw: Kiểm tra kết nối MCP (để load tool mới)
```

Test nhanh trên VPS:

```bash
docker exec -u goclaw goclaw-goclaw-1 sh -c '
  cd /opt/my-website/mcp-server && \
  DOTENV_PATH=/opt/my-website/.env SITE_ROOT=/opt/my-website \
  node --input-type=module -e "
import { loadProjectEnv } from \"./lib/env.js\";
import { getBusinessAlerts } from \"./tools/alerts.js\";
loadProjectEnv();
const r = await getBusinessAlerts({ signals: [\"daily_summary\"], lookback_hours: 24 });
console.log(r.content[0].text.slice(0, 1200));
"'
```
