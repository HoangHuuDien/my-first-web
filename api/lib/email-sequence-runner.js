/**
 * Cron: quet don pending, gui Email 2/3 theo email_sequence.md.
 */
const fs = require("fs");
const path = require("path");
const { adminRest, readJson, errorFromResponse } = require("../admin/_supabase");
const { sendResendEmail } = require("./resend-client");

var _templatesCache;

function loadSequenceTemplates() {
  if (_templatesCache) return _templatesCache;
  var candidates = [
    path.join(process.cwd(), "data", "email_sequence.md"),
    path.join(__dirname, "..", "..", "data", "email_sequence.md"),
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
    throw new Error("Không đọc được data/email_sequence.md");
  }
  md = md.replace(/\r\n/g, "\n");
  function extract(n) {
    var head = "## Email " + n;
    var idx = md.indexOf(head);
    if (idx === -1) {
      throw new Error("Thiếu mục " + head + " trong email_sequence.md");
    }
    var slice = md.slice(idx);
    var block = slice.match(
      /### Subject\s*\n([^\n]+)\n\n###[^\n]+\n\n([\s\S]*?)\n\n---/
    );
    if (!block) {
      throw new Error("Parse lỗi mục Email " + n + " (Subject / Nội dung)");
    }
    return { subject: block[1].trim(), body: block[2].trim() };
  }
  _templatesCache = { e2: extract(2), e3: extract(3) };
  return _templatesCache;
}

function personalize(body, customerName) {
  var name = (customerName && String(customerName).trim()) || "bạn";
  return body.split("[Tên]").join(name);
}

function getOrderEmail(row) {
  if (!row) return "";
  var e = row.customer_email != null ? String(row.customer_email).trim() : "";
  if (e) return e;
  var phone = row.customer_phone != null ? String(row.customer_phone).trim() : "";
  if (phone.indexOf("@") !== -1) return phone;
  return "";
}

function isoHoursAgo(h) {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

async function fetchJsonUrl(urlPath) {
  var res = await adminRest(urlPath, { method: "GET" });
  var body = await readJson(res);
  if (!res.ok) {
    throw errorFromResponse(res, body, "Supabase GET");
  }
  return body;
}

async function patchOrder(id, fields) {
  var res = await adminRest("orders?id=eq." + id, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(fields),
  });
  var body = await readJson(res);
  if (!res.ok) {
    throw errorFromResponse(res, body, "Supabase PATCH");
  }
}

async function loadPendingOrders() {
  var fullSelect =
    "id,customer_email,customer_name,created_at,sequence_email_2_sent_at,sequence_email_3_sent_at";
  var basePath = "orders?select=" + encodeURIComponent(fullSelect) + "&status=eq.pending";
  var rows = await fetchJsonUrl(basePath);
  return Array.isArray(rows) ? rows : [];
}

function orderNeedsEmail2(row) {
  if (!getOrderEmail(row)) return false;
  if (row.sequence_email_2_sent_at) return false;
  if (!row.created_at) return false;
  return new Date(row.created_at) <= isoHoursAgo(48);
}

function orderNeedsEmail3(row) {
  if (!getOrderEmail(row)) return false;
  if (!row.sequence_email_2_sent_at || row.sequence_email_3_sent_at) return false;
  return new Date(row.sequence_email_2_sent_at) <= isoHoursAgo(24);
}

/** Email 2 >= 48h tu created_at; Email 3 >= 24h sau Email 2; chi pending. */
async function runEmailSequence() {
  var templates = loadSequenceTemplates();
  var report = {
    email2: { candidates: 0, sent: 0, errors: [] },
    email3: { candidates: 0, sent: 0, errors: [] },
  };

  var allPending;
  try {
    allPending = await loadPendingOrders();
  } catch (loadErr) {
    var lm = (loadErr && loadErr.message) || String(loadErr);
    if (/sequence_email/i.test(lm)) {
      throw new Error(
        "Thiếu cột sequence_email_2_sent_at / sequence_email_3_sent_at trên bảng orders. " +
          "Chạy migration 20260519120000_orders_sequence_email_timestamps.sql trên Supabase."
      );
    }
    throw loadErr;
  }

  var queue2 = [];
  var queue3 = [];
  for (var i = 0; i < allPending.length; i += 1) {
    var row = allPending[i];
    if (orderNeedsEmail2(row)) queue2.push(row);
    if (orderNeedsEmail3(row)) queue3.push(row);
  }

  report.email2.candidates = queue2.length;
  report.email3.candidates = queue3.length;

  for (var j = 0; j < queue2.length; j += 1) {
    var o2 = queue2[j];
    try {
      await sendResendEmail(
        getOrderEmail(o2),
        templates.e2.subject,
        personalize(templates.e2.body, o2.customer_name)
      );
      await patchOrder(o2.id, { sequence_email_2_sent_at: new Date().toISOString() });
      report.email2.sent += 1;
    } catch (sendErr) {
      report.email2.errors.push({ id: o2.id, error: sendErr.message || String(sendErr) });
    }
  }

  for (var k = 0; k < queue3.length; k += 1) {
    var o3 = queue3[k];
    try {
      await sendResendEmail(
        getOrderEmail(o3),
        templates.e3.subject,
        personalize(templates.e3.body, o3.customer_name)
      );
      await patchOrder(o3.id, { sequence_email_3_sent_at: new Date().toISOString() });
      report.email3.sent += 1;
    } catch (sendErr3) {
      report.email3.errors.push({ id: o3.id, error: sendErr3.message || String(sendErr3) });
    }
  }

  return report;
}

function totalSent(report) {
  return (report.email2.sent || 0) + (report.email3.sent || 0);
}

module.exports = {
  runEmailSequence: runEmailSequence,
  totalSent: totalSent,
  loadSequenceTemplates: loadSequenceTemplates,
};
