/**
 * CRUD products | customers | orders — Supabase (service role, server-only)
 */
const { getSupabaseAdmin } = require("./_supabase");

const TABLES = {
  products: true,
  customers: true,
  orders: true,
};

const LIST_COLS = {
  products: "id, source_path, slug, title, price_hint, updated_at",
  customers: "id, source_path, slug, title, tags, updated_at",
  orders: "id, source_path, slug, title, category, updated_at",
};

function checkAuth(req) {
  var token = process.env.ADMIN_TOKEN;
  if (!token) return true;
  var h = req.headers.authorization || "";
  return h === "Bearer " + token || req.headers["x-admin-token"] === token;
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    req.on("data", function (c) {
      chunks.push(c);
    });
    req.on("end", function () {
      try {
        var raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  if (!checkAuth(req)) {
    return json(res, 401, { error: "Unauthorized" });
  }

  var table = (req.query && req.query.table) || "";
  if (!TABLES[table]) {
    return json(res, 400, { error: "table phải là products | customers | orders" });
  }

  var supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    return json(res, 503, { error: e.message, code: e.code || "NO_SUPABASE" });
  }

  try {
    if (req.method === "GET") {
      var id = req.query.id;
      if (id) {
        var { data: row, error: errOne } = await supabase
          .from(table)
          .select("*")
          .eq("id", Number(id))
          .maybeSingle();
        if (errOne) throw errOne;
        if (!row) return json(res, 404, { error: "Not found" });
        return json(res, 200, { row: row });
      }
      var q = (req.query.q || "").trim();
      var limit = Math.min(Number(req.query.limit) || 200, 500);
      var query = supabase.from(table).select(LIST_COLS[table]).order("id", { ascending: true }).limit(limit);
      if (q) {
        var pattern = "%" + q + "%";
        query = query.or(
          "title.ilike." + pattern + ",slug.ilike." + pattern + ",source_path.ilike." + pattern
        );
      }
      var { data: rows, error: errList } = await query;
      if (errList) throw errList;
      return json(res, 200, { rows: rows || [], table: table, source: "supabase" });
    }

    if (req.method === "POST" || req.method === "PUT") {
      var body = await parseBody(req);
      var ts = new Date().toISOString();
      body.updated_at = ts;

      if (req.method === "POST") {
        delete body.id;
        var row = {
          source_path: body.source_path || "manual/" + (body.slug || "new"),
          slug: body.slug || "new",
          title: body.title || "",
          content: body.content || "",
          updated_at: ts,
        };
        if (table === "products") row.price_hint = body.price_hint || null;
        if (table === "customers") row.tags = body.tags || null;
        if (table === "orders") {
          row.category = body.category || null;
          row.related_product_slug = body.related_product_slug || null;
        }
        var { data: inserted, error: errIns } = await supabase
          .from(table)
          .insert([row])
          .select("id")
          .single();
        if (errIns) throw errIns;
        return json(res, 201, { id: inserted.id });
      }

      var idPut = Number(body.id);
      if (!idPut) return json(res, 400, { error: "Thiếu id" });
      delete body.id;
      delete body.source_path;
      var { error: errUp } = await supabase.from(table).update(body).eq("id", idPut);
      if (errUp) throw errUp;
      return json(res, 200, { ok: true });
    }

    if (req.method === "DELETE") {
      var delId = Number(req.query.id);
      if (!delId) return json(res, 400, { error: "Thiếu id" });
      var { error: errDel } = await supabase.from(table).delete().eq("id", delId);
      if (errDel) throw errDel;
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    return json(res, 500, { error: err.message || String(err) });
  }
};
