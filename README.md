# Kleza Excelliq AI

React/Vite frontend plus a Node/Express API backend for running prompts through an n8n workflow connected to ChatGPT/OpenAI, Claude/Anthropic, and Gemini/Google provider APIs.

This branch is API-only. It does not include provider website login, saved provider sessions, or web-automation prompt execution.

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
npm start
```

Copy `.env.example` to `.env` and fill in the Supabase, Google OAuth, backend URL, and `N8N_WEBHOOK_URL` values.

## Full project documentation

See [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) for the API-only architecture, deployment model, and user flows.
