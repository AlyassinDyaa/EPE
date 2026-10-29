// /api/auth  GET: current session · POST: sign in · DELETE: sign out
const { HttpError, SESSION_HOURS, rateLimit, sign, getSession, setSessionCookie, passwordMatches, handler } = require("./_lib");

module.exports = handler(["GET", "POST", "DELETE"], async (req, res) => {
  if (req.method === "GET") {
    const s = getSession(req);
    if (!s) throw new HttpError(401, "Not signed in.");
    return res.status(200).json({ name: s.name });
  }

  if (req.method === "DELETE") {
    setSessionCookie(res, "", 0);
    return res.status(200).json({ ok: true });
  }

  if (req.headers["x-epe"] !== "1") throw new HttpError(403, "Missing request header.");
  const name = String(req.body?.name || "").trim().slice(0, 60);
  if (!name) throw new HttpError(400, "Enter your name.", { name: "Enter your name." });
  await rateLimit(req, "login", 10, 900);
  if (!passwordMatches(req.body?.password)) {
    throw new HttpError(401, "That password isn't right.", { password: "That password isn't right." });
  }
  setSessionCookie(res, sign({ name, exp: Date.now() + SESSION_HOURS * 3600 * 1000 }), SESSION_HOURS * 3600);
  res.status(200).json({ name });
});
