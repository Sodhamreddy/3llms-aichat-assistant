const express = require('express');
const cors = require('cors');
const {
  loginClient,
  sendPasswordReset,
  signupClient,
  startSignup,
  upsertClientPreferences,
  verifySignup,
} = require('./auth-store');
const { createAdminPortalSession, getAdminAnalytics } = require('./admin-store');
const { runPromptOnAllLLMs, runFollowUpOnAllLLMs } = require('./scraper');
const {
  DEFAULT_CLIENT_ID,
  PROVIDERS,
  captureRemoteBrowser,
  closeAllContexts,
  closeRemoteBrowserPage,
  getClientContext,
  getClientSessions,
  normalizeProvider,
  openLoginTabs,
  performRemoteBrowserAction,
  sanitizeClientId,
  setChromeHidden,
  setChromeVisible,
  upsertSession,
  validateProviderSession,
} = require('./session-manager');

const app = express();
app.use(cors());
app.use(express.json());

const runningClients = new Set();

function getRequestClientId(req) {
  return sanitizeClientId(
    req.params.clientId ||
    req.body?.clientId ||
    req.body?.client_id ||
    req.get('x-client-id') ||
    DEFAULT_CLIENT_ID
  );
}

function parseProvider(req) {
  const requested = req.params.provider || req.body?.provider || req.query?.provider;
  if (!requested) return null;
  const provider = normalizeProvider(requested);
  if (!provider) {
    const allowed = Object.keys(PROVIDERS).join(', ');
    throw new Error(`Unknown provider "${requested}". Use one of: ${allowed}.`);
  }
  return provider;
}

function selectedProvidersFromBody(req) {
  const selected = req.body?.selectedModels;
  return selected && selected.length ? selected : Object.keys(PROVIDERS);
}

