/**
 * Logic chung: quet don pending, gui Email 2/3 theo email_sequence.md.
 * Dung cho Cron (/api/process-email-sequence) va nut test Admin.
 */
const fs = require("fs");
const path = require("path");
const { Resend } = require("resend");
const { adminRest, readJson, errorFromResponse } = require("../admin/_supabase");

function getResendApiKey() {
  var fromEnv = process.env.RESEND_API_KEY && String(process.env.RESEND_API_KEY).trim();
  if (fromEnv) return fromEnv;
  var candidates = [
    path.join(process.cwd(), "resend_config.txt"),
    path.join(__dirname, "..", "..", "resend_config.txt"),
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

async function sendResendEmail(to, subject, text) {
  var apiKey = getResendApiKey();
  if (!apiKey) {
    throw new Error("Thiếu RESEND_API_KEY (hoặc resend_config.txt)");
  }
  var from =
    (process.env.RESEND_FROM && String(process.env.RESEND_FROM).trim()) ||
    "Thuận Thiên <onboarding@resend.dev>";
  var resend = new Resend(apiKey);
  var result = await resend.emails.send({
    from: from,
    to: [to],
    subject: subject,
    text: text,
  });
  if (result.error) {
    throw new Error(result.error.message || "Resend send failed");
  }
  return result.data && result.data.id;
}

function isoHoursAgo(h) {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
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

/** Cung logic voi Vercel Cron: Email 2 >= 48h, Email 3 >= 24h sau Email 2, chi pending. */
async function runEmailSequence() {
  var templates = loadSequenceTemplates();
  var report = {
    email2: { candidates: 0, sent: 0, errors: [] },
    email3: { candidates: 0, sent: 0, errors: [] },
  };
  var twoDaysAgoIso = isoHoursAgo(48);
  var oneDayAgoIso = isoHoursAgo(24);

  var q2 =
    "orders?select=id,customer_email,customer_name,created_at" +
    "&status=eq.pending" +
    "&customer_email=not.is.null" +
    "&sequence_email_2_sent_at=is.null" +
    "&created_at=lte." +
    encodeURIComponent(twoDaysAgoIso);

  var rows2 = await fetchJsonUrl(q2);
  if (!Array.isArray(rows2)) {
    throw new Error("Supabase trả về không phải mảng (email2)");
  }
  report.email2.candidates = rows2.length;

  for (var i = 0; i < rows2.length; i += 1) {
    var o2 = rows2[i];
    var email2 = o2.customer_email && String(o2.customer_email).trim();
    if (!email2) continue;
    try {
      var text2 = personalize(templates.e2.body, o2.customer_name);
      await sendResendEmail(email2, templates.e2.subject, text2);
      await patchOrder(o2.id, { sequence_email_2_sent_at: new Date().toISOString() });
      report.email2.sent += 1;
    } catch (sendErr) {
      report.email2.errors.push({ id: o2.id, error: sendErr.message || String(sendErr) });
    }
  }

  var q3 =
    "orders?select=id,customer_email,customer_name,sequence_email_2_sent_at" +
    "&status=eq.pending" +
    "&customer_email=not.is.null" +
    "&sequence_email_2_sent_at=not.is.null" +
    "&sequence_email_3_sent_at=is.null" +
    "&sequence_email_2_sent_at=lte." +
    encodeURIComponent(oneDayAgoIso);

  var rows3 = await fetchJsonUrl(q3);
  if (!Array.isArray(rows3)) {
    throw new Error("Supabase trả về không phải mảng (email3)");
  }
  report.email3.candidates = rows3.length;

  for (var j = 0; j < rows3.length; j += 1) {
    var o3 = rows3[j];
    var email3 = o3.customer_email && String(o3.customer_email).trim();
    if (!email3) continue;
    try {
      var text3 = personalize(templates.e3.body, o3.customer_name);
      await sendResendEmail(email3, templates.e3.subject, text3);
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
