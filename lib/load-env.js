/**
 * Load .env into process.env (không ghi đè biến đã set sẵn).
 */
const fs = require("fs");
const path = require("path");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  var content = fs.readFileSync(filePath, { encoding: "utf8" });
  var lines = content.split(/\r?\n/);
  for (var i = 0; i < lines.length; i += 1) {
    var line = lines[i].trim();
    if (!line || line.charAt(0) === "#") continue;
    var eq = line.indexOf("=");
    if (eq <= 0) continue;
    var key = line.slice(0, eq).trim();
    var val = line.slice(eq + 1).trim();
    if (
      (val.charAt(0) === '"' && val.charAt(val.length - 1) === '"') ||
      (val.charAt(0) === "'" && val.charAt(val.length - 1) === "'")
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = val;
    }
  }
  return true;
}

function loadProjectEnv(rootDir) {
  rootDir = rootDir || path.join(__dirname, "..");
  loadEnvFile(path.join(rootDir, ".env"));
  var nodeEnv = process.env.NODE_ENV || "development";
  loadEnvFile(path.join(rootDir, ".env." + nodeEnv));
}

module.exports = { loadProjectEnv, loadEnvFile };
