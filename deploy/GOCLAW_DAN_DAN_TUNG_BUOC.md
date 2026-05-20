# goClaw — dán prompt ở đâu? (click từng bước)

Bạn **không** dán prompt vào trang **Máy chủ MCP** (ảnh 2 — chỗ đã có *Thuận Thiên*). Trang đó chỉ kết nối tool, đã xong.

Prompt cron dán vào **Tác vụ định kỳ** (scheduled task / heartbeat).

---

## Bước 0 — MCP đã có rồi, bỏ qua

Sidebar → **KHẢ NĂNG** → **Máy chủ MCP**  
→ thấy *Thuận Thiên* + **stdio** + **Bật: Có** → **không cần Thêm máy chủ** nữa.

*(Chỉ khi chưa có server mới mở **+ Thêm máy chủ** — xem `GOCLAW_DASHBOARD_MCP.md`.)*

---

## Bước 1 — Cho agent Telegram được dùng MCP

1. Sidebar → **AGENTS** (hoặc **Agents** / danh sách agent).
2. Mở agent Telegram của bạn (vd. **Cát Tường**).
3. Tab **Phân quyền** (hoặc **Capabilities** / **MCP**).
4. Bật máy chủ **Thuận Thiên** / `thuan_thien_web`.
5. Lưu.

*(Hoặc: **Máy chủ MCP** → hàng Thuận Thiên → icon chìa khóa / gán agent → chọn agent Telegram.)*

---

## Bước 2 — Tạo cron 30 phút (tín hiệu 01 + 02)

1. Sidebar → **KHẢ NĂNG** → **Tác vụ định kỳ**  
   *(tiếng Anh có thể là **Scheduled tasks** / **Cron** / **Heartbeat**)*.
2. Bấm **+ Thêm** / **Tạo tác vụ**.
3. Điền form (tên field có thể khác một chút):

| Ô trong form | Điền gì |
|--------------|---------|
| **Tên** | `Poll đơn hàng 30 phút` |
| **Agent** | Agent Telegram (Cát Tường / agent bạn dùng) |
| **Lịch / Cron** | Mỗi **30 phút** — hoặc cron `*/30 * * * *` |
| **Múi giờ** | `Asia/Ho_Chi_Minh` |
| **Bật** | Có |

4. Ô **Prompt** / **Nội dung** / **Instruction** — **DÁN KHỐI NÀY**:

```
Bạn là trợ lý vận hành. Mỗi lần chạy:

1) Gọi tool tt_get_business_alerts với tham số:
   - signals: ["new_pending", "new_paid"]
   - lookback_minutes: 30

2) Đọc JSON trả về:
   - Nếu should_notify === false → KẾT THÚC, không gửi tin Telegram.
   - Nếu should_notify === true → gửi 1 tin Telegram cho chủ, tiếng Việt, tối đa 5 dòng:
     • đơn pending mới (mã CK, tên)
     • đơn vừa thanh toán (mã, số tiền)
   - Cuối tin có link admin nếu JSON có admin_url.
```

5. **Lưu** / **Bật tác vụ**.

---

## Bước 3 — Tạo cron 8h sáng (tổng kết 24h — tín hiệu 03)

1. Vẫn trong **Tác vụ định kỳ** → **+ Thêm**.
2. Điền:

| Ô | Điền |
|---|------|
| **Tên** | `Tổng kết sáng 8h` |
| **Agent** | Cùng agent Telegram |
| **Lịch** | **08:00** hàng ngày — hoặc cron `0 8 * * *` |
| **Múi giờ** | `Asia/Ho_Chi_Minh` |

3. Ô **Prompt** — **DÁN KHỐI NÀY**:

```
Bạn là trợ lý vận hành. Mỗi lần chạy (8h sáng):

1) Gọi tool tt_get_business_alerts với:
   - signals: ["daily_summary"]
   - lookback_hours: 24

2) Luôn gửi 1 tin Telegram tổng kết tiếng Việt cho chủ:
   - số đơn pending mới 24h qua
   - số đơn paid + doanh thu (VND)
   - số khách (unique email/SĐT)
   - tổng pending đang chờ (still_pending_total)
   - link admin_url
```

4. Lưu.

---

## Bước 4 — Thử nhanh (trong Dashboard)

- **Tác vụ định kỳ** → hàng vừa tạo → **Chạy ngay** / **Run now** (nếu có).
- Hoặc nhắn Telegram agent: *«Gọi tt_get_business_alerts lookback_minutes 30»* — xem có trả JSON không.

Nếu báo **không có tool** → quay lại Bước 1 (phân quyền MCP) + trên **Máy chủ MCP** bấm **Kiểm tra kết nối**.

---

## Sơ đồ “dán ở đâu”

```
Máy chủ MCP          →  ĐÃ CÓ (Thuận Thiên) — không dán prompt cron ở đây
        ↓
Phân quyền agent     →  Bật MCP cho agent Telegram
        ↓
Tác vụ định kỳ       →  DÁN PROMPT (2 task: 30 phút + 8h sáng)
        ↓
Telegram             →  Agent tự nhắn khi should_notify / tổng kết sáng
```

---

## Code MCP trên VPS

Tool `tt_get_business_alerts` cần có trên VPS (`git pull` trong `/opt/my-website`).  
Nếu chưa pull, agent sẽ không thấy tool mới dù cron đã tạo.

Chi tiết kỹ thuật: `GOCLAW_ALERTS_CRON.md`, `GOCLAW_DASHBOARD_MCP.md`.
