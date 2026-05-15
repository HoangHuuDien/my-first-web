/** Cấu hình thanh toán SePay — dùng chung payment + thank-you */
window.TT_PAYMENT_CONFIG = {
  account: "0977611153",
  bank: "MB",
  amount: 500000,
  /** @deprecated — mỗi đơn dùng transaction_code riêng (QR des) */
  transferDesc: "TVBT500",
  giftDownloadUrl:
    "https://drive.google.com/file/d/1UUvksD7X6jgt14Y1VXBgui2ebg4jBfuB/view?usp=sharing",
};

/**
 * Mã duy nhất: tiền tố TVBT_ + 5 ký tự (A–Z, 2–9, tránh 0/O/I/1).
 * Ví dụ: TVBT_K3M9P
 */
window.TT_generateTransactionCode = function () {
  var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var s = "";
  for (var i = 0; i < 5; i += 1) {
    s += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return "TVBT_" + s;
};

/** Trạng thái coi như đã thanh toán (webhook hoặc đối soát tay) */
window.TT_isOrderPaidStatus = function (status) {
  var s = String(status || "").toLowerCase();
  return s === "paid" || s === "success";
};

window.TT_buildSepayQrUrl = function (cfg) {
  cfg = cfg || window.TT_PAYMENT_CONFIG;
  var des = cfg.transferDesc || cfg.transactionCode || "";
  var params = new URLSearchParams({
    acc: cfg.account,
    bank: cfg.bank,
    amount: String(cfg.amount),
    des: des,
  });
  return "https://qr.sepay.vn/img?" + params.toString();
};

window.TT_formatVnd = function (n) {
  return (Number(n) || 0).toLocaleString("vi-VN") + "đ";
};

window.TT_getLeadSession = function () {
  try {
    var raw = sessionStorage.getItem("tt_lead");
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

/** Chỉ cho vào trang QR khi đã có đơn orders (pending) + mã CK */
window.TT_hasOrderForPayment = function () {
  var s = window.TT_getLeadSession();
  return !!(s && s.orderId && s.transactionCode);
};

window.TT_setLeadSession = function (lead) {
  sessionStorage.setItem("tt_lead", JSON.stringify(lead));
  sessionStorage.removeItem("tt_payment_confirmed");
};

window.TT_clearLeadSession = function () {
  sessionStorage.removeItem("tt_lead");
};
