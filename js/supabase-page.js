/** Helper Supabase client từ /js/client-env.js */
window.TT_getSupabaseClient = function () {
  var env = window.__TT_ENV__ || {};
  var url = (env.supabaseUrl || "").trim();
  var key = (env.supabaseAnonKey || "").trim();
  if (!window.supabase || !window.supabase.createClient) {
    throw new Error("Supabase SDK failed to load");
  }
  if (!url || !key) {
    throw new Error("Thiếu SUPABASE_URL / SUPABASE_ANON_KEY trong .env");
  }
  return window.supabase.createClient(url, key);
};
