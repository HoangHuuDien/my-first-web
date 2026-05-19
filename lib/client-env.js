/** Cấu hình public cho trình duyệt (từ process.env — không chứa service role / OpenRouter). */
function getClientEnv() {
  return {
    supabaseUrl: (process.env.SUPABASE_URL || "").trim(),
    supabaseAnonKey: (
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      ""
    ).trim(),
    makeWebhookUrl: (process.env.MAKE_WEBHOOK_URL || "").trim(),
    siteUrl: (process.env.SITE_URL || "").trim().replace(/\/$/, ""),
    payment: {
      account: (process.env.PAYMENT_ACCOUNT || "0977611153").trim(),
      bank: (process.env.PAYMENT_BANK || "MB").trim(),
      amount: Number(process.env.PAYMENT_AMOUNT || 500000) || 500000,
      giftDownloadUrl: (process.env.GIFT_DOWNLOAD_URL || "").trim(),
    },
  };
}

function renderClientEnvScript() {
  var payload = getClientEnv();
  return (
    "window.__TT_ENV__=" +
    JSON.stringify(payload) +
    ";\n"
  );
}

module.exports = { getClientEnv, renderClientEnvScript };
