import { fetchJson } from "../lib/supabase-bridge.js";

const DETAIL_SELECT =
  "id,customer_name,customer_email,customer_phone,amount,status,transaction_code,transfer_content,product_note,created_at,updated_at,sequence_email_2_sent_at,sequence_email_3_sent_at,confirmation_email_sent_at";

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

function nextStepHint(row) {
  if (!row) return null;
  if (isPaid(row.status)) {
    if (!row.confirmation_email_sent_at) {
      return "Đã thanh toán — có thể gửi email xác nhận (confirmation).";
    }
    return "Đã thanh toán và đã gửi email xác nhận.";
  }
  if (!row.sequence_email_2_sent_at) {
    return "Pending — chờ CK; email nurture 2 sau 48h từ lúc tạo đơn.";
  }
  if (row.sequence_email_2_sent_at && !row.sequence_email_3_sent_at) {
    return "Pending — đã email 2; email 3 sau 24h kể từ email 2.";
  }
  return "Pending — đã gửi cả email 2 và 3, chờ thanh toán.";
}

function formatOrder(row) {
  return {
    id: row.id,
    status: row.status,
    amount: row.amount,
    transaction_code: row.transaction_code,
    transfer_content: row.transfer_content,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    customer_email: row.customer_email,
    product_note: row.product_note,
    created_at: row.created_at,
    updated_at: row.updated_at,
    sequence_email_2_sent_at: row.sequence_email_2_sent_at,
    sequence_email_3_sent_at: row.sequence_email_3_sent_at,
    confirmation_email_sent_at: row.confirmation_email_sent_at,
    next_step: nextStepHint(row),
  };
}

async function queryOrders(filterPath) {
  const path =
    "orders?select=" +
    encodeURIComponent(DETAIL_SELECT) +
    filterPath +
    "&order=created_at.desc&limit=20";
  const rows = await fetchJson(path);
  return Array.isArray(rows) ? rows : [];
}

/**
 * lookup_order — tra Supabase orders.
 */
export async function lookupOrder(args) {
  const { order_id, transaction_code, phone, email } = args;
  if (!order_id && !transaction_code && !phone && !email) {
    return toolResult(
      {
        ok: false,
        error: "Cần ít nhất một: order_id, transaction_code, phone, email",
      },
      true
    );
  }

  try {
    let rows = [];
    if (order_id) {
      rows = await queryOrders("&id=eq." + encodeURIComponent(String(order_id)));
    } else if (transaction_code) {
      const code = String(transaction_code).trim();
      rows = await queryOrders(
        "&transaction_code=eq." + encodeURIComponent(code)
      );
      if (!rows.length) {
        rows = await queryOrders(
          "&transfer_content=eq." + encodeURIComponent(code)
        );
      }
    } else if (phone) {
      const p = String(phone).trim();
      rows = await queryOrders(
        "&customer_phone=ilike." + encodeURIComponent("%" + p + "%")
      );
    } else if (email) {
      const e = String(email).trim();
      rows = await queryOrders(
        "&customer_email=ilike." + encodeURIComponent("%" + e + "%")
      );
    }

    const data = rows.map(formatOrder);
    const payload = {
      ok: true,
      count: data.length,
      query: { order_id, transaction_code, phone, email },
      data,
      admin_url:
        (process.env.SITE_URL || "https://xembattu.thuanthienkinhdich.com")
          .replace(/\/$/, "") +
        "/admin",
    };
    if (!data.length) {
      payload.hint = "Không thấy đơn — kiểm tra mã CK / SĐT / email.";
    } else if (data.length > 1) {
      payload.hint = "Nhiều đơn trùng — xem list hoặc thu hẹp query.";
    }
    return toolResult(payload);
  } catch (err) {
    return toolResult(
      {
        ok: false,
        error: (err && err.message) || String(err),
        code: err.code || "LOOKUP_ERROR",
      },
      true
    );
  }
}
