// POST /api/subscribe: newsletter sign-up. Emails are only readable by the team.
const { K, HttpError, EMAIL_RE, redis, rateLimit, logActivity, handler } = require("./_lib");

module.exports = handler(["POST"], async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 200) {
    throw new HttpError(400, "Enter a valid email like name@example.com.", { email: "Enter a valid email like name@example.com." });
  }
  await rateLimit(req, "subscribe", 10, 3600);
  const added = await redis("SADD", K.subscribers, email);
  if (added) await logActivity("New newsletter subscriber");
  // Same response either way, so the form can't be used to check who is subscribed.
  res.status(200).json({ ok: true });
});
