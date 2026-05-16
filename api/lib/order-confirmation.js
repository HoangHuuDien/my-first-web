/**
 * Email xac nhan don hang khi status = paid | success.
 */
const fs = require("fs");
const path = require("path");
const { adminRest, readJson, errorFromResponse } = require("../admin/_supabase");
const { sendResendEmail } = require("./resend-client");

var DEFAULT_PRODUCT_NAME =
  "Tư vấn chuyên sâu Bát Tự — Sự nghiệp & Hôn nhân (buổi xem lá số)";
var DEFAULT_GIFT_URL =
  "https://drive.google.com/file/d/1UUvksD7X6jgt14Y1VXBgui2ebg4jBfuB/view?usp=sharing";
var DEFAULT_SITE_URL = "https://xembattu.vercel.app/";

var _templateCache;

function loadConfirmationTemplate() {
  if (_templateCache) return _templateCache;
  var candidates = [
    path.join(process.cwd(), "data", "order_confirmation_email.md"),
    path.join(__dirname, "..", "..", "data", "order_confirmation_email.md"),
  ];
  var md = "";
  for (var i = 0; i < candidates.length; i += 1) {
    try {
      if (fs.existsSync(candidates[i])) {
        md = fs.readFileSync(candidates[i], { encoding: "utf8" });
        break;
      }
    } catch (e) {}
  }
  if (!md) {
    throw new Error("Không đọc được data/order_confirmation_email.md");
  }
  md = md.replace(/\r\n/g, "\n");
  var block = md.match(
    /### Subject\s*\n([^\n]+)\n\n### Nội dung\s*\n\n([\s\S]+)$/
  );
  if (!block) {
    throw new Error("Parse lỗi order_confirmation_email.md");
  }
  _templateCache = { subject: block[1].trim(), body: block[2].trim() };
  return _templateCache;
}

function formatVnd(amount) {
  return (Number(amount) || 0).toLocaleString("vi-VN") + "đ";
}

function resolveProductName(order) {
  var note = (order && order.product_note && String(order.product_note).trim()) || "";
  if (note && note.indexOf("Đăng ký form") === -1) {
    return note;
  }
  return DEFAULT_PRODUCT_NAME;
}

function personalizeTemplate(str, vars) {
  var out = String(str);
  Object.keys(vars).forEach(function (key) {
    out = out.split("[" + key + "]").join(vars[key]);
  });
  return out;
}

function isPaidStatus(status) {
  var s = String(status || "").toLowerCase();
  return s === "paid" || s === "success";
}

function getOrderEmail(order) {
  var e = order && order.customer_email != null ? String(order.customer_email).trim() : "";
  return e;
}

async function fetchOrderById(orderId) {
  var path =
    "orders?select=id,customer_name,customer_email,customer_phone,amount,status,transaction_code,product_note,confirmation_email_sent_at&id=eq." +
    encodeURIComponent(String(orderId));
  var res = await adminRest(path, { method: "GET" });
  var body = await readJson(res);
  if (!res.ok) {
    throw errorFromResponse(res, body, "Supabase GET order");
  }
  if (!Array.isArray(body) || !body[0]) {
    return null;
  }
  return body[0];
}

async function markConfirmationSent(orderId) {
  var res = await adminRest("orders?id=eq." + encodeURIComponent(String(orderId)), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      confirmation_email_sent_at: new Date().toISOString(),
    }),
  });
  var body = await readJson(res);
  if (!res.ok) {
    throw errorFromResponse(res, body, "Supabase PATCH confirmation_email_sent_at");
  }
}

/**
 * @returns {{ ok: boolean, sent?: boolean, skipped?: string, reason?: string, resendId?: string }}
 */
async function trySendOrderConfirmation(orderId, options) {
  options = options || {};
  var order = await fetchOrderById(orderId);
  if (!order) {
    return { ok: false, reason: "order_not_found" };
  }

  if (!isPaidStatus(order.status)) {
    return { ok: true, skipped: "status_not_paid", status: order.status };
  }

  if (order.confirmation_email_sent_at && !options.force) {
    return { ok: true, skipped: "already_sent" };
  }

  var to = getOrderEmail(order);
  if (!to) {
    return { ok: false, reason: "missing_customer_email" };
  }

  if (options.transactionCode) {
    var expected = String(order.transaction_code || "").trim();
    var got = String(options.transactionCode).trim();
    if (!expected || expected !== got) {
      return { ok: false, reason: "transaction_code_mismatch" };
    }
  }

  var tpl = loadConfirmationTemplate();
  var giftUrl =
    (process.env.GIFT_DOWNLOAD_URL && String(process.env.GIFT_DOWNLOAD_URL).trim()) ||
    DEFAULT_GIFT_URL;
  var siteUrl =
    (process.env.SITE_URL && String(process.env.SITE_URL).trim()) || DEFAULT_SITE_URL;
  if (siteUrl.slice(-1) !== "/") siteUrl += "/";

  var name = (order.customer_name && String(order.customer_name).trim()) || "bạn";
  var vars = {
    Tên: name,
    Ten_san_pham: resolveProductName(order),
    So_tien: formatVnd(order.amount),
    Ma_don: String(order.id),
    Ma_CK: (order.transaction_code && String(order.transaction_code)) || "-",
    Link_qua: giftUrl,
    Link_trang_chu: siteUrl,
    Email_khach: to,
  };

  var subject = personalizeTemplate(tpl.subject, vars);
  var text = personalizeTemplate(tpl.body, vars);

  var resendId = await sendResendEmail(to, subject, text);
  await markConfirmationSent(order.id);

  return { ok: true, sent: true, resendId: resendId, to: to };
}

module.exports = {
  trySendOrderConfirmation: trySendOrderConfirmation,
  isPaidStatus: isPaidStatus,
  loadConfirmationTemplate: loadConfirmationTemplate,
};
