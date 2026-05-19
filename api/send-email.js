/**
 * POST /api/send-email — Resend (RESEND_API_KEY trong .env).
 */
const { sendResendEmail } = require("./lib/resend-client");

function readJsonBody(req) {
  return new Promise(function (resolve, reject) {
    if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
      return resolve(req.body);
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
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
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

  var to = body.to && String(body.to).trim();
  var text = body.text != null ? String(body.text) : "";
  var html = body.html != null ? String(body.html) : "";
  var subject = (body.subject && String(body.subject).trim()) || "Thuận Thiên — Xem Bát Tự";

  if (!to) {
    res.statusCode = 400;
    res.end(JSON.stringify({ ok: false, error: "Missing required field: to (email)" }));
    return;
  }

  if (!text && !html) {
    res.statusCode = 400;
    res.end(JSON.stringify({ ok: false, error: "Missing content: send text and/or html" }));
    return;
  }

  try {
    var id = await sendResendEmail(to, subject, text, html);
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, id: id }));
  } catch (err) {
    console.error("[api/send-email]", err);
    var status = err.message && err.message.indexOf("Thiếu RESEND") === 0 ? 503 : 502;
    res.statusCode = status;
    res.end(JSON.stringify({ ok: false, error: err.message || String(err) }));
  }
};
