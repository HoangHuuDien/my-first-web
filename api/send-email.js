/**
 * Vercel Serverless — gửi email qua Resend.
 *
 * API Key (theo thứ tự ưu tiên):
 * 1) process.env.RESEND_API_KEY  — khuyên dùng trên Vercel (Production)
 * 2) File resend_config.txt ở thư mục gốc project (một dòng, chỉ chứa key) — tiện cho local
 *
 * Biến tùy chọn: RESEND_FROM — ví dụ "Thuận Thiên <hello@yourdomain.com>"
 * (domain phải đã verify trên Resend). Mặc định dùng onboarding@resend.dev chỉ phù hợp test.
 */
const fs = require("fs");
const path = require("path");
const { Resend } = require("resend");

function getResendApiKey() {
  var fromEnv = process.env.RESEND_API_KEY && String(process.env.RESEND_API_KEY).trim();
  if (fromEnv) return fromEnv;

  var candidates = [
    path.join(process.cwd(), "resend_config.txt"),
    path.join(__dirname, "..", "resend_config.txt"),
  ];
  for (var i = 0; i < candidates.length; i += 1) {
    try {
      if (fs.existsSync(candidates[i])) {
        var line = fs.readFileSync(candidates[i], { encoding: "utf8" }).split(/\r?\n/)[0];
        var key = (line || "").trim();
        if (key) return key;
      }
    } catch (e) {}
  }
  return "";
}

function readJsonBody(req) {
  return new Promise(function (resolve, reject) {
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

  var apiKey = getResendApiKey();
  if (!apiKey) {
    res.statusCode = 503;
    res.end(
      JSON.stringify({
        ok: false,
        error:
          "Missing Resend API key. Set RESEND_API_KEY on Vercel or add resend_config.txt locally.",
      })
    );
    return;
  }

  var from =
    (process.env.RESEND_FROM && String(process.env.RESEND_FROM).trim()) ||
    "Thuận Thiên <onboarding@resend.dev>";

  try {
    var resend = new Resend(apiKey);
    var payload = {
      from: from,
      to: [to],
      subject: subject,
    };
    if (text) payload.text = text;
    if (html) payload.html = html;

    var result = await resend.emails.send(payload);

    if (result.error) {
      console.error("[api/send-email] Resend error:", result.error);
      res.statusCode = 502;
      res.end(JSON.stringify({ ok: false, error: result.error.message || "Resend send failed" }));
      return;
    }

    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, id: result.data && result.data.id }));
  } catch (err) {
    console.error("[api/send-email]", err);
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: err.message || String(err) }));
  }
};
