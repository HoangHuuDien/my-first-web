import { countRows, fetchJson } from "../lib/supabase-bridge.js";
import { hoursAgoIso } from "../lib/timezone.js";

const ORDER_SELECT =
  "id,customer_name,customer_email,customer_phone,transaction_code,amount,status,created_at,updated_at";

const VALID_SIGNALS = ["new_pending", "new_paid", "daily_summary"];

function toolResult(payload, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

function isPaid(status) {
  const s = String(status || "").toLowerCase();
  return s === "paid" || s === "success";
}

function compactOrder(row) {
  return {
    id: row.id,
    name: row.customer_name || null,
    email: row.customer_email || null,
    zalo: row.customer_phone || null,
    transaction_code: row.transaction_code || null,
    amount: row.amount != null ? Number(row.amount) : null,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function resolveSince(args) {
  if (args.since && String(args.since).trim()) {
    const t = new Date(String(args.since).trim());
    if (Number.isNaN(t.getTime())) {
      throw new Error("since không hợp lệ (cần ISO datetime).");
    }
    return t.toISOString();
  }
  const minutes = Number(args.lookback_minutes);
  const m = Number.isFinite(minutes) && minutes > 0 ? minutes : 30;
  return hoursAgoIso(m / 60);
}

function resolveDailySince(args) {
  if (args.since && String(args.since).trim()) {
    return resolveSince(args);
  }
  const hours = Number(args.lookback_hours);
  const h = Number.isFinite(hours) && hours > 0 ? hours : 24;
  return hoursAgoIso(h);
}

function adminUrl() {
  return (
    (process.env.SITE_URL || "https://xembattu.thuanthienkinhdich.com")
      .trim()
      .replace(/\/$/, "") + "/admin"
  );
}

async function fetchOrdersSince(filterExtra) {
  const path =
    "orders?select=" +
    encodeURIComponent(ORDER_SELECT) +
    filterExtra +
    "&order=created_at.desc&limit=100";
  const rows = await fetchJson(path);
  return Array.isArray(rows) ? rows : [];
}

function uniqueCustomers(orders) {
  const keys = new Set();
  for (const row of orders) {
    const email = (row.customer_email || "").trim().toLowerCase();
    const phone = (row.customer_phone || "").trim();
    if (email) keys.add("e:" + email);
    else if (phone) keys.add("p:" + phone);
    else if (row.customer_name) keys.add("n:" + String(row.customer_name).trim());
  }
  return keys.size;
}

function sumRevenue(orders) {
  let total = 0;
  for (const row of orders) {
    if (!isPaid(row.status)) continue;
    const n = Number(row.amount);
    if (Number.isFinite(n)) total += n;
  }
  return total;
}

async function signalNewPending(sinceIso) {
  const rows = await fetchOrdersSince(
    "&status=eq.pending&created_at=gte." + encodeURIComponent(sinceIso)
  );
  return rows.map((row) => ({
    signal: "new_pending",
    priority: "high",
    message:
      "Đơn pending mới #" +
      row.id +
      " — " +
      (row.customer_name || "Khách") +
      (row.transaction_code ? " (" + row.transaction_code + ")" : ""),
    order: compactOrder(row),
  }));
}

async function signalNewPaid(sinceIso) {
  let rows;
  try {
    rows = await fetchOrdersSince(
      "&status=in.(paid,success)&updated_at=gte." + encodeURIComponent(sinceIso)
    );
  } catch {
    rows = await fetchOrdersSince(
      "&status=in.(paid,success)&created_at=gte." + encodeURIComponent(sinceIso)
    );
  }
  return rows.map((row) => ({
    signal: "new_paid",
    priority: "high",
    message:
      "Đơn đã thanh toán #" +
      row.id +
      " — " +
      (row.customer_name || "Khách") +
      (row.amount != null ? " — " + Number(row.amount).toLocaleString("vi-VN") + "đ" : ""),
    order: compactOrder(row),
  }));
}

async function signalDailySummary(sinceIso, lookbackHours) {
  const created = await fetchOrdersSince(
    "&created_at=gte." + encodeURIComponent(sinceIso)
  );
  let paidRows;
  try {
    paidRows = await fetchOrdersSince(
      "&status=in.(paid,success)&updated_at=gte." + encodeURIComponent(sinceIso)
    );
  } catch {
    paidRows = created.filter((r) => isPaid(r.status));
  }

  const pendingNew = created.filter((r) => String(r.status).toLowerCase() === "pending");
  const revenue = sumRevenue(paidRows);
  const customers = uniqueCustomers(created);
  const hoursLabel =
    Number.isFinite(lookbackHours) && lookbackHours > 0
      ? lookbackHours
      : Math.max(1, Math.round((Date.now() - new Date(sinceIso).getTime()) / 3600000));

  const summary = {
    signal: "daily_summary",
    priority: "normal",
    message:
      "Tổng kết " +
      hoursLabel +
      "h: " +
      pendingNew.length +
      " đơn pending mới, " +
      paidRows.length +
      " đơn paid, doanh thu " +
      revenue.toLocaleString("vi-VN") +
      "đ, " +
      customers +
      " khách (theo email/SĐT)",
    period_since: sinceIso,
    stats: {
      orders_created: created.length,
      pending_new: pendingNew.length,
      paid_count: paidRows.length,
      revenue_vnd: revenue,
      unique_customers: customers,
      still_pending_total: await countRows("orders?select=id&status=eq.pending"),
    },
    recent_pending: pendingNew.slice(0, 10).map(compactOrder),
    recent_paid: paidRows.slice(0, 10).map(compactOrder),
  };
  return [summary];
}

/**
 * get_business_alerts — tín hiệu cho agent chủ động nhắn Telegram.
 */
export async function getBusinessAlerts(args = {}) {
  try {
    const rawSignals = args.signals;
    let signals = VALID_SIGNALS;
    if (Array.isArray(rawSignals) && rawSignals.length) {
      signals = rawSignals.filter((s) => VALID_SIGNALS.includes(s));
      if (!signals.length) {
        return toolResult(
          {
            ok: false,
            error: "signals không hợp lệ",
            allowed: VALID_SIGNALS,
          },
          true
        );
      }
    }

    const alerts = [];
    let sinceUsed = null;

    const sincePoll = resolveSince(args);
    const sinceDaily = resolveDailySince(args);

    if (signals.includes("new_pending")) {
      sinceUsed = sincePoll;
      alerts.push(...(await signalNewPending(sincePoll)));
    }
    if (signals.includes("new_paid")) {
      sinceUsed = sinceUsed || sincePoll;
      alerts.push(...(await signalNewPaid(sincePoll)));
    }
    if (signals.includes("daily_summary")) {
      sinceUsed = sinceDaily;
      const lookbackHours = Number(args.lookback_hours);
      alerts.push(
        ...(await signalDailySummary(
          sinceDaily,
          Number.isFinite(lookbackHours) && lookbackHours > 0 ? lookbackHours : 24
        ))
      );
    }

    const payload = {
      ok: true,
      checked_at: new Date().toISOString(),
      timezone: "Asia/Ho_Chi_Minh",
      since_used: sinceUsed || sincePoll,
      signals_requested: signals,
      alerts,
      alert_count: alerts.length,
      should_notify: alerts.length > 0,
      admin_url: adminUrl(),
      hints: {
        new_pending: "Đơn pending tạo sau since_used (cron 15–30 phút: truyền since lần poll trước).",
        new_paid: "Đơn paid/success cập nhật sau since_used.",
        daily_summary:
          "Tổng kết lookback_hours (mặc định 24). Cron 8h sáng: signals=[daily_summary].",
      },
    };
    return toolResult(payload);
  } catch (err) {
    return toolResult(
      {
        ok: false,
        error: (err && err.message) || String(err),
        code: err.code || "ALERTS_ERROR",
      },
      true
    );
  }
}
