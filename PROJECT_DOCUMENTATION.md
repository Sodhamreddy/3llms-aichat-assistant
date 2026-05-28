# Kleza Excelliq AI project documentation

## 1. Project overview

### What this product does

Kleza Excelliq AI is a web application that lets a user ask one question and receive answers from multiple AI systems, mainly **ChatGPT**, **Claude**, and **Gemini**.

Instead of showing only one AI answer, the system:

1. Sends the user's question to the selected AI models.
2. Collects the individual answers.
3. Sends those answers to Claude for final synthesis.
4. Shows the user one clean final answer, plus the individual model responses for comparison.

### Simple explanation

Think of the app as a meeting room with three AI assistants. The user asks one question. Each assistant gives its own answer. Then Claude acts like an editor and prepares one final, polished answer using the best parts from all responses.

### Main goal

The goal is to give users a better answer than they would get from one AI model alone.

The product is useful for:

- Research
- Decision-making
- Content writing
- Comparisons
- Technical questions
- Business analysis
- Brainstorming

## 2. Key features

### Multi-model answering

The app can run a prompt through:

| Model | Role in the system |
|-------|---------------------|
| ChatGPT | Gives one independent answer |
| Gemini | Gives one independent answer |
| Claude | Gives one independent answer and also creates the final synthesis |

### Final synthesis

After the individual answers are collected, Claude receives a special synthesis prompt. Claude is instructed to act like an editor-in-chief, compare the answers, remove weak information, resolve conflicts, and produce one definitive response.

### Browser mode

Browser Mode lets users connect their own ChatGPT, Claude, and Gemini accounts without using official API keys.

The system uses Playwright browser automation to open those AI websites, send prompts through the normal web interface, and read the answers.

### API mode

API Mode is an optional path where users can provide API keys instead of browser logins.

This mode can be faster and more stable, but it requires users to have official API access.

### User account system

The app supports user signup and login using Supabase authentication.

Users can log in with:

- Email and password
- Google login

### Password reset

Users can click **Forgot password**, receive a Supabase reset email, and set a new password from the reset page.

### Admin portal

The admin portal is separate from the main chat interface. It shows analytics and user information for administrators.

## 3. Important terms

### Frontend

The frontend is the part users see in the browser. It includes the login screen, onboarding screens, settings, chat interface, and admin page.

Technical part:

- Built with React and Vite
- Main source folder: `src`
- Production build output: `dist`

### Backend

The backend is the server that handles authentication, browser automation, prompt execution, and admin analytics.

Technical part:

- Built with Node.js and Express
- Main backend folder: `playwright-server`
- Main backend file: `playwright-server/server.js`

### Playwright

Playwright is a browser automation tool. It controls Chrome in the background.

In this project, Playwright is used to:

- Open ChatGPT, Claude, and Gemini
- Let users log in to those websites
- Save browser sessions
- Send prompts
- Read responses

### Supabase

Supabase is used for user authentication and database storage.

It stores:

- User profiles
- Client IDs
- User preferences
- Browser session status

It should not store:

- ChatGPT passwords
- Claude passwords
- Gemini passwords

### Browser profile

A browser profile is a saved browser session. It contains cookies and login state.

In simple terms, it remembers that a user is already logged in.

Technical path:

```txt
playwright-server/profiles/<client_id>/
```

Each user gets a separate profile so user sessions do not mix.

## 4. System architecture

### High-level architecture

```txt
User browser
   |
   v
React frontend
   |
   v
Node/Express backend
   |
   +--> Supabase database and auth
   |
   +--> Playwright-controlled browser profiles
          |
          +--> ChatGPT website
          +--> Claude website
          +--> Gemini website
```

### Plain-English explanation

The user uses the web app in their browser. The web app talks to the backend server. The backend server talks to Supabase for user data and controls browser sessions for ChatGPT, Claude, and Gemini.

### Technical explanation

