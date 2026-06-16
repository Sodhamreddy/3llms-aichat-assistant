# API-only deployment

This branch deploys Excelliq without browser automation. The production stack is:

1. React/Vite frontend
2. Node/Express API backend
3. Supabase auth and database
4. n8n workflow for provider API calls

## Required environment variables

Frontend:

```env
VITE_API_SERVER_URL=https://your-backend-domain.com
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
```

Backend:

```env
PORT=3001
APP_URL=https://your-frontend-domain.com
ALLOWED_ORIGINS=https://your-frontend-domain.com
N8N_WEBHOOK_URL=https://n8n.kleza.io/webhook/your-workflow/chat
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
ADMIN_PORTAL_EMAIL=admin@example.com
ADMIN_PORTAL_PASSWORD=replace_with_a_strong_password
ADMIN_SESSION_SECRET=replace_with_a_long_random_secret
SUPABASE_ADMIN_EMAILS=admin@example.com
```

## Deploy backend

```bash
cd playwright-server
npm ci
npm start
```

Docker:

```bash
docker build -t excelliq-api ./playwright-server
docker run --env-file .env -p 3001:3001 excelliq-api
```

## Deploy frontend

```bash
npm ci
npm run build
```

Deploy the `dist` folder to Vercel, Netlify, Cloudflare Pages, or another static host.

## Validate production

- Signup and login
- Google login
- Forgot password
- API key setup
- Prompt run through n8n
- Follow-up question
- Results history
- Admin portal
- `/health` on the backend
