import { createRequire } from "module";
import { countRows, fetchJson } from "../lib/supabase-bridge.js";
import { vnDayBounds, hoursAgoIso } from "../lib/timezone.js";

const require = createRequire(import.meta.url);
let _emailRunner;

function getEmailRunner() {
  if (!_emailRunner) {
    _emailRunner = require("../../api/lib/email-sequence-runner.js");
  }
  return _emailRunner;
}

const ORDER_LIST_SELECT =
  "id,customer_name,customer_email,customer_phone,transaction_code,created_at,status";

function toolResult(payload, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

function siteAdminUrl() {
  const base = (process.env.SITE_URL || "https://xembattu.thuanthienkinhdich.com")
    .trim()
    .replace(/\/$/, "");
  return base + "/admin";
}

function compactOrder(row) {
  return {
    id: row.id,
    name: row.customer_name || null,
    transaction_code: row.transaction_code || null,
    zalo: row.customer_phone || null,
    email: row.customer_email || null,
    created_at: row.created_at,
    status: row.status,
  };
}

/**
 * get_daily_ops_briefing — Supabase orders + logic email 2/3.
 */
export async function getDailyOpsBriefing(args) {
  try {
    const { day, startIso, endIso } = vnDayBounds(args.date);
    const pendingTotal = await countRows(
      "orders?select=id&status=eq.pending"
    );

    let paidToday = 0;
    try {
      paidToday = await countRows(
        "orders?select=id&status=in.(paid,success)&updated_at=gte." +
          encodeURIComponent(startIso) +
          "&updated_at=lte." +
          encodeURIComponent(endIso)
      );
    } catch {
      paidToday = await countRows(
        "orders?select=id&status=in.(paid,success)&created_at=gte." +
          encodeURIComponent(startIso) +
          "&created_at=lte." +
          encodeURIComponent(endIso)
      );
    }

    const cutoff24 = hoursAgoIso(24);
    const pendingOld = await fetchJson(
      "orders?select=" +
        encodeURIComponent(ORDER_LIST_SELECT) +
        "&status=eq.pending&created_at=lt." +
        encodeURIComponent(cutoff24) +
        "&order=created_at.asc&limit=50"
    );
    const pendingOver24h = (Array.isArray(pendingOld) ? pendingOld : []).map(
      compactOrder
    );

    let email2Candidates = 0;
    let email3Candidates = 0;
    try {
      const emailRunner = getEmailRunner();
      const pending = await emailRunner.loadPendingOrders();
      for (const row of pending) {
        if (emailRunner.orderNeedsEmail2(row)) email2Candidates += 1;
        if (emailRunner.orderNeedsEmail3(row)) email3Candidates += 1;
      }
    } catch (seqErr) {
      return toolResult({
        ok: false,
        error: (seqErr && seqErr.message) || String(seqErr),
        hint: "Kiểm tra cột sequence_email_* trên bảng orders.",
      }, true);
    }

    const payload = {
      ok: true,
      date: day,
      timezone: "Asia/Ho_Chi_Minh",
      summary: {
        pending_total: pendingTotal,
        paid_today: paidToday,
        pending_over_24h: pendingOver24h,
        pending_over_24h_count: pendingOver24h.length,
        email2_candidates: email2Candidates,
        email3_candidates: email3Candidates,
      },
      admin_url: siteAdminUrl(),
      notes: [
        "email2: pending ≥48h chưa gửi email 2",
        "email3: đã gửi email 2 ≥24h, chưa email 3",
      ],
    };
    return toolResult(payload);
  } catch (err) {
    return toolResult(
      {
        ok: false,
        error: (err && err.message) || String(err),
        code: err.code || "BRIEFING_ERROR",
      },
      true
    );
  }
}
