# Kleza Excelliq AI project documentation

## Project overview

Kleza Excelliq AI is an API-only multi-model answer engine. A user asks one question, the app sends that question to a configured n8n workflow, and the workflow routes it through selected AI provider APIs.

The supported model families are:

| Provider | Purpose |
|---|---|
| OpenAI / ChatGPT | Independent answer |
| Anthropic / Claude | Independent answer and final synthesis |
| Google / Gemini | Independent answer |

The final response is shown beside the individual model responses so the user can compare each source and read one polished synthesis.

## Architecture

```txt
User browser
   |
   v
React/Vite frontend
   |
   v
Node/Express API backend
   |
   +--> Supabase Auth and database
   |
   +--> n8n workflow
          |
          +--> OpenAI API
          +--> Anthropic Claude API
          +--> Google Gemini API
```

## Frontend

The frontend lives in `src`.

Important areas:

- `src/App.jsx`: routing, onboarding, history, usage state
- `src/components/PromptControl.jsx`: API-only prompt runner and follow-ups
- `src/pages/OnboardingPage.jsx`: signup/login and API key setup
- `src/pages/SettingsPage.jsx`: profile, model toggles, API keys
- `src/pages/IntegrationsPage.jsx`: n8n webhook and API key management
- `src/pages/AdminPortal.jsx`: admin analytics

Local browser storage is used for:

- `ph_user`: user profile, API keys, enabled models
- `ph_history`: prompt history
- `ph_usage`: usage and cost estimates

## Backend

The backend lives in `playwright-server` for compatibility with the existing project folder name, but this branch is an API-only Express server.

Main file:

```txt
playwright-server/server.js
```

Routes:

| Route | Purpose |
|---|---|
| `POST /auth/signup/start` | Create account |
| `POST /auth/signup/verify` | Signup verification compatibility route |
| `POST /auth/login` | Email/password login |
| `POST /auth/google` | Google login |
| `POST /auth/forgot-password` | Password reset |
| `POST /auth/preferences` | Save API-mode preferences |
| `POST /api/n8n-chat` | Proxy prompt requests to n8n |
| `POST /admin/login` | Admin login |
| `GET /admin/analytics` | Admin user analytics |
| `GET /health` | Backend health check |

## Prompt flow

```txt
User enters prompt
   |
Frontend sends chatInput, selectedModels, deepResearch, apiKeys
   |
POST /api/n8n-chat
   |
Backend proxies request to N8N_WEBHOOK_URL
   |
n8n calls provider APIs
   |
n8n returns openai, claude, gemini, output/synthesis, usage
   |
Frontend displays model cards and final synthesis
```

## Follow-up flow

Follow-ups are also API-only. The frontend builds a contextual prompt from:

- original question
- previous final answer
- previous follow-up answers
- new follow-up question

That contextual input is sent to the same `/api/n8n-chat` route.

## Data storage

Supabase stores:

| Table | Purpose |
|---|---|
| `profiles` | User profile, email, client ID, onboarding state |
| `client_preferences` | API mode and enabled models |

Provider API keys are stored locally in the user's browser and sent to the n8n workflow with each prompt request.

## Deployment

Required services:

- Static frontend host
- Node backend host
- Supabase project
- n8n workflow with provider API integrations

See [DEPLOYMENT.md](./DEPLOYMENT.md) for environment variables and deployment steps.
