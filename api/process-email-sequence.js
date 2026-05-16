/**
 * Cron: gui Email 2/3 (cung logic voi nut test Admin).
 * Bao mat: Authorization: Bearer <CRON_SECRET>
 */
const {
  runEmailSequence,
  totalSent,
} = require("./lib/email-sequence-runner");

function assertCronAuth(req) {
  var secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) {
    var err = new Error("Thiếu CRON_SECRET trên server");
    err.code = "NO_CRON_SECRET";
    throw err;
  }
  var auth = (req.headers.authorization || "").trim();
  if (auth !== "Bearer " + secret) {
    var e = new Error("Unauthorized");
    e.code = "UNAUTHORIZED";
    e.status = 401;
    throw e;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET" && req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
    return;
  }

  try {
    assertCronAuth(req);
  } catch (authErr) {
    if (authErr.code === "UNAUTHORIZED") {
      res.statusCode = 401;
      res.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
      return;
    }
    res.statusCode = 503;
    res.end(JSON.stringify({ ok: false, error: authErr.message }));
    return;
  }

  try {
    var report = await runEmailSequence();
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        ok: true,
        sent: totalSent(report),
        report: report,
      })
    );
  } catch (err) {
    console.error("[api/process-email-sequence]", err);
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: err.message || String(err) }));
  }
};
