# MCP functions — Phase 1 (3 function đã chọn)

**Đã chốt build:** `get_daily_ops_briefing`, `lookup_order`, `edit_landing_page`  
**Kênh:** Telegram (goClaw) → MCP server trên VPS → Supabase / file landing (`index.html`, `.env` cho giá CK).

**Site production:** https://xembattu.thuanthienkinhdich.com

---

## 1. `get_daily_ops_briefing`

| | |
|---|---|
| **Input** | `date` (string, optional — `YYYY-MM-DD`, mặc định hôm nay `Asia/Ho_Chi_Minh`) |
| **Output** | Text/JSON tóm tắt: số đơn `pending` / `paid` (hôm nay + tổng), danh sách `pending` > 24h (id, tên, mã CK, Zalo, email, ngày tạo), số đơn đủ điều kiện email 2 & 3 (logic `email-sequence-runner`), link admin |
| **Tình huống hàng ngày** | Sáng mở Telegram — biết hôm nay chase ai, ai đã trả, ai sắp nhận email nurture. |
| **Ưu tiên** | **5** |

**Backend:** Supabase `orders` + tái dùng `orderNeedsEmail2/3` từ `api/lib/email-sequence-runner.js`.

### Ví dụ câu nhắn Telegram → trigger function này

- «Hôm nay có đơn gì?»
- «Briefing sáng nay»
- «Còn bao nhiêu đơn chưa thanh toán?»
- «Ai pending quá 24 giờ rồi?»
- «Tổng kết đơn hàng hôm nay»
- «/briefing» hoặc «/don hang» (nếu map slash command)

---

## 2. `lookup_order`

| | |
|---|---|
| **Input** | Ít nhất một: `order_id` (number), `transaction_code` (string, vd. `TVBT_K3M9P`), `phone` (string), `email` (string) |
| **Output** | Chi tiết đơn (hoặc list nếu trùng): status, amount, mã CK, email/Zalo, timestamp email 2/3 & xác nhận, gợi ý bước tiếp theo |
| **Tình huống hàng ngày** | Khách nhắn «em CK rồi» kèm mã hoặc SĐT — tra ngay không mở admin. |
| **Ưu tiên** | **5** |

**Backend:** Supabase REST qua `api/admin/_supabase.js` → bảng `orders`.

### Ví dụ câu nhắn Telegram → trigger function này

- «Tra mã TVBT_AB12X»
- «Đơn của Nguyễn Văn A SĐT 09xx»
- «Email khach@gmail.com đã đăng ký chưa»
- «Lookup order 42»
- «Kiểm tra đơn mã CK TVBT_K3M9P»
- «Số 0977611153 có đơn pending không»

---

## 3. `edit_landing_page`

Sửa nội dung landing **qua chat** — không SSH, không mở file. Agent đọc `index.html` (+ tuỳ chọn `js/payment-config.js` / `.env` cho **giá hiển thị & QR**), áp thay đổi có kiểm soát.

| | |
|---|---|
| **Input** | `instruction` (string, required) — mô tả tiếng Việt muốn đổi gì; `section` (string, optional) — gợi ý vùng: `hero_title` \| `hero_intro` \| `offer` \| `register_headline` \| `quote` \| `page_title` \| `price` \| `cta_button`; `new_text` (string, optional) — nếu user paste nội dung thay thế chính xác; `confirm` (boolean, default `false`) — `false` = chỉ preview/diff, `true` = ghi file + reload (hoặc `git pull` deploy flow trên VPS) |
| **Output** | `preview`: đoạn cũ → mới; `applied`: file đã sửa, URL xem lại; `warnings` nếu instruction mơ hồ; với `price`: báo đã đổi `PAYMENT_AMOUNT` trong `.env` (cần `systemctl restart mywebsite` nếu đổi env) |
| **Tình huống hàng ngày** | Đổi headline, giá 500k→…, câu quote, tiêu đề form đăng ký — test copy mới trong vài phút từ điện thoại. |
| **Ưu tiên** | **4** |

**Phạm vi file (phase 1):**

| `section` | File / vị trí |
|-----------|----------------|
| `hero_title`, `hero_intro`, `offer`, `register_headline`, `quote`, `page_title` | `index.html` (selector/CSS class đã map sẵn trong MCP) |
| `price` | `.env` → `PAYMENT_AMOUNT` (+ đồng bộ hiển thị QR qua `client-env.js`) |
| `cta_button` | Text nút submit trong `index.html` |

**An toàn:** Chỉ user Telegram được phép; mọi lần `confirm=true` log lại + nên backup/commit trước khi apply.

### Ví dụ câu nhắn Telegram → trigger function này

- «Đổi tiêu đề landing thành: [paste câu mới]» → `section=hero_title`, `new_text=...`
- «Sửa đoạn intro hero: Mình hỗ trợ bạn nhìn rõ sự nghiệp trong 90 phút...»
- «Giá trên web còn 450000» → `section=price`
- «Đổi câu quote cuối form thành: ...»
- «Preview: đổi headline ngắn hơn, bớt chữ thử và sai» → `confirm=false`
- «Ok apply thay đổi landing vừa preview» → `confirm=true`
- «Đổi nút form thành: Gửi đăng ký nhận suất tư vấn»
- «Cập nhật landing: tăng giá lên 550k và đổi tiêu đề như sau: ...» (một instruction, agent tách 2 thay đổi)

---

## Map intent → function (cho goClaw / router)

| Ý định trong tin nhắn | Function |
|----------------------|----------|
| Tổng quan đơn, briefing, pending, hôm nay | `get_daily_ops_briefing` |
| Tra mã CK, SĐT, email, id đơn | `lookup_order` |
| Sửa web, landing, tiêu đề, giá, quote, form, copy trang chủ | `edit_landing_page` |

---

## Ghi chú implement

- MCP server trên VPS (`/opt/my-website` hoặc repo riêng), gọi Supabase service role cho 2 function đơn hàng.
- `edit_landing_page`: đọc/ghi `index.html` trên disk production; sau apply có thể `systemctl restart mywebsite` (static HTML không cần restart trừ khi đổi `.env`).
- Xác thực: chỉ `TELEGRAM_CHAT_ID` / allowlist user id của bạn.
- Build sau (không nằm phase 1): `update_order_status`, `run_email_sequence`, `search_sales_knowledge`.
