import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const PAYMENT_CODE = "TVBT500";

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

function paymentHaystack(data: Record<string, unknown>) {
  return [data.content, data.description, data.code]
    .map(function (v) {
      return String(v || "");
    })
    .join(" ");
}

function matchesPaymentCode(data: Record<string, unknown>) {
  return paymentHaystack(data).includes(PAYMENT_CODE);
}

async function notifyTelegram(text: string) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
  if (!token || !chatId) {
    console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in Edge Function secrets");
    return { ok: false, reason: "missing_telegram_secrets" };
  }

  const res = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Telegram API error:", res.status, errText);
    return { ok: false, reason: "telegram_api_error", detail: errText };
  }

  return { ok: true };
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
  const hasCode = matchesPaymentCode(data);

  const message =
    (hasCode ? "💰 Thanh toán SePay (mã TVBT500)\n\n" : "💰 Tiền vào tài khoản (SePay webhook)\n\n") +
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
    payment_code_matched: hasCode,
    ...(telegram.ok ? {} : { telegram_error: telegram.reason }),
  });
});
