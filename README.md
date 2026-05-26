# Kleza Excelliq AI

React/Vite frontend plus a Node/Express Playwright backend for running prompts through browser sessions for ChatGPT, Claude, and Gemini.

## Local Development

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
cd playwright-server
npm install
npm run install:browser
npm start
```

Copy `.env.example` to `.env` and fill in the Supabase, Google OAuth, and backend URL values.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full production checklist.
