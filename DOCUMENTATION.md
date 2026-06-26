# Kleza TriMind AI — Full Project Documentation

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [How It Works — End to End](#4-how-it-works--end-to-end)
5. [Browser Process (Playwright)](#5-browser-process-playwright)
6. [API Reference](#6-api-reference)
7. [Frontend Pages & Components](#7-frontend-pages--components)
8. [Data Flow Diagram](#8-data-flow-diagram)
9. [State Management](#9-state-management)
10. [Pricing & Token Tracking](#10-pricing--token-tracking)
11. [Setup & Running Locally](#11-setup--running-locally)

---

## 1. Project Overview

**Kleza TriMind AI** is a desktop AI assistant that sends any prompt to **ChatGPT, Claude, and Gemini simultaneously** inside a hidden Chrome browser window (no API keys required for ChatGPT or Claude — it logs in as a real user). All three responses are then fed back into Claude for a final synthesized, well-formatted answer.

The system has two parts that run together:
- **React frontend** (Vite) — the UI the user interacts with
- **Playwright server** (Node.js / Express) — controls a hidden Chrome window and scrapes LLM responses

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, plain CSS-in-JS |
| Backend | Node.js, Express 4 |
| Browser automation | Playwright (Chromium via CDP) |
| Chrome connection | Chrome DevTools Protocol (CDP) on port 9222 |
| Streaming | Server-Sent Events (SSE) |
| State persistence | `localStorage` (history + usage) |

---

## 3. Project Structure

```
3llms-aichat-assistant/
├── src/                          # React frontend (Vite)
│   ├── App.jsx                   # Root — routing, shared state, history
│   ├── components/
│   │   ├── Sidebar.jsx           # Navigation sidebar + chat history
│   │   ├── PromptControl.jsx     # Main chat input + response cards
│   │   ├── HistoryTable.jsx      # Compact history table widget
│   │   ├── DashWidgets.jsx       # Reusable dashboard widgets
│   │   └── Header.jsx            # Top header bar
│   └── pages/
│       ├── PromptRunnerPage.jsx  # Landing / chat page
│       ├── DashboardPage.jsx     # Overview stats + recent activity
│       ├── AnalyticsPage.jsx     # Charts, token usage, cost breakdown
│       ├── LLMModelsPage.jsx     # Model cards + enable/disable toggles
│       ├── ResultsHistoryPage.jsx# Full paginated history
│       ├── SettingsPage.jsx      # Profile, prefs, Browser Login control
│       ├── AutomationsPage.jsx   # (Placeholder)
│       └── IntegrationsPage.jsx  # (Placeholder)
│
└── playwright-server/            # Node.js backend
    ├── server.js                 # Express API + SSE endpoint
    ├── scraper.js                # All Playwright browser automation
    ├── login.js                  # First-time login helper
    ├── start-chrome.bat          # Launches Chrome with CDP on port 9222
    └── package.json
```

---

## 4. How It Works — End to End

### Normal Prompt Run

```
User types prompt
        │
        ▼
React frontend (PromptControl.jsx)
  POST /run-prompt  ──────────────────▶  Express server (server.js)
                                                │
                                         Playwright connects
                                         to Chrome via CDP
                                                │
                                    ┌───────────┼───────────┐
                                    ▼           ▼           ▼
                                ChatGPT      Gemini      Claude
                               (parallel)  (parallel)  (parallel)
                                    │           │           │
                                    └───────────┴───────────┘
                                                │
                                    SSE stream back to React
                                    (partial events per model)
                                                │
                                         Claude synthesizes
                                         all 3 responses
                                                │
                                    SSE "complete" event sent
                                                │
                                        ▼
                              React renders response cards
                              History saved to localStorage
```

### Follow-up Question

```
User types follow-up
        │
        ▼
POST /follow-up
        │
  Claude only (full context already in previous answer)
        │
  JSON response (not SSE)
        │
  Appended to history item's followUps[]
```

---

## 5. Browser Process (Playwright)

### Chrome Setup
Chrome must be launched with remote debugging enabled (via `start-chrome.bat`):
```
chrome.exe --remote-debugging-port=9222 --user-data-dir=C:\chrome-llm-profile
```
Playwright then connects to it over CDP — it **reuses the existing logged-in session**, not a fresh browser.

### Window Visibility
| State | How | When |
|---|---|---|
| Hidden | `left: -32000, top: -32000, 1×1px` + minimized | Default during automation |
| Visible | `windowState: normal, 1280×900, left: 80, top: 80` | User clicks "Show Chrome" in Settings |

The off-screen + minimized combination is used because CDP events work regardless of window state — Chrome remains fully functional while invisible.

### First-Time Login
1. User clicks **Show Chrome** in Settings → `POST /show-chrome`
2. Chrome window appears with tabs open for chatgpt.com, claude.ai, gemini.google.com
3. User manually logs into all three accounts
4. User clicks **Hide Chrome** → `POST /hide-chrome`
5. Sessions are persisted in the Chrome profile folder — this only needs to be done once

### Text Input Strategy
`page.click()` fails when a window is off-screen (element outside viewport). Instead, the scraper uses `page.evaluate()` to inject text directly via JS:
```js
document.querySelector(selector).focus();
document.execCommand('selectAll', false, null);
document.execCommand('insertText', false, content);
```
This runs inside the page context and is not affected by the window position.

### Parallel Tab Execution
All three browser tabs are pre-created sequentially (fast — just `newPage()`), then all three navigations and interactions fire **simultaneously** via `Promise.all`. This means total wait time ≈ slowest model, not sum of all three.

### Waiting for Response Completion

Two strategies are tried per model:

**Strategy A — Stop button (preferred):**
Watches for a stop/cancel button to appear in the DOM, then waits for it to disappear. Races multiple known selectors in parallel so the first one found wins.

**Strategy B — Stability poll (fallback):**
Polls the last assistant message's text length every 700ms. If length is unchanged for 3 consecutive polls (~2.1s) and content is longer than 30 chars, generation is considered complete.

### Response Extraction (Claude)

Three layers, tried in order:
1. **Copy button click** — clicks the "Copy" button on the last response, reads `navigator.clipboard`. Validates the clipboard content is not accidentally the input prompt.
2. **DOM selector** — queries `[data-testid="assistant-message"]`, `.font-claude-message`, etc. Filters out blocks that contain input-like signals.
3. **`cleanClaudeResponse()`** — strips Claude UI chrome: timestamps, model labels (Sonnet/Opus/Haiku), knowledge-cutoff disclaimers, "Claude is AI…" notices, leaked synthesis instructions.

### Synthesis Step
After all three raw responses arrive, a **second Claude call** runs a synthesis prompt:
```
Question: "{original}"

[ChatGPT]
{gpt response}

[Gemini]
{gemini response}

[Claude]
{claude response}

Synthesize the above into one clear, comprehensive final answer...
```
The synthesized response is what the user sees as the final "Claude" result.

---

## 6. API Reference

Base URL: `http://localhost:3001`

### `GET /health`
Health check.
```json
{ "ok": true }
```

### `POST /show-chrome`
Makes the Chrome window visible. Opens tabs for chatgpt.com, claude.ai, and gemini.google.com if not already open.

**Response:**
```json
{ "ok": true, "message": "Chrome is now visible..." }
```
**Error (500):** Chrome not running / CDP connection failed.

---

### `POST /hide-chrome`
Moves Chrome off-screen and minimizes it.

**Response:**
```json
{ "ok": true, "message": "Chrome hidden." }
```

---

### `POST /run-prompt`
Main endpoint. Runs the prompt on all selected LLMs and streams results via SSE.

**Request body:**
```json
{
  "prompt": "Explain quantum computing",
  "selectedModels": ["openai", "gemini", "claude"],
  "deepResearch": false
}
```
- `selectedModels` — optional, defaults to all three
- `deepResearch` — optional boolean, enables Deep Research mode for ChatGPT and Gemini

**Response:** `Content-Type: text/event-stream`

Each SSE event is `data: <JSON>\n\n`:

| `type` | Payload | Meaning |
|---|---|---|
| `running` | `{}` | Job started |
| `partial` | `{ openai: "..." }` | ChatGPT finished |
| `partial` | `{ gemini: "..." }` | Gemini finished |
| `partial` | `{ claude: "Synthesizing…" }` | Synthesis started |
| `partial` | `{ claude: "<answer>" }` | Synthesis complete |
| `complete` | `{ openai, claude, gemini, elapsed }` | All done |
| `error` | `{ message: "..." }` | Failure |

**429** if another prompt is already running.

---

### `POST /follow-up`
Sends a follow-up question to Claude only (uses previous conversation as context).

**Request body:**
```json
{
  "originalPrompt": "Explain quantum computing",
  "previousAnswer": "...",
  "followUpQuestion": "Can you elaborate on superposition?",
  "selectedModels": ["claude"]
}
```

**Response:**
```json
{ "claude": "...", "elapsed": "3.42" }
```

---

## 7. Frontend Pages & Components

### App.jsx — Root
Holds all shared state and routes between pages.

| State | Storage | Purpose |
|---|---|---|
| `activePage` | memory | Which page is shown |
| `history` | `localStorage` (100 items max) | All past prompt runs |
| `usage` | `localStorage` | Cumulative token counts and cost |
| `chatKey` | memory | Forces `PromptRunnerPage` remount on "New Chat" |

---

### Sidebar.jsx
Fixed left panel (240px wide, collapses to 0).

Features:
- **New Chat** — resets the prompt runner
- **Search** — inline filter on history, activates on click
- **History** — goes to ResultsHistoryPage
- **More** — expandable sub-nav (Dashboard, Analytics, Integrations, Automations, LLM Models, Settings)
- **Recent chats** — last 30 items grouped by Today / Yesterday / This week / This month / Older
- **Profile popup** — Settings, Help (mailto), Log out (clears localStorage + reloads)

---

### PromptRunnerPage.jsx + PromptControl.jsx
The main chat interface.

`PromptRunnerPage` is a centered layout with a greeting and the `PromptControl` component.

`PromptControl` handles:
- **Prompt textarea** with auto-resize
- **Model selector checkboxes** (OpenAI, Gemini, Claude)
- **Deep Research toggle**
- **Suggestion chips** (Write something, Compare models, Brainstorm ideas, Analyze data)
- **SSE connection** to `/run-prompt` — updates response cards as each model finishes
- **Response cards** — one per model with inline markdown rendering
- **Follow-up input** — appears after a run completes, posts to `/follow-up`
- **Error blocks** — categorized error display (rate limit, auth, timeout, server error, etc.)
- **Token/cost display** — shows per-run token counts from Gemini API
- **Research step animation** — animated steps shown during Deep Research runs

**Markdown rendering** (built-in, no library):
- `## Headings` → `<h2>`
- `**bold**`, `*italic*`, `` `code` ``
- `- bullet lists`
- Numbered lists
- Code blocks (` ``` `)
- Markdown tables with `|` pipe syntax
- Horizontal rules (`---`)

---

### DashboardPage.jsx
Overview with 4 stat cards (Total Runs, Total Tokens, Total API Cost, Top Model), a Gemini API usage breakdown, a quick-action "Run a Prompt" button, and a recent activity table (last 5 runs).

---

### AnalyticsPage.jsx
- 4 stat cards (same metrics as Dashboard)
- Weekly activity bar chart (current week, Mon–Sun, today highlighted)
- Model usage breakdown with percentage bars
- Full Gemini API cost breakdown table (input tokens, output tokens, total tokens, total cost)

---

### LLMModelsPage.jsx
Cards for each model (Gemini 1.5, Claude-3, GPT-4o) showing:
- Speed, context window, input/output pricing
- Strength tags
- Active/inactive toggle (local state only — controls which models are pre-selected in PromptControl)

---

### SettingsPage.jsx
- **Profile** — display name and email (local state, no backend)
- **API Usage** — live token counts and cost from `usage` prop
- **Preferences** — toggles for email notifications, auto-save, show tokens, dark mode
- **Browser Mode Login** — Show Chrome / Hide Chrome buttons (calls `/show-chrome` and `/hide-chrome`)
- **Danger Zone** — Reset Usage Stats, Clear History, Delete Account

---

### ResultsHistoryPage.jsx
Full paginated view of all saved prompt runs. Each row is expandable to show all three model responses and any follow-up Q&As.

---

## 8. Data Flow Diagram

```
┌──────────────────────────────────────────────────────┐
│                   React Frontend                      │
│                                                       │
│  PromptControl ──POST /run-prompt──▶                  │
│                                                       │
│  ◀── SSE stream ─────────────────────────────────     │
│    partial { openai }  → renders ChatGPT card         │
│    partial { gemini }  → renders Gemini card          │
│    partial { claude }  → renders Claude card          │
│    complete            → saves to history[]           │
│                                                       │
│  App.jsx                                              │
│    history[]  ──────────────── localStorage           │
│    usage{}    ──────────────── localStorage           │
└──────────────────────────────────────────────────────┘
                         │
                    POST /run-prompt
                         │
┌──────────────────────────────────────────────────────┐
│                  Express Server                       │
│                  (server.js :3001)                    │
│                                                       │
│  isRunning guard → 429 if busy                        │
│  SSE headers set                                      │
│  calls runPromptOnAllLLMs()                           │
└──────────────────────────────────────────────────────┘
                         │
                  CDP / Playwright
                         │
┌──────────────────────────────────────────────────────┐
│                Chrome (hidden window)                 │
│                  :9222 CDP debug                      │
│                                                       │
│  Tab 1: chatgpt.com   ─┐                             │
│  Tab 2: gemini.com    ─┼─ Promise.all (parallel)      │
│  Tab 3: claude.ai     ─┘                             │
│                                                       │
│  Each tab:                                           │
│    navigate → inject prompt → wait for stop btn      │
│    → extract response → close tab                    │
│                                                       │
│  Tab 4 (new): claude.ai — synthesis run              │
│    inject buildSynthesisPrompt(gpt+gemini+claude)    │
│    → wait → extract → return final answer            │
└──────────────────────────────────────────────────────┘
```

---

## 9. State Management

All state lives in `App.jsx` and is passed down as props. There is no external state library.

```
App.jsx
 ├─ activePage        → Sidebar (read + write), renderPage()
 ├─ sidebarOpen       → Sidebar visibility
 ├─ chatKey           → Key for PromptRunnerPage remount
 ├─ history[]         → DashboardPage, AnalyticsPage, ResultsHistoryPage, Sidebar
 │    persisted in localStorage (max 100 items)
 │    item shape: { id, prompt, date, best, status, responses, tokenData, elapsed, followUps[] }
 └─ usage{}           → DashboardPage, AnalyticsPage, SettingsPage
      persisted in localStorage
      shape: { totalInputTokens, totalOutputTokens, totalTokens, totalCost }
```

`handleRunComplete` — called by PromptControl after SSE `complete` event. Adds a new item to `history[]` and accumulates token counts in `usage{}`.

`handleFollowUpComplete` — called by PromptControl after a follow-up JSON response. Appends to the matching history item's `followUps[]` array.

---

## 10. Pricing & Token Tracking

Pricing constants in `PromptControl.jsx`:

| Model | Input | Output |
|---|---|---|
| OpenAI (GPT-4.1 mini) | $0.40 / 1M tokens | $1.60 / 1M tokens |
| Claude (Haiku 4.5) | $0.80 / 1M tokens | $4.00 / 1M tokens |
| Gemini (1.5 Flash) | $0.075 / 1M tokens | $0.30 / 1M tokens |

Token counts come from the Gemini API response metadata (the only model accessed via API key directly). ChatGPT and Claude are accessed via browser scraping, so their token counts are estimated if not returned.

---

## 11. Setup & Running Locally

### Prerequisites
- Node.js 18+
- Google Chrome installed
- Accounts on chatgpt.com, claude.ai, gemini.google.com

### Step 1 — Install dependencies

```bash
# Frontend
cd 3llms-aichat-assistant
npm install

# Playwright server
cd playwright-server
npm install
npx playwright install chromium
```

### Step 2 — Start Chrome with CDP

Run `playwright-server/start-chrome.bat` (Windows) or equivalent:
```
chrome.exe --remote-debugging-port=9222 --user-data-dir=C:\chrome-llm-profile
```

### Step 3 — Log in to all three LLMs

```bash
cd playwright-server
node login.js
```
Or use the **Settings → Show Chrome** button in the app UI after starting the server.

### Step 4 — Start the Playwright server

```bash
cd playwright-server
node server.js
# Server starts on http://localhost:3001
```

### Step 5 — Start the React frontend

```bash
cd 3llms-aichat-assistant
npm run dev
# Opens on http://localhost:5173
```

### Step 6 — Use the app

1. Open `http://localhost:5173`
2. Type a prompt in the chat box
3. Select which models to include
4. Click Send — responses stream in as each model finishes
5. The final synthesized answer appears in the Claude card