| Layer | Technology | Responsibility |
|-------|------------|----------------|
| Frontend | React, Vite | User interface |
| Backend | Node.js, Express | API routes, auth handling, prompt orchestration |
| Automation | Playwright, Chrome | Browser-based LLM login and prompting |
| Database/Auth | Supabase | Users, profiles, preferences, session tracking |
| Storage | Persistent server disk | Browser profiles and cookies |

## 5. Detailed user flow

## 5.1 First-time user flow

### Step 1: User opens the website

The user lands on the Excelliq website.

They see the product introduction and can click **Get Started** or **Start for free**.

Technical detail:

- The frontend checks local browser storage to see whether the user has completed onboarding.
- If not, the onboarding flow starts.

### Step 2: User creates an account

The user can sign up using:

- Email and password
- Google login

For email signup, the user enters:

- Display name
- Email address
- Password

Technical detail:

- Signup request goes to the backend.
- Backend creates the user in Supabase.
- Backend creates or links a `client_id`.
- User profile is saved in the `profiles` table.
- Preferences are saved in the `client_preferences` table.

### Step 3: User chooses setup mode

The user chooses between:

| Mode | Meaning | Best for |
|------|---------|----------|
| Browser Mode | Uses the user's logged-in ChatGPT, Claude, and Gemini accounts | Users without API keys |
| API Mode | Uses official provider API keys | Advanced users or production-grade reliability |

Browser Mode is the default because the project is designed to work without API keys.

### Step 4: User connects LLM accounts

In Browser Mode, the user connects:

- ChatGPT
- Claude
- Gemini

The user clicks **Connect** for each provider.

### Local development behavior

When running locally, the app can open a real Chrome browser window on the same machine. The user logs in normally, just like using Chrome directly.

### Production behavior

In deployment, the backend runs on a server, not on the user's laptop. A real Chrome window would open on the server, not on the user's screen.

So production should use:

```env
VITE_REMOTE_LOGIN_MODE=preview
```

This shows the remote browser inside the app using screenshots and browser actions.

### Step 5: User logs in to ChatGPT, Claude, and Gemini

The user manually logs in to each provider.

Important security point:

The app does not store the user's ChatGPT, Claude, or Gemini passwords.

It only stores browser session data such as cookies inside that user's isolated browser profile.

### Step 6: User clicks Finish

After logging in, the user clicks **Finish**.

The backend checks whether the login was successful.

Technical detail:

- Backend opens the provider page.
- It checks whether logged-in UI elements are visible.
- If valid, session status becomes `connected`.
- If not valid, session status becomes `expired` or `error`.

Session status is stored in:

```txt
client_llm_sessions
```

### Step 7: User completes onboarding

After accounts are connected, the user enters the main chat screen.

Technical detail:

- `onboarding_complete` is marked as true in Supabase.
- Next time the user logs in, setup should not appear again.

## 5.2 Returning user flow

### Step 1: User logs in

The user logs in using email/password or Google.

### Step 2: App loads saved profile

The backend retrieves:

- User profile
- Client ID
- Preferences
- Onboarding status
- Connected provider status

### Step 3: User goes directly to chat

If onboarding is already complete, the user should not see setup again.

They go directly to the main chat screen.

### Step 4: User asks a question

The user enters a prompt in the chat box.

Example:

```txt
What are the best AI trends in SEO?
```

### Step 5: App checks connected models

Before running the prompt, the app checks which browser sessions are connected.

If Claude and ChatGPT are connected but Gemini is expired, the system should only use the connected models or ask the user to reconnect Gemini.

### Step 6: Backend sends prompt to selected providers

The backend opens the saved browser profile and sends the prompt to selected AI websites.

Technical route:

```txt
POST /run-prompt
```

The backend sends progress updates using a streaming response.

### Step 7: Individual answers are collected

The backend collects:

- ChatGPT answer
- Gemini answer
- Claude answer