app.post('/auth/signup', async (req, res) => {
  try {
    res.json({ ok: true, client: await signupClient(req.body || {}) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/auth/signup/start', async (req, res) => {
  try {
    res.json({ ok: true, ...(await startSignup(req.body || {})) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/auth/signup/verify', async (req, res) => {
  try {
    res.json({ ok: true, client: await verifySignup(req.body || {}) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    res.json({ ok: true, client: await loginClient(req.body || {}) });
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
});

app.post('/auth/forgot-password', async (req, res) => {
  try {
    res.json({ ok: true, ...(await sendPasswordReset(req.body || {})) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/auth/preferences', async (req, res) => {
  try {
    const client = await upsertClientPreferences(req.body || {});
    if (!client) return res.status(404).json({ error: 'Account not found.' });
    res.json({ ok: true, client });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

async function showChromeForClient(req, res) {
  try {
    const clientId = getRequestClientId(req);
    const provider = parseProvider(req);
    const session = await getClientContext(clientId, { visible: true });

    await setChromeVisible(session.context);
    const opened = await openLoginTabs(session.context, provider);
    const checkedAt = new Date().toISOString();
    opened.forEach(key => upsertSession(session.clientId, key, {
      status: 'expired',
      last_checked_at: checkedAt,
      error: null,
    }));

    res.json({
      ok: true,
      clientId: session.clientId,
      profilePath: session.profilePath,
      opened,
      sessions: getClientSessions(session.clientId),
      message: 'Chrome is now visible for this client profile. Log in, then click Hide Chrome.',
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function hideChromeForClient(req, res) {
  try {
    const clientId = getRequestClientId(req);
    const session = await getClientContext(clientId, { visible: false });
    await setChromeHidden(session.context);

    res.json({
      ok: true,
      clientId: session.clientId,
      profilePath: session.profilePath,
      sessions: getClientSessions(session.clientId),
      message: 'Chrome hidden. Browser mode is ready for this client profile.',
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

app.post('/client/:clientId/show-chrome', showChromeForClient);
app.post('/client/:clientId/hide-chrome', hideChromeForClient);
app.post('/show-chrome', showChromeForClient);
app.post('/hide-chrome', hideChromeForClient);

app.post('/client/:clientId/remote-browser/:provider/open', async (req, res) => {
  try {
    const clientId = getRequestClientId(req);
    const provider = parseProvider(req);
    upsertSession(clientId, provider, {
      status: 'expired',
      last_checked_at: new Date().toISOString(),
      error: null,
    });
    res.json({ ok: true, ...(await captureRemoteBrowser(clientId, provider)) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/client/:clientId/remote-browser/:provider/screenshot', async (req, res) => {
  try {
    const clientId = getRequestClientId(req);
    const provider = parseProvider(req);
    res.json({ ok: true, ...(await captureRemoteBrowser(clientId, provider)) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/client/:clientId/remote-browser/:provider/action', async (req, res) => {
  try {
    const clientId = getRequestClientId(req);
    const provider = parseProvider(req);
    res.json({ ok: true, ...(await performRemoteBrowserAction(clientId, provider, req.body)) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/client/:clientId/remote-browser/:provider/finish', async (req, res) => {
  try {
    const clientId = getRequestClientId(req);
    const provider = parseProvider(req);
    const session = await getClientContext(clientId, { visible: false });
    const result = await validateProviderSession(session.context, session.clientId, provider);
    await closeRemoteBrowserPage(session.clientId, provider);
    await setChromeHidden(session.context).catch(() => {});

    res.json({
      ok: result.status === 'connected',
      clientId: session.clientId,
      provider,
      session: result,
      sessions: getClientSessions(session.clientId),
      message: result.status === 'connected'
        ? `${PROVIDERS[provider].label} connected.`
        : `${PROVIDERS[provider].label} is not connected yet.`,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/client/:clientId/remote-browser/:provider/close', async (req, res) => {
  try {
    const clientId = getRequestClientId(req);
    const provider = parseProvider(req);
    await closeRemoteBrowserPage(clientId, provider);
    res.json({ ok: true, clientId, provider });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/client/:clientId/sessions', (req, res) => {
  try {
    const clientId = getRequestClientId(req);
    res.json({ ok: true, clientId, sessions: getClientSessions(clientId) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/client/:clientId/check-sessions', async (req, res) => {
  try {
    const clientId = getRequestClientId(req);
    const session = await getClientContext(clientId, { visible: false });
    const providers = selectedProvidersFromBody(req).map(normalizeProvider).filter(Boolean);
    await Promise.all([...new Set(providers)].map(provider =>
      validateProviderSession(session.context, session.clientId, provider)
    ));
    await setChromeHidden(session.context).catch(() => {});
    res.json({
      ok: true,
      clientId: session.clientId,
      profilePath: session.profilePath,
      sessions: getClientSessions(session.clientId),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/', (req, res) => res.send(`
  <body style="font-family:sans-serif;padding:2rem;background:#f9fafb">
    <h2>Playwright LLM Server</h2>
    <p style="color:green;font-weight:bold">Server is running on port ${PORT}</p>
    <p>POST <code>/run-prompt</code> with <code>{ "clientId": "client_123", "prompt": "..." }</code>.</p>
    <p>Use <code>/client/:clientId/show-chrome</code> to connect ChatGPT, Claude, and Gemini for each client.</p>
  </body>
`));

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/admin/analytics', async (req, res) => {
  try {
    res.json(await getAdminAnalytics(req));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.post('/admin/login', (req, res) => {
  try {
    res.json({ ok: true, ...createAdminPortalSession(req.body || {}) });
  } catch (e) {
    res.status(e.status || 401).json({ error: e.message });
  }
});

app.post('/run-prompt', async (req, res) => {
  const { prompt, selectedModels, deepResearch = false } = req.body;
  const clientId = getRequestClientId(req);

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: 'prompt is required' });
  }
  if (runningClients.has(clientId)) {
    return res.status(429).json({ error: 'Already running a prompt for this client. Wait for it to finish.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  runningClients.add(clientId);
  try {
    const result = await runPromptOnAllLLMs(prompt, (type, partial) => {
      send({ type, ...partial });
    }, selectedModels, deepResearch, clientId);

    send({ type: 'complete', clientId, ...result });
  } catch (e) {
    console.error('Playwright error:', e);
    send({ type: 'error', clientId, message: e.message });
  } finally {
    runningClients.delete(clientId);
    res.end();
  }
});

app.post('/follow-up', async (req, res) => {
  const { originalPrompt, previousAnswer, followUpQuestion, selectedModels } = req.body;
  const clientId = getRequestClientId(req);

  if (!followUpQuestion || !followUpQuestion.trim()) {
    return res.status(400).json({ error: 'followUpQuestion is required' });
  }
  if (!previousAnswer || !previousAnswer.trim()) {
    return res.status(400).json({ error: 'previousAnswer is required' });
  }
  if (runningClients.has(clientId)) {
    return res.status(429).json({ error: 'Already running a prompt for this client. Wait for it to finish.' });
  }

  runningClients.add(clientId);
  try {
    const result = await runFollowUpOnAllLLMs({
      originalPrompt: originalPrompt || '',
      previousAnswer,
      followUpQuestion,
      selectedModels: selectedModels || ['openai', 'gemini', 'claude'],
      clientId,
    });
    res.json({ clientId, ...result });
  } catch (e) {
    console.error('Follow-up error:', e);
    res.status(500).json({ error: e.message });
  } finally {
    runningClients.delete(clientId);
  }
});

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`\nPlaywright LLM server ready on http://localhost:${PORT}`);
  console.log('Each client now uses playwright-server/profiles/<client_id>/ for browser sessions.');
  console.log('Use Settings in the app, or run: node login.js <client_id>\n');
});

// Graceful shutdown — close all Chrome contexts so profiles are unlocked for the next start.
async function shutdown(signal) {
  console.log(`\n[Server] ${signal} received — closing Chrome contexts...`);
  await closeAllContexts().catch(() => {});
  process.exit(0);
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
