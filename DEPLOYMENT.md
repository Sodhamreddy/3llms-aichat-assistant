# Excelliq Deployment Guide

This project has two deployable parts:

1. React/Vite frontend
2. Node/Express Playwright backend

Do not deploy this as a frontend-only app. Browser Mode requires a continuously running backend with persistent storage for Playwright profiles.

## Required Production Architecture

- Frontend: Vercel, Netlify, Cloudflare Pages, or any static host
- Backend: VPS, Render/Railway/Fly service, or Docker host
- Database/Auth: Supabase
- Persistent disk: mounted to `playwright-server/profiles`

## Frontend

Build command:

```bash
npm ci
npm run build
```

Output directory:

```txt
dist
```

Required frontend environment variables:

```env
VITE_PLAYWRIGHT_SERVER_URL=https://your-backend-domain.com
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
VITE_REMOTE_LOGIN_MODE=preview
VITE_SHARED_BROWSER_CLIENT_ID=client_1779447562737_qok6u0y7
```

Use `VITE_REMOTE_LOGIN_MODE=preview` for deployed/cloud servers. `native` only opens real Chrome on the machine where the Playwright backend is running, so it is useful for local desktop testing but not for normal website users.

SPA rewrites are included:

- `vercel.json` for Vercel
- `public/_redirects` for Netlify

These keep `/admin` and `/reset-password` working after refresh/direct link.

## Backend

From `playwright-server`:

```bash
npm ci
npm run install:browser:with-deps
npm start
```

Required backend environment variables:

```env
PORT=3001
APP_URL=https://your-frontend-domain.com
ALLOWED_ORIGINS=https://your-frontend-domain.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
ADMIN_PORTAL_EMAIL=admin@example.com
ADMIN_PORTAL_PASSWORD=replace_with_a_strong_password
ADMIN_SESSION_SECRET=replace_with_a_long_random_secret
SUPABASE_ADMIN_EMAILS=admin@example.com
PLAYWRIGHT_HEADLESS=true
SHARED_BROWSER_CLIENT_ID=client_1779447562737_qok6u0y7
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend.

## Optional Shared Browser Mode

Shared Browser Mode lets all app users run Browser Mode through one server-managed browser profile. This is useful for demos or internal deployments where you want users to use Excelliq immediately without logging in to ChatGPT, Claude, and Gemini themselves.

The app currently defaults to the shared profile `client_1779447562737_qok6u0y7`. Keep the same profile id in both frontend and backend env:

```env
SHARED_BROWSER_CLIENT_ID=client_1779447562737_qok6u0y7
VITE_SHARED_BROWSER_CLIENT_ID=client_1779447562737_qok6u0y7
```

Then log in once to each provider using that profile:

```bash
cd playwright-server
node login.js client_1779447562737_qok6u0y7
```

After deployment, rebuild the frontend and restart the backend so both env values are active. The shared session is stored under `playwright-server/profiles/client_1779447562737_qok6u0y7/`, so this folder must be on persistent disk.

Important: all users share the same provider accounts, provider limits, and provider chat history. Use separate per-client browser profiles for production deployments that require user privacy or per-user billing.

## Backend Docker

A Dockerfile is included in `playwright-server/Dockerfile`.

Build:

```bash
docker build -t excelliq-playwright ./playwright-server
```

Run locally:

```bash
docker run --env-file .env -p 3001:3001 -v excelliq-profiles:/app/profiles excelliq-playwright
```

In production, mount persistent storage to:

```txt
/app/profiles
```

## Supabase

Run `supabase/schema.sql` in the Supabase SQL editor.

Authentication settings:

- Disable email confirmation if you want immediate signup.
- Add these redirect URLs:

```txt
https://your-frontend-domain.com
https://your-frontend-domain.com/reset-password
http://localhost:5173
http://localhost:5173/reset-password
http://127.0.0.1:5173
http://127.0.0.1:5173/reset-password
```

Google OAuth:

- Add your production frontend URL to Google OAuth authorized JavaScript origins.
- Add your local dev origins if needed:

```txt
http://localhost:5173
http://127.0.0.1:5173
```

## Production Checks

Before launch:

```bash
npm ci
npm run build
cd playwright-server
npm ci
npm audit --omit=dev
node --check server.js
node --check session-manager.js
node --check auth-store.js
node --check admin-store.js
```

Then test:

- Signup
- Login
- Google login
- Forgot password
- `/admin`
- Browser Mode account connection
- Prompt run with ChatGPT, Claude, Gemini
- Logout and login again

## Known Production Risks

Browser Mode depends on ChatGPT, Claude, and Gemini web UIs. These sites can change selectors, add captchas, expire sessions, or block automation-like traffic. Keep the browser-profile disk persistent and expect occasional reconnects.

For the smoothest deployed remote login experience, replace the screenshot preview with a real streaming browser protocol such as noVNC or WebRTC. The current in-app preview is deployable, but it is not as smooth as a real local Chrome window.
