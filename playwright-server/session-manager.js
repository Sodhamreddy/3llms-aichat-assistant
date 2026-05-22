const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

function loadRootEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  try {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx === -1) return;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (key && process.env[key] === undefined) process.env[key] = value;
    });
  } catch {
    // Optional. Local JSON session tracking remains available.
  }
}

loadRootEnv();

const PROFILE_ROOT = path.join(__dirname, 'profiles');
const SESSION_STORE = path.join(PROFILE_ROOT, 'client_llm_sessions.json');
const DEFAULT_CLIENT_ID = 'client_default';
const CHROME_EXE = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const PROVIDERS = {
  openai: {
    label: 'ChatGPT',
    url: 'https://chatgpt.com/',
    loginUrl: 'https://chatgpt.com/auth/login',
    match: 'chatgpt.com',
    editorSelectors: ['#prompt-textarea'],
  },
  claude: {
    label: 'Claude',
    url: 'https://claude.ai/new',
    loginUrl: 'https://claude.ai/login',
    match: 'claude.ai',
    editorSelectors: ['.ProseMirror', '[contenteditable="true"]'],
  },
  gemini: {
    label: 'Gemini',
    url: 'https://gemini.google.com/',
    loginUrl: 'https://gemini.google.com/app',
    match: 'gemini.google.com',
    editorSelectors: ['rich-textarea .ql-editor', '.input-area-container [contenteditable="true"]'],
    // Selectors that are ONLY present when a Google account is signed in.
    // Gemini puts the account section at the bottom-left sidebar, not top-right like other Google apps.
    authSelectors: [
      'button[aria-label*="Google Account"]',
      '[data-ogsr-up]',
      'a[aria-label*="Google Account"]',
      'a[href*="SignOutOptions"]',
    ],
  },
};

const PROVIDER_ALIASES = {
  chatgpt: 'openai',
  gpt: 'openai',
  openai: 'openai',
  claude: 'claude',
  anthropic: 'claude',
  gemini: 'gemini',
  google: 'gemini',
};

const activeContexts = new Map();
const launchLocks = new Map();
const remoteLoginPages = new Map();

