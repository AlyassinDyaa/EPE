/* East Park Entertainment — public site interactions. */
(function () {
  "use strict";

  const { api, loadPublic, esc, initials, fmtDate, ROLES } = window.EPE;
  const toast = window.EPEA11y.toast;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduced = () => document.documentElement.dataset.motion === "reduce";

  const ICON = {
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    cal: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  };

  // Loaded once from /api/public.
  let data = { settings: {}, interviews: [], shops: [] };
  const published = () => data.interviews;

  /* ---------- Announcement ---------- */
  function renderAnnouncement() {
    const { settings } = data;
    const bar = $("#announce");
    let dismissed = null;
    try { dismissed = sessionStorage.getItem("epe:announce-dismissed"); } catch (e) {}
    const show = settings.showAnnouncement && settings.announcement && dismissed !== settings.announcement;
    bar.hidden = !show;
    if (show) $("#announce-text").textContent = settings.announcement;
  }
  $("#announce-close").addEventListener("click", () => {
    try { sessionStorage.setItem("epe:announce-dismissed", data.settings.announcement); } catch (e) {}
    $("#announce").hidden = true;
    $("#main").focus();
  });

  /* ---------- Header ---------- */
  const header = $(".site-header");
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 10);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const navToggle = $("#nav-toggle");
  const navMenu = $("#nav-menu");
  function setNav(open) {
    navToggle.setAttribute("aria-expanded", String(open));
    navMenu.classList.toggle("is-open", open);
  }
  navToggle.addEventListener("click", () => setNav(navToggle.getAttribute("aria-expanded") !== "true"));
  navMenu.addEventListener("click", (e) => { if (e.target.closest("a")) setNav(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && navMenu.classList.contains("is-open")) { setNav(false); navToggle.focus(); }
  });
  window.matchMedia("(min-width: 901px)").addEventListener("change", () => setNav(false));

  // Highlight the nav item for the section in view.
  const navLinks = $$('.nav__menu a[href^="#"]:not(.btn)');
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      navLinks.forEach((a) =>
        a.getAttribute("href") === "#" + en.target.id ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")
      );
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  navLinks.forEach((a) => { const t = $(a.getAttribute("href")); t && spy.observe(t); });
  spy.observe($("#home"));

  /* ---------- Hero rotator ---------- */
  const words = ["creators", "authors", "artists", "writers", "comic shops"];
  const rot = $("#rotator");
  let wi = 0;
  setInterval(() => {
    if (reduced() || document.hidden) return;
    rot.classList.add("is-out");
    setTimeout(() => {
      wi = (wi + 1) % words.length;
      rot.textContent = words[wi];
      rot.classList.remove("is-out");
      rot.classList.add("is-in-start");
      void rot.offsetWidth;
      rot.classList.remove("is-in-start");
    }, 320);
  }, 2400);

  // Comic page follows the pointer a little.
  const page = $("#hero-page");
  const art = $(".hero__art");
  if (window.matchMedia("(hover: hover)").matches) {
    art.addEventListener("pointermove", (e) => {
      if (reduced()) return;
      const r = art.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      page.style.setProperty("--ry", `${x * 10}deg`);
      page.style.setProperty("--rx", `${-y * 10}deg`);
    });
    art.addEventListener("pointerleave", () => { page.style.setProperty("--ry", "0deg"); page.style.setProperty("--rx", "0deg"); });
  }

  /* ---------- Reveal + counters ---------- */
  const revealer = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add("is-in");
      revealer.unobserve(en.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  const observeReveals = () => $$(".reveal:not(.is-in)").forEach((el) => revealer.observe(el));

  function stats() {
    const countries = new Set([...published().map((i) => i.location.split(",").pop().trim()), ...data.shops.map((s) => s.country)]);
    return { interviews: published().length, countries: countries.size, followers: Math.round((data.settings.followers || 0) / 1000) };
  }
  function runCounters() {
    const s = stats();
    $$("[data-count]").forEach((el) => {
      const target = s[el.dataset.stat] || 0;
      const suffix = el.dataset.suffix || "";
      if (reduced()) { el.textContent = target + suffix; return; }
      const start = performance.now();
      const dur = 1400;
      const tick = (now) => {
        const p = Math.min(1, (now - start) / dur);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  /* ---------- Tilt cards ---------- */
  if (window.matchMedia("(hover: hover)").matches) {
    $$("[data-tilt]").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        if (reduced()) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty("--ty", `${((e.clientX - r.left) / r.width - 0.5) * 12}deg`);
        card.style.setProperty("--tx", `${-((e.clientY - r.top) / r.height - 0.5) * 12}deg`);
      });
      card.addEventListener("pointerleave", () => { card.style.setProperty("--tx", "0deg"); card.style.setProperty("--ty", "0deg"); });
    });
  }

  /* ---------- Cover story ---------- */
  function renderCover() {
    const pub = published();
    const it = pub.find((i) => i.featured) || pub[0];
    const el = $("#cover");
    if (!it) { el.hidden = true; return; }
    el.hidden = false;
    el.dataset.color = it.color;
    el.innerHTML = `
      <div class="cover__art" aria-hidden="true">
        <span class="cover__issue">Issue #${String(pub.length).padStart(3, "0")}</span>
        <div class="avatar">${esc(initials(it.name))}</div>
      </div>
      <div class="cover__body">
        <div class="cover__meta">
          <span class="tag tag--${it.role}">${esc(ROLES[it.role])}</span>
          <span>${esc(it.name)}</span>
          <span>${ICON.pin} ${esc(it.location)}</span>
        </div>
        <h3>${esc(it.title)}</h3>
        <p class="cover__quote">“${esc(it.quote)}”</p>
        <p>${esc(it.excerpt)}</p>
        <div><a class="btn btn--red" href="#interview=${esc(it.id)}">Read the interview<span class="visually-hidden">: ${esc(it.title)}</span>
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a></div>
      </div>`;
  }

  /* ---------- Interview grid ---------- */
  let filter = "all";
  let query = "";
  const cardsEl = $("#cards");
  const statusEl = $("#results-status");

  function renderCards(announce) {
    const q = query.trim().toLowerCase();
    const list = published().filter((i) =>
      (filter === "all" || i.role === filter) &&
      (!q || [i.name, i.title, i.location, i.excerpt, ...(i.tags || [])].join(" ").toLowerCase().includes(q))
    );
    cardsEl.innerHTML = list.map((it, idx) => `
      <li class="card" data-color="${esc(it.color)}" style="--i:${idx}">
        <div class="card__art">
          <span class="tag">${esc(ROLES[it.role])}</span>
          <div class="avatar" aria-hidden="true">${esc(initials(it.name))}</div>
        </div>
        <div class="card__body">
          <p class="card__name">${esc(it.name)}</p>
          <h3 class="card__title"><a href="#interview=${esc(it.id)}">${esc(it.title)}</a></h3>
          <p class="card__excerpt">${esc(it.excerpt)}</p>
          <p class="card__meta">
            <span>${ICON.pin}<span class="visually-hidden">Location:</span> ${esc(it.location)}</span>
            <span>${ICON.clock} ${esc(it.readTime)} min read</span>
          </p>
        </div>
      </li>`).join("");
    $("#empty").hidden = list.length > 0;
    const label = filter === "all" ? "interviews" : `${ROLES[filter].toLowerCase()} interviews`;
    // Only announce on user-driven changes to avoid noise on load.
    statusEl.textContent = announce
      ? `Showing ${list.length} ${list.length === 1 ? label.replace(/s$/, "") : label}${q ? ` matching “${query.trim()}”` : ""}`
      : "";
  }

  $("#filters").addEventListener("click", (e) => {
    const b = e.target.closest("[data-filter]");
    if (b) setFilter(b.dataset.filter, true);
  });
  function setFilter(f, announce) {
    filter = f;
    $$("#filters [data-filter]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.filter === f)));
    renderCards(announce);
  }
  let searchT;
  $("#search").addEventListener("input", (e) => {
    query = e.target.value;
    clearTimeout(searchT);
    searchT = setTimeout(() => renderCards(true), 250);
  });
  $$("[data-filter-jump]").forEach((b) => b.addEventListener("click", () => {
    setFilter(b.dataset.filterJump, true);
    $("#interviews").scrollIntoView({ behavior: reduced() ? "auto" : "smooth" });
    $(`#filters [data-filter="${b.dataset.filterJump}"]`).focus({ preventScroll: true });
  }));

  /* ---------- Interview dialog (deep-linkable: #interview=ID) ---------- */
  const modal = $("#interview-modal");
  let lastFocus = null;

  function openInterview(id) {
    const it = published().find((i) => i.id === id);
    if (!it) return;
    lastFocus = document.activeElement;
    $("#modal-body").innerHTML = `
      <header class="im-head" data-color="${esc(it.color)}">
        <div class="avatar" aria-hidden="true">${esc(initials(it.name))}</div>
        <div>
          <span class="tag">${esc(ROLES[it.role])}</span>
          <h2 id="modal-title">${esc(it.title)}</h2>
          <p>${esc(it.name)} · ${esc(it.location)}</p>
        </div>
      </header>
      <div class="im-body">
        <p class="cover__meta">${ICON.cal} ${esc(fmtDate(it.date))} · ${ICON.clock} ${esc(it.readTime)} min read</p>
        ${it.quote ? `<p class="im-quote">${esc(it.quote)}</p>` : ""}
        <p>${esc(it.excerpt)}</p>
        ${it.qa && it.qa.length ? `<dl class="qa">${it.qa.map((x) => `<div><dt>${esc(x.q)}</dt><dd>${esc(x.a)}</dd></div>`).join("")}</dl>` : ""}
        ${it.tags && it.tags.length ? `<ul class="im-tags" role="list" aria-label="Topics">${it.tags.map((t) => `<li class="tag">${esc(t)}</li>`).join("")}</ul>` : ""}
        <div class="im-share">
          <button type="button" class="btn btn--yellow btn--sm" data-copy>Copy link</button>
          <a class="btn btn--ghost btn--sm" href="#pitch" data-close-nav>Pitch someone like ${esc(it.name.split(" ")[0])}</a>
        </div>
      </div>`;
    if (!modal.open) modal.showModal();
    $("[data-close]", modal).focus();
  }
  modal.addEventListener("close", () => {
    if (location.hash.startsWith("#interview=")) history.replaceState(null, "", location.pathname + location.search);
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  });
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.closest("[data-close]") || e.target.closest("[data-close-nav]")) modal.close();
    if (e.target.closest("[data-copy]")) {
      (navigator.clipboard ? navigator.clipboard.writeText(location.href) : Promise.reject()).then(
        () => toast("Link copied to clipboard"),
        () => toast("Couldn't copy. Use your address bar instead.")
      );
    }
  });
  function onHash() {
    const m = location.hash.match(/^#interview=(.+)$/);
    if (m) openInterview(decodeURIComponent(m[1]));
  }
  window.addEventListener("hashchange", onHash);

  /* ---------- Shops carousel ---------- */
  const track = $("#shops-track");
  function renderShops() {
    track.innerHTML = data.shops.map((s) => `
      <li class="ticket" data-color="${esc(s.color)}">
        <span class="ticket__stamp" aria-hidden="true">${esc(initials(s.name))}</span>
        <h3>${esc(s.name)}</h3>
        <p class="ticket__place">${ICON.pin} ${esc(s.city)}, ${esc(s.country)}</p>
        <p class="ticket__spec">${esc(s.specialty)}</p>
      </li>`).join("");
    syncShopButtons();
  }
  const step = () => (track.querySelector(".ticket")?.getBoundingClientRect().width || 300) + 24;
  $("#shops-prev").addEventListener("click", () => track.scrollBy({ left: -step(), behavior: reduced() ? "auto" : "smooth" }));
  $("#shops-next").addEventListener("click", () => track.scrollBy({ left: step(), behavior: reduced() ? "auto" : "smooth" }));
  function syncShopButtons() {
    const max = track.scrollWidth - track.clientWidth - 4;
    $("#shops-prev").disabled = track.scrollLeft <= 4;
    $("#shops-next").disabled = track.scrollLeft >= max;
  }
  track.addEventListener("scroll", syncShopButtons, { passive: true });
  window.addEventListener("resize", syncShopButtons);
  track.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); track.scrollBy({ left: step() }); }
    if (e.key === "ArrowLeft") { e.preventDefault(); track.scrollBy({ left: -step() }); }
  });

  /* ---------- Quotes ---------- */
  function renderQuotes() {
    $("#quotes").innerHTML = published().filter((i) => i.quote).slice(0, 3).map((it) => `
      <li class="reveal">
        <figure class="quote-card" data-color="${esc(it.color)}">
          <blockquote><p>${esc(it.quote)}</p></blockquote>
          <figcaption><span class="avatar" aria-hidden="true">${esc(initials(it.name))}</span><span>${esc(it.name)}<small>${esc(ROLES[it.role])}, ${esc(it.location)}</small></span></figcaption>
        </figure>
      </li>`).join("");
  }

  /* ---------- Pitch form ---------- */
  const form = $("#pitch-form");
  const msg = $("#f-msg");
  const submitBtn = $(".pitch__submit", form);
  msg.addEventListener("input", () => { $("#f-msg-count").textContent = msg.value.length; });

  const FIELD = {
    name: () => $("#f-name"),
    email: () => $("#f-email"),
    link: () => $("#f-link"),
    message: () => msg,
    role: () => form.querySelector('input[name="role"]'),
    consent: () => $("#f-consent"),
  };
  const ERR = { name: "#f-name-err", email: "#f-email-err", link: "#f-link-err", message: "#f-msg-err", role: "#f-role-err", consent: "#f-consent-err" };

  function showErrors(fields) {
    Object.keys(ERR).forEach((k) => {
      const text = fields[k] || "";
      $(ERR[k]).textContent = text;
      const el = FIELD[k]();
      if (k === "role") $(".roles").toggleAttribute("data-invalid", !!text);
      else {
        el.setAttribute("aria-invalid", text ? "true" : "false");
        el.closest(".field")?.toggleAttribute("data-invalid", !!text);
      }
    });
    const first = Object.keys(ERR).find((k) => fields[k]);
    return first ? FIELD[first]() : null;
  }

  function validate() {
    const f = {};
    const v = (id) => $(id).value.trim();
    if (v("#f-name").length < 2) f.name = "Please enter a name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v("#f-email"))) f.email = "Enter an email like name@example.com.";
    if (v("#f-link") && !/^https?:\/\/\S+\.\S+/.test(v("#f-link"))) f.link = "Links should start with http:// or https://";
    if (msg.value.trim().length < 20) f.message = `Tell us a bit more: at least 20 characters (${msg.value.trim().length} so far).`;
    if (!form.querySelector('input[name="role"]:checked')) f.role = "Choose who the pitch is about.";
    if (!$("#f-consent").checked) f.consent = "Please tick this box so we can reply.";
    return f;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errors = validate();
    const first = showErrors(errors);
    if (first) {
      first.focus();
      const n = Object.keys(errors).length;
      toast(`Please fix ${n} ${n === 1 ? "field" : "fields"}`);
      return;
    }
    const fd = new FormData(form);
    submitBtn.disabled = true;
    submitBtn.setAttribute("aria-busy", "true");
    try {
      await api("/api/pitch", {
        method: "POST",
        body: {
          name: fd.get("name"), email: fd.get("email"), role: fd.get("role"), link: fd.get("link"),
          message: fd.get("message"), consent: $("#f-consent").checked, website: fd.get("website"),
        },
      });
      form.reset();
      $("#f-msg-count").textContent = "0";
      const ok = $("#form-success");
      ok.hidden = false;
      ok.focus();
      toast("Pitch sent!");
    } catch (err) {
      if (err.fields) { const f = showErrors(err.fields); f && f.focus(); }
      toast(err.status === 404 ? "Pitches need the server running (npm run dev)." : err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.removeAttribute("aria-busy");
    }
  });
  // Re-validate once the user starts fixing a field.
  form.addEventListener("input", (e) => {
    $("#form-success").hidden = true;
    if (e.target.closest("[data-invalid]") || e.target.getAttribute("aria-invalid") === "true") showErrors(validate());
  });

  /* ---------- Newsletter ---------- */
  $("#news-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("#news-email");
    const err = $("#news-err");
    const btn = $("button", e.currentTarget);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim())) {
      err.textContent = "Enter a valid email like name@example.com.";
      input.setAttribute("aria-invalid", "true");
      input.focus();
      return;
    }
    err.textContent = "";
    input.setAttribute("aria-invalid", "false");
    btn.disabled = true;
    try {
      await api("/api/subscribe", { method: "POST", body: { email: input.value.trim() } });
      input.value = "";
      toast("You're on the list. See you Sunday!");
    } catch (ex) {
      err.textContent = ex.status === 404 ? "Sign-ups need the server running (npm run dev)." : ex.message;
    } finally {
      btn.disabled = false;
    }
  });

  /* ---------- Boot ---------- */
  $("#year").textContent = new Date().getFullYear();

  async function boot() {
    cardsEl.setAttribute("aria-busy", "true");
    try {
      data = await loadPublic();
    } catch (e) {
      $("#empty").hidden = false;
      $("#empty p").textContent = "We couldn't load the interviews right now. Please refresh in a moment.";
      return;
    } finally {
      cardsEl.removeAttribute("aria-busy");
    }
    renderAnnouncement();
    renderCover();
    renderCards(false);
    renderShops();
    renderQuotes();
    observeReveals();
    const countObs = new IntersectionObserver((en) => { if (en[0].isIntersecting) { runCounters(); countObs.disconnect(); } });
    countObs.observe($(".hero__stats"));
    onHash();
  }
  observeReveals();
  boot();
})();
