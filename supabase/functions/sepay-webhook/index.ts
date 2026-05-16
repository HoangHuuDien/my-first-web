import "jsr:@supabase/functions-js/edge-runtime.d.ts";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isAuthorized(req: Request, expectedKey: string | undefined) {
  if (!expectedKey) return true;
  const auth = (req.headers.get("Authorization") || "").trim();
  const expected = "Apikey " + expectedKey.trim();
  if (auth === expected) return true;
  return auth.toLowerCase() === expected.toLowerCase();
}

/** Chuẩn hóa để so khớp nội dung CK: bỏ dấu, bỏ mọi khoảng trắng, bỏ gạch dưới (_), chữ hoa (không phân biệt hoa thường khi so). */
function normalizeMatch(s: string) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/_/g, "")
    .toUpperCase();
}

function paymentHaystack(data: Record<string, unknown>) {
  return normalizeMatch(
    [data.content, data.description, data.code].map((v) => String(v || "")).join("|"),
  );
}

function getSupabaseRest() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return { ok: false as const, reason: "missing_supabase_secrets" };
  }
  const base = supabaseUrl.replace(/\/$/, "");
  return { ok: true as const, base, serviceKey };
}

type PendingOrder = { id: number; transaction_code: string; amount: number | string };

async function fetchPendingOrdersWithCode(
  base: string,
  serviceKey: string,
): Promise<{ ok: true; rows: PendingOrder[] } | { ok: false; detail: string }> {
  const url =
    `${base}/rest/v1/orders?status=eq.pending&transaction_code=not.is.null&select=id,transaction_code,amount&order=id.desc&limit=500`;
  const res = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: "Bearer " + serviceKey,
    },
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, detail: t };
  }
  const rows = (await res.json()) as PendingOrder[];
  return { ok: true, rows: Array.isArray(rows) ? rows : [] };
}

function findOrderByTransferContent(
  haystack: string,
  rows: PendingOrder[],
  transferAmount: number,
): PendingOrder | null {
  const amount = Math.round(transferAmount);
  for (const row of rows) {
    const code = normalizeMatch(row.transaction_code || "");
    if (!code || code.length < 6) continue;
    if (!haystack.includes(code)) continue;
    const expected = Math.round(Number(row.amount) || 0);
    if (expected > 0 && Math.abs(amount - expected) > 1) continue;
    return row;
  }
  return null;
}

async function markOrderPaid(
  base: string,
  serviceKey: string,
  orderId: number,
  transferNote: string,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  const patchUrl = `${base}/rest/v1/orders?id=eq.${orderId}`;
  const res = await fetch(patchUrl, {
    method: "PATCH",
    headers: {
      apikey: serviceKey,
      Authorization: "Bearer " + serviceKey,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      status: "paid",
      transfer_content: String(transferNote || "").slice(0, 500),
      updated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, detail: t };
  }
  return { ok: true };
}

function sleep(ms: number) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

/** Gửi Telegram: tối đa 3 lần, cách nhau 1s khi lỗi mạng hoặc HTTP lỗi. */
async function notifyTelegram(text: string) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
  if (!token || !chatId) {
    console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in Edge Function secrets");
    return { ok: false, reason: "missing_telegram_secrets" };
  }

  const url = "https://api.telegram.org/bot" + token + "/sendMessage";
  const body = JSON.stringify({ chat_id: chatId, text: text });
  const maxAttempts = 3;
  const delayMs = 1000;
  let lastDetail = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (attempt > 1) {
      await sleep(delayMs);
    }
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
      });
      if (res.ok) {
        return { ok: true };
      }
      lastDetail = await res.text();
      console.error("Telegram API error (attempt " + attempt + "/" + maxAttempts + "):", res.status, lastDetail);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastDetail = msg;
      console.error("Telegram fetch failed (attempt " + attempt + "/" + maxAttempts + "):", msg);
    }
  }

  return {
    ok: false,
    reason: "telegram_api_error",
    detail: lastDetail.slice(0, 500),
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ success: false, message: "Method not allowed" }, 405);
  }

  const sepayApiKey = Deno.env.get("SEPAY_WEBHOOK_API_KEY");
  if (!isAuthorized(req, sepayApiKey)) {
    return jsonResponse({ success: false, message: "Unauthorized" }, 401);
  }

  let data: Record<string, unknown>;
  try {
    data = await req.json();
  } catch {
    return jsonResponse({ success: false, message: "Invalid JSON" }, 400);
  }

  if (data.transferType !== "in") {
    return jsonResponse({ success: true, skipped: "not_incoming_transfer" });
  }

  const amount = Number(data.transferAmount || 0);
  const formatted = amount.toLocaleString("vi-VN");
  const haystack = paymentHaystack(data);
  const rawNote =
    String(data.content || "").trim() ||
    String(data.description || "").trim() ||
    "";

  const sb = getSupabaseRest();
  let matched: PendingOrder | null = null;
  let patchOk = true;
  let patchDetail = "";

  if (sb.ok) {
    const pending = await fetchPendingOrdersWithCode(sb.base, sb.serviceKey);
    if (pending.ok) {
      matched = findOrderByTransferContent(haystack, pending.rows, amount);
      if (matched) {
        const upd = await markOrderPaid(sb.base, sb.serviceKey, matched.id, rawNote);
        patchOk = upd.ok;
        if (!upd.ok) patchDetail = upd.detail;
      }
    } else {
      console.error("fetchPendingOrders:", pending.detail);
    }
  }

  const message =
    (matched && patchOk
      ? "✅ SePay — đã khớp mã & cập nhật đơn #" + matched.id + " → paid\n\n"
      : matched && !patchOk
      ? "⚠️ SePay — khớp mã đơn #" + matched.id + " nhưng PATCH lỗi\n\n"
      : "💰 SePay — tiền vào (chưa khớp đơn pending)\n\n") +
    "Số tiền: " + formatted + "đ\n" +
    "Nội dung: " + String(data.content || "").trim() + "\n" +
    "Mô tả: " + String(data.description || "").trim() + "\n" +
    "Mã: " + String(data.code || "-") + "\n" +
    "TK: " + String(data.accountNumber || "-") + "\n" +
    "Lúc: " + String(data.transactionDate || "-");

  const telegram = await notifyTelegram(message);

  return jsonResponse({
    success: true,
    telegram_sent: telegram.ok,
    order_matched: !!matched,
    order_id: matched?.id ?? null,
    order_updated_paid: matched ? patchOk : false,
    ...(telegram.ok ? {} : { telegram_error: telegram.reason }),
    ...(matched && !patchOk ? { order_error: "patch_failed", detail: patchDetail } : {}),
  });
});
