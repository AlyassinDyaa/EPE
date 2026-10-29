// POST /api/pitch: public "Get featured" form.
const { K, ROLES, HttpError, EMAIL_RE, URL_RE, ensureSeeded, hashPut, logActivity, rateLimit, text, newId, handler } = require("./_lib");

module.exports = handler(["POST"], async (req, res) => {
  const b = req.body || {};
  // Honeypot: real people never see or fill this field.
  if (b.website) return res.status(200).json({ ok: true });

  const fields = {};
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const email = typeof b.email === "string" ? b.email.trim() : "";
  const link = typeof b.link === "string" ? b.link.trim() : "";
  const message = typeof b.message === "string" ? b.message.trim() : "";
  if (name.length < 2 || name.length > 100) fields.name = "Please enter a name.";
  if (!EMAIL_RE.test(email) || email.length > 200) fields.email = "Enter an email like name@example.com.";
  if (!ROLES.includes(b.role)) fields.role = "Choose who the pitch is about.";
  if (link && (!URL_RE.test(link) || link.length > 300)) fields.link = "Links should start with http:// or https://";
  if (message.length < 20 || message.length > 1200) fields.message = "Tell us a bit more: between 20 and 1200 characters.";
  if (b.consent !== true) fields.consent = "Please tick this box so we can reply.";
  if (Object.keys(fields).length) throw new HttpError(400, "Please check the highlighted fields.", fields);

  await rateLimit(req, "pitch", 5, 3600);
  await ensureSeeded();
  const sub = {
    id: newId("sub"),
    name: text(name, { max: 100, field: "name", label: "Name" }),
    email,
    role: b.role,
    link,
    message,
    date: new Date().toISOString().slice(0, 10),
    status: "new",
  };
  await hashPut(K.subs, sub);
  await logActivity(`New pitch from ${sub.name}`);
  res.status(201).json({ ok: true });
});