const REMOTE_VIEWPORT = {
  width: Number(process.env.REMOTE_BROWSER_WIDTH || 1280),
  height: Number(process.env.REMOTE_BROWSER_HEIGHT || 800),
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sanitizeClientId(value) {
  const raw = String(value || DEFAULT_CLIENT_ID).trim();
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return safe || DEFAULT_CLIENT_ID;
}

function normalizeProvider(provider) {
  if (!provider) return null;
  return PROVIDER_ALIASES[String(provider).toLowerCase()] || null;
}

function getRemotePageKey(clientId, provider) {
  return `${sanitizeClientId(clientId)}:${normalizeProvider(provider)}`;
}

function getProfilePath(clientId) {
  const safeClientId = sanitizeClientId(clientId);
  ensureDir(PROFILE_ROOT);

  const root = path.resolve(PROFILE_ROOT);
  const profilePath = path.resolve(path.join(PROFILE_ROOT, safeClientId));
  if (profilePath !== root && !profilePath.startsWith(root + path.sep)) {
    throw new Error('Invalid client profile path.');
  }

  ensureDir(profilePath);
  return profilePath;
}

function readSessionStore() {
  try {
    return JSON.parse(fs.readFileSync(SESSION_STORE, 'utf8'));
  } catch {
    return {};
  }
}

function writeSessionStore(store) {
  ensureDir(PROFILE_ROOT);
  fs.writeFileSync(SESSION_STORE, JSON.stringify(store, null, 2));
}

async function mirrorSessionToSupabase(session) {
  if (!supabaseAdmin || !session?.client_id || !session?.provider) return;
  const profileResult = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('client_id', session.client_id)
    .maybeSingle();

  if (profileResult.error || !profileResult.data?.id) return;

  await supabaseAdmin
    .from('client_llm_sessions')
    .upsert({
      user_id: profileResult.data.id,
      client_id: session.client_id,
      provider: session.provider,
      profile_key: path.basename(session.profile_path || session.client_id),
      status: session.status || 'expired',
      error: session.error || null,
      last_checked_at: session.last_checked_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });
}

function upsertSession(clientId, provider, patch = {}) {
  const safeClientId = sanitizeClientId(clientId);
  const normalizedProvider = normalizeProvider(provider);
  if (!normalizedProvider) return null;

  const profilePath = getProfilePath(safeClientId);
  const store = readSessionStore();
  store[safeClientId] = store[safeClientId] || {};
  store[safeClientId][normalizedProvider] = {
    client_id: safeClientId,
    provider: normalizedProvider,
    profile_path: profilePath,
    status: 'expired',
    last_checked_at: null,
    ...(store[safeClientId][normalizedProvider] || {}),
    ...patch,
  };
  writeSessionStore(store);
  const session = store[safeClientId][normalizedProvider];
  mirrorSessionToSupabase(session).catch(() => {});
  return session;
}

function getClientSessions(clientId) {
  const safeClientId = sanitizeClientId(clientId);
  const profilePath = getProfilePath(safeClientId);
  const saved = readSessionStore()[safeClientId] || {};

  return Object.keys(PROVIDERS).reduce((acc, provider) => {
    acc[provider] = {
      client_id: safeClientId,
      provider,
      profile_path: profilePath,
      status: saved[provider]?.status || 'expired',
      last_checked_at: saved[provider]?.last_checked_at || null,
      error: saved[provider]?.error || null,
    };
    return acc;
  }, {});
}

async function getCDPWindow(context) {
  const pages = context.pages();
  const refPage = pages.length > 0 ? pages[0] : await context.newPage();
  const cdp = await context.newCDPSession(refPage);
  const { windowId } = await cdp.send('Browser.getWindowForTarget');
  return { cdp, windowId, pages };
}

async function setChromeVisible(context) {
  const { cdp, windowId } = await getCDPWindow(context);
  await cdp.send('Browser.setWindowBounds', {
    windowId,
    bounds: { windowState: 'normal', left: 80, top: 80, width: 1280, height: 900 },
  });
  await cdp.detach();
}

async function setChromeHidden(context) {
  const { cdp, windowId } = await getCDPWindow(context);
  await cdp.send('Browser.setWindowBounds', {
    windowId,
    bounds: { windowState: 'normal', left: -32000, top: -32000, width: 1280, height: 900 },
  });
  await cdp.detach();
}

function killChromeUsingProfile(profilePath) {
  // On Windows, a stale Chrome process holds a named lock on the profile directory
  // even after lock files are deleted. Find and kill it by matching its --user-data-dir arg.
  if (process.platform !== 'win32') return;
  try {
    const normalized = profilePath.toLowerCase();
    // Get all chrome.exe PIDs via tasklist
    const taskOut = execSync('tasklist /FI "IMAGENAME eq chrome.exe" /FO CSV /NH 2>nul', { encoding: 'utf8', timeout: 5000 });
    const pids = taskOut.split('\n')
      .map(l => l.split(',')[1]?.replace(/"/g, '').trim())
      .filter(pid => pid && /^\d+$/.test(pid));

    for (const pid of pids) {
      try {
        const cmdOut = execSync(`wmic process where "ProcessId=${pid}" get CommandLine /value 2>nul`, { encoding: 'utf8', timeout: 3000 });
        if (cmdOut.toLowerCase().includes(normalized)) {
          execSync(`taskkill /F /PID ${pid} 2>nul`, { stdio: 'ignore', timeout: 3000 });
          console.log(`[Chrome] Killed stale Chrome process PID ${pid} (profile: ${profilePath})`);
        }
      } catch { /* PID gone or access denied — skip */ }
    }
  } catch { /* tasklist/wmic unavailable — non-fatal */ }
}

function clearProfileLocks(profilePath) {
  // Step 1: kill any Chrome process that's holding this profile directory open
  killChromeUsingProfile(profilePath);
  // Step 2: remove stale lock files Chrome leaves on unclean exit
  const lockFiles = ['SingletonLock', 'SingletonSocket', 'SingletonCookie', 'lockfile'];
  for (const lf of lockFiles) {
    try { fs.unlinkSync(path.join(profilePath, lf)); } catch { /* not present — fine */ }
  }
}

async function launchPersistentClientContext(clientId, { visible = false } = {}) {
  const safeClientId = sanitizeClientId(clientId);
  const profilePath = getProfilePath(safeClientId);
  clearProfileLocks(profilePath);
  const chromeExists = fs.existsSync(CHROME_EXE);
  const args = [
    '--disable-blink-features=AutomationControlled',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    visible ? '--start-maximized' : '--window-position=-32000,-32000',
    visible ? null : '--window-size=1280,900',
  ].filter(Boolean);

  const context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    executablePath: chromeExists ? CHROME_EXE : undefined,
    args,
    ignoreDefaultArgs: ['--enable-automation'],
    viewport: null,
  });

  context.on('close', () => activeContexts.delete(safeClientId));
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = window.chrome || { runtime: {} };
  }).catch(() => {});
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});

  const session = { clientId: safeClientId, profilePath, context, launchedAt: new Date().toISOString() };
  activeContexts.set(safeClientId, session);
  if (!visible) await setChromeHidden(context).catch(() => {});
  return session;
}

