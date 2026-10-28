/* East Park Entertainment — admin dashboard.
   NOTE: sign-in here is a front-end demo gate only. Replace with real authentication
   (e.g. a hosted auth provider + API) before storing anything private. */
(function () {
  "use strict";

  const DEMO_PASSCODE = "eastpark";
  const SESSION_KEY = "epe:admin";

  const { get, update, log, reset, uid, esc, initials, fmtDate, ROLES } = window.EPE;
  const toast = window.EPEA11y.toast;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const ROUTES = { overview: "Overview", interviews: "Interviews", submissions: "Pitches", shops: "Shops", settings: "Settings" };
  const STATUS = { published: "Published", scheduled: "Scheduled", draft: "Draft", new: "New", approved: "Approved", declined: "Declined" };

  /* ---------- Auth (demo) ---------- */
  const session = {
    get() { try { return sessionStorage.getItem(SESSION_KEY); } catch (e) { return this._v || null; } },
    set(v) { try { sessionStorage.setItem(SESSION_KEY, v); } catch (e) { this._v = v; } },
    clear() { try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { this._v = null; } },
  };

  function showApp(signedIn) {
    $("#login").hidden = signedIn;
    $("#app").hidden = !signedIn;
    $(".skip-link").setAttribute("href", signedIn ? "#main" : "#l-name");
    if (signedIn) {
      const name = session.get();
      $("#me-name").textContent = name;
      $("#me-avatar").textContent = initials(name);
      route();
    }
  }

  $("#login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#l-name"), pass = $("#l-pass");
    const nameOk = name.value.trim().length > 0;
    const passOk = pass.value === DEMO_PASSCODE;
    fieldError(name, nameOk ? "" : "Enter your name.");
    fieldError(pass, passOk ? "" : pass.value ? "That passcode isn't right." : "Enter the passcode.");
    if (!nameOk) return name.focus();
    if (!passOk) return pass.focus();
    session.set(name.value.trim());
    pass.value = "";
    showApp(true);
    $("#view-title").focus();
    toast(`Welcome back, ${name.value.trim().split(" ")[0]}!`);
  });
  $("#sign-out").addEventListener("click", () => {
    session.clear();
    showApp(false);
    $("#l-name").focus();
  });

  function fieldError(input, msg) {
    const id = (input.getAttribute("aria-describedby") || "").split(" ").find((x) => x.endsWith("-err"));
    if (id) $("#" + id).textContent = msg;
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    input.closest(".field")?.toggleAttribute("data-invalid", !!msg);
    return !msg;
  }

  /* ---------- Routing ---------- */
  function currentRoute() {
    const r = location.hash.replace("#", "");
    return ROUTES[r] ? r : "overview";
  }
  function route(focus) {
    if ($("#app").hidden) return;
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
    $("#greeting").innerHTML = `${hello}, <strong>${esc(session.get().split(" ")[0])}</strong>. You have ${newSubs} new ${newSubs === 1 ? "pitch" : "pitches"} waiting.`;

    const kpis = [
      { label: "Published", value: pub.length, note: "interviews live", color: "yellow" },
      { label: "In the works", value: pipeline.length, note: "drafts & scheduled", color: "blue" },
      { label: "New pitches", value: newSubs, note: "need a reply", color: "red" },
      { label: "Subscribers", value: d.settings.subscribers.toLocaleString(), note: "Sunday Panel", color: "mint" },
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

    $("#activity").innerHTML = d.activity.slice(0, 6).map((a) => `
      <li><span>${esc(a.text)}</span><time datetime="${esc(a.t)}">${esc(fmtDate(a.t, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}</time></li>`).join("");
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
    if (feat) {
      const id = feat.dataset.feature;
      let title = "";
      update((d) => d.interviews.forEach((i) => { i.featured = i.id === id ? !i.featured : false; if (i.id === id) title = i.title; }));
      const on = get().interviews.find((i) => i.id === id).featured;
      toast(on ? `“${title}” is the cover story` : "Cover story cleared");
      renderInterviews();
      $(`[data-feature="${id}"]`).focus();
    }
    if (edit) openEditor(edit.dataset.edit, edit);
    if (del) {
      const it = get().interviews.find((i) => i.id === del.dataset.del);
      if (await confirmDialog(`Delete “${it.title}”? This can't be undone.`)) {
        update((d) => { d.interviews = d.interviews.filter((i) => i.id !== it.id); });
        log(`Deleted “${it.title}”`);
        toast("Interview deleted");
        renderInterviews();
        $("#iv-new").focus();
      } else del.focus();
    }
  });

  /* Editor */
  const editor = $("#editor");
  const eform = $("#editor-form");
  let editingId = null, editorReturn = null;

  function qaToText(qa) { return (qa || []).map((x) => `Q: ${x.q}\nA: ${x.a}`).join("\n\n"); }
  function textToQa(t) {
    return t.split(/\n\s*\n/).map((block) => {
      const q = (block.match(/Q:\s*([\s\S]*?)(?=\nA:|$)/) || [])[1];
      const a = (block.match(/A:\s*([\s\S]*)$/) || [])[1];
      return q && a ? { q: q.trim(), a: a.trim() } : null;
    }).filter(Boolean);
  }

  function openEditor(id, returnTo, prefill) {
    editingId = id || null;
    editorReturn = returnTo || document.activeElement;
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

  eform.addEventListener("submit", (e) => {
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

    const data = {
      name: f.name.value.trim(), role: f.role.value, title: f.title.value.trim(), location: f.location.value.trim(),
      date: f.date.value, readTime: Math.max(1, parseInt(f.readTime.value, 10) || 5), status: f.status.value,
      color: f.color.value, featured: f.featured.checked, quote: f.quote.value.trim(), excerpt: f.excerpt.value.trim(),
      tags: f.tags.value.split(",").map((t) => t.trim()).filter(Boolean), qa: textToQa(f.qa.value),
    };
    const isNew = !editingId;
    update((d) => {
      if (data.featured) d.interviews.forEach((i) => (i.featured = false));
      if (isNew) d.interviews.unshift({ id: uid("i"), ...data });
      else Object.assign(d.interviews.find((i) => i.id === editingId), data);
    });
    log(`${isNew ? "Created" : "Updated"} “${data.title}” (${STATUS[data.status].toLowerCase()})`);
    editor.close();
    toast(isNew ? "Interview created" : "Changes saved");
    if (currentRoute() !== "interviews") location.hash = "#interviews";
    else renderInterviews();
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
          ${s.link ? `<a href="${esc(/^https?:\/\//.test(s.link) ? s.link : "#")}" target="_blank" rel="noopener noreferrer">Portfolio<span class="visually-hidden"> for ${esc(s.name)} (opens in a new tab)</span></a>` : ""}</p>
        <div class="btn-row">
          ${s.status !== "approved" ? `<button type="button" class="btn btn--red btn--sm" data-approve="${esc(s.id)}">Approve &amp; draft<span class="visually-hidden"> interview with ${esc(s.name)}</span></button>` : ""}
          ${s.status === "new" ? `<button type="button" class="btn btn--ghost btn--sm" data-decline="${esc(s.id)}">Decline<span class="visually-hidden"> ${esc(s.name)}</span></button>` : ""}
          <button type="button" class="btn btn--ghost btn--sm" data-sdel="${esc(s.id)}">Delete<span class="visually-hidden"> pitch from ${esc(s.name)}</span></button>
        </div>
      </li>`).join("") : `<li class="empty-note">No ${subFilter === "all" ? "" : subFilter + " "}pitches right now.</li>`;
  }
  $("#subs").addEventListener("click", async (e) => {
    const ap = e.target.closest("[data-approve]");
    const de = e.target.closest("[data-decline]");
    const sd = e.target.closest("[data-sdel]");
    const id = (ap || de || sd)?.dataset.approve || (ap || de || sd)?.dataset.decline || (ap || de || sd)?.dataset.sdel;
    if (!id) return;
    const s = get().submissions.find((x) => x.id === id);
    if (ap) {
      update((d) => (d.submissions.find((x) => x.id === id).status = "approved"));
      log(`Approved pitch from ${s.name}`);
      renderSubs(); renderBadge();
      openEditor(null, $("#sub-filters .chip"), { name: s.name, role: s.role, excerpt: s.message, title: `In conversation with ${s.name}` });
    }
    if (de) {
      update((d) => (d.submissions.find((x) => x.id === id).status = "declined"));
      log(`Declined pitch from ${s.name}`);
      toast("Pitch declined");
      renderSubs(); renderBadge();
      $("#sub-filters .chip").focus();
    }
    if (sd) {
      if (await confirmDialog(`Delete the pitch from ${s.name}?`)) {
        update((d) => { d.submissions = d.submissions.filter((x) => x.id !== id); });
        toast("Pitch deleted");
        renderSubs(); renderBadge();
      }
      $("#sub-filters .chip").focus();
    }
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
    if (await confirmDialog(`Remove ${s.name} from the site?`, "Remove")) {
      update((d) => { d.shops = d.shops.filter((x) => x.id !== s.id); });
      log(`Removed shop ${s.name}`);
      toast("Shop removed");
      renderShops();
      $("#s-name").focus();
    } else b.focus();
  });
  $("#shop-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.currentTarget.elements;
    const ok = [
      fieldError(f.name, f.name.value.trim() ? "" : "Add the shop's name."),
      fieldError(f.city, f.city.value.trim() ? "" : "Add a city."),
      fieldError(f.country, f.country.value.trim() ? "" : "Add a country."),
    ];
    if (ok.includes(false)) { $('#shop-form [aria-invalid="true"]').focus(); return; }
    const shop = { id: uid("s"), name: f.name.value.trim(), city: f.city.value.trim(), country: f.country.value.trim(), specialty: f.specialty.value.trim() || "Independent comic shop", color: f.color.value };
    update((d) => d.shops.unshift(shop));
    log(`Added shop ${shop.name}`);
    e.currentTarget.reset();
    toast(`${shop.name} added`);
    renderShops();
    f.name.focus();
  });

  /* ---------- Settings ---------- */
  function renderSettings() {
    const s = get().settings;
    $("#set-ann").value = s.announcement;
    $("#set-show").checked = s.showAnnouncement;
    $("#set-followers").value = s.followers;
    $("#set-subs").value = s.subscribers;
  }
  $("#settings-form").addEventListener("submit", (e) => {
    e.preventDefault();
    update((d) => {
      d.settings.announcement = $("#set-ann").value.trim();
      d.settings.showAnnouncement = $("#set-show").checked;
      d.settings.followers = Math.max(0, parseInt($("#set-followers").value, 10) || 0);
      d.settings.subscribers = Math.max(0, parseInt($("#set-subs").value, 10) || 0);
    });
    log("Updated site settings");
    toast("Settings saved");
  });
  $("#export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(get(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `east-park-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("Backup downloaded");
  });
  $("#reset").addEventListener("click", async (e) => {
    if (await confirmDialog("Reset all interviews, pitches, shops and settings to the demo content?", "Reset")) {
      reset();
      toast("Demo data restored");
      renderSettings();
    }
    e.target.focus();
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
  window.addEventListener("epe:change", () => { if (!$("#app").hidden) render(); });
  showApp(!!session.get());
})();
