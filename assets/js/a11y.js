/* Accessibility preferences and toasts — shared by every page. */
(function () {
  "use strict";

  const PREF_KEY = "epe:prefs";
  const root = document.documentElement;
  const mq = (q) => window.matchMedia && window.matchMedia(q).matches;

  function readPrefs() {
    try { return JSON.parse(localStorage.getItem(PREF_KEY) || "{}"); } catch (e) { return {}; }
  }
  let prefs = readPrefs();

  function writePrefs() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* session only */ }
  }

  const motionReduced = () => (prefs.motion === undefined ? mq("(prefers-reduced-motion: reduce)") : !!prefs.motion);

  function apply() {
    root.dataset.text = String(prefs.text || 0);
    root.dataset.contrast = prefs.contrast ? "high" : "normal";
    root.dataset.motion = motionReduced() ? "reduce" : "full";
    root.dataset.spacing = prefs.spacing ? "wide" : "normal";
    root.dataset.links = prefs.links ? "highlight" : "normal";
    syncControls();
    window.dispatchEvent(new CustomEvent("epe:prefs", { detail: { reducedMotion: motionReduced() } }));
  }

  function set(key, value) {
    prefs[key] = value;
    writePrefs();
    apply();
  }

  /* ---------- Toasts ---------- */
  let region;
  function toast(message) {
    if (!region) {
      region = document.createElement("div");
      region.className = "toast-region";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      document.body.appendChild(region);
    }
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    region.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  /* ---------- Panel ---------- */
  const SWITCHES = [
    ["contrast", "High contrast", "Maximum contrast colours"],
    ["motion", "Reduce motion", "Stops animations and auto-scrolling"],
    ["spacing", "Readable spacing", "More space between letters, words and lines"],
    ["links", "Highlight links", "Underline and highlight every link"],
  ];

  function buildPanel() {
    const panel = document.createElement("section");
    panel.id = "a11y-panel";
    panel.className = "a11y-panel";
    panel.hidden = true;
    panel.setAttribute("aria-labelledby", "a11y-title");
    panel.innerHTML = `
      <h2 id="a11y-title">Accessibility
        <button class="btn btn--ghost btn--icon btn--sm" type="button" data-a11y-close aria-label="Close accessibility settings">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </h2>
      <p>Adjust the site to suit you. Your choices are saved on this device.</p>
      <div class="a11y-group">
        <div class="a11y-row">
          <span class="label" id="lbl-text">Text size</span>
          <div class="seg" role="group" aria-labelledby="lbl-text">
            <button type="button" data-text="0" aria-label="Default text size">A</button>
            <button type="button" data-text="1" aria-label="Large text">A+</button>
            <button type="button" data-text="2" aria-label="Larger text">A++</button>
            <button type="button" data-text="3" aria-label="Largest text">A³</button>
          </div>
        </div>
      </div>
      ${SWITCHES.map(([k, l, d]) => `
      <div class="a11y-group">
        <div class="a11y-row">
          <span class="label" id="lbl-${k}">${l}<span class="desc">${d}</span></span>
          <button type="button" class="switch" role="switch" aria-checked="false" data-pref="${k}" aria-labelledby="lbl-${k}"></button>
        </div>
      </div>`).join("")}
      <div class="a11y-group">
        <button type="button" class="btn btn--ghost btn--sm" data-a11y-reset>Reset to defaults</button>
        <a class="btn btn--ghost btn--sm" href="accessibility.html">Accessibility statement</a>
      </div>`;
    document.body.appendChild(panel);

    panel.addEventListener("click", (e) => {
      const t = e.target.closest("button");
      if (!t) return;
      if (t.dataset.text !== undefined) set("text", Number(t.dataset.text));
      else if (t.dataset.pref) {
        const key = t.dataset.pref;
        const on = key === "motion" ? !motionReduced() : !prefs[key];
        set(key, on);
        toast(`${t.closest(".a11y-row").querySelector(".label").firstChild.textContent.trim()} ${on ? "on" : "off"}`);
      } else if (t.hasAttribute("data-a11y-reset")) {
        prefs = {};
        writePrefs();
        apply();
        toast("Accessibility settings reset");
      } else if (t.hasAttribute("data-a11y-close")) close(true);
    });
    return panel;
  }

  let panel, trigger;

  function open() {
    panel.hidden = false;
    trigger && trigger.setAttribute("aria-expanded", "true");
    panel.querySelector("button").focus();
  }
  function close(returnFocus) {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    trigger && trigger.setAttribute("aria-expanded", "false");
    if (returnFocus && trigger) trigger.focus();
  }

  function syncControls() {
    document.querySelectorAll("[data-text]").forEach((b) => b.tagName === "BUTTON" && b.setAttribute("aria-pressed", String(String(prefs.text || 0) === b.dataset.text)));
    document.querySelectorAll(".switch[data-pref]").forEach((b) => {
      const k = b.dataset.pref;
      b.setAttribute("aria-checked", String(k === "motion" ? motionReduced() : !!prefs[k]));
    });
  }

  function init() {
    panel = buildPanel();
    trigger = document.querySelector("[data-a11y-toggle]");
    if (trigger) {
      trigger.setAttribute("aria-controls", "a11y-panel");
      trigger.setAttribute("aria-expanded", "false");
      trigger.addEventListener("click", () => (panel.hidden ? open() : close(true)));
    }
    document.querySelectorAll("[data-open-a11y]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); open(); }));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) close(true); });
    document.addEventListener("pointerdown", (e) => {
      if (!panel.hidden && !panel.contains(e.target) && !(trigger && trigger.contains(e.target))) close(false);
    });
    apply();
  }

  window.EPEA11y = { toast, set, reducedMotion: motionReduced };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
