# Kleza Excelliq AI — Current Version Documentation

_Executive Multi-LLM Dashboard. API-only mode (no browser automation)._
_Last updated: 2026-06-24 — reflects the Supabase-auth migration described in §10._

---

## 1. What this app is

Excelliq is a single-page React app that sends one prompt to **three LLM providers at once**
(ChatGPT, Gemini, Claude), shows each raw answer side-by-side, and then produces a **final
synthesis written by Claude**. All provider calls are orchestrated by an **n8n workflow**, not
by the frontend directly. The frontend holds user identity, API keys, history, and usage stats
in the **browser (localStorage)**, and uses **Supabase** only for account auth (signup / login /
password reset).

Two run modes:
| Mode | Key | Behaviour |
|------|-----|-----------|
| **Battle Mode** | `battle` | Shows all three raw model answers as cards, then the Claude synthesis. |
| **Invisible Mode** | `invisible` | Hides the raw cards, shows only the clean Claude synthesis. |

Claude is **always** enabled (it does the synthesis); OpenAI and Gemini are optional toggles.

---

## 2. Tech stack

| Layer | Technology |
|-------|------------|
| Framework | React 19 + Vite 8 (`type: module`, Node ≥ 20) |
| Routing | Manual (no router lib) — see §5 |
| Auth | Supabase Auth (`@supabase/supabase-js` ^2.108) |
| OAuth | Google (`@react-oauth/google`) — profile fetched client-side |
| Animation | framer-motion |
| Charts | recharts |
| Icons | lucide-react |
| Orchestration | n8n workflow (external, at `n8n.kleza.io`) |
| Hosting | Hostinger static hosting (`*.hostingersite.com`) + PHP proxy |

Package name: `kleza-excelliq-ai`, version `0.0.0`. Scripts: `dev`, `build`, `lint`, `preview`.

---

## 3. Architecture (request flow)

```
┌─────────────┐  signup/login/reset   ┌──────────────────────┐
│   Browser   │ ────────────────────► │  Supabase Auth        │
│ (React SPA) │                       │  (*.supabase.co)      │
│             │  chat prompt          └──────────────────────┘
│             │ ──────────────┐
└─────────────┘               │
        │                     ▼
        │           ┌───────────────────┐  HTTPS POST   ┌─────────────────┐
        │  prod:    │  /proxy.php       │ ────────────► │  n8n workflow   │
        └──────────►│  (Hostinger PHP)  │               │ (n8n.kleza.io)  │
           dev:     └───────────────────┘               │                 │
           Vite proxy /n8n-proxy ──────────────────────►│  ┌───────────┐  │
                                                         │  │ ChatGPT   │  │
                                                         │  │ Gemini    │  │
                                                         │  │ Claude ───┼──┼─► synthesis
                                                         │  └───────────┘  │
                                                         └─────────────────┘
```

- **Auth** goes browser → Supabase directly.
- **Chat** goes browser → PHP proxy (prod) or Vite proxy (dev) → n8n → providers.
- The PHP/Vite proxy exists only to avoid CORS and hide the n8n URL; it forwards the JSON body verbatim.

---

## 4. Project structure

```
src/
  App.jsx                  Top-level routing + global state (history, usage)
  main.jsx                 React root + GoogleOAuthProvider
  config/api.js            API_SERVER base URL (legacy Node backend — see §11)
  utils/
    supabase.js            Supabase client (null if env not set)
    clientIdentity.js      localStorage user model (clientId, ph_user)
  pages/
    LandingPage.jsx        First-visit marketing screen
    OnboardingPage.jsx     Signup/login + provider-key setup (3 steps)  ← AUTH lives here
    ResetPasswordPage.jsx  Supabase password-recovery screen
    PromptRunnerPage.jsx   Main chat screen (greeting + composer)
    DashboardPage.jsx      Overview widgets
    ResultsHistoryPage.jsx Saved runs + follow-ups
    LLMModelsPage.jsx      Model info
    AutomationsPage.jsx    Automations
    AnalyticsPage.jsx      Usage analytics
    IntegrationsPage.jsx   Integrations
    SettingsPage.jsx       Settings + usage reset
    AdminPortal.jsx        /admin dashboard (needs Node backend — see §11)
    ArchitectureDiagram.jsx
  components/
    PromptControl.jsx      n8n call, markdown render, model cards, follow-ups
    Sidebar.jsx, Header.jsx, DashWidgets.jsx, HistoryTable.jsx
public/
  proxy.php                Production n8n proxy (Hostinger)
  _redirects               SPA fallback (Netlify-style)
vercel.json                SPA rewrite for Vercel
vite.config.js             Dev server /n8n-proxy → n8n.kleza.io
supabase/schema.sql        profiles + client_preferences tables (optional)
```

