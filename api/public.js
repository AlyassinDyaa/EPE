// GET /api/public: everything the public site needs. Published content only.
const { K, ensureSeeded, hashValues, getSettings, handler } = require("./_lib");

module.exports = handler(["GET"], async (req, res) => {
  await ensureSeeded();
  const [settings, interviews, shops] = await Promise.all([getSettings(), hashValues(K.interviews), hashValues(K.shops)]);
  // Browsers always revalidate; only Vercel's CDN caches briefly, so dashboard edits appear within ~30s.
  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  res.setHeader("CDN-Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
  res.status(200).json({
    settings: { announcement: settings.announcement, showAnnouncement: settings.showAnnouncement, followers: settings.followers },
    interviews: interviews.filter((i) => i.status === "published").sort((a, b) => b.date.localeCompare(a.date)),
    shops: shops.sort((a, b) => a.name.localeCompare(b.name)),
  });
});
