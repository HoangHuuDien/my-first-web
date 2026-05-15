const fs = require("fs");
const path = require("path");

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

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (!Database) {
    res.statusCode = 503;
    return res.end(
      JSON.stringify({ ok: false, error: "Chạy npm install trong my-first-web" })
    );
  }
  var dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) {
    res.statusCode = 503;
    return res.end(
      JSON.stringify({
        ok: false,
        error: "Chưa có brain.db — chạy python my-brain/sync_data_to_brain.py",
      })
    );
  }
  try {
    var db = new Database(dbPath, { readonly: true });
    var tables = {};
    ["products", "customers", "orders"].forEach(function (t) {
      tables[t] = db.prepare("SELECT COUNT(*) AS n FROM " + t).get().n;
    });
    db.close();
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, db_path: dbPath, tables: tables }));
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
};
