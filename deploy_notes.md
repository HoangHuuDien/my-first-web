# deploy_notes.md — VPS production

## Stack dự án

| Thành phần | Công nghệ |
|------------|-----------|
| Frontend | HTML/CSS/JS tĩnh (`index.html`, `payment/`, `thank-you/`, `admin/`) |
| Server | **Node.js ≥18** — `server.js` (HTTP native, không Express) phục vụ static + API |
| API | `api/*.js` (chat OpenRouter, Resend email, admin Supabase, cron email) |
| Database web | **Supabase** (Postgres) — admin/orders qua REST |
| `brain.db` | SQLite local (legacy) — **không dùng trong code hiện tại**; đã `.gitignore` |
| Webhook thanh toán | Supabase Edge Function `sepay-webhook` (host trên Supabase) |

Client config (Supabase anon, Make webhook, payment): server sinh động tại **`GET /js/client-env.js`** từ `.env`.

---

## Git / GitHub

- Repo: **https://github.com/HoangHuuDien/my-first-web** (đã có `origin/main`)
- Không tạo repo `my-website` vì remote đã tồn tại.

---

## Biến `.env` trên VPS (bắt buộc điền đủ)

Copy từ `.env.example` → `/var/www/my-first-web/.env` (hoặc thư mục clone của bạn).

| Biến | Bắt buộc | Ghi chú |
|------|----------|---------|
| `NODE_ENV` | Có | `production` |
| `PORT` | Có | Mặc định `3000` (nginx proxy vào đây) |
| `OPENROUTER_API_KEY` | Có | Chat `/api/chat` |
| `OPENROUTER_MODEL` | Không | Mặc định trong code |
| `SUPABASE_URL` | Có | |
| `SUPABASE_ANON_KEY` | Có | Publishable — lộ ra browser qua `client-env.js` |
| `SUPABASE_SERVICE_ROLE_KEY` | Có | **Mật** — admin + cron |
| `RESEND_API_KEY` | Có | Email |
| `RESEND_FROM` | Khuyến nghị | Domain đã verify Resend |
| `CRON_SECRET` | Có | Cron email + webhook gọi send-confirmation |
| `ORDER_CONFIRM_SECRET` | Không | Fallback |
| `SITE_URL` | Có | URL production (subdomain VPS) |
| `GIFT_DOWNLOAD_URL` | Không | Link quà email |
| `PAYMENT_ACCOUNT` | Có | Số TK SePay QR |
| `PAYMENT_BANK` | Có | VD `MB` |
| `PAYMENT_AMOUNT` | Có | VD `500000` |
| `MAKE_WEBHOOK_URL` | Có | Chat widget |
| `TELEGRAM_BOT_TOKEN` | Có | Form đơn mới (server) |
| `TELEGRAM_CHAT_ID` | Có | |

**Supabase Edge** (Dashboard, không file `.env` web): `SEPAY_WEBHOOK_API_KEY`, `TELEGRAM_*`, `SITE_URL`, `CRON_SECRET` — cập nhật `SITE_URL` sau khi đổi domain.

Lấy thêm từ Vercel (nếu còn): `OPENROUTER_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.

---

## Chạy server

```bash
cd /path/to/my-first-web
npm install
cp .env.example .env   # rồi sửa giá trị thật
npm start
```

- Lệnh: `node server.js` (script `npm start`)
- **Cổng lắng nghe:** `process.env.PORT` hoặc **3000**
- Log: `my-first-web listening on http://localhost:3000`

### PM2 (khuyến nghị)

```bash
pm2 start ecosystem.config.js
pm2 save
```

### Cron email (thay Vercel cron)

```cron
0 7 * * * curl -sS -X POST https://YOUR_DOMAIN/api/process-email-sequence -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Nginx

Xem mẫu `deploy/nginx.example.conf` — proxy `/api/` và `/js/client-env.js` → `127.0.0.1:3000`, static có thể do nginx hoặc Node.

---

## Không upload lên VPS

- `resend_config.txt` (đã bỏ đọc file — chỉ `.env`)
- `.env` từ máy dev (tạo `.env` riêng trên server)
- `brain.db` (local legacy)