async function getClientContext(clientId, options = {}) {
  const safeClientId = sanitizeClientId(clientId);
  const active = activeContexts.get(safeClientId);
  if (active) {
    try {
      active.context.pages();
      return active;
    } catch {
      activeContexts.delete(safeClientId);
      // Stale context — clear any leftover lock files before re-launching
      clearProfileLocks(getProfilePath(safeClientId));
    }
  }

  if (launchLocks.has(safeClientId)) return launchLocks.get(safeClientId);

  const promise = launchPersistentClientContext(safeClientId, options)
    .finally(() => launchLocks.delete(safeClientId));
  launchLocks.set(safeClientId, promise);
  return promise;
}

async function openLoginTabs(context, provider) {
  const requested = normalizeProvider(provider);
  const providers = requested ? [requested] : Object.keys(PROVIDERS);
  const pages = context.pages();
  const opened = [];

  for (const key of providers) {
    const site = PROVIDERS[key];
    const alreadyOpen = pages.some(page => page.url().includes(site.match));
    const page = alreadyOpen ? pages.find(p => p.url().includes(site.match)) : await context.newPage();
    if (!alreadyOpen) {
      await page.goto(site.loginUrl || site.url, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {});
    } else {
      await page.bringToFront().catch(() => {});
    }
    opened.push(key);
  }

  return opened;
}

async function getRemoteBrowserPage(clientId, provider) {
  const normalizedProvider = normalizeProvider(provider);
  if (!normalizedProvider) throw new Error(`Unknown provider: ${provider}`);

  const session = await getClientContext(clientId, { visible: false });
  const key = getRemotePageKey(session.clientId, normalizedProvider);
  const existing = remoteLoginPages.get(key);

  if (existing && !existing.page.isClosed()) {
    existing.lastAccessedAt = new Date().toISOString();
    return { session, provider: normalizedProvider, page: existing.page };
  }

  const def = PROVIDERS[normalizedProvider];
  const matchedPage = session.context.pages().find(page => page.url().includes(def.match));
  const page = matchedPage || await session.context.newPage();
  await page.setViewportSize(REMOTE_VIEWPORT).catch(() => {});

  const targetUrl = def.loginUrl || def.url;
  if (!page.url().includes(def.match) || (def.loginUrl && page.url() === def.url)) {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
  }

  remoteLoginPages.set(key, {
    page,
    provider: normalizedProvider,
    lastAccessedAt: new Date().toISOString(),
  });
  await setChromeHidden(session.context).catch(() => {});

  return { session, provider: normalizedProvider, page };
}