---

## 5. Routing (manual, in `App.jsx`)

`App()` picks the screen before rendering:
1. Path starts with `/admin` → **AdminPortal**.
2. Password-recovery route (`/reset-password`, or `type=recovery`, or `access_token`+`refresh_token` in hash) → **ResetPasswordPage**.
3. Otherwise → **ChatApp**, which gates on localStorage:
   - No onboarding + first visit → **LandingPage**
   - Not onboarded → **OnboardingPage**
   - Onboarded → main app (sidebar + active page; default page `prompt-runner`).

Server must serve `index.html` for all paths (SPA fallback). Configured via `public/_redirects`
and `vercel.json`. On Hostinger, an `.htaccess` rewrite to `index.html` is required for deep links
like `/reset-password` to work on refresh.

---

## 6. Authentication (current — Supabase)

All auth lives in `src/pages/OnboardingPage.jsx` and uses the Supabase client from
`src/utils/supabase.js`. **There is no custom Node auth backend in the request path anymore.**

| Action | Call |
|--------|------|
| Sign up | `supabase.auth.signUp({ email, password, options: { data: { name } } })` |
| Log in | `supabase.auth.signInWithPassword({ email, password })` |
| Forgot password | `supabase.auth.resetPasswordForEmail(email, { redirectTo: <origin>/reset-password })` |
| Set new password | `supabase.auth.updateUser({ password })` (in ResetPasswordPage) |
| Google | OAuth token → Google `userinfo` endpoint → stored locally (no backend) |

Notes:
- If the Supabase project requires **email confirmation**, `signUp` returns no session; the UI
  shows a notice and still lets the user finish provider setup (app state is localStorage-based).
- `supabase` is `null` if env vars are missing → the UI shows
  "Authentication is not configured" instead of crashing.

### Onboarding steps (OnboardingPage)
1. **Step 1** — signup/login (email+password or Google) + Terms checkbox.
2. **Step 2** — toggle providers + paste API keys (stored in browser only).
3. **Step 3** — review, then "Start chatting" → `onboardingComplete: true`.

---

## 7. Chat / n8n flow (`PromptControl.jsx`)

- Endpoint: `VITE_N8N_URL` (prod `/proxy.php`, dev `/n8n-proxy/webhook/.../chat`).
- POST body: `{ action: 'sendMessage', sessionId, chatInput, selectedModels }`.
- 5-minute client timeout (`AbortController`).
- Response parsing tolerates `{...}` or `[{...}]`; reads `openai|gpt`, `claude|anthropic`,
  `gemini|google`, and `output|synthesis` for the final answer.
- Token usage/cost: uses `usage` from n8n if present, otherwise **estimates** at ~4 chars/token
  using the `PRICING` table.
- Follow-ups re-send the full prior context as a new `chatInput`.
- Built-in markdown renderer (headings, lists, tables, code, inline styles) — no markdown lib.
- Friendly error mapping: `Failed to fetch` → "Could not reach n8n — check CORS / URL".

---

## 8. Data model

### localStorage keys
| Key | Contents |
|-----|----------|
| `ph_user` | `{ clientId, name, email, mode:'api', apiKeys, enabledModels, onboardingComplete }` |
| `ph_history` | last 100 runs (prompt, responses, tokenData, follow-ups) |
| `ph_usage` | running totals (input/output/total tokens, cost) |
| `excelliq_admin_token` | admin portal JWT (admin feature only) |

`clientId` is generated client-side (`client_<ts>_<rand>`) and attached to every n8n request.

### Supabase schema (`supabase/schema.sql`, optional)
Tables `public.profiles` and `public.client_preferences` with RLS enabled. The current frontend
does **not** require these tables for auth to work — they're for server-side profile storage if
the Node backend is reintroduced.

---

## 9. Environment variables

### Frontend (baked at build time — must be set BEFORE `npm run build`)
```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<supabase publishable/anon key>
VITE_GOOGLE_CLIENT_ID=<google oauth client id>.apps.googleusercontent.com
VITE_N8N_URL=/proxy.php           # production (Hostinger)
# VITE_N8N_URL=/n8n-proxy/webhook/.../chat   # dev (Vite proxy)
VITE_API_SERVER_URL=https://<node-backend>   # ONLY if using Admin/ResultsHistory backend
```
`.env.production` currently sets the Supabase + Google + `/proxy.php` values. `VITE_API_SERVER_URL`
is intentionally unset (no Node backend deployed).