These are shown in separate model cards.

### Step 8: Claude creates final synthesis

Claude receives:

- The original question
- ChatGPT's response
- Gemini's response
- Claude's own first response

Claude then creates one final answer using the synthesis prompt.

The final answer is shown as the main result.

### Step 9: User can ask follow-up questions

The user can ask a follow-up question based on the previous answer.

Technical route:

```txt
POST /follow-up
```

The system can again use the selected models and synthesize a final response.

## 5.3 Forgot password flow

### Step 1: User clicks Forgot password

The user enters their email and clicks the reset option.

### Step 2: Supabase sends reset email

Supabase sends a password reset email to the user.

### Step 3: User clicks reset link

The link opens:

```txt
/reset-password
```

### Step 4: User sets new password

The user enters and confirms the new password.

### Step 5: User logs in again

After password reset, the user can log in with the new password.

## 5.4 Admin user flow

### Step 1: Admin opens admin page

The admin page is separate from the chat interface.

Path:

```txt
/admin
```

### Step 2: Admin logs in

Admin uses the configured admin email and password.

Technical environment variables:

```env
ADMIN_PORTAL_EMAIL=admin@example.com
ADMIN_PORTAL_PASSWORD=replace_with_a_strong_password
ADMIN_SESSION_SECRET=replace_with_a_long_random_secret
```

### Step 3: Admin views analytics

Admin can view:

- Signed-in users
- Browser mode users
- Connected sessions
- Provider status
- User profile information

## 6. Prompt execution flow

### Plain-English flow

The user asks one question. The app sends that question to multiple AI models. Each model answers. Claude then reads the answers and prepares the best final version.

### Technical flow

```txt
Frontend
   |
   v
POST /run-prompt
   |
   v
Backend validates client_id and selected models
   |
   v
Backend opens Playwright browser context
   |
   v
Prompt sent to ChatGPT, Claude, Gemini
   |
   v
Responses scraped from browser UI
   |
   v
Claude receives synthesis prompt
   |
   v
Final answer streamed back to frontend
```

### Final synthesis behavior

Claude is instructed to:

- Understand the user's true goal
- Compare all model responses
- Keep strong and accurate claims
- Remove weak or unsupported claims
- Resolve conflicts
- Produce one polished final answer

The final answer must not include:

- Source labels
- Original question
- Meta commentary
- Knowledge cutoff disclaimers
- UI artifacts
- Unnecessary filler

## 7. Data storage

### What is stored

| Data | Where it is stored | Why it is needed |
|------|---------------------|------------------|
| User account | Supabase Auth | Login and identity |
| User profile | `profiles` table | Name, email, client ID |
| Preferences | `client_preferences` table | Mode and enabled models |
| Session status | `client_llm_sessions` table | Provider connection tracking |
| Browser cookies | Server browser profile folder | Keeps LLM accounts logged in |

### What is not stored

The system should not store:

- ChatGPT password
- Claude password
- Gemini password
- User's official API keys on the server unless a secure storage design is added

## 8. Security model

### Client isolation

Each user has a unique `client_id`.

Each `client_id` gets its own browser profile.

Example:

```txt
playwright-server/profiles/client_123/
playwright-server/profiles/client_456/
```

This prevents one user's browser session from mixing with another user's session.

### Supabase service role key

The Supabase service role key is powerful. It must only exist on the backend server.

It must never be placed in:

- Frontend code
- Vite environment variables exposed to the browser
- Public GitHub repository

### CORS protection

The backend supports `ALLOWED_ORIGINS`.

This controls which frontend domains can call the backend.

Example:

```env
ALLOWED_ORIGINS=https://your-frontend-domain.com
```

## 9. Deployment architecture

### Recommended production setup