async function captureRemoteBrowser(clientId, provider) {
  const { session, provider: normalizedProvider, page } = await getRemoteBrowserPage(clientId, provider);
  await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => {});

  const image = await page.screenshot({
    type: 'jpeg',
    quality: 72,
    fullPage: false,
    animations: 'disabled',
  });

  return {
    clientId: session.clientId,
    provider: normalizedProvider,
    image: image.toString('base64'),
    viewport: REMOTE_VIEWPORT,
    url: page.url(),
    title: await page.title().catch(() => ''),
  };
}

function clampCoordinate(value, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(Math.round(n), max));
}

async function performRemoteBrowserAction(clientId, provider, action = {}) {
  const { session, provider: normalizedProvider, page: currentPage } = await getRemoteBrowserPage(clientId, provider);
  let page = currentPage;
  const type = action.type;
  await page.bringToFront().catch(() => {});

  if (type === 'click') {
    const x = clampCoordinate(action.x, REMOTE_VIEWPORT.width);
    const y = clampCoordinate(action.y, REMOTE_VIEWPORT.height);
    await page.mouse.click(x, y, { delay: 45 });
  } else if (type === 'dblclick') {
    const x = clampCoordinate(action.x, REMOTE_VIEWPORT.width);
    const y = clampCoordinate(action.y, REMOTE_VIEWPORT.height);
    await page.mouse.dblclick(x, y, { delay: 45 });
  } else if (type === 'type') {
    const text = String(action.text || '').slice(0, 2000);
    if (text) await page.keyboard.type(text, { delay: 15 });
  } else if (type === 'press') {
    const key = String(action.key || '').slice(0, 40);
    if (key) await page.keyboard.press(key);
  } else if (type === 'wheel') {
    await page.mouse.wheel(Number(action.deltaX) || 0, Number(action.deltaY) || 0);
  } else if (type === 'reload') {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
  } else if (type === 'back') {
    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
  } else {
    throw new Error(`Unsupported remote browser action: ${type}`);
  }

  await page.waitForTimeout(850);
  const pages = session.context.pages().filter(item => !item.isClosed());
  const newestPage = pages[pages.length - 1];
  if (newestPage && newestPage !== page) {
    page = newestPage;
    await page.setViewportSize(REMOTE_VIEWPORT).catch(() => {});
    await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => {});
  }

  remoteLoginPages.set(getRemotePageKey(session.clientId, normalizedProvider), {
    page,
    provider: normalizedProvider,
    lastAccessedAt: new Date().toISOString(),
  });

  return captureRemoteBrowser(session.clientId, normalizedProvider);
}

async function closeRemoteBrowserPage(clientId, provider) {
  const normalizedProvider = normalizeProvider(provider);
  if (!normalizedProvider) throw new Error(`Unknown provider: ${provider}`);

  const key = getRemotePageKey(clientId, normalizedProvider);
  const remote = remoteLoginPages.get(key);
  remoteLoginPages.delete(key);
  if (remote && !remote.page.isClosed()) {
    await remote.page.close().catch(() => {});
  }
}

