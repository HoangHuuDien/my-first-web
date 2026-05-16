/**
 * Logic chung: quet don pending, gui Email 2/3 theo email_sequence.md.
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

function getOrderEmail(row) {
  if (!row) return "";
  var e = row.customer_email != null ? String(row.customer_email).trim() : "";
  if (e) return e;
  var phone = row.customer_phone != null ? String(row.customer_phone).trim() : "";
  if (phone.indexOf("@") !== -1) return phone;
  return "";
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
  return { rows: Array.isArray(rows) ? rows : [], hasSequenceCols: true };
}

async function resetSequenceForPending(rows) {
  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    if (!getOrderEmail(row)) continue;
    await patchOrder(row.id, {
      sequence_email_2_sent_at: null,
      sequence_email_3_sent_at: null,
    });
  }
}

function orderNeedsEmail2(row, opts, hasSequenceCols) {
  if (!getOrderEmail(row)) return false;
  if (!hasSequenceCols) return true;
  if (row.sequence_email_2_sent_at) return false;
  if (opts.ignoreTiming) return true;
  if (!row.created_at) return false;
  return new Date(row.created_at) <= isoHoursAgo(48);
}

function orderNeedsEmail3(row, opts, hasSequenceCols) {
  if (!getOrderEmail(row)) return false;
  if (!hasSequenceCols) return false;
  if (!row.sequence_email_2_sent_at || row.sequence_email_3_sent_at) return false;
  if (opts.ignoreTiming) return true;
  return new Date(row.sequence_email_2_sent_at) <= isoHoursAgo(24);
}

function buildDiagnostics(allPending, hasSequenceCols, migrationHint) {
  var pending = allPending.length;
  var withEmail = 0;
  var missingEmail = 0;
  var alreadyE2 = 0;
  var alreadyE3 = 0;
  for (var i = 0; i < allPending.length; i += 1) {
    var r = allPending[i];
    if (getOrderEmail(r)) {
      withEmail += 1;
    } else {
      missingEmail += 1;
    }
    if (hasSequenceCols && r.sequence_email_2_sent_at) alreadyE2 += 1;
    if (hasSequenceCols && r.sequence_email_3_sent_at) alreadyE3 += 1;
  }
  return {
    pending: pending,
    withEmail: withEmail,
    missingEmail: missingEmail,
    alreadyEmail2: alreadyE2,
    alreadyEmail3: alreadyE3,
    hasSequenceCols: hasSequenceCols,
    migrationHint: migrationHint || null,
  };
}

/**
 * @param {{ ignoreTiming?: boolean, resetSequence?: boolean, sendBothEmails?: boolean, dryRun?: boolean }} opts
 */
async function runEmailSequence(opts) {
  opts = opts || {};
  var ignoreTiming = !!opts.ignoreTiming;
  var sendBothEmails = opts.sendBothEmails !== false;
  var dryRun = !!opts.dryRun;
  var templates = loadSequenceTemplates();
  var report = {
    testMode: ignoreTiming,
    resetSequence: !!opts.resetSequence,
    email2: { candidates: 0, sent: 0, errors: [] },
    email3: { candidates: 0, sent: 0, errors: [] },
    diagnostics: null,
    samples: [],
  };

  var loaded;
  try {
    loaded = await loadPendingOrders();
  } catch (loadErr) {
    var lm = (loadErr && loadErr.message) || String(loadErr);
    if (/sequence_email/i.test(lm)) {
      throw new Error(
        "Thiếu cột sequence_email_2_sent_at / sequence_email_3_sent_at trên bảng orders. " +
          "Vào Supabase → SQL Editor, chạy file migration 20260519120000_orders_sequence_email_timestamps.sql."
      );
    }
    throw loadErr;
  }

  if (opts.resetSequence && ignoreTiming && !dryRun) {
    await resetSequenceForPending(loaded.rows);
    loaded = await loadPendingOrders();
  }

  var allPending = loaded.rows;
  report.diagnostics = buildDiagnostics(allPending, loaded.hasSequenceCols, null);
  report.samples = allPending.slice(0, 8).map(function (r) {
    return {
      id: r.id,
      email: getOrderEmail(r) || null,
      e2: r.sequence_email_2_sent_at || null,
      e3: r.sequence_email_3_sent_at || null,
    };
  });

  var queue2 = [];
  var queue3 = [];
  for (var i = 0; i < allPending.length; i += 1) {
    var row = allPending[i];
    if (orderNeedsEmail2(row, opts, loaded.hasSequenceCols)) {
      queue2.push(row);
    }
    if (!ignoreTiming || !sendBothEmails) {
      if (orderNeedsEmail3(row, opts, loaded.hasSequenceCols)) {
        queue3.push(row);
      }
    }
  }

  report.email2.candidates = queue2.length;
  report.email3.candidates = queue3.length;

  if (dryRun) {
    return report;
  }

  for (var j = 0; j < queue2.length; j += 1) {
    var o2 = queue2[j];
    var email2 = getOrderEmail(o2);
    try {
      var text2 = personalize(templates.e2.body, o2.customer_name);
      await sendResendEmail(email2, templates.e2.subject, text2);
      await patchOrder(o2.id, { sequence_email_2_sent_at: new Date().toISOString() });
      report.email2.sent += 1;
    } catch (sendErr) {
      report.email2.errors.push({ id: o2.id, error: sendErr.message || String(sendErr) });
    }
  }

  if (ignoreTiming && sendBothEmails) {
    loaded = await loadPendingOrders();
    queue3 = [];
    for (var q = 0; q < loaded.rows.length; q += 1) {
      var r3 = loaded.rows[q];
      if (orderNeedsEmail3(r3, opts, loaded.hasSequenceCols)) {
        queue3.push(r3);
      }
    }
    report.email3.candidates = queue3.length;
  }

  for (var k = 0; k < queue3.length; k += 1) {
    var o3 = queue3[k];
    var email3 = getOrderEmail(o3);
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

function formatUserHint(report) {
  var d = report.diagnostics || {};
  var parts = [];
  if (d.migrationHint) parts.push(d.migrationHint);
  if (d.missingEmail > 0) {
    parts.push(
      d.missingEmail +
        " đơn pending thiếu email khách — mở tab Đơn hàng, điền Email và Lưu."
    );
  }
  if (d.pending > 0 && d.withEmail > 0 && totalSent(report) === 0) {
    if (d.alreadyEmail2 >= d.withEmail && report.email3.candidates === 0) {
      parts.push("Các đơn có email đã gửi Email 2 trước đó (chờ Email 3 hoặc đã xong).");
    }
  }
  return parts.join(" ");
}

module.exports = {
  runEmailSequence: runEmailSequence,
  totalSent: totalSent,
  formatUserHint: formatUserHint,
  loadSequenceTemplates: loadSequenceTemplates,
};
