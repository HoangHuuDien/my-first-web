const {
  getSupabaseEnv,
  adminRest,
  parseCountHeader,
  readJson,
  errorFromResponse,
} = require("./_supabase");

var TABLES = ["products", "customers", "knowledge", "orders"];

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    getSupabaseEnv();
    var counts = {};

    for (var i = 0; i < TABLES.length; i += 1) {
      var table = TABLES[i];
      var response = await adminRest(table + "?select=id", {
        headers: { Prefer: "count=exact" },
      });
      if (!response.ok) {
        var body = await readJson(response);
        throw errorFromResponse(response, body, table);
      }
      counts[table] = parseCountHeader(response);
    }

    res.status(200).json(counts);
  } catch (e) {
    var code = e.code === "ENV_MISSING" ? 503 : 500;
    res.status(code).json({
      error: e.message || String(e),
      code: e.code || "STATS_ERROR",
    });
  }
};
