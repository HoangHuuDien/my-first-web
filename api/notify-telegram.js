/**
 * POST /api/notify-telegram — gửi Telegram từ server (token không lộ ra browser).
 * Body JSON: { text: string } hoặc { orderId, fullName, email, zalo, transactionCode }
 */
async function sendTelegram(text) {
  var token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  var chatId = (process.env.TELEGRAM_CHAT_ID || "").trim();
  if (!token || !chatId) {
    var err = new Error("Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID");
    err.code = "ENV_MISSING";
    throw err;
  }
  var res = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: String(text || "").slice(0, 4000) }),
  });
  if (!res.ok) {
    var body = await res.text();
    throw new Error("Telegram API " + res.status + ": " + body.slice(0, 300));
  }
  return true;
}

function buildOrderText(body) {
  return (
    "📩 Đơn mới từ form (chờ thanh toán)\n\n" +
    "Mã đơn: #" + body.orderId + "\n" +
    "Mã CK: " + (body.transactionCode || "-") + "\n" +
    "Tên khách: " + (body.fullName || "-") + "\n" +
    "Email: " + (body.email || "-") + "\n" +
    "SĐT/Zalo: " + (body.zalo || "-") + "\n" +
    "Trạng thái: pending"
  );
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
  }

  var body = req.body && typeof req.body === "object" ? req.body : {};
  var text = body.text && String(body.text).trim();
  if (!text && body.orderId != null) {
    text = buildOrderText(body);
  }
  if (!text) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "Missing text or order fields" }));
  }

  try {
    await sendTelegram(text);
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true }));
  } catch (e) {
    console.error("[notify-telegram]", e);
    res.statusCode = e.code === "ENV_MISSING" ? 503 : 502;
    res.end(JSON.stringify({ ok: false, error: e.message || "Telegram failed" }));
  }
};
