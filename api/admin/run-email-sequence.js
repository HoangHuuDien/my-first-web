/**
 * Admin test: POST gui Email 2/3 (bo qua 48h/24h, reset lich, gui ca 2+3).
 */
const {
  runEmailSequence,
  totalSent,
  formatUserHint,
} = require("../lib/email-sequence-runner");

function isAdminEmailTestEnabled() {
  if (process.env.ENABLE_ADMIN_EMAIL_TEST === "true") return true;
  if (process.env.VERCEL_ENV === "development") return true;
  if (process.env.NODE_ENV === "development") return true;
  return false;
}

function readRequestBody(req) {
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

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (!isAdminEmailTestEnabled()) {
    res.statusCode = 403;
    res.end(
      JSON.stringify({
        ok: false,
        error:
          "API test email tắt. Bật ENABLE_ADMIN_EMAIL_TEST=true trên Vercel rồi Redeploy.",
      })
    );
    return;
  }

  if (req.method === "GET") {
    try {
      var preview = await runEmailSequence({
        ignoreTiming: true,
        resetSequence: false,
        sendBothEmails: false,
        dryRun: true,
      });
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          ok: true,
          dryRun: true,
          diagnostics: preview.diagnostics,
          samples: preview.samples,
        })
      );
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ ok: false, error: err.message || String(err) }));
    }
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
    return;
  }

  var body = {};
  try {
    body = await readRequestBody(req);
  } catch (e) {
    res.statusCode = 400;
    res.end(JSON.stringify({ ok: false, error: "Invalid JSON body" }));
    return;
  }

  try {
    var report = await runEmailSequence({
      ignoreTiming: true,
      resetSequence: body.resetSequence !== false,
      sendBothEmails: body.sendBothEmails !== false,
    });
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        ok: true,
        sent: totalSent(report),
        testMode: true,
        hint: formatUserHint(report),
        report: report,
      })
    );
  } catch (err) {
    console.error("[api/admin/run-email-sequence]", err);
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: err.message || String(err) }));
  }
};