| Part | Recommended hosting |
|------|----------------------|
| Frontend | Vercel, Netlify, or Cloudflare Pages |
| Backend | VPS, Render, Railway, Fly.io, or Docker host |
| Database | Supabase |
| Browser profile storage | Persistent disk attached to backend |

### Why frontend-only hosting is not enough

The app cannot be deployed only as a static website because Browser Mode needs a backend that runs continuously.

The backend must:

- Run Playwright
- Launch Chrome
- Store browser profiles
- Send prompts
- Read AI responses

## 10. Required environment variables

### Frontend variables

```env
VITE_PLAYWRIGHT_SERVER_URL=https://your-backend-domain.com
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
VITE_REMOTE_LOGIN_MODE=preview
```

### Backend variables

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
```

## 11. Deployment steps

### Step 1: Prepare Supabase

Run the database schema:

```txt
supabase/schema.sql
```

Add redirect URLs:

```txt
https://your-frontend-domain.com
https://your-frontend-domain.com/reset-password
```

### Step 2: Deploy backend

Install backend dependencies:

```bash
cd playwright-server
npm ci
npm run install:browser:with-deps
npm start
```

For Docker:

```bash
docker build -t excelliq-playwright ./playwright-server
docker run --env-file .env -p 3001:3001 -v excelliq-profiles:/app/profiles excelliq-playwright
```

### Step 3: Attach persistent storage

Browser profiles must survive server restarts.

Mount persistent storage to:

```txt
playwright-server/profiles
```

Docker path:

```txt
/app/profiles
```

### Step 4: Deploy frontend

Build frontend:

```bash
npm ci
npm run build
```

Deploy output folder:

```txt
dist
```

### Step 5: Test production

Test these flows:

- Signup
- Login
- Google login
- Forgot password
- Browser Mode connection
- Prompt run
- Follow-up question
- Logout and login again
- Admin portal

## 12. Known production risks

### Browser automation can break

ChatGPT, Claude, and Gemini are third-party websites. Their UI can change at any time.

If they change buttons, editors, or response layout, scraping may need updates.

### Captchas and bot detection

LLM providers may show captchas, additional login checks, or automation warnings.

Users may need to manually reconnect.

### Session expiry

Saved browser sessions can expire.

When this happens, the app should show the user that the account needs reconnection.

### Remote browser login smoothness

The current production-safe browser login uses a screenshot-based preview.

It works, but it is not as smooth as a real local browser.

For a smoother production experience, use:

- noVNC
- WebRTC browser streaming
- A managed remote browser service

### Server resource usage

Running multiple browser sessions can use significant CPU and memory.

Production hosting should have enough resources for expected users.

## 13. Final launch checklist

### Product checks

- Users can sign up.
- Users can log in.
- Existing users skip setup.
- Forgot password works.
- Browser Mode opens provider login.
- ChatGPT connects.
- Claude connects.
- Gemini connects.
- Prompt run returns individual responses.
- Claude final synthesis appears.
- Follow-up questions work.
- Admin portal works.

### Technical checks

- `npm run build` passes.
- `npm run lint` passes with no blocking errors.
- Backend starts successfully.
- `/health` returns `{ "ok": true }`.
- Supabase schema is created.
- Supabase redirect URLs are correct.
- Persistent storage is mounted.
- `ALLOWED_ORIGINS` is set.
- `SUPABASE_SERVICE_ROLE_KEY` is only on backend.
- `VITE_REMOTE_LOGIN_MODE=preview` is set for production.

## 14. Summary

Kleza Excelliq AI is a multi-model AI answer engine. It lets users connect their own ChatGPT, Claude, and Gemini accounts, ask one question, and receive a stronger final answer synthesized by Claude.

The most important production requirement is the Playwright backend. It must run continuously and must have persistent storage for browser profiles. Without that, Browser Mode will not work reliably.

The most important user experience requirement is account reconnection. Since third-party LLM sessions can expire, the app must clearly guide users to reconnect ChatGPT, Claude, or Gemini when needed.
