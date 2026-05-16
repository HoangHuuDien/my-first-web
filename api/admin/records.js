const {
  getSupabaseEnv,
  adminRest,
  readJson,
  errorFromResponse,
} = require("./_supabase");
const {
  trySendOrderConfirmation,
  isPaidStatus,
} = require("../lib/order-confirmation");

var VIEWS = {
  products: {
    table: "products",
    kind: "content",
    listSelect: "id,source_path,slug,title,price_hint,updated_at",
    searchFields: ["title", "slug", "source_path"],
  },
  customers: {
    table: "customers",
    kind: "content",
    listSelect: "id,source_path,slug,title,tags,updated_at",
    searchFields: ["title", "slug", "source_path"],
  },
  knowledge: {
    table: "knowledge",
    kind: "content",
    listSelect: "id,source_path,slug,title,category,updated_at",
    searchFields: ["title", "slug", "source_path", "category"],
  },
  orders: {
    table: "orders",
    kind: "sales",
    listSelect:
      "id,customer_name,customer_phone,customer_email,amount,status,transaction_code,created_at",
    searchFields: [
      "customer_name",
      "customer_phone",
      "customer_email",
      "status",
      "transfer_content",
      "transaction_code",
    ],
  },
};

function getView(req) {
  var view =
    (req.query && req.query.view) ||
    (req.body && req.body.view) ||
    "";
  if (!VIEWS[view]) {
    var err = new Error("view không hợp lệ: " + view);
    err.code = "BAD_VIEW";
    throw err;
  }
  return { key: view, cfg: VIEWS[view] };
}

function buildListPath(cfg, q) {
  var orderCol = cfg.kind === "sales" ? "created_at" : "id";
  var path =
    cfg.table +
    "?select=" +
    encodeURIComponent(cfg.listSelect) +
    "&order=" +
    orderCol +
    ".desc" +
    "&limit=200";

  if (q && cfg.searchFields && cfg.searchFields.length) {
    var pattern = encodeURIComponent("%" + q + "%");
    var parts = cfg.searchFields.map(function (f) {
      return f + ".ilike." + pattern;
    });
    path += "&or=(" + parts.join(",") + ")";
  }
  return path;
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  try {
    getSupabaseEnv();
    var viewInfo = getView(req);
    var cfg = viewInfo.cfg;
    var table = cfg.table;

    if (req.method === "GET") {
      var id = req.query && req.query.id;
      if (id) {
        var onePath = table + "?select=*&id=eq." + encodeURIComponent(id);
        var oneRes = await adminRest(onePath);
        var oneBody = await readJson(oneRes);
        if (!oneRes.ok) throw errorFromResponse(oneRes, oneBody, table);
        var row = Array.isArray(oneBody) ? oneBody[0] : oneBody;
        if (!row) {
          res.status(404).json({ error: "Không tìm thấy bản ghi." });
          return;
        }
        res.status(200).json({ data: row });
        return;
      }

      var q = (req.query && req.query.q) || "";
      var listPath = buildListPath(cfg, String(q).trim());
      var listRes = await adminRest(listPath);
      var listBody = await readJson(listRes);
      if (!listRes.ok) throw errorFromResponse(listRes, listBody, table);
      res.status(200).json({ data: listBody || [] });
      return;
    }

    if (req.method === "POST") {
      var insertPayload = req.body && req.body.payload;
      if (!insertPayload || typeof insertPayload !== "object") {
        res.status(400).json({ error: "Thiếu payload." });
        return;
      }
      var insRes = await adminRest(table, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(insertPayload),
      });
      var insBody = await readJson(insRes);
      if (!insRes.ok) throw errorFromResponse(insRes, insBody, table);
      res.status(200).json({ data: insBody });
      return;
    }

    if (req.method === "PATCH") {
      var patchId = req.body && req.body.id;
      var patchPayload = req.body && req.body.payload;
      if (!patchId || !patchPayload) {
        res.status(400).json({ error: "Thiếu id hoặc payload." });
        return;
      }
      var patchPath =
        table + "?id=eq." + encodeURIComponent(String(patchId));
      var patchRes = await adminRest(patchPath, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(patchPayload),
      });
      var patchBody = await readJson(patchRes);
      if (!patchRes.ok) throw errorFromResponse(patchRes, patchBody, table);

      if (
        table === "orders" &&
        patchPayload.status &&
        isPaidStatus(patchPayload.status)
      ) {
        trySendOrderConfirmation(patchId).catch(function (err) {
          console.error("[admin/records] order confirmation email:", err);
        });
      }

      res.status(200).json({ data: patchBody });
      return;
    }

    if (req.method === "DELETE") {
      var delId = (req.query && req.query.id) || (req.body && req.body.id);
      if (!delId) {
        res.status(400).json({ error: "Thiếu id." });
        return;
      }
      var delPath = table + "?id=eq." + encodeURIComponent(String(delId));
      var delRes = await adminRest(delPath, { method: "DELETE" });
      if (!delRes.ok) {
        var delBody = await readJson(delRes);
        throw errorFromResponse(delRes, delBody, table);
      }
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    var status =
      e.code === "ENV_MISSING"
        ? 503
        : e.code === "BAD_VIEW"
          ? 400
          : e.status && e.status >= 400 && e.status < 600
            ? e.status
            : 500;
    res.status(status).json({
      error: e.message || String(e),
      code: e.code || "RECORDS_ERROR",
    });
  }
};
