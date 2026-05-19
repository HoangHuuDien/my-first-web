import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function resolveSiteRoot() {
  if (process.env.SITE_ROOT) {
    return path.resolve(process.env.SITE_ROOT);
  }
  return path.resolve(__dirname, "..", "..");
}

export function loadProjectEnv() {
  const root = resolveSiteRoot();
  const dotenvPath = process.env.DOTENV_PATH || path.join(root, ".env");
  loadEnvFile(dotenvPath);
  const nodeEnv = process.env.NODE_ENV || "development";
  loadEnvFile(path.join(root, ".env." + nodeEnv));
  return root;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, { encoding: "utf8" });
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = val;
    }
  }
  return true;
}
