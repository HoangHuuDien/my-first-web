/**
 * POST — gui email xac nhan don (paid/success).
 *
 * Auth (mot trong hai):
 * 1) Authorization: Bearer <ORDER_CONFIRM_SECRET hoac CRON_SECRET>
 *    Body: { "orderId": 123 }
 * 2) Khach tu trang thank-you (khong can secret):
 *    Body: { "orderId": 123, "transactionCode": "TVBT_XXXXX" }
 */
const { trySendOrderConfirmation } = require("../lib/order-confirmation");

function readJsonBody(req) {
  return new Promise(function (resolve, reject) {
    if (req.body && typeof req.body === "object") {
      resolve(req.body);
      return;
    }
    var chunks = [];
    req.on("data", function (c) {
      chunks.push(c);
    });
    req.on("end", function () {
      try {
        var raw = Buffer.concat(chunks).toString("utf8");
        if (!raw.trim()) return resolve({});
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function assertInternalAuth(req) {
  var secret =
    (process.env.ORDER_CONFIRM_SECRET && String(process.env.ORDER_CONFIRM_SECRET).trim()) ||
    (process.env.CRON_SECRET && String(process.env.CRON_SECRET).trim()) ||
    "";
  if (!secret) return false;
  var auth = (req.headers.authorization || "").trim();
  return auth === "Bearer " + secret;
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
    return;
  }

  var body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    res.statusCode = 400;
    res.end(JSON.stringify({ ok: false, error: "Invalid JSON body" }));
    return;
  }

  var orderId = body.orderId != null ? Number(body.orderId) : NaN;
  if (!orderId || !Number.isFinite(orderId)) {
    res.statusCode = 400;
    res.end(JSON.stringify({ ok: false, error: "Thiếu orderId hợp lệ" }));
    return;
  }

  var internal = assertInternalAuth(req);
  var txCode = body.transactionCode && String(body.transactionCode).trim();

  if (!internal && !txCode) {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        ok: false,
        error: "Cần Authorization Bearer (server) hoặc transactionCode (thank-you)",
      })
    );
    return;
  }

  try {
    var result = await trySendOrderConfirmation(orderId, {
      transactionCode: internal ? undefined : txCode,
    });
    res.statusCode = result.ok ? 200 : 400;
    res.end(JSON.stringify({ ok: result.ok, result: result }));
  } catch (err) {
    console.error("[api/orders/send-confirmation]", err);
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: err.message || String(err) }));
  }
};
