/**
 * Chay cung logic Cron email 2/3 — chi khi bat test (local hoac ENABLE_ADMIN_EMAIL_TEST).
 * Nut Admin goi POST /api/admin/run-email-sequence (khong can CRON_SECRET).
 */
const {
  runEmailSequence,
  totalSent,
} = require("../lib/email-sequence-runner");

function isAdminEmailTestEnabled() {
  if (process.env.ENABLE_ADMIN_EMAIL_TEST === "true") return true;
  if (process.env.VERCEL_ENV === "development") return true;
  if (process.env.NODE_ENV === "development") return true;
  return false;
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
    return;
  }

  if (!isAdminEmailTestEnabled()) {
    res.statusCode = 403;
    res.end(
      JSON.stringify({
        ok: false,
        error:
          "API test email tắt. Bật ENABLE_ADMIN_EMAIL_TEST=true trên Vercel (hoặc chạy local) rồi thử lại.",
      })
    );
    return;
  }

  try {
    var report = await runEmailSequence({ ignoreTiming: true });
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        ok: true,
        sent: totalSent(report),
        testMode: true,
        report: report,
      })
    );
  } catch (err) {
    console.error("[api/admin/run-email-sequence]", err);
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: err.message || String(err) }));
  }
};
