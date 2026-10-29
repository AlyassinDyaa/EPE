/* East Park Entertainment — admin dashboard (talks to /api/auth and /api/admin). */
(function () {
  "use strict";

  const { api, esc, initials, fmtDate, ROLES } = window.EPE;
  const toast = window.EPEA11y.toast;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const ROUTES = { overview: "Overview", interviews: "Interviews", submissions: "Pitches", shops: "Shops", settings: "Settings" };
  const STATUS = { published: "Published", scheduled: "Scheduled", draft: "Draft", new: "New", approved: "Approved", declined: "Declined" };

  // Server data, refreshed after every change.
  let state = null;
  const get = () => state;

  /* ---------- Errors ---------- */
  function fieldError(input, msg) {
    const id = (input.getAttribute("aria-describedby") || "").split(" ").find((x) => x.endsWith("-err"));
    if (id) $("#" + id).textContent = msg;
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    input.closest(".field")?.toggleAttribute("data-invalid", !!msg);
    return !msg;
  }

  // Show server-side field errors on a form, or a toast. Sends people back to sign-in if the session expired.
  function handleError(err, form) {
    if (err.status === 401 && !$("#app").hidden) {
      toast("Your session ended. Please sign in again.");
      showLogin();
      return;
    }
    if (form && err.fields) {
      let first = null;
      Object.entries(err.fields).forEach(([name, text]) => {
        const el = form.elements[name];
        if (el) { fieldError(el, text); first = first || el; }
      });
      if (first) { first.focus(); return; }
    }
    toast(err.message);
  }

  async function busy(btn, fn) {
    if (btn) { btn.disabled = true; btn.setAttribute("aria-busy", "true"); }
    try { return await fn(); } finally { if (btn) { btn.disabled = false; btn.removeAttribute("aria-busy"); } }
  }

  /* ---------- Auth ---------- */
  function showLogin() {
    state = null;
    $("#login").hidden = false;
    $("#app").hidden = true;
    $(".skip-link").setAttribute("href", "#l-name");
  }

  async function showApp() {
    $("#login").hidden = true;
    $("#app").hidden = false;
    $(".skip-link").setAttribute("href", "#main");
    await refresh();
  }

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const name = $("#l-name"), pass = $("#l-pass");
    $("#login-alert").textContent = "";
    const ok = [
      fieldError(name, name.value.trim() ? "" : "Enter your name."),
      fieldError(pass, pass.value ? "" : "Enter the team password."),
    ];
    if (ok.includes(false)) return (ok[0] ? pass : name).focus();
    try {
      await busy($("#login-btn"), () => api("/api/auth", { method: "POST", body: { name: name.value.trim(), password: pass.value } }));
      pass.value = "";
      await showApp();
      $("#view-title").focus();
      toast(`Welcome back, ${name.value.trim().split(" ")[0]}!`);
    } catch (err) {
      if (err.fields) handleError(err, form);
      else {
        $("#login-alert").textContent = err.status === 404 ? "The dashboard needs the server running (npm run dev)." : err.message;
      }
    }
  });

  $("#sign-out").addEventListener("click", async () => {
    try { await api("/api/auth", { method: "DELETE" }); } catch (e) { /* signed out locally anyway */ }
    showLogin();
    $("#l-name").focus();
  });

  /* ---------- Data ---------- */
  async function refresh() {
    try {
      state = await api("/api/admin");
      $("#load-alert").hidden = true;
      $("#me-name").textContent = state.me;
      $("#me-avatar").textContent = initials(state.me);
      route();
    } catch (err) {
      if (err.status === 401) return showLogin();
      $("#load-alert").hidden = false;
      $("#load-alert").textContent = `Couldn't load dashboard data: ${err.message}`;
    }
  }

  /* ---------- Routing ---------- */
  function currentRoute() {
    const r = location.hash.replace("#", "");
    return ROUTES[r] ? r : "overview";
  }
  function route(focus) {
    if ($("#app").hidden || !state) return;
    const r = currentRoute();
    $$("[data-view]").forEach((v) => (v.hidden = v.dataset.view !== r));
    $$("[data-route]").forEach((a) => (a.dataset.route === r ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
    $("#view-title").textContent = ROUTES[r];
    document.title = `${ROUTES[r]} | East Park Dashboard`;
    render();
    if (focus) { window.scrollTo(0, 0); $("#view-title").focus(); }
  }
  window.addEventListener("hashchange", () => route(true));

  /* ---------- Render ---------- */
  function render() {
    const r = currentRoute();
    renderBadge();
    if (r === "overview") renderOverview();
    if (r === "interviews") renderInterviews();
    if (r === "submissions") renderSubs();
    if (r === "shops") renderShops();
    if (r === "settings") renderSettings();
  }

  function renderBadge() {
    const n = get().submissions.filter((s) => s.status === "new").length;
    const b = $("#badge-subs");
    b.hidden = n === 0;
    b.textContent = n;
    b.setAttribute("aria-label", `${n} new`);
  }

  function renderOverview() {
    const d = get();
    const pub = d.interviews.filter((i) => i.status === "published");
    const pipeline = d.interviews.filter((i) => i.status !== "published");
    const newSubs = d.submissions.filter((s) => s.status === "new").length;
    const countries = new Set([...pub.map((i) => i.location.split(",").pop().trim()), ...d.shops.map((s) => s.country)]).size;

    const hour = new Date().getHours();
    const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    $("#greeting").innerHTML = `${hello}, <strong>${esc(d.me.split(" ")[0])}</strong>. You have ${newSubs} new ${newSubs === 1 ? "pitch" : "pitches"} waiting.`;

    const kpis = [
      { label: "Published", value: pub.length, note: "interviews live", color: "yellow" },
      { label: "In the works", value: pipeline.length, note: "drafts & scheduled", color: "blue" },
      { label: "New pitches", value: newSubs, note: "need a reply", color: "red" },
      { label: "Subscribers", value: d.subscribers.toLocaleString(), note: "Sunday Panel", color: "mint" },
      { label: "Countries", value: countries, note: "on the map", color: "violet" },
    ];
    $("#kpis").innerHTML = kpis.map((k, i) => `
      <li class="kpi" data-color="${k.color}" style="--i:${i}">
        <span class="kpi__label">${k.label}</span>
        <span class="kpi__value">${esc(k.value)}</span>
        <span class="kpi__note">${k.note}</span>
      </li>`).join("");

    // Published per month, last 6 months.
    const months = [];
    const now = new Date();
    for (let m = 5; m >= 0; m--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: dt.toLocaleDateString(undefined, { month: "short" }), long: dt.toLocaleDateString(undefined, { month: "long", year: "numeric" }), n: pub.filter((i) => i.date.startsWith(key)).length });
    }
    const max = Math.max(1, ...months.map((m) => m.n));
    $("#chart").innerHTML = months.map((m, i) => `
      <div class="chart__col" aria-hidden="true"><span class="chart__val">${m.n}</span><span class="chart__bar" style="--h:${(m.n / max) * 100};--i:${i}"></span></div>`).join("");
    let labels = $(".chart__labels");
    if (!labels) { labels = document.createElement("div"); labels.className = "chart__labels"; labels.setAttribute("aria-hidden", "true"); $("#chart").after(labels); }
    labels.innerHTML = months.map((m) => `<span>${m.label}</span>`).join("");
    $("#chart-desc").textContent = "Bar chart. " + months.map((m) => `${m.long}: ${m.n}`).join("; ") + ".";

    // Category breakdown.
    const roleCount = Object.keys(ROLES).map((r) => ({ r, n: pub.filter((i) => i.role === r).length }));
    const rmax = Math.max(1, ...roleCount.map((x) => x.n));
    const roleColor = { creator: "yellow", author: "mint", artist: "red", writer: "blue", shop: "violet" };
    $("#cat-bars").innerHTML = roleCount.map((x) => `
      <li data-color="${roleColor[x.r]}">
        <div class="bars__row"><span>${ROLES[x.r]}</span><span>${x.n}</span></div>
        <div class="bars__track" role="img" aria-label="${ROLES[x.r]}: ${x.n} of ${pub.length}"><div class="bars__fill" style="--w:${(x.n / rmax) * 100}"></div></div>
      </li>`).join("");

    const next = pipeline.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
    $("#pipeline").innerHTML = next.length ? next.map((i) => `
      <li>
        <span class="avatar" data-color="${esc(i.color)}" aria-hidden="true">${esc(initials(i.name))}</span>
        <span class="grow"><strong>${esc(i.title)}</strong><small>${esc(i.name)} · ${esc(fmtDate(i.date))}</small></span>
        <span class="pill pill--${i.status}">${STATUS[i.status]}</span>
      </li>`).join("") : `<li class="empty-note">Nothing in the pipeline. Time to book some guests!</li>`;

    $("#activity").innerHTML = d.activity.length ? d.activity.slice(0, 6).map((a) => `
      <li><span>${esc(a.text)}</span><time datetime="${esc(a.t)}">${esc(fmtDate(a.t, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}</time></li>`).join("")
      : `<li class="empty-note">No activity yet.</li>`;
  }

  /* ---------- Interviews ---------- */
  let sortKey = "date", sortDir = -1;
  function renderInterviews() {
    const q = $("#iv-search").value.trim().toLowerCase();
    const st = $("#iv-status").value;
    const rows = get().interviews
      .filter((i) => (st === "all" || i.status === st) && (!q || `${i.name} ${i.title} ${i.location}`.toLowerCase().includes(q)))
      .sort((a, b) => String(a[sortKey]).localeCompare(String(b[sortKey])) * sortDir);

    $$("th[aria-sort]").forEach((th) => {
      const k = th.querySelector("button").dataset.sort;
      th.setAttribute("aria-sort", k === sortKey ? (sortDir === 1 ? "ascending" : "descending") : "none");
    });
    $("#iv-count").textContent = `${rows.length} ${rows.length === 1 ? "interview" : "interviews"}`;
    $("#iv-rows").innerHTML = rows.length ? rows.map((i) => `
      <tr>
        <td><div class="t-main"><span class="avatar" data-color="${esc(i.color)}" aria-hidden="true">${esc(initials(i.name))}</span><span><strong>${esc(i.title)}</strong><small>${esc(i.name)} · ${esc(i.location)}</small></span></div></td>
        <td><span class="tag tag--${i.role}">${ROLES[i.role]}</span></td>
        <td><span class="pill pill--${i.status}">${STATUS[i.status]}</span></td>
        <td><time datetime="${esc(i.date)}">${esc(fmtDate(i.date))}</time></td>
        <td><button type="button" class="star" data-feature="${esc(i.id)}" aria-pressed="${!!i.featured}" aria-label="Cover story: ${esc(i.title)}">${i.featured ? "★" : "☆"}</button></td>
        <td><div class="t-actions">
          <button type="button" class="btn btn--ghost btn--sm" data-edit="${esc(i.id)}">Edit<span class="visually-hidden"> ${esc(i.title)}</span></button>
          <button type="button" class="btn btn--ghost btn--sm" data-del="${esc(i.id)}">Delete<span class="visually-hidden"> ${esc(i.title)}</span></button>
        </div></td>
      </tr>`).join("") : `<tr><td colspan="6" class="empty-cell">No interviews match. Try a different search.</td></tr>`;
  }
  $("#iv-search").addEventListener("input", renderInterviews);
  $("#iv-status").addEventListener("change", renderInterviews);
  $("thead").addEventListener("click", (e) => {
    const b = e.target.closest("[data-sort]");
    if (!b) return;
    if (sortKey === b.dataset.sort) sortDir *= -1;
    else { sortKey = b.dataset.sort; sortDir = sortKey === "date" ? -1 : 1; }
    renderInterviews();
  });
  $("#iv-rows").addEventListener("click", async (e) => {
    const feat = e.target.closest("[data-feature]");
    const edit = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-del]");
    try {
      if (feat) {
        const id = feat.dataset.feature;
        const it = get().interviews.find((i) => i.id === id);
        await busy(feat, () => api(`/api/admin?r=interviews&id=${encodeURIComponent(id)}`, { method: "PUT", body: { featured: !it.featured } }));
        await refresh();
        toast(!it.featured ? `“${it.title}” is the cover story` : "Cover story cleared");
        $(`[data-feature="${id}"]`)?.focus();
      }
      if (edit) openEditor(edit.dataset.edit, edit);
      if (del) {
        const it = get().interviews.find((i) => i.id === del.dataset.del);
        if (await confirmDialog(`Delete “${it.title}”? This can't be undone.`)) {
          await api(`/api/admin?r=interviews&id=${encodeURIComponent(it.id)}`, { method: "DELETE" });
          await refresh();
          toast("Interview deleted");
          $("#iv-new").focus();
        } else del.focus();
      }
    } catch (err) { handleError(err); }
  });

  /* Editor */
  const editor = $("#editor");
  const eform = $("#editor-form");
  let editingId = null, editorReturn = null, afterSave = null;

  function qaToText(qa) { return (qa || []).map((x) => `Q: ${x.q}\nA: ${x.a}`).join("\n\n"); }
  function textToQa(t) {
    return t.split(/\n\s*\n/).map((block) => {
      const q = (block.match(/Q:\s*([\s\S]*?)(?=\nA:|$)/) || [])[1];
      const a = (block.match(/A:\s*([\s\S]*)$/) || [])[1];
      return q && a ? { q: q.trim(), a: a.trim() } : null;
    }).filter(Boolean);
  }

  function openEditor(id, returnTo, prefill, onSaved) {
    editingId = id || null;
    editorReturn = returnTo || document.activeElement;
    afterSave = onSaved || null;
    const it = id ? get().interviews.find((i) => i.id === id) : {
      name: "", role: "creator", title: "", location: "", date: new Date().toISOString().slice(0, 10),
      readTime: 6, status: "draft", color: "yellow", featured: false, quote: "", excerpt: "", tags: [], qa: [], ...prefill,
    };
    $("#editor-title").textContent = id ? "Edit interview" : "New interview";
    const f = eform.elements;
    ["name", "role", "title", "location", "date", "readTime", "status", "color", "quote", "excerpt"].forEach((k) => (f[k].value = it[k] ?? ""));
    f.featured.checked = !!it.featured;
    f.tags.value = (it.tags || []).join(", ");
    f.qa.value = qaToText(it.qa);
    $$(".error", eform).forEach((x) => (x.textContent = ""));
    $$("[data-invalid]", eform).forEach((x) => x.removeAttribute("data-invalid"));
    $$("[aria-invalid]", eform).forEach((x) => x.setAttribute("aria-invalid", "false"));
    editor.showModal();
    f.name.focus();
  }
  $("#iv-new").addEventListener("click", (e) => openEditor(null, e.currentTarget));
  $$("[data-cancel]", editor).forEach((b) => b.addEventListener("click", () => editor.close()));
  editor.addEventListener("close", () => editorReturn && document.contains(editorReturn) && editorReturn.focus());

  eform.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = eform.elements;
    const checks = [
      fieldError(f.name, f.name.value.trim() ? "" : "Add the guest's name."),
      fieldError(f.title, f.title.value.trim() ? "" : "Add a headline."),
      fieldError(f.location, f.location.value.trim() ? "" : "Add a location, e.g. Glasgow, Scotland."),
      fieldError(f.date, f.date.value ? "" : "Pick a date."),
      fieldError(f.excerpt, f.excerpt.value.trim() ? "" : "Write a short summary."),
    ];
    if (checks.includes(false)) { $('[aria-invalid="true"]', eform).focus(); return; }

    const body = {
      name: f.name.value, role: f.role.value, title: f.title.value, location: f.location.value,
      date: f.date.value, readTime: f.readTime.value, status: f.status.value, color: f.color.value,
      featured: f.featured.checked, quote: f.quote.value, excerpt: f.excerpt.value,
      tags: f.tags.value.split(",").map((t) => t.trim()).filter(Boolean), qa: textToQa(f.qa.value),
    };
    const isNew = !editingId;
    try {
      await busy($('button[type="submit"]', eform), () =>
        isNew
          ? api("/api/admin?r=interviews", { method: "POST", body })
          : api(`/api/admin?r=interviews&id=${encodeURIComponent(editingId)}`, { method: "PUT", body })
      );
      if (afterSave) await afterSave();
      editor.close();
      toast(isNew ? "Interview created" : "Changes saved");
      if (currentRoute() !== "interviews") location.hash = "#interviews";
      await refresh();
    } catch (err) { handleError(err, eform); }
  });

  /* ---------- Submissions ---------- */
  let subFilter = "new";
  $("#sub-filters").addEventListener("click", (e) => {
    const b = e.target.closest("[data-sf]");
    if (!b) return;
    subFilter = b.dataset.sf;
    $$("#sub-filters [data-sf]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    renderSubs();
  });
  function renderSubs() {
    const list = get().submissions.filter((s) => subFilter === "all" || s.status === subFilter);
    $("#subs").innerHTML = list.length ? list.map((s, i) => `
      <li class="sub" style="--i:${i}">
        <div class="sub__head">
          <span class="avatar" data-color="${s.role === "shop" ? "violet" : "yellow"}" aria-hidden="true">${esc(initials(s.name))}</span>
          <div class="grow"><h2>${esc(s.name)}</h2><small><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></small></div>
          <span class="pill pill--${s.status}">${STATUS[s.status]}</span>
        </div>
        <p class="sub__msg">${esc(s.message)}</p>
        <p class="sub__meta"><span class="tag tag--${s.role}">${ROLES[s.role]}</span> <span>${esc(fmtDate(s.date))}</span>
          ${s.link && /^https?:\/\//.test(s.link) ? `<a href="${esc(s.link)}" target="_blank" rel="noopener noreferrer">Portfolio<span class="visually-hidden"> for ${esc(s.name)} (opens in a new tab)</span></a>` : ""}</p>
        <div class="btn-row">
          ${s.status !== "approved" ? `<button type="button" class="btn btn--red btn--sm" data-approve="${esc(s.id)}">Approve &amp; draft<span class="visually-hidden"> interview with ${esc(s.name)}</span></button>` : ""}
          ${s.status === "new" ? `<button type="button" class="btn btn--ghost btn--sm" data-decline="${esc(s.id)}">Decline<span class="visually-hidden"> ${esc(s.name)}</span></button>` : ""}
          <button type="button" class="btn btn--ghost btn--sm" data-sdel="${esc(s.id)}">Delete<span class="visually-hidden"> pitch from ${esc(s.name)}</span></button>
        </div>
      </li>`).join("") : `<li class="empty-note">No ${subFilter === "all" ? "" : subFilter + " "}pitches right now.</li>`;
  }
  const setSubStatus = (id, status) => api(`/api/admin?r=submissions&id=${encodeURIComponent(id)}`, { method: "PUT", body: { status } });

  $("#subs").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-approve], [data-decline], [data-sdel]");
    if (!btn) return;
    const id = btn.dataset.approve || btn.dataset.decline || btn.dataset.sdel;
    const s = get().submissions.find((x) => x.id === id);
    try {
      if (btn.dataset.approve) {
        // The pitch is marked approved once the drafted interview is saved.
        openEditor(null, $("#sub-filters .chip"), { name: s.name, role: s.role, excerpt: s.message, title: `In conversation with ${s.name}` },
          () => setSubStatus(id, "approved"));
      }
      if (btn.dataset.decline) {
        await busy(btn, () => setSubStatus(id, "declined"));
        await refresh();
        toast("Pitch declined");
        $("#sub-filters .chip").focus();
      }
      if (btn.dataset.sdel) {
        if (await confirmDialog(`Delete the pitch from ${s.name}?`)) {
          await api(`/api/admin?r=submissions&id=${encodeURIComponent(id)}`, { method: "DELETE" });
          await refresh();
          toast("Pitch deleted");
        }
        $("#sub-filters .chip").focus();
      }
    } catch (err) { handleError(err); }
  });

  /* ---------- Shops ---------- */
  function renderShops() {
    const shops = get().shops;
    $("#shop-rows").innerHTML = shops.length ? shops.map((s) => `
      <tr>
        <td><div class="t-main"><span class="avatar" data-color="${esc(s.color)}" aria-hidden="true">${esc(initials(s.name))}</span><strong>${esc(s.name)}</strong></div></td>
        <td>${esc(s.city)}, ${esc(s.country)}</td>
        <td>${esc(s.specialty)}</td>
        <td><div class="t-actions"><button type="button" class="btn btn--ghost btn--sm" data-shopdel="${esc(s.id)}">Remove<span class="visually-hidden"> ${esc(s.name)}</span></button></div></td>
      </tr>`).join("") : `<tr><td colspan="4" class="empty-cell">No shops yet. Add one with the form.</td></tr>`;
  }
  $("#shop-rows").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-shopdel]");
    if (!b) return;
    const s = get().shops.find((x) => x.id === b.dataset.shopdel);
    try {
      if (await confirmDialog(`Remove ${s.name} from the site?`, "Remove")) {
        await api(`/api/admin?r=shops&id=${encodeURIComponent(s.id)}`, { method: "DELETE" });
        await refresh();
        toast("Shop removed");
        $("#s-name").focus();
      } else b.focus();
    } catch (err) { handleError(err); }
  });
  $("#shop-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = form.elements;
    const ok = [
      fieldError(f.name, f.name.value.trim() ? "" : "Add the shop's name."),
      fieldError(f.city, f.city.value.trim() ? "" : "Add a city."),
      fieldError(f.country, f.country.value.trim() ? "" : "Add a country."),
    ];
    if (ok.includes(false)) { $('#shop-form [aria-invalid="true"]').focus(); return; }
    try {
      const shop = await busy($('button[type="submit"]', form), () => api("/api/admin?r=shops", {
        method: "POST",
        body: { name: f.name.value, city: f.city.value, country: f.country.value, specialty: f.specialty.value, color: f.color.value },
      }));
      form.reset();
      await refresh();
      toast(`${shop.name} added`);
      f.name.focus();
    } catch (err) { handleError(err, form); }
  });

  /* ---------- Settings ---------- */
  function renderSettings() {
    const s = get().settings;
    $("#set-ann").value = s.announcement || "";
    $("#set-show").checked = !!s.showAnnouncement;
    $("#set-followers").value = s.followers || 0;
  }
  $("#settings-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      await busy($('button[type="submit"]', form), () => api("/api/admin?r=settings", {
        method: "PUT",
        body: { announcement: $("#set-ann").value, showAnnouncement: $("#set-show").checked, followers: $("#set-followers").value },
      }));
      await refresh();
      toast("Settings saved");
    } catch (err) { handleError(err, form); }
  });
  $("#export").addEventListener("click", () => {
    const { me, ...backup } = get();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `east-park-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("Backup downloaded");
  });

  /* ---------- Confirm dialog ---------- */
  function confirmDialog(message, okLabel = "Delete") {
    const dlg = $("#confirm");
    $("#confirm-msg").textContent = message;
    $("#confirm-ok").textContent = okLabel;
    return new Promise((resolve) => {
      const done = (val) => { dlg.removeEventListener("close", onClose); dlg.removeEventListener("click", onClick); if (dlg.open) dlg.close(); resolve(val); };
      const onClick = (e) => {
        const b = e.target.closest("[data-confirm]");
        if (b) done(b.dataset.confirm === "yes");
        else if (e.target === dlg) done(false);
      };
      const onClose = () => done(false);
      dlg.addEventListener("click", onClick);
      dlg.addEventListener("close", onClose);
      dlg.showModal();
      $('[data-confirm="no"]', dlg).focus();
    });
  }

  /* ---------- Boot ---------- */
  (async () => {
    try {
      await api("/api/auth");
      await showApp();
    } catch (e) {
      showLogin();
    }
  })();
})();
