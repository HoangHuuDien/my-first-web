/** Cấu hình thanh toán SePay — dùng chung payment + thank-you */
window.TT_PAYMENT_CONFIG = {
  account: "0977611153",
  bank: "MB",
  amount: 500000,
  transferDesc: "TVBT500",
  giftDownloadUrl:
    "https://drive.google.com/file/d/1UUvksD7X6jgt14Y1VXBgui2ebg4jBfuB/view?usp=sharing",
};

window.TT_buildSepayQrUrl = function (cfg) {
  cfg = cfg || window.TT_PAYMENT_CONFIG;
  var params = new URLSearchParams({
    acc: cfg.account,
    bank: cfg.bank,
    amount: String(cfg.amount),
    des: cfg.transferDesc,
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

/** Chỉ cho vào trang QR khi đã có đơn orders (pending) */
window.TT_hasOrderForPayment = function () {
  var s = window.TT_getLeadSession();
  return !!(s && s.orderId);
};

window.TT_setLeadSession = function (lead) {
  sessionStorage.setItem("tt_lead", JSON.stringify(lead));
  sessionStorage.removeItem("tt_payment_confirmed");
};

window.TT_clearLeadSession = function () {
  sessionStorage.removeItem("tt_lead");
};
