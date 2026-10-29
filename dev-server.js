/* Local development server: static files + the /api functions, no dependencies.
   Usage: node dev-server.js [port]   (default http://localhost:3000)
   Without Redis env vars the API uses an in-memory database that resets on restart. */
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const PORT = Number(process.argv[2] || process.env.PORT) || 3000;

// Optional .env.local (KEY=value lines) for local secrets. Never commit it.
const envFile = path.join(ROOT, ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
if (!process.env.SESSION_SECRET) process.env.SESSION_SECRET = crypto.randomBytes(32).toString("hex");
if (!process.env.ADMIN_PASSWORD) {
  process.env.ADMIN_PASSWORD = crypto.randomBytes(6).toString("hex");
  console.log(`\n  No ADMIN_PASSWORD set. Dashboard password for this run: ${process.env.ADMIN_PASSWORD}\n`);
}

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
};

function vercelRes(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => {
    if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(obj));
    return res;
  };
  return res;
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString();
  if (!raw) return undefined;
  if ((req.headers["content-type"] || "").includes("application/json")) {
    try { return JSON.parse(raw); } catch (e) { return raw; }
  }
  return raw;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      const name = url.pathname.slice(5).replace(/\/$/, "");
      const file = path.join(ROOT, "api", `${name}.js`);
      if (!/^[a-z-]+$/.test(name) || !fs.existsSync(file)) { res.statusCode = 404; return res.end("Not found"); }
      req.query = Object.fromEntries(url.searchParams);
      req.body = await readBody(req);
      return await require(file)(req, vercelRes(res));
    }

    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.normalize(path.join(ROOT, rel));
    const blocked = !file.startsWith(ROOT + path.sep) || /[\\/](\.|api[\\/]|node_modules)/.test(file.slice(ROOT.length));
    if (blocked || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end("Not found"); }
    res.setHeader("Content-Type", MIME[path.extname(file)] || "application/octet-stream");
    res.setHeader("Cache-Control", "no-cache");
    fs.createReadStream(file).pipe(res);
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end("Server error");
  }
}).listen(PORT, () => console.log(`  East Park dev server → http://localhost:${PORT}\n`));
