/**
 * Supabase admin — chỉ dùng trên server (Vercel).
 * Bắt buộc: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
function getSupabaseEnv() {
  var url = (process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  var serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !serviceKey) {
    var err = new Error(
      "Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY. Thêm trong Vercel → Settings → Environment Variables."
    );
    err.code = "ENV_MISSING";
    throw err;
  }
  return { url: url, serviceKey: serviceKey };
}

async function adminRest(pathWithQuery, options) {
  var env = getSupabaseEnv();
  var headers = Object.assign(
    {
      apikey: env.serviceKey,
      Authorization: "Bearer " + env.serviceKey,
    },
    (options && options.headers) || {}
  );
  var res = await fetch(env.url + "/rest/v1/" + pathWithQuery, {
    method: (options && options.method) || "GET",
    headers: headers,
    body: options && options.body,
  });
  return res;
}

function parseCountHeader(res) {
  var range = res.headers.get("content-range") || "";
  var m = range.match(/\/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

async function readJson(res) {
  var text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    return { message: text };
  }
}

function errorFromResponse(res, body, prefix) {
  var msg =
    (body && (body.message || body.error || body.hint)) ||
    res.statusText ||
    "Lỗi Supabase";
  if (prefix) msg = prefix + ": " + msg;
  var err = new Error(msg);
  err.status = res.status;
  return err;
}

module.exports = {
  getSupabaseEnv: getSupabaseEnv,
  adminRest: adminRest,
  parseCountHeader: parseCountHeader,
  readJson: readJson,
  errorFromResponse: errorFromResponse,
};
