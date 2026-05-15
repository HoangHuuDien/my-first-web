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

async function notifyTelegram(text: string) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
  if (!token || !chatId) {
    console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
    return;
  }

  const res = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!res.ok) {
    console.error("Telegram error:", res.status, await res.text());
  }
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
    return jsonResponse({ success: true });
  }

  const content = String(data.content || "") + " " + String(data.description || "");
  if (!content.includes(PAYMENT_CODE)) {
    return jsonResponse({ success: true });
  }

  const amount = Number(data.transferAmount || 0);
  const formatted = amount.toLocaleString("vi-VN");

  const message =
    "💰 Thanh toán SePay thành công\n\n" +
    "Số tiền: " + formatted + "đ\n" +
    "Nội dung: " + String(data.content || "").trim() + "\n" +
    "Mã: " + String(data.code || "-") + "\n" +
    "TK: " + String(data.accountNumber || "-") + "\n" +
    "Lúc: " + String(data.transactionDate || "-");

  await notifyTelegram(message);

  return jsonResponse({ success: true });
});