> ⚠️ Vite inlines `VITE_*` vars into the bundle at build time. Changing them requires a **rebuild
> and re-upload** — editing them on the server does nothing.

---

## 10. Recent change — auth migrated off the dead Node backend

**Problem:** the deployed signup posted to `http://localhost:3001/auth/signup/start`
(the `API_SERVER` fallback in `config/api.js`, because `VITE_API_SERVER_URL` was unset at build).
On the live HTTPS site this failed with **"Failed to fetch"** (no such server + mixed-content
block), and no Node auth backend was ever deployed.

**Fix (applied):** rewrote `OnboardingPage.jsx` to call **Supabase Auth directly** for
signup / login / password reset, and removed the dead fire-and-forget backend calls
(`/auth/google`, `/auth/preferences`). No Node backend needed; works on Hostinger static hosting.

Verified: the production bundle (`index-DYiNofYJ.js`) contains `signInWithPassword` /
`resetPasswordForEmail` and no longer contains `/auth/signup/start`.

---

## 11. Known issues / current status

1. **Supabase project unreachable (active blocker for signup).**
   `xvuyjjmflurqtuxculco.supabase.co` returns **NXDOMAIN** (host does not resolve). This is almost
   always a **paused** free-tier project (auto-pauses after ~1 week idle) or a deleted project.
   → **Action:** open https://supabase.com/dashboard and **Restore/Resume** the project (DNS returns
   in ~1–2 min, no rebuild needed). If deleted, create a new project, update `VITE_SUPABASE_URL`
   and `VITE_SUPABASE_PUBLISHABLE_KEY`, rebuild, re-upload.
   Also set, in Supabase → Authentication → URL Configuration:
   - Site URL: `https://lightseagreen-goose-335565.hostingersite.com`
   - Redirect URLs: add `…/reset-password`

2. **Admin Portal & Results History still depend on the Node backend.**
   `AdminPortal.jsx` (`${API_SERVER}/admin/...`) and `ResultsHistoryPage.jsx`
   (`${API_SERVER}/api/n8n-chat`) still call `API_SERVER`, which falls back to `localhost:3001`.
   These features will show "Failed to fetch" on the live site until either a Node backend is
   deployed (set `VITE_API_SERVER_URL`) or they're migrated to the proxy/Supabase like auth was.
   _(Note: the main chat does NOT use `API_SERVER` — it uses `VITE_N8N_URL`/`proxy.php`, so chat works.)_

3. **Bundle size** ~678 KB (190 KB gzipped) — single chunk; fine, but code-splitting would help.

---

## 12. Build & deploy (Hostinger)

```bash
cd 3llms-aichat-assistant
npm ci                # or npm install
# ensure .env.production has the correct VITE_* values
npm run build         # outputs dist/
# upload the CONTENTS of dist/ to Hostinger public_html (replace old files)
# ensure public/proxy.php is present at the site root
# ensure an .htaccess SPA rewrite to index.html exists for deep links
```

Each deploy creates a new hashed bundle name (e.g. `index-<hash>.js`); confirm the live
`index.html` references the new hash to verify the upload took effect.

---

## 13. Troubleshooting "Failed to fetch"

| Where it happens | Likely cause | Fix |
|------------------|-------------|-----|
| **Signup / login** | Supabase host unreachable (paused/deleted) | Restore Supabase project (§11.1) |
| Signup / login | Wrong `VITE_SUPABASE_URL`/key in build | Fix `.env.production`, rebuild, re-upload |
| Signup / login | "Authentication is not configured" message | Supabase env vars missing at build |
| **Chat prompt** | n8n unreachable / CORS / workflow off | Check `n8n.kleza.io` workflow active; CORS allow `*`; verify `proxy.php` |
| Chat prompt | n8n returns HTML | Webhook URL wrong or workflow errored |
| **Admin / History** | Node backend not deployed | Deploy backend + set `VITE_API_SERVER_URL`, or migrate (§11.2) |

A quick way to verify the live build and Supabase reachability:
```bash
curl -s https://<site>/ | grep -oE 'assets/[^"]+\.js'        # which bundle is live
nslookup <project-ref>.supabase.co                           # NXDOMAIN = paused/deleted
```
