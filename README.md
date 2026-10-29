# East Park Entertainment

Website for **East Park Entertainment**: interviews with comic creators, authors, artists, writers and comic shops around the world.

Static front end (HTML, CSS, vanilla JS) plus Vercel serverless functions in `/api`, backed by Upstash Redis. No npm dependencies and no build step.

## Pages

| Page | What it is |
| --- | --- |
| `index.html` | Public site: hero, cover story, categories, searchable and filterable interview archive (each interview opens in a deep-linkable dialog), shop carousel, pitch form, newsletter, footer accessibility statement |
| `accessibility.html` | Full accessibility statement |
| `admin.html` | Team dashboard: overview KPIs and charts, interview editor (create, edit, delete, set the cover story), pitch inbox (approve to draft, decline), shops, site settings, JSON export |

## Run locally

```bash
npm run dev
```

Then open http://localhost:3000. You can pass a different port: `node dev-server.js 5173`.

- Copy `.env.example` to `.env.local` and set `ADMIN_PASSWORD` and `SESSION_SECRET`. If you don't, the dev server makes a one-off password and prints it in the terminal.
- Without Redis variables, the API uses an **in-memory database** that resets each time the server restarts. Add `KV_REST_API_URL` and `KV_REST_API_TOKEN` to `.env.local` to use your real database instead.

## Deploy on Vercel

1. Import the repo. Choose **Other** as the framework preset and leave the build command empty.
2. **Storage → Create / Connect → Upstash (Redis)**. Connect it to the project. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.
3. **Settings → Environment Variables**: add
   - `ADMIN_PASSWORD`: the team's dashboard password (8+ characters, ideally much longer)
   - `SESSION_SECRET`: 32+ random characters. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
4. Redeploy. The first visit fills the empty database with the starter content from `data/seed.json`.

## API

| Route | Access | Purpose |
| --- | --- | --- |
| `GET /api/public` | public | Published interviews, shops and public settings. Cached by Vercel's CDN for 30s |
| `POST /api/pitch` | public | "Get featured" form. Validated, rate-limited (5/hour per IP) and protected by a honeypot field |
| `POST /api/subscribe` | public | Newsletter sign-up, rate-limited |
| `GET / POST / DELETE /api/auth` | public | Session check, sign in, sign out |
| `/api/admin` | team | Read everything; create, update and delete interviews, shops, pitches and settings |

### Security

- **Sign-in:** a single team password, compared in constant time. Sign-in attempts are rate-limited (10 per 15 minutes per IP).
- **Sessions:** an HMAC-signed, `HttpOnly`, `Secure`, `SameSite=Strict` cookie that lasts 12 hours.
- **CSRF:** every write request must carry an `X-EPE: 1` header. Browsers can't send that header cross-site without a CORS preflight, and the API never allows one.
- **Validation:** all input is checked and length-limited on the server, and everything the pages render is HTML-escaped.
- **Privacy:** pitches (including email addresses) and subscriber emails are only returned to signed-in team members.

## Accessibility

Built to WCAG 2.2 AA:

- Semantic landmarks and headings, plus a skip link
- Full keyboard support with visible focus
- Native `<dialog>` for modals
- Screen-reader announcements for filter results, toasts and form errors
- Respects `prefers-reduced-motion` and supports forced-colours mode
- 44px minimum touch targets
- Atkinson Hyperlegible body font

The ♿ button opens settings for text size, high contrast, reduced motion, readable spacing and link highlighting.

## Structure

```
api/
  _lib.js         Redis client, sessions, validation, rate limiting (not a route)
  public.js  pitch.js  subscribe.js  auth.js  admin.js
data/seed.json    starter content written to an empty database
assets/
  css/base.css    design tokens (white/gray/black), buttons, forms, a11y panel, dialogs
  css/site.css    public site
  css/admin.css   dashboard
  js/store.js     API client and shared helpers
  js/a11y.js      accessibility preferences, toasts
  js/site.js      public site
  js/admin.js     dashboard
dev-server.js     local server for static files and /api
```
