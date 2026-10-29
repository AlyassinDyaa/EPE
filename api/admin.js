/* /api/admin: team dashboard (requires a signed-in session).
   GET                              → all data
   POST   ?r=interviews | shops     → create
   PUT    ?r=interviews&id=…        → update interview
   PUT    ?r=submissions&id=…       → set pitch status
   PUT    ?r=settings               → update settings
   DELETE ?r=interviews|shops|submissions&id=… */
const {
  K, SUB_STATUSES, HttpError, redis, pipeline, ensureSeeded, hashValues, hashGet, hashPut,
  getSettings, logActivity, requireAdmin, cleanInterview, cleanShop, text, newId, handler,
} = require("./_lib");

const TABLES = { interviews: K.interviews, shops: K.shops, submissions: K.subs };

// Only one interview can be the cover story.
async function clearOtherFeatured(keepId) {
  const all = await hashValues(K.interviews);
  const changed = all.filter((i) => i.featured && i.id !== keepId).map((i) => ({ ...i, featured: false }));
  if (changed.length) await redis("HSET", K.interviews, ...changed.flatMap((i) => [i.id, JSON.stringify(i)]));
}

module.exports = handler(["GET", "POST", "PUT", "DELETE"], async (req, res) => {
  const session = requireAdmin(req);
  await ensureSeeded();
  const r = String(req.query.r || "");
  const id = String(req.query.id || "");
  const body = req.body || {};

  if (req.method === "GET") {
    const [settings, interviews, shops, submissions, activity, subscribers] = await Promise.all([
      getSettings(), hashValues(K.interviews), hashValues(K.shops), hashValues(K.subs),
      redis("LRANGE", K.activity, "0", "39"), redis("SCARD", K.subscribers),
    ]);
    return res.status(200).json({
      me: session.name,
      settings,
      interviews,
      shops: shops.sort((a, b) => a.name.localeCompare(b.name)),
      submissions: submissions.sort((a, b) => b.date.localeCompare(a.date)),
      activity: (activity || []).map((a) => JSON.parse(a)),
      subscribers,
    });
  }

  if (r === "settings" && req.method === "PUT") {
    const current = await getSettings();
    const next = {
      ...current,
      announcement: text(body.announcement, { max: 120, field: "announcement", label: "Announcement" }),
      showAnnouncement: !!body.showAnnouncement,
      followers: Math.max(0, Math.min(1e9, parseInt(body.followers, 10) || 0)),
    };
    await redis("SET", K.settings, JSON.stringify(next));
    await logActivity(`${session.name} updated site settings`);
    return res.status(200).json(next);
  }

  const table = TABLES[r];
  if (!table) throw new HttpError(404, "Unknown resource.");

  if (req.method === "POST") {
    if (r === "interviews") {
      const item = { id: newId("i"), ...cleanInterview(body) };
      if (item.featured) await clearOtherFeatured(item.id);
      await hashPut(table, item);
      await logActivity(`${session.name} created “${item.title}”`);
      return res.status(201).json(item);
    }
    if (r === "shops") {
      const item = { id: newId("s"), ...cleanShop(body) };
      await hashPut(table, item);
      await logActivity(`${session.name} added shop ${item.name}`);
      return res.status(201).json(item);
    }
    throw new HttpError(405, "Pitches are created from the public form.");
  }

  const existing = id && (await hashGet(table, id));
  if (!existing) throw new HttpError(404, "Not found.");

  if (req.method === "PUT") {
    if (r === "interviews") {
      // Featured-only toggle from the table, or a full edit from the editor.
      const item = Object.keys(body).length === 1 && "featured" in body
        ? { ...existing, featured: !!body.featured }
        : { ...cleanInterview(body, existing), id };
      if (item.featured) await clearOtherFeatured(id);
      await hashPut(table, item);
      await logActivity(`${session.name} updated “${item.title}”`);
      return res.status(200).json(item);
    }
    if (r === "submissions") {
      if (!SUB_STATUSES.includes(body.status)) throw new HttpError(400, "Unknown status.");
      const item = { ...existing, status: body.status };
      await hashPut(table, item);
      await logActivity(`${session.name} marked the pitch from ${item.name} as ${item.status}`);
      return res.status(200).json(item);
    }
    throw new HttpError(405, "Shops can be added or removed.");
  }

  // DELETE
  await pipeline([["HDEL", table, id]]);
  await logActivity(`${session.name} deleted ${r === "submissions" ? `the pitch from ${existing.name}` : `“${existing.title || existing.name}”`}`);
  res.status(200).json({ ok: true });
});
