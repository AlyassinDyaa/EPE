/* East Park Entertainment — API client and shared helpers for the site and dashboard. */
(function () {
  "use strict";

  const ROLES = {
    creator: "Comic creator",
    author: "Author",
    artist: "Artist",
    writer: "Writer",
    shop: "Comic shop",
  };

  const COLORS = ["yellow", "red", "blue", "mint", "violet"];

  async function api(path, { method = "GET", body } = {}) {
    let res;
    try {
      res = await fetch(path, {
        method,
        credentials: "same-origin",
        headers: body !== undefined ? { "Content-Type": "application/json", "X-EPE": "1" } : { "X-EPE": "1" },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      const err = new Error("Can't reach the server. Check your connection and try again.");
      err.status = 0;
      throw err;
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* non-JSON response */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status}).`);
      err.status = res.status;
      err.fields = data && data.fields;
      throw err;
    }
    return data;
  }

  // Public content. Falls back to the bundled starter content when there's no working API.
  async function loadPublic() {
    try {
      return await api("/api/public");
    } catch (e) {
      // 404/405: plain static hosting. 503: backend deployed but not configured yet.
      if (![404, 405, 501, 503].includes(e.status)) throw e;
      const seed = await (await fetch("data/seed.json")).json();
      return {
        offline: true,
        settings: seed.settings,
        interviews: seed.interviews.filter((i) => i.status === "published").sort((a, b) => b.date.localeCompare(a.date)),
        shops: seed.shops,
      };
    }
  }

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const initials = (name) => String(name).split(/\s+/).filter((w) => /^[\p{L}]/u.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  const fmtDate = (iso, opts = { day: "numeric", month: "short", year: "numeric" }) => {
    const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
    return isNaN(d) ? "" : d.toLocaleDateString(undefined, opts);
  };

  window.EPE = { api, loadPublic, esc, initials, fmtDate, ROLES, COLORS };
})();
