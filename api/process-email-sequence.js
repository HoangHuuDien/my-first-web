/**
 * Email sequence cron DISABLED - returns immediately without sending.
 * Previously: Cron gui Email 2/3 theo lich 48h / 24h.
 */
module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET" && req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
    return;
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, disabled: true, sent: 0 }));
};
