# East Park Entertainment

Website for **East Park Entertainment**: interviews with comic creators, authors, artists, writers and comic shops around the world.

Static site (HTML, CSS, vanilla JS). No build step and no dependencies, so it deploys as-is to Vercel, Netlify or GitHub Pages.

## Pages

| Page | What it is |
| --- | --- |
| `index.html` | Public site: hero, cover story, categories, searchable and filterable interview archive (each interview opens in a deep-linkable dialog), shop carousel, pitch form, newsletter, footer accessibility statement |
| `accessibility.html` | Full accessibility statement |
| `admin.html` | Team dashboard: overview KPIs and charts, interview editor (create, edit, delete, set the cover story), pitch inbox (approve to draft, decline), shops, site settings, JSON export |

## Run locally

```bash
python -m http.server 5173
```

Then open http://localhost:5173.

## Deploy on Vercel

Import the repo, choose **Other** as the framework preset, and leave the build command empty. The output directory is the repo root.

## How data works (important)

Content lives in `assets/js/store.js` (seed data) and is saved to the visitor's **localStorage**. That means:

- Changes made in the dashboard show up on the public site **in the same browser only**.
- The dashboard sign-in is a **demo gate** (`DEMO_PASSCODE` in `assets/js/admin.js`), not real security.

Before launch, connect a real backend (for example Supabase, Firebase or a headless CMS) and real authentication. The store exposes `get / update / save`, so you only need to swap those for API calls.

## Accessibility

Built to WCAG 2.2 AA:

- Semantic landmarks and headings, plus a skip link
- Full keyboard support with visible focus
- Native `<dialog>` for modals
- Screen-reader announcements for filter results, toasts and form errors
- Respects `prefers-reduced-motion` and `prefers-color-scheme`, and supports forced-colours mode
- 44px minimum touch targets
- Atkinson Hyperlegible body font

The yellow ♿ button opens settings for text size, theme, high contrast, reduced motion, readable spacing and link highlighting. The scrolling marquee has its own pause button.

## Structure

```
assets/
  css/base.css    design tokens, buttons, forms, a11y panel, dialogs
  css/site.css    public site
  css/admin.css   dashboard
  js/store.js     shared data store and seed content
  js/a11y.js      accessibility preferences, theme, toasts
  js/site.js      public site interactions
  js/admin.js     dashboard
```