async function validateProviderSession(context, clientId, provider) {
  const normalizedProvider = normalizeProvider(provider);
  if (!normalizedProvider) throw new Error(`Unknown provider: ${provider}`);

  const def = PROVIDERS[normalizedProvider];
  const checkedAt = new Date().toISOString();
  const page = await context.newPage();

  try {
    await page.goto(def.url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Give Angular/React time to hydrate before reading auth state
    await page.waitForTimeout(2000);

    // Redirect to a login page means not authenticated
    const currentUrl = page.url();
    const redirectedToLogin =
      currentUrl.includes('accounts.google.com') ||
      (normalizedProvider === 'openai' && currentUrl.includes('/auth/login')) ||
      (normalizedProvider === 'claude' && currentUrl.includes('/login'));

    if (redirectedToLogin) {
      return upsertSession(clientId, normalizedProvider, {
        status: 'expired',
        last_checked_at: checkedAt,
        error: `Redirected to login page — not authenticated. URL: ${currentUrl.split('?')[0]}`,
      });
    }

    // Providers with authSelectors: check for elements that ONLY appear when signed in.
    // This matters for Gemini — the text editor is visible even in guest mode,
    // so editorSelectors alone cannot distinguish authenticated from unauthenticated.
    if (def.authSelectors && def.authSelectors.length) {
      if (normalizedProvider === 'gemini') {
        const geminiAuthState = await page.evaluate(() => {
          const isVisible = (el) => {
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
          };
          const controls = [...document.querySelectorAll('a[href], button')];
          const hasVisibleSignIn = controls.some(el => isVisible(el) && /^sign\s*in$/i.test((el.textContent || '').trim()));
          const hasAccountControl = !!document.querySelector(
            'button[aria-label*="Google Account"], a[aria-label*="Google Account"], [data-ogsr-up], a[href*="SignOutOptions"]'
          );
          const pageText = document.body.innerText || '';
          const guestMode = /Welcome,\s*stranger|Meet Gemini,\s*your personal AI assistant/i.test(pageText);
          return { hasVisibleSignIn, hasAccountControl, guestMode };
        }).catch(() => ({ hasVisibleSignIn: false, hasAccountControl: false, guestMode: false }));

        if (geminiAuthState.hasVisibleSignIn || geminiAuthState.guestMode || !geminiAuthState.hasAccountControl) {
          return upsertSession(clientId, normalizedProvider, {
            status: 'expired',
            last_checked_at: checkedAt,
            error: 'Gemini is not signed in. Open Browser Mode, click Connect Gemini, and log in to the Google account in the server browser.',
          });
        }
      }

      const authSelector = def.authSelectors.join(', ');
      const loggedIn = await page.waitForSelector(authSelector, { timeout: 10_000 })
        .then(() => true).catch(() => false);

      if (!loggedIn) {
        return upsertSession(clientId, normalizedProvider, {
          status: 'expired',
          last_checked_at: checkedAt,
          error: 'Not signed in — Google Account button not found. Open Settings and log in.',
        });
      }
    } else {
      // For providers without authSelectors, fall back to editor presence
      const selector = def.editorSelectors.join(', ');
      await page.waitForSelector(selector, { timeout: 15_000 });
    }

    return upsertSession(clientId, normalizedProvider, {
      status: 'connected',
      last_checked_at: checkedAt,
      error: null,
    });
  } catch (error) {
    const status = /timeout|not found|waiting for selector/i.test(error.message) ? 'expired' : 'error';
    return upsertSession(clientId, normalizedProvider, {
      status,
      last_checked_at: checkedAt,
      error: error.message,
    });
  } finally {
    await page.close().catch(() => {});
  }
}

async function validateClientSessions(context, clientId, selectedModels = Object.keys(PROVIDERS)) {
  const selected = selectedModels && selectedModels.length ? selectedModels : Object.keys(PROVIDERS);
  const providers = [...new Set(selected.map(normalizeProvider).filter(Boolean))];
  const results = await Promise.all(providers.map(provider => validateProviderSession(context, clientId, provider)));
  const unavailable = results.filter(item => item.status !== 'connected');

  if (unavailable.length) {
    const names = unavailable.map(item => PROVIDERS[item.provider].label).join(', ');
    throw new Error(`Browser session expired for ${names}. Open Settings and reconnect the selected LLM account.`);
  }

  return results;
}

async function closeAllContexts() {
  const entries = [...activeContexts.entries()];
  activeContexts.clear();
  await Promise.all(entries.map(async ([id, session]) => {
    try {
      await session.context.close();
      console.log(`[Chrome] Closed context for ${id}`);
    } catch { /* already closed */ }
  }));
}

module.exports = {
  DEFAULT_CLIENT_ID,
  PROVIDERS,
  captureRemoteBrowser,
  closeAllContexts,
  closeRemoteBrowserPage,
  getClientContext,
  getClientSessions,
  getProfilePath,
  getRemoteBrowserPage,
  normalizeProvider,
  openLoginTabs,
  performRemoteBrowserAction,
  sanitizeClientId,
  setChromeHidden,
  setChromeVisible,
  upsertSession,
  validateClientSessions,
  validateProviderSession,
};
