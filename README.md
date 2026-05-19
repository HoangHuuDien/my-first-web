# my-first-web — Thuận Thiên

Landing + chat AI + form lead + thanh toán SePay + admin + email tự động.

## Cấu trúc

| Thư mục | Mô tả |
| --- | --- |
| `index.html`, `payment/`, `thank-you/` | Frontend tĩnh |
| `api/` | API Node (Vercel Serverless hoặc `server.js` trên VPS) |
| `data/` | Prompt, brandvoice, email template |
| `supabase/` | Migrations + Edge Function `sepay-webhook` |

## Yêu cầu

- Node.js **18+**
- Tài khoản: [Supabase](https://supabase.com), [OpenRouter](https://openrouter.ai), [Resend](https://resend.com), SePay (webhook)

## Biến môi trường

Copy `.env.example` → `.env` (local) hoặc cấu hình trên Vercel/VPS:

```bash
OPENROUTER_API_KEY=
OPENROUTER_MODEL=          # tùy chọn
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY= # chỉ server — không đưa vào HTML
RESEND_API_KEY=
RESEND_FROM=               # tùy chọn, domain đã verify
CRON_SECRET=               # cron email + webhook gọi send-confirmation
ORDER_CONFIRM_SECRET=      # tùy chọn (fallback)
SITE_URL=https://your-domain.com
GIFT_DOWNLOAD_URL=         # tùy chọn
```

**Local:** có thể dùng `resend_config.txt` (một dòng API key) — file đã `.gitignore`. **Production:** chỉ dùng `RESEND_API_KEY` env (`NODE_ENV=production` sẽ không đọc file).

Supabase Edge Function `sepay-webhook`: xem `deploy_checklist.md` mục secrets.

## Deploy trên Vercel (khuyến nghị)

1. Import repo GitHub vào [Vercel](https://vercel.com).
2. Root directory: `my-first-web` (nếu repo monorepo).
3. Thêm toàn bộ biến env ở trên.
4. Deploy — `vercel.json` đã cấu hình cron `0 7 * * *` → `/api/process-email-sequence`.
5. Supabase:
   ```bash
   supabase link
   supabase db push
   supabase functions deploy sepay-webhook
   ```
6. SePay: webhook → `https://<project-ref>.supabase.co/functions/v1/sepay-webhook`
7. `SITE_URL` trên Edge Function = URL Vercel production.

## Deploy trên VPS Linux (full stack)

1. Clone repo, `cd my-first-web && npm install`
2. Tạo `.env` (không upload `resend_config.txt`)
3. Chạy API + static:
   ```bash
   export NODE_ENV=production
   node server.js
   ```
   Hoặc PM2: `pm2 start ecosystem.config.js`
4. Nginx: xem `deploy/nginx.example.conf` (proxy `/api` → port 3000, static từ thư mục gốc)
5. SSL: `certbot --nginx -d your-domain.com`
6. Cron email (thay Vercel cron):
   ```cron
   0 7 * * * curl -sS -X POST https://your-domain.com/api/process-email-sequence -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```
7. Supabase Edge Function vẫn host trên Supabase (không chạy trên VPS).

## Chạy local

```bash
npm install
# .env hoặc resend_config.txt
npx vercel dev
# hoặc: node server.js  → http://localhost:3000
```

## API routes

| Route | Method |
| --- | --- |
| `/api/chat` | POST |
| `/api/send-email` | POST |
| `/api/process-email-sequence` | GET/POST + Bearer `CRON_SECRET` |
| `/api/orders/send-confirmation` | POST |
| `/api/admin/stats` | GET |
| `/api/admin/records` | GET/POST/PATCH/DELETE |

## Bảo mật

- Không commit `.env`, `resend_config.txt`
- Bảo vệ `/admin` (nginx basic auth hoặc IP whitelist)
- Rà Supabase RLS cho anon key trên client

Chi tiết: `deploy_checklist.md`.
