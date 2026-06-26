# Excelliq AI — Getting Started & Full Process Guide

_A step-by-step walkthrough: what to set up, how to start the app, how a user signs up,
and the full process of using it. Current version (2026-06-24, Supabase-auth)._

> Read [CURRENT_VERSION.md](./CURRENT_VERSION.md) for the technical architecture.
> This file is the **process / how-to** guide.

---

## PART A — One-time setup (operator / admin)

Signup will NOT work until these three services are live. Do these once.

### Step 1 — Restore the Supabase project (REQUIRED — current blocker)
Auth runs on Supabase. Right now the project host does not resolve (it is paused or deleted).

1. Go to **https://supabase.com/dashboard** and log in.
2. Open the project (ref `xvuyjjmflurqtuxculco`).
3. If it shows **Paused** → click **Restore / Resume**. Wait ~1–2 minutes.
4. If the project is gone → create a new project, then copy its **Project URL** and
   **publishable (anon) key** into `.env.production` (see Step 4) and rebuild.
5. In Supabase → **Authentication → URL Configuration**, set:
   - **Site URL:** `https://lightseagreen-goose-335565.hostingersite.com`
   - **Redirect URLs:** add `https://lightseagreen-goose-335565.hostingersite.com/reset-password`
6. In Supabase → **Authentication → Providers → Email**, choose:
   - **Confirm email ON** = users must click an email link before they can log in (more secure).
   - **Confirm email OFF** = instant signup, no email step (simpler).

> ✅ Verify it's live: `nslookup xvuyjjmflurqtuxculco.supabase.co` should return an IP
> (NXDOMAIN means still paused/deleted).

### Step 2 — n8n workflow (powers the chat, not signup)
The chat sends prompts to an n8n workflow at `n8n.kleza.io`.
1. Make sure the workflow with webhook id `bf39cd7e-9f1b-4b3e-98eb-8b746cd2b510` is **Active**.
2. Make sure its provider nodes (ChatGPT / Gemini / Claude) have valid API keys.

### Step 3 — Google OAuth (only if "Continue with Google" is used)
The client id is already set in `.env.production`. If you change it, make sure the site origin
`https://lightseagreen-goose-335565.hostingersite.com` is an authorized JavaScript origin in the
Google Cloud console.

### Step 4 — Environment file
`.env.production` must contain (these are baked into the build):
```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable/anon key>
VITE_GOOGLE_CLIENT_ID=<client-id>.apps.googleusercontent.com
VITE_N8N_URL=/proxy.php
```
> ⚠️ Changing these requires a **rebuild + re-upload** — editing them on the server does nothing.

---

## PART B — How to start the app

### Option 1 — Run locally (development)
```bash
cd 3llms-aichat-assistant
npm install        # first time only
npm run dev        # starts Vite dev server
```
Open the URL it prints (usually `http://localhost:5173`).
In dev, chat goes through the Vite proxy `/n8n-proxy` → `n8n.kleza.io` automatically.

### Option 2 — Build & deploy to Hostinger (production)
```bash
cd 3llms-aichat-assistant
npm install                 # first time only
npm run build               # creates the dist/ folder
```
Then:
1. Upload **the contents of `dist/`** to Hostinger `public_html` (replace old files).
2. Make sure **`proxy.php`** is at the site root (it forwards chat to n8n).
3. Make sure an **`.htaccess`** SPA rewrite to `index.html` exists (so `/reset-password` works on refresh).
4. Open `https://lightseagreen-goose-335565.hostingersite.com`.

> ✅ Verify the upload: `curl -s https://<site>/ | grep assets` — the `index-<hash>.js`
> filename should match the newest file in your local `dist/assets/`.

---

## PART C — How a user signs up (step by step)

This is what an end user sees the first time they open the site.

1. **Landing page** → click **Get Started**.
2. **Create your account** screen appears. Two ways:

   **A) Email + password**
   1. Enter **Display name**.
   2. Enter **Email address**.
   3. Enter a **Password** (minimum 6 characters; use Show/Hide to check it).
   4. Tick **"I agree to the Terms of use and Privacy Policy."**
   5. Click **Sign up**.
   6. If email confirmation is ON, you'll see "Account created — check your email to confirm."
      Confirm via the email link, then you can log in. (You can still continue setup now.)

   **B) Continue with Google**
   1. Click **Continue with Google**.
   2. Pick your Google account and approve.
   3. Your name/email are filled in automatically.

3. **Add provider keys** (Step 2 of onboarding):
   - Toggle the providers you want: **ChatGPT**, **Gemini**, **Claude**.
     (Claude is always on — it writes the final answer.)
   - Paste each provider's API key (ChatGPT `sk-...`, Claude `sk-ant-...`, Gemini `AIza...`).
     Keys are stored **only in your browser**.
   - Click **Review setup**.
4. **Review** (Step 3): confirm name, email, and which providers have keys → click **Start chatting**.

You're now in the app. Onboarding is remembered in your browser, so next time you go straight in.

### Logging in later
On the same screen click **"Already have an account? Log in"**, enter email + password (or Google),
and click **Log in**.

### Forgot password
1. On the **Log in** screen click **Forgot password?**
2. Enter your email → a reset link is emailed.
3. Click the link → you land on the **Reset password** page → set a new password → log in.

---

## PART D — The full process of using the app

1. **Pick a mode** (top-left of the chat screen):
   - **⚡ Battle Mode** — see all three model answers, then Claude's synthesis.
   - **👁 Invisible Mode** — see only Claude's clean synthesis.
2. **Choose models** with the pills above the send button (ChatGPT / Gemini / Claude).
3. **Type your prompt** in the box and press **Enter** (Shift+Enter for a new line).
4. The app shows a live timer while it calls **ChatGPT · Claude · Gemini via n8n**.
5. **Results:**
   - Battle Mode: a card per model, then the Claude synthesis (orange "C" bubble).
   - Each answer has a **Copy** button; the synthesis shows elapsed time.
6. **Ask a follow-up** — the box turns into "Ask a follow-up…"; prior context is carried over.
7. **History & usage** are saved automatically (in your browser):
   - **Results History** — past runs and follow-ups (sidebar).
   - **Dashboard / Analytics** — token usage and estimated cost.
   - **Settings** — reset usage counters.
8. **New chat** — click **New chat** in the sidebar to start fresh.

---

## PART E — Quick reference

| I want to… | Do this |
|------------|---------|
| Run locally | `npm run dev` |
| Deploy | `npm run build` → upload `dist/` to Hostinger |
| Fix "Failed to fetch" on signup | Restore the Supabase project (Part A, Step 1) |
| Fix "Failed to fetch" on chat | Check n8n workflow is Active + `proxy.php` present |
| Change Supabase/Google/n8n config | Edit `.env.production`, then rebuild + re-upload |
| Reset a password | Log in screen → Forgot password? |
| Open admin dashboard | Go to `/admin` (needs the Node backend — not deployed yet) |

---

## PART F — Process flow at a glance

```
First visit
   │
   ▼
Landing → Sign up (email/Google) ──► [Supabase Auth]
   │                                      │
   ▼                                      ▼
Add provider API keys (stored in browser)
   │
   ▼
Start chatting
   │
   ▼
Type prompt ──► proxy.php ──► n8n ──► ChatGPT + Gemini + Claude
   │                                          │
   ▼                                          ▼
See model cards (Battle) ◄────────── Claude writes final synthesis
   │
   ▼
Ask follow-ups · saved to History · usage tracked
```
