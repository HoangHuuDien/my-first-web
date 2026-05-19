/**
 * VPS production: static HTML + API (cùng handler Vercel).
 * Chạy: npm start  (đọc .env qua lib/load-env.js)
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { loadProjectEnv } = require("./lib/load-env");
const { renderClientEnvScript } = require("./lib/client-env");

loadProjectEnv(__dirname);

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;

const API_ROUTES = {
  "POST /api/chat": "./api/chat.js",
  "POST /api/send-email": "./api/send-email.js",
  "POST /api/notify-telegram": "./api/notify-telegram.js",
  "GET /api/process-email-sequence": "./api/process-email-sequence.js",
  "POST /api/process-email-sequence": "./api/process-email-sequence.js",
  "POST /api/orders/send-confirmation": "./api/orders/send-confirmation.js",
  "GET /api/admin/stats": "./api/admin/stats.js",
  "GET /api/admin/records": "./api/admin/records.js",
  "POST /api/admin/records": "./api/admin/records.js",
  "PATCH /api/admin/records": "./api/admin/records.js",
  "DELETE /api/admin/records": "./api/admin/records.js",
};

/** Giống vercel.json rewrites */
const PATH_REWRITES = {
  "/admin": "/admin/index.html",
  "/admin/": "/admin/index.html",
  "/payment": "/payment/index.html",
  "/payment/": "/payment/index.html",
  "/thank-you": "/thank-you/index.html",
  "/thank-you/": "/thank-you/index.html",
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function enhanceRes(nodeRes) {
  var state = { statusCode: 200 };
  var res = {
    get statusCode() {
      return state.statusCode;
    },
    set statusCode(v) {
      state.statusCode = v;
    },
    setHeader: function (k, v) {
      nodeRes.setHeader(k, v);
      return res;
    },
    status: function (code) {
      state.statusCode = code;
      return res;
    },
    json: function (obj) {
      if (!nodeRes.headersSent) nodeRes.statusCode = state.statusCode;
      nodeRes.setHeader("Content-Type", "application/json; charset=utf-8");
      nodeRes.end(JSON.stringify(obj));
    },
    end: function (body) {
      if (!nodeRes.headersSent) nodeRes.statusCode = state.statusCode;
      nodeRes.end(body == null ? "" : body);
    },
  };
  return res;
}

function readBody(nodeReq) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    nodeReq.on("data", function (c) {
      chunks.push(c);
    });
    nodeReq.on("end", function () {
      resolve(Buffer.concat(chunks));
    });
    nodeReq.on("error", reject);
  });
}

function resolveStaticPath(urlPath) {
  var safe = urlPath.split("?")[0];
  if (PATH_REWRITES[safe]) safe = PATH_REWRITES[safe];
  if (safe === "/") safe = "/index.html";
  if (safe.endsWith("/")) safe += "index.html";
  return safe;
}

function serveStatic(urlPath, nodeRes) {
  var safe = resolveStaticPath(urlPath);
  var filePath = path.join(ROOT, safe.replace(/^\//, "").split("/").join(path.sep));
  if (!filePath.startsWith(ROOT)) {
    nodeRes.statusCode = 403;
    nodeRes.end("Forbidden");
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    nodeRes.statusCode = 404;
    nodeRes.end("Not found");
    return;
  }
  var ext = path.extname(filePath).toLowerCase();
  nodeRes.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
  if (safe.indexOf("/admin") === 0) {
    nodeRes.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  }
  nodeRes.end(fs.readFileSync(filePath));
}

function serveClientEnv(nodeRes) {
  nodeRes.statusCode = 200;
  nodeRes.setHeader("Content-Type", "application/javascript; charset=utf-8");
  nodeRes.setHeader("Cache-Control", "no-cache");
  nodeRes.end(renderClientEnvScript());
}

const server = http.createServer(async function (nodeReq, nodeRes) {
  try {
    var url = new URL(nodeReq.url || "/", "http://localhost");
    var pathname = url.pathname;

    if (nodeReq.method === "GET" && pathname === "/js/client-env.js") {
      serveClientEnv(nodeRes);
      return;
    }

    var routeKey = nodeReq.method + " " + pathname;
    var handlerPath = API_ROUTES[routeKey];

    if (handlerPath) {
      var handler = require(path.join(ROOT, handlerPath));
      var raw = await readBody(nodeReq);
      var req = {
        method: nodeReq.method,
        url: nodeReq.url,
        headers: nodeReq.headers,
        query: Object.fromEntries(url.searchParams),
        body: undefined,
      };
      if (raw.length) {
        var ct = String(nodeReq.headers["content-type"] || "");
        if (ct.indexOf("application/json") >= 0) {
          try {
            req.body = JSON.parse(raw.toString("utf8"));
          } catch (e) {
            req.body = {};
          }
        } else {
          req.body = raw.toString("utf8");
        }
      }
      await handler(req, enhanceRes(nodeRes));
      return;
    }

    if (nodeReq.method === "GET" || nodeReq.method === "HEAD") {
      serveStatic(pathname, nodeRes);
      return;
    }

    nodeRes.statusCode = 405;
    nodeRes.end("Method not allowed");
  } catch (err) {
    console.error("[server]", err);
    if (!nodeRes.headersSent) {
      nodeRes.statusCode = 500;
      nodeRes.end("Internal Server Error");
    }
  }
});

server.listen(PORT, function () {
  console.log("my-first-web listening on http://localhost:" + PORT);
});
