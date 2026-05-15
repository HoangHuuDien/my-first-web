const { getSupabaseAdmin } = require("./_supabase");

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  var supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    res.statusCode = 503;
    return res.end(
      JSON.stringify({ ok: false, error: e.message, code: e.code || "NO_SUPABASE" })
    );
  }

  try {
    var tables = {};
    for (var i = 0; i < ["products", "customers", "orders"].length; i++) {
      var t = ["products", "customers", "orders"][i];
      var { count, error } = await supabase
        .from(t)
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      tables[t] = count ?? 0;
    }
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        ok: true,
        source: "supabase",
        tables: tables,
      })
    );
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: err.message || String(err) }));
  }
};
