import fs from "fs";
import path from "path";

export function readPaymentAmount(envPath) {
  if (!fs.existsSync(envPath)) return null;
  const content = fs.readFileSync(envPath, "utf8");
  const m = content.match(/^PAYMENT_AMOUNT=(.*)$/m);
  if (!m) return null;
  return Number(String(m[1]).trim()) || null;
}

export function writePaymentAmount(envPath, amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Giá không hợp lệ: " + amount);
  }
  let content = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf8")
    : "";
  const line = "PAYMENT_AMOUNT=" + Math.round(n);
  if (/^PAYMENT_AMOUNT=/m.test(content)) {
    content = content.replace(/^PAYMENT_AMOUNT=.*$/m, line);
  } else {
    content = (content.trimEnd() ? content.trimEnd() + "\n" : "") + line + "\n";
  }
  fs.writeFileSync(envPath, content, "utf8");
  return Math.round(n);
}

export function parsePriceFromText(text) {
  const digits = String(text).replace(/[^\d]/g, "");
  if (!digits) return null;
  return Number(digits);
}
