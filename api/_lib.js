/* Shared helpers for the East Park API (Vercel serverless functions).
   Files starting with "_" in /api are not exposed as routes. */
const crypto = require("crypto");
const seed = require("../data/seed.json");

const ON_VERCEL = !!process.env.VERCEL;
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const K = {
  seeded: "epe:seeded",
  settings: "epe:settings",
  interviews: "epe:interviews",
  shops: "epe:shops",
  subs: "epe:submissions",
  activity: "epe:activity",
  subscribers: "epe:subscribers",
};

const ROLES = ["creator", "author", "artist", "writer", "shop"];
const STATUSES = ["draft", "scheduled", "published"];
const SUB_STATUSES = ["new", "approved", "declined"];
const COLORS = ["yellow", "red", "blue", "mint", "violet"];

class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

/* ---------- Redis (Upstash REST) with an in-memory stand-in for local dev ---------- */

const mem = globalThis.__epeMem || (globalThis.__epeMem = { data: new Map(), exp: new Map() });

function memGet(k) {
  const e = mem.exp.get(k);
  if (e && e < Date.now()) { mem.data.delete(k); mem.exp.delete(k); }
  return mem.data.get(k);
}

function memCmd([c, k, ...a]) {
  const v = memGet(k);
  switch (c.toUpperCase()) {
    case "GET": return v ?? null;
    case "SET": {
      if (a.includes("NX") && v !== undefined) return null;
      mem.data.set(k, String(a[0]));
      return "OK";
    }
    case "DEL": return mem.data.delete(k) ? 1 : 0;
    case "EXISTS": return v !== undefined ? 1 : 0;
    case "INCR": { const n = Number(v || 0) + 1; mem.data.set(k, String(n)); return n; }
    case "EXPIRE": { if (v !== undefined && !(a[1] === "NX" && mem.exp.has(k))) mem.exp.set(k, Date.now() + Number(a[0]) * 1000); return 1; }
    case "HSET": { const h = v || new Map(); for (let i = 0; i < a.length; i += 2) h.set(a[i], String(a[i + 1])); mem.data.set(k, h); return 1; }
    case "HGET": return v ? v.get(a[0]) ?? null : null;
    case "HDEL": return v && v.delete(a[0]) ? 1 : 0;
    case "HGETALL": return v ? [...v].flat() : [];
    case "LPUSH": { const l = v || []; l.unshift(...a.map(String).reverse()); mem.data.set(k, l); return l.length; }
    case "LTRIM": { if (v) mem.data.set(k, v.slice(Number(a[0]), Number(a[1]) + 1)); return "OK"; }
    case "LRANGE": return v ? v.slice(Number(a[0]), Number(a[1]) + 1) : [];
    case "SADD": { const s = v || new Set(); const before = s.size; a.forEach((x) => s.add(x)); mem.data.set(k, s); return s.size - before; }
    case "SCARD": return v ? v.size : 0;
    default: throw new Error(`memCmd: unsupported ${c}`);
  }
}

function assertDb() {
  if (!REDIS_URL || !REDIS_TOKEN) {
    if (ON_VERCEL) throw new HttpError(503, "Database not configured. In Vercel, add Upstash Redis under Storage and redeploy.");
    return false;
  }
  return true;
}

async function redis(...args) {
  if (!assertDb()) return memCmd(args);
  const res = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(`Redis error: ${json.error || res.status}`);
  return json.result;
}

