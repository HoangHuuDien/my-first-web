const { Resend } = require("resend");

function getResendApiKey() {
  return (process.env.RESEND_API_KEY && String(process.env.RESEND_API_KEY).trim()) || "";
}

function getResendFrom() {
  return (
    (process.env.RESEND_FROM && String(process.env.RESEND_FROM).trim()) ||
    "Thuận Thiên <onboarding@resend.dev>"
  );
}

async function sendResendEmail(to, subject, text, html) {
  var apiKey = getResendApiKey();
  if (!apiKey) {
    throw new Error("Thiếu RESEND_API_KEY trong .env");
  }
  var resend = new Resend(apiKey);
  var payload = {
    from: getResendFrom(),
    to: [to],
    subject: subject,
  };
  if (text) payload.text = text;
  if (html) payload.html = html;
  if (!text && !html) {
    throw new Error("Thiếu nội dung email");
  }
  var result = await resend.emails.send(payload);
  if (result.error) {
    throw new Error(result.error.message || "Resend send failed");
  }
  return result.data && result.data.id;
}

module.exports = {
  getResendApiKey: getResendApiKey,
  getResendFrom: getResendFrom,
  sendResendEmail: sendResendEmail,
};
