/**
 * CRUD brain.db — products | customers | orders
 * DB: brain.db ở thư mục gốc my-first-web (sau khi chạy sync)
 */
const fs = require("fs");
const path = require("path");

const TABLES = {
  products: ["id", "source_path", "slug", "title", "content", "price_hint", "updated_at"],
  customers: ["id", "source_path", "slug", "title", "content", "tags", "updated_at"],
  orders: [
    "id",
    "source_path",
    "slug",
    "title",
    "content",
    "category",
    "related_product_slug",
    "updated_at",
  ],
};

let Database;
try {
  Database = require("better-sqlite3");
} catch (e) {
  Database = null;
}

function getDbPath() {
  var env = process.env.BRAIN_DB_PATH;
  if (env && fs.existsSync(env)) return env;
  var candidates = [
    path.join(process.cwd(), "brain.db"),
    path.join(__dirname, "..", "..", "brain.db"),
    path.join(process.cwd(), "data", "brain.db"),
    path.join(__dirname, "..", "..", "data", "brain.db"),
    path.join(__dirname, "..", "..", "..", "my-brain", "brain.db"),
  ];
  for (var i = 0; i < candidates.length; i++) {
    if (fs.existsSync(candidates[i])) return candidates[i];
  }
  return candidates[0];
}

function openDb() {
  if (!Database) {
    var err = new Error("better-sqlite3 chưa cài. Chạy: npm install");
    err.code = "NO_SQLITE";
    throw err;
  }
  var dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) {
    var missing = new Error(
      "Chưa có brain.db. Chạy: python my-brain/sync_data_to_brain.py"
    );
    missing.code = "NO_DB";
    throw missing;
  }
  return new Database(dbPath, { readonly: false });
}

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

  var cols = TABLES[table];

  try {
    var db = openDb();
  } catch (e) {
    return json(res, 503, {
      error: e.message,
      code: e.code || "DB_ERROR",
    });
  }

  try {
    if (req.method === "GET") {
      var id = req.query.id;
      if (id) {
        var row = db.prepare("SELECT * FROM " + table + " WHERE id = ?").get(Number(id));
        db.close();
        if (!row) return json(res, 404, { error: "Not found" });
        return json(res, 200, { row: row });
      }
      var q = (req.query.q || "").trim();
      var limit = Math.min(Number(req.query.limit) || 200, 500);
      var sql =
        "SELECT id, source_path, slug, title, " +
        (table === "products"
          ? "price_hint"
          : table === "customers"
            ? "tags"
            : "category") +
        ", updated_at FROM " +
        table;
      var params = [];
      if (q) {
        sql +=
          " WHERE title LIKE ? OR slug LIKE ? OR source_path LIKE ?";
        var like = "%" + q + "%";
        params = [like, like, like];
      }
      sql += " ORDER BY id ASC LIMIT ?";
      params.push(limit);
      var rows = db.prepare(sql).all.apply(db.prepare(sql), params);
      db.close();
      return json(res, 200, { rows: rows, table: table });
    }

    if (req.method === "POST" || req.method === "PUT") {
      var body = await parseBody(req);
      var ts = new Date().toISOString();
      if (req.method === "POST") {
        if (table === "products") {
          db.prepare(
            "INSERT INTO products (source_path, slug, title, content, price_hint, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
          ).run(
            body.source_path || "manual/" + (body.slug || "new"),
            body.slug || "new",
            body.title || "",
            body.content || "",
            body.price_hint || null,
            ts
          );
        } else if (table === "customers") {
          db.prepare(
            "INSERT INTO customers (source_path, slug, title, content, tags, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
          ).run(
            body.source_path || "manual/" + (body.slug || "new"),
            body.slug || "new",
            body.title || "",
            body.content || "",
            body.tags || null,
            ts
          );
        } else {
          db.prepare(
            "INSERT INTO orders (source_path, slug, title, content, category, related_product_slug, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
          ).run(
            body.source_path || "manual/" + (body.slug || "new"),
            body.slug || "new",
            body.title || "",
            body.content || "",
            body.category || null,
            body.related_product_slug || null,
            ts
          );
        }
        var lastId = db.prepare("SELECT last_insert_rowid() AS id").get().id;
        db.close();
        return json(res, 201, { id: lastId });
      }

      var idPut = Number(body.id);
      if (!idPut) {
        db.close();
        return json(res, 400, { error: "Thiếu id" });
      }
      var sets = [];
      var vals = [];
      cols.forEach(function (c) {
        if (c === "id" || c === "source_path") return;
        if (body[c] !== undefined) {
          sets.push(c + " = ?");
          vals.push(body[c]);
        }
      });
      sets.push("updated_at = ?");
      vals.push(ts);
      vals.push(idPut);
      db.prepare(
        "UPDATE " + table + " SET " + sets.join(", ") + " WHERE id = ?"
      ).run(...vals);
      db.close();
      return json(res, 200, { ok: true });
    }

    if (req.method === "DELETE") {
      var delId = Number(req.query.id);
      if (!delId) {
        db.close();
        return json(res, 400, { error: "Thiếu id" });
      }
      db.prepare("DELETE FROM " + table + " WHERE id = ?").run(delId);
      db.close();
      return json(res, 200, { ok: true });
    }

    db.close();
    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    try {
      db.close();
    } catch (e2) {}
    return json(res, 500, { error: err.message });
  }
};
