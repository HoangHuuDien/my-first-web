import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const supabasePath = path.resolve(__dirname, "../../api/admin/_supabase.js");
const sb = require(supabasePath);

export const adminRest = sb.adminRest;
export const readJson = sb.readJson;
export const errorFromResponse = sb.errorFromResponse;
export const parseCountHeader = sb.parseCountHeader;
export const getSupabaseEnv = sb.getSupabaseEnv;

export async function fetchJson(pathWithQuery) {
  getSupabaseEnv();
  const res = await adminRest(pathWithQuery, { method: "GET" });
  const body = await readJson(res);
  if (!res.ok) {
    throw errorFromResponse(res, body, "Supabase GET");
  }
  return body;
}

export async function countRows(pathWithQuery) {
  getSupabaseEnv();
  const res = await adminRest(pathWithQuery, {
    headers: { Prefer: "count=exact" },
  });
  if (!res.ok) {
    const body = await readJson(res);
    throw errorFromResponse(res, body, "Supabase count");
  }
  return parseCountHeader(res);
}
