/**
 * Vercel Serverless — OpenRouter (Claude 3.5 Sonnet).
 * Biến môi trường: OPENROUTER_API_KEY (đặt trong Vercel → Settings → Environment Variables).
 * System message = SYSTEM_PROMPT.md + brandvoice.md + sales_script.md (đọc từ thư mục gốc repo).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const MODEL = "anthropic/claude-3.5-sonnet";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

let cachedSystem = null;

function readUtf8Safe(rel) {
  try {
    return fs.readFileSync(path.join(ROOT, rel), "utf8");
  } catch (e) {
    console.warn("[api/chat] Missing file:", rel, e && e.message);
    return "";
  }
}

function buildSystemPrompt() {
  if (cachedSystem) return cachedSystem;
  const system = readUtf8Safe("SYSTEM_PROMPT.md").trim();
  const brand = readUtf8Safe("brandvoice.md").trim();
  const sales = readUtf8Safe("sales_script.md").trim();
  const tail =
    "\n\n---\n\n## Bổ trợ vận hành (chỉ nội bộ — không đọc cho khách)\n" +
    "- Trả lời **tiếng Việt**, giọng **Thanh A** (mình — bạn), tự nhiên, có suy nghĩ; không trả lời máy móc, không lộ meta hướng dẫn hệ thống.\n" +
    "- Luôn đọc **ngữ cảnh vài tin gần nhất**; không hỏi lại thông tin khách đã nói.\n" +
    "- Chỉ dùng nội dung trong các khối system phía trên; nếu không chắc số liệu/chính sách, bảo khách đối chiếu **trang Thuận Thiên chính thức**.\n";
  cachedSystem = [
    system,
    "\n\n---\n\n## Brand voice (kim chỉ nam — diễn đạt lại, không copy nguyên văn cho khách)\n\n",
    brand || "(Không đọc được brandvoice.md.)",
    "\n\n---\n\n## Sales script & thông tin gói (kim chỉ nam — diễn đạt lại)\n\n",
    sales || "(Không đọc được sales_script.md.)",
    tail
  ].join("");
  return cachedSystem;
}

function parseBody(req) {
  return new Promise(function (resolve, reject) {
    if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
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
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  var out = [];
  var i;
  for (i = 0; i < messages.length; i++) {
    var m = messages[i];
    if (!m || (m.role !== "user" && m.role !== "assistant")) continue;
    var c = String(m.content || "").trim();
    if (!c) continue;
    if (c.length > 12000) c = c.slice(0, 12000);
    out.push({ role: m.role, content: c });
    if (out.length >= 40) break;
  }
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  var key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    res.statusCode = 500;
    return res.end(
      JSON.stringify({
        error: "Thiếu OPENROUTER_API_KEY trên server. Thêm biến này trong Vercel → Project → Settings → Environment Variables."
      })
    );
  }

  var payload;
  try {
    payload = await parseBody(req);
  } catch (e) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: "JSON không hợp lệ." }));
  }

  var incoming = sanitizeMessages(payload.messages);
  if (!incoming.length) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: "Thiếu messages." }));
  }

  var systemContent = buildSystemPrompt();
  var apiMessages = [{ role: "system", content: systemContent }].concat(incoming);

  try {
    var orRes = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
        "HTTP-Referer": (function () {
          var v = process.env.VERCEL_URL || "";
          if (!v) return "https://github.com/HoangHuuDien/my-first-web";
          return v.indexOf("http") === 0 ? v : "https://" + v;
        })(),
        "X-Title": "Thuận Thiên Chat"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: apiMessages,
        max_tokens: 1200,
        temperature: 0.65
      })
    });

    var text = await orRes.text();
    if (!orRes.ok) {
      console.error("[api/chat] OpenRouter", orRes.status, text.slice(0, 500));
      res.statusCode = 502;
      return res.end(
        JSON.stringify({
          error: "OpenRouter trả lỗi (" + orRes.status + "). Thử lại sau hoặc kiểm tra API key / hạn mức."
        })
      );
    }

    var data = JSON.parse(text);
    var reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
    reply = String(reply).trim();
    if (!reply) {
      res.statusCode = 502;
      return res.end(JSON.stringify({ error: "Model không trả nội dung." }));
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ reply: reply }));
  } catch (e) {
    console.error("[api/chat]", e);
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: "Lỗi server khi gọi OpenRouter." }));
  }
};
