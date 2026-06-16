const express = require('express');
const cors = require('cors');
const {
  googleClient,
  loginClient,
  sendPasswordReset,
  signupClient,
  startSignup,
  upsertClientPreferences,
  verifySignup,
} = require('./auth-store');
const { createAdminPortalSession, getAdminAnalytics } = require('./admin-store');

const app = express();
const DEFAULT_N8N_WEBHOOK_URL = 'https://n8n.kleza.io/webhook/bf39cd7e-9f1b-4b3e-98eb-8b746cd2b510/chat';
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || DEFAULT_N8N_WEBHOOK_URL;
const allowedOrigins = String(process.env.ALLOWED_ORIGINS || process.env.APP_URL || '')
  .split(',')
  .map(origin => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0) return callback(null, true);
    const normalizedOrigin = origin.replace(/\/+$/, '');
    if (allowedOrigins.includes(normalizedOrigin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
}));
app.use(express.json({ limit: '1mb' }));

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

app.post('/auth/google', async (req, res) => {
  try {
    res.json({ ok: true, client: await googleClient(req.body || {}) });
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
    const client = await upsertClientPreferences({ ...(req.body || {}), mode: 'api' });
    if (!client) return res.status(404).json({ error: 'Account not found.' });
    res.json({ ok: true, client });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/', (req, res) => res.send(`
  <body style="font-family:sans-serif;padding:2rem;background:#f9fafb">
    <h2>Excelliq API Mode Server</h2>
    <p style="color:green;font-weight:bold">Server is running on port ${PORT}</p>
    <p>POST <code>/api/n8n-chat</code> to proxy prompt runs to the configured n8n workflow.</p>
  </body>
`));

app.get('/health', (req, res) => res.json({
  ok: true,
  mode: 'api',
  n8nConfigured: Boolean(N8N_WEBHOOK_URL),
}));

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

app.post('/api/n8n-chat', async (req, res) => {
  try {
    const n8nRes = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {}),
    });

    const text = await n8nRes.text();
    let payload = null;
    if (text.trim()) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { output: text };
      }
    } else {
      payload = {};
    }

    if (!n8nRes.ok) {
      return res.status(n8nRes.status).json({
        error: payload?.error || payload?.message || n8nRes.statusText || 'n8n workflow failed.',
        details: payload,
      });
    }

    res.json(payload);
  } catch (e) {
    res.status(502).json({ error: `Unable to reach n8n workflow: ${e.message}` });
  }
});

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`\nExcelliq API Mode server ready on http://localhost:${PORT}`);
  console.log('Prompt runs are proxied through /api/n8n-chat.\n');
});