async function pipeline(commands) {
  if (!commands.length) return [];
  if (!assertDb()) return commands.map(memCmd);
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Redis pipeline error: ${res.status}`);
  return json.map((r) => {
    if (r.error) throw new Error(`Redis error: ${r.error}`);
    return r.result;
  });
}

/* ---------- Data access ---------- */

// First request on an empty database writes the seed content. SET NX makes sure only one request does it.
async function ensureSeeded() {
  if (await redis("EXISTS", K.seeded)) return;
  if ((await redis("SET", K.seeded, new Date().toISOString(), "NX")) !== "OK") return;
  const cmds = [["SET", K.settings, JSON.stringify(seed.settings)]];
  const hset = (key, items) => items.length && cmds.push(["HSET", key, ...items.flatMap((x) => [x.id, JSON.stringify(x)])]);
  hset(K.interviews, seed.interviews);
  hset(K.shops, seed.shops);
  hset(K.subs, seed.submissions);
  await pipeline(cmds);
}

async function hashValues(key) {
  const flat = (await redis("HGETALL", key)) || [];
  const out = [];
  for (let i = 0; i < flat.length; i += 2) out.push(JSON.parse(flat[i + 1]));
  return out;
}

async function hashGet(key, id) {
  const raw = await redis("HGET", key, id);
  return raw ? JSON.parse(raw) : null;
}

const hashPut = (key, item) => redis("HSET", key, item.id, JSON.stringify(item));

async function getSettings() {
  const raw = await redis("GET", K.settings);
  return { ...seed.settings, ...(raw ? JSON.parse(raw) : {}) };
}

async function logActivity(text) {
  await pipeline([
    ["LPUSH", K.activity, JSON.stringify({ t: new Date().toISOString(), text })],
    ["LTRIM", K.activity, "0", "39"],
  ]);
}

/* ---------- Rate limiting ---------- */

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  return (fwd ? String(fwd).split(",")[0] : req.socket?.remoteAddress || "unknown").trim();
}

async function rateLimit(req, bucket, max, windowSec) {
  const key = `epe:rl:${bucket}:${crypto.createHash("sha256").update(clientIp(req)).digest("hex").slice(0, 24)}`;
  const n = await redis("INCR", key);
  if (n === 1) await redis("EXPIRE", key, String(windowSec));
  if (n > max) throw new HttpError(429, "Too many requests. Please try again later.");
}

/* ---------- Sessions (signed, HttpOnly cookie) ---------- */

const COOKIE = "epe_session";
const SESSION_HOURS = 12;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new HttpError(503, "SESSION_SECRET is not configured (use at least 32 random characters).");
  return s;
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function verify(token) {
  if (!token || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  const expected = crypto.createHmac("sha256", secret()).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    return p.exp > Date.now() ? p : null;
  } catch (e) { return null; }
}

function readCookie(req, name) {
  const header = req.headers.cookie || "";
  const m = header.split(/;\s*/).find((c) => c.startsWith(name + "="));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}

function setSessionCookie(res, value, maxAgeSec) {
  const parts = [`${COOKIE}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Strict", `Max-Age=${maxAgeSec}`];
  if (ON_VERCEL) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function getSession(req) {
  return verify(readCookie(req, COOKIE));
}

function requireAdmin(req) {
  const s = getSession(req);
  if (!s) throw new HttpError(401, "Please sign in.");
  // Custom header can't be sent cross-site without a CORS preflight, which we never allow.
  if (req.method !== "GET" && req.headers["x-epe"] !== "1") throw new HttpError(403, "Missing request header.");
  return s;
}

function passwordMatches(input) {
  const real = process.env.ADMIN_PASSWORD;
  if (!real || real.length < 8) throw new HttpError(503, "ADMIN_PASSWORD is not configured (use at least 8 characters).");
  const a = crypto.createHash("sha256").update(String(input || "")).digest();
  const b = crypto.createHash("sha256").update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

/* ---------- Validation ---------- */

function text(v, { max = 200, min = 0, field, label }) {
  const s = typeof v === "string" ? v.trim() : "";
  if (s.length < min) throw new HttpError(400, `${label} is required.`, { [field]: min > 1 ? `${label} needs at least ${min} characters.` : `${label} is required.` });
  if (s.length > max) throw new HttpError(400, `${label} is too long.`, { [field]: `${label} must be ${max} characters or fewer.` });
  return s;
}

function oneOf(v, list, fallback) {
  return list.includes(v) ? v : fallback;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/\S+\.\S+$/;

function cleanInterview(input, existing = {}) {
  const i = input || {};
  const date = typeof i.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(i.date) ? i.date : null;
  if (!date) throw new HttpError(400, "Pick a date.", { date: "Pick a date." });
  return {
    ...existing,
    name: text(i.name, { min: 1, max: 100, field: "name", label: "Guest name" }),
    role: oneOf(i.role, ROLES, "creator"),
    title: text(i.title, { min: 1, max: 160, field: "title", label: "Headline" }),
    location: text(i.location, { min: 1, max: 100, field: "location", label: "Location" }),
    date,
    readTime: Math.min(120, Math.max(1, parseInt(i.readTime, 10) || 5)),
    status: oneOf(i.status, STATUSES, "draft"),
    color: oneOf(i.color, COLORS, "yellow"),
    featured: !!i.featured,
    quote: text(i.quote, { max: 300, field: "quote", label: "Pull quote" }),
    excerpt: text(i.excerpt, { min: 1, max: 600, field: "excerpt", label: "Summary" }),
    tags: (Array.isArray(i.tags) ? i.tags : []).map((t) => String(t).trim().slice(0, 40)).filter(Boolean).slice(0, 12),
    qa: (Array.isArray(i.qa) ? i.qa : [])
      .map((x) => ({ q: String(x?.q || "").trim().slice(0, 500), a: String(x?.a || "").trim().slice(0, 4000) }))
      .filter((x) => x.q && x.a)
      .slice(0, 40),
  };
}

function cleanShop(input) {
  const s = input || {};
  return {
    name: text(s.name, { min: 1, max: 100, field: "name", label: "Shop name" }),
    city: text(s.city, { min: 1, max: 80, field: "city", label: "City" }),
    country: text(s.country, { min: 1, max: 80, field: "country", label: "Country" }),
    specialty: text(s.specialty, { max: 120, field: "specialty", label: "Specialty" }) || "Independent comic shop",
    color: oneOf(s.color, COLORS, "yellow"),
  };
}

const newId = (prefix) => prefix + crypto.randomBytes(6).toString("hex");

/* ---------- Handler wrapper ---------- */

function handler(methods, fn) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      if (!methods.includes(req.method)) {
        res.setHeader("Allow", methods.join(", "));
        throw new HttpError(405, "Method not allowed.");
      }
      if (req.body && typeof req.body === "string") {
        try { req.body = JSON.parse(req.body); } catch (e) { throw new HttpError(400, "Invalid JSON."); }
      }
      await fn(req, res);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) console.error(err);
      res.status(status).json({
        error: err instanceof HttpError ? err.message : "Something went wrong on our side.",
        ...(err.fields ? { fields: err.fields } : {}),
      });
    }
  };
}

module.exports = {
  K, ROLES, STATUSES, SUB_STATUSES, COLORS, HttpError, EMAIL_RE, URL_RE, SESSION_HOURS,
  redis, pipeline, ensureSeeded, hashValues, hashGet, hashPut, getSettings, logActivity,
  rateLimit, sign, getSession, requireAdmin, setSessionCookie, passwordMatches,
  text, oneOf, cleanInterview, cleanShop, newId, handler,
};
