// Background service worker for Font Pair extension v2
// Handles auth sync from content script and save operations

const SUPABASE_URL = 'https://kbbmlrtqzhhfopfsqgwd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtiYm1scnRxemhoZm9wZnNxZ3dkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM5NDk5NzYsImV4cCI6MjA1OTUyNTk3Nn0.mZ2a1YpbvOJqpbuRqlCCdbLu-NkJfsbY6GlrKthD-Tw';

// Google Fonts API key (free, publishable read-only key)
const GOOGLE_FONTS_API_KEY = 'AIzaSyA_uNw16rA5xfZ-PgfSLBVk4wReyQjeU4E';

const FREE_SAVE_LIMIT = 10;

// Session cache for Google Fonts list
let googleFontsCache = null;
let googleFontsCachePromise = null;

// System fonts to skip linking
const SYSTEM_FONTS = new Set([
  'arial', 'helvetica', 'times new roman', 'times', 'courier new', 'courier',
  'georgia', 'verdana', 'tahoma', 'trebuchet ms', 'impact', 'comic sans ms',
  'palatino', 'garamond', 'bookman', 'avant garde', 'lucida console',
  'lucida sans', 'lucida grande', 'geneva', 'monaco', 'segoe ui',
  'system-ui', '-apple-system', 'blinkmacsystemfont', 'sans-serif',
  'serif', 'monospace', 'cursive', 'fantasy', 'ui-sans-serif', 'ui-serif',
  'ui-monospace', 'ui-rounded', 'apple color emoji', 'segoe ui emoji',
  'noto color emoji', 'android emoji', 'emojisymbols', 'calibri', 'cambria',
  'consolas', 'candara', 'optima', 'didot', 'baskerville', 'futura',
  'gill sans', 'rockwell', 'franklin gothic', 'century gothic',
  'roboto', 'sf pro', 'sf pro display', 'sf pro text', 'sf mono',
  'neue helvetica', 'helvetica neue', 'arial black', 'arial narrow',
  'inter', 'geist'
]);

// Known commercial foundry fonts
const FOUNDRY_FONTS = [
  {
    name: 'adobe', source: 'adobe',
    patterns: [
      'proxima-nova', 'proxima nova', 'freight', 'acumin', 'futura-pt', 'futura pt',
      'brandon-grotesque', 'brandon grotesque', 'tt-norms', 'tt norms',
      'neue-haas-grotesk', 'neue haas grotesk', 'adobe caslon', 'adobe garamond',
      'adobe jenson', 'adobe text', 'myriad', 'minion', 'cronos', 'chaparral',
      'kepler', 'warnock', 'utopia', 'hypatia', 'trajan', 'birch', 'lithos',
      'rosewood', 'mesquite', 'juniper', 'blackoak', 'madrone', 'ironwood',
      'ponderosa', 'poplar', 'flood', 'voluta', 'bickham', 'brioso', 'arno',
      'garamond premier', 'jenson', 'kinesis', 'caflisch', 'sanvito',
      'sofia pro', 'museo', 'museo sans', 'museo slab', 'calluna', 'calluna sans',
      'freight text', 'freight sans', 'freight display', 'freight big',
      'aktiv grotesk', 'din next', 'din 2014'
    ],
    nameIncludes: 'adobe',
    buildUrl: (name) => `https://fonts.adobe.com/fonts/${name.toLowerCase().replace(/\s+/g, '-')}`
  },
  {
    name: 'hoefler', source: 'hoefler',
    patterns: [
      'gotham', 'gotham rounded', 'gotham narrow', 'gotham condensed',
      'ideal sans', 'chronicle', 'chronicle display', 'chronicle text',
      'mercury', 'mercury text', 'mercury display',
      'sentinel', 'archer', 'whitney', 'tungsten', 'tungsten rounded',
      'knockout', 'ringside', 'numbers', 'quarto',
      'surveyor', 'nitro', 'decimal', 'operator', 'operator mono',
      'inkwell', 'ziggurat', 'leviathan', 'requiem',
      'cyclone', 'gestalt', 'obsidian', 'troubadour',
      'topaz', 'peristyle', 'scout', 'forza', 'verlag'
    ],
    nameIncludes: 'hoefler',
    buildUrl: (name) => `https://www.typography.com/fonts/${name.toLowerCase().replace(/\s+/g, '-')}`
  },
  {
    name: 'klim', source: 'klim',
    patterns: [
      'untitled sans', 'untitled serif', 'calibre', 'metric',
      'domaine', 'domaine display', 'domaine text', 'domaine sans',
      'financier', 'financier display', 'financier text',
      'tiempos', 'tiempos headline', 'tiempos text', 'tiempos fine',
      'söhne', 'sohne', 'söhne breit', 'söhne mono',
      'national', 'national 2', 'pitch', 'pitch sans',
      'epicene', 'epicene display', 'epicene text',
      'maelstrom', 'maelstrom sans', 'founders grotesk',
      'heldane', 'heldane display', 'heldane text'
    ],
    buildUrl: (name) => `https://klim.co.nz/retail-fonts/${name.toLowerCase().replace(/\s+/g, '-')}/`
  },
  {
    name: 'grilli', source: 'grilli',
    patterns: [
      'gt america', 'gt walsheim', 'gt sectra', 'gt sectra display',
      'gt sectra fine', 'gt flexa', 'gt haptik', 'gt pressura',
      'gt pressura mono', 'gt eesti', 'gt eesti display', 'gt eesti text',
      'gt planar', 'gt alpina', 'gt maru', 'gt zirkon',
      'gt super', 'gt cinetype', 'gt america mono'
    ],
    nameIncludes: 'gt ',
    buildUrl: (name) => `https://www.grillitype.com/typeface/${name.toLowerCase().replace(/\s+/g, '-')}`
  },
  {
    name: 'commercial_type', source: 'commercial_type',
    patterns: [
      'graphik', 'graphik wide', 'graphik compact', 'graphik x condensed',
      'atlas grotesk', 'atlas typewriter',
      'canela', 'canela deck', 'canela text',
      'dala floda', 'druk', 'druk wide', 'druk text', 'druk text wide',
      'giorgio', 'giorgio sans', 'lausanne',
      'lyon display', 'lyon text',
      'marr sans', 'marr sans condensed',
      'produkt', 'robinson', 'stag', 'stag sans',
      'test founder grotesk', 'action condensed', 'action text'
    ],
    buildUrl: (name) => `https://commercialtype.com/catalog/${name.toLowerCase().replace(/\s+/g, '_')}`
  },
  {
    name: 'dalton_maag', source: 'dalton_maag',
    patterns: [
      'aktiv grotesk', 'effra', 'lexia', 'venn', 'venn condensed',
      'museo', 'museo sans', 'museo slab',
      'bressay', 'elido', 'kulturista'
    ],
    buildUrl: (name) => `https://www.daltonmaag.com/library/${name.toLowerCase().replace(/\s+/g, '-')}`
  },
  {
    name: 'monotype', source: 'monotype',
    patterns: [
      'neue frutiger', 'frutiger', 'avenir', 'avenir next',
      'din next', 'din 2014', 'neue helvetica', 'univers', 'univers next',
      'trade gothic', 'trade gothic next', 'sabon', 'sabon next',
      'walbaum', 'plantin', 'bembo', 'gill sans nova',
      'neue plak', 'burlingame', 'macklin', 'giorgio sans',
      'helvetica now', 'helvetica now display', 'helvetica now text'
    ],
    buildUrl: (name) => `https://www.monotype.com/fonts/${name.toLowerCase().replace(/\s+/g, '-')}`
  },
  {
    name: 'atipo', source: 'atipo',
    patterns: [
      'bariol', 'bariol serif', 'cassannet', 'fibon sans',
      'geomanist', 'silka', 'silka mono', 'wotfard', 'argesta'
    ],
    buildUrl: (name) => `https://www.atipofoundry.com/fonts/${name.toLowerCase().replace(/\s+/g, '-')}`
  },
  {
    name: 'sharp_type', source: 'sharp_type',
    patterns: [
      'sharp grotesk', 'sharp sans', 'sharp serif',
      'ogg', 'reckless', 'reckless neue',
      'centra no1', 'centra no2',
      'sport', 'nocturno'
    ],
    buildUrl: (name) => `https://sharptype.co/typefaces/${name.toLowerCase().replace(/\s+/g, '-')}/`
  },
  {
    name: 'pangram', source: 'pangram',
    patterns: [
      'neue montreal', 'editorial new', 'editorial old',
      'right grotesk', 'monument extended', 'monument grotesk',
      'formula condensed', 'migra', 'basement grotesque',
      'supply', 'supply mono', 'hatton', 'neue world'
    ],
    buildUrl: (name) => `https://pangrampangram.com/products/${name.toLowerCase().replace(/\s+/g, '-')}`
  }
];

// ── Context Menu: Inspect Font ──
chrome.contextMenus?.create({
  id: 'fontpair-inspect-font',
  title: 'Inspect font with Fontpair',
  contexts: ['selection']
});

chrome.contextMenus?.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'fontpair-inspect-font' && tab?.id) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['src/js/font-inspector.js']
    }).catch(err => console.warn('[Fontpair] Could not inject font inspector:', err));
  }
});

// ── First-Visit Tooltip Flag + Welcome Page ──
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({ showFirstVisitTooltip: true });
    console.log('[Fontpair] Fresh install detected, first-visit tooltip enabled');
    chrome.tabs.create({ url: 'https://www.fontpair.co/welcome-extension' });
  }
});

// ── Proactive Token Refresh ──

// Set up periodic alarm for token refresh (every 5 minutes)
chrome.alarms?.create('tokenRefresh', { periodInMinutes: 5 });

chrome.alarms?.onAlarm.addListener((alarm) => {
  if (alarm.name === 'tokenRefresh') {
    proactiveTokenRefresh();
  }
});

// Also run on service worker startup
proactiveTokenRefresh();

async function proactiveTokenRefresh() {
  try {
    const data = await chrome.storage.local.get(['accessToken', 'refreshToken', 'expiresAt']);
    if (!data.accessToken || !data.refreshToken) return;

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = data.expiresAt || 0;
    const fiveMinutes = 5 * 60;

    // Refresh if token expires within 5 minutes
    if (expiresAt - now < fiveMinutes) {
      console.log('[Fontpair] Proactively refreshing token');
      const result = await refreshAccessToken(data.refreshToken);
      if (!result.success) {
        console.warn('[Fontpair] Proactive refresh failed, clearing auth');
        await chrome.storage.local.remove(['accessToken', 'refreshToken', 'expiresAt', 'user', 'isAdmin', 'isPro', 'saveCount']);
        broadcastAuthChange();
      } else {
        broadcastAuthChange();
      }
    }
  } catch (e) {
    console.error('[Fontpair] Proactive refresh error:', e);
  }
}

// Broadcast auth state changes to popup
function broadcastAuthChange() {
  try {
    chrome.runtime.sendMessage({ type: 'AUTH_STATE_CHANGED' }).catch(() => {});
  } catch (e) {
    // Popup may not be open
  }
}

// Wrapper for Supabase API calls with 401 retry
async function supabaseFetch(url, options = {}) {
  const storage = await chrome.storage.local.get(['accessToken', 'refreshToken']);
  if (!storage.accessToken) throw new Error('Not authenticated');

  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${storage.accessToken}`,
    'Content-Type': 'application/json',
    ...options.headers
  };

  let response = await fetch(url, { ...options, headers });

  // If 401, try refreshing token and retrying
  if (response.status === 401 && storage.refreshToken) {
    console.log('[Fontpair] Got 401, attempting token refresh');
    const refreshResult = await refreshAccessToken(storage.refreshToken);
    if (refreshResult.success) {
      const newStorage = await chrome.storage.local.get(['accessToken']);
      headers['Authorization'] = `Bearer ${newStorage.accessToken}`;
      response = await fetch(url, { ...options, headers });
      broadcastAuthChange();
    } else {
      // Refresh failed — clear auth
      await chrome.storage.local.remove(['accessToken', 'refreshToken', 'expiresAt', 'user', 'isAdmin', 'isPro', 'saveCount']);
      broadcastAuthChange();
      throw new Error('Session expired. Sign in again to continue saving.');
    }
  }

  return response;
}

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Auth sync from auth-bridge.js content script
  if (message.type === 'AUTH_SYNC') {
    handleAuthSync(message.session)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'COPY_TO_CLIPBOARD') {
    copyToClipboardViaOffscreen(message.text)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'GET_AUTH_STATUS') {
    chrome.storage.local.get(['accessToken', 'refreshToken', 'user', 'isAdmin', 'isPro', 'expiresAt', 'saveCount'], async (data) => {
      const isExpired = data.expiresAt && Date.now() / 1000 > data.expiresAt;
      
      // Auto-refresh if expired but we have a refresh token
      if (isExpired && data.refreshToken) {
        try {
          const refreshed = await refreshAccessToken(data.refreshToken);
          if (refreshed.success) {
            sendResponse({
              isLoggedIn: true,
              user: refreshed.user || data.user || null,
              isAdmin: data.isAdmin || false,
              isPro: refreshed.isPro ?? data.isPro ?? false,
              saveCount: data.saveCount || 0
            });
            return;
          }
        } catch (e) {
          console.error('[Fontpair] Token refresh failed:', e);
        }
        // Refresh failed — clear auth
        await chrome.storage.local.remove(['accessToken', 'refreshToken', 'expiresAt', 'user', 'isAdmin', 'isPro', 'saveCount']);
        sendResponse({ isLoggedIn: false, user: null, isAdmin: false, isPro: false, saveCount: 0 });
        return;
      }
      
      sendResponse({
        isLoggedIn: !!data.accessToken && !isExpired,
        user: data.user || null,
        isAdmin: data.isAdmin || false,
        isPro: data.isPro ?? false,
        saveCount: data.saveCount || 0
      });
    });
    return true;
  }

  if (message.type === 'LOGOUT') {
    chrome.storage.local.remove(['accessToken', 'refreshToken', 'expiresAt', 'user', 'isAdmin', 'isPro', 'saveCount'], () => {
      broadcastAuthChange();
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'CAPTURE_SCREENSHOT') {
    captureAndCompress()
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'SAVE_INSPIRATION') {
    saveInspiration(message.data)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'CHECK_DUPLICATE') {
    checkDuplicate(message.url)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'IDENTIFY_FONTS') {
    identifyFonts(message.fontNames)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'GET_SAVE_COUNT') {
    getSaveCount()
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message, count: 0 }));
    return true;
  }

  // Keep legacy handler for backward compat
  if (message.type === 'CHECK_FONTS_IN_DB') {
    checkFontsInDatabase(message.fontNames)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

const TRUSTED_EXTERNAL_AUTH_ORIGINS = new Set([
  'https://fontpair.co',
  'https://www.fontpair.co',
  'https://fontpair-2025.lovable.app',
  'http://localhost:5173'
]);

function isTrustedExternalAuthSender(sender) {
  const senderUrl = sender?.url;
  if (!senderUrl) return false;

  try {
    const { origin } = new URL(senderUrl);
    return TRUSTED_EXTERNAL_AUTH_ORIGINS.has(origin);
  } catch {
    return false;
  }
}

// Listen for auth sync from website pages (e.g. /extension-login)
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'AUTH_SUCCESS') return;

  if (!isTrustedExternalAuthSender(sender)) {
    sendResponse({ success: false, error: 'UNTRUSTED_ORIGIN' });
    return;
  }

  handleAuthSync({
    accessToken: message.accessToken,
    refreshToken: message.refreshToken,
    expiresAt: message.expiresAt,
    user: message.user
  })
    .then((result) => sendResponse(result))
    .catch((err) => sendResponse({ success: false, error: err.message }));

  return true;
});

// Get save count from saved_inspirations
async function getSaveCount() {
  const storage = await chrome.storage.local.get(['accessToken', 'user']);
  if (!storage.accessToken || !storage.user) return { success: true, count: 0 };

  try {
    const response = await supabaseFetch(
      `${SUPABASE_URL}/rest/v1/saved_inspirations?user_id=eq.${storage.user.id}&select=id`,
      { method: 'GET' }
    );
    if (!response.ok) return { success: true, count: 0 };
    const data = await response.json();
    const count = data.length;
    await chrome.storage.local.set({ saveCount: count });
    return { success: true, count };
  } catch (e) {
    return { success: true, count: 0 };
  }
}

// Refresh an expired access token using the refresh token
async function refreshAccessToken(refreshToken) {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    });

    if (!response.ok) {
      return { success: false };
    }

    const data = await response.json();
    const user = { id: data.user?.id, email: data.user?.email };
    
    // Check Pro status
    const isPro = await checkProStatus(data.access_token, data.user?.id);
    const isAdmin = await checkAdminRole(data.access_token, data.user?.id);

    await chrome.storage.local.set({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at || (Math.floor(Date.now() / 1000) + data.expires_in),
      user,
      isAdmin,
      isPro
    });

    return { success: true, user, isPro };
  } catch (e) {
    console.error('[Fontpair] Refresh token error:', e);
    return { success: false };
  }
}

// Check if user has Pro subscription
async function checkProStatus(accessToken, userId) {
  if (!userId) return false;
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/is_pro`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uid: userId })
      }
    );
    if (!response.ok) return false;
    return await response.json();
  } catch (e) {
    return false;
  }
}

// Handle auth sync from the fontpair.co content script
async function handleAuthSync(session) {
  if (!session || !session.accessToken) {
    // User logged out on fontpair.co — clear local auth
    await chrome.storage.local.remove(['accessToken', 'refreshToken', 'expiresAt', 'user', 'isAdmin', 'isPro', 'saveCount']);
    broadcastAuthChange();
    return { success: true, loggedIn: false };
  }

  // Store tokens
  await chrome.storage.local.set({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
    user: session.user
  });

  // Check admin role and Pro status
  const isAdmin = await checkAdminRole(session.accessToken, session.user?.id);
  const isPro = await checkProStatus(session.accessToken, session.user?.id);
  await chrome.storage.local.set({ isAdmin, isPro });

  // Fetch save count
  getSaveCount();

  broadcastAuthChange();
  return { success: true, loggedIn: true, isAdmin, isPro };
}

// Query user_roles table to check if user is admin
async function checkAdminRole(accessToken, userId) {
  if (!userId) return false;

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/user_roles?user_id=eq.${userId}&role=eq.admin&select=id`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) return false;
    const data = await response.json();
    return data.length > 0;
  } catch (e) {
    console.error('[Fontpair] Admin check failed:', e);
    return false;
  }
}

// Ensure offscreen document exists
let offscreenCreating = null;
async function ensureOffscreen(reasons, justification) {
  const existing = await chrome.offscreen.hasDocument();
  if (existing) return;
  if (offscreenCreating) { await offscreenCreating; return; }
  offscreenCreating = chrome.offscreen.createDocument({
    url: 'src/html/offscreen.html',
    reasons: reasons || ['CLIPBOARD'],
    justification: justification || 'Clipboard write from extension'
  });
  await offscreenCreating;
  offscreenCreating = null;
}

// Copy text to clipboard via offscreen document
async function copyToClipboardViaOffscreen(text) {
  await ensureOffscreen(['CLIPBOARD'], 'Write to clipboard from extension popup');
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'COPY_TEXT_OFFSCREEN', text }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response && response.success) {
        resolve();
      } else {
        reject(new Error(response?.error || 'Clipboard copy failed'));
      }
    });
  });
}

// Screenshot capture
async function captureAndCompress() {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 80 });
    const sizeKB = Math.round((dataUrl.length * 3) / 4 / 1024);
    console.log(`[Fontpair] Screenshot captured: ~${sizeKB}KB`);
    return { success: true, dataUrl, sizeKB };
  } catch (e) {
    console.error('[Fontpair] Screenshot capture failed:', e);
    return { success: false, error: e.message };
  }
}

// Normalize a URL for duplicate comparison
function normalizeUrlForDuplicateCheck(url) {
  try {
    const u = new URL(url);
    let normalized = u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '');
    return normalized.toLowerCase();
  } catch {
    return url.replace(/\/$/, '').toLowerCase();
  }
}

// Check if URL already saved
async function checkDuplicate(url) {
  const storage = await chrome.storage.local.get(['accessToken']);
  if (!storage.accessToken) return { success: false, error: 'Not authenticated' };

  try {
    const cleanUrl = url.replace(/\/$/, '');
    const urlObj = new URL(url);
    const variants = new Set();
    variants.add(cleanUrl);
    const noWww = urlObj.origin.replace('://www.', '://') + urlObj.pathname.replace(/\/$/, '');
    variants.add(noWww);
    const withWww = urlObj.origin.replace('://', '://www.').replace('://www.www.', '://www.') + urlObj.pathname.replace(/\/$/, '');
    variants.add(withWww);

    const orFilter = Array.from(variants).map(v => `url.eq.${encodeURIComponent(v)}`).join(',');
    const response = await supabaseFetch(
      `${SUPABASE_URL}/rest/v1/saved_inspirations?or=(${orFilter})&select=id,status`
    );

    if (!response.ok) throw new Error('Failed to check duplicates');
    const data = await response.json();
    return { success: true, isDuplicate: data.length > 0, existing: data[0] || null };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Check which font names exist in the fonts table
async function checkFontsInDatabase(fontNames) {
  if (!fontNames || fontNames.length === 0) return { success: true, results: {} };

  try {
    const nameFilter = fontNames.map(n => `name.ilike.${encodeURIComponent(n)}`).join(',');
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/fonts?or=(${nameFilter})&select=name,slug,font_type,is_paid`,
      { headers: { 'apikey': SUPABASE_ANON_KEY } }
    );

    if (!response.ok) return { success: true, results: {} };
    const data = await response.json();

    const results = {};
    fontNames.forEach(name => {
      const match = data.find(f => f.name.toLowerCase() === name.toLowerCase());
      results[name] = match ? { inDatabase: true, slug: match.slug, fontType: match.font_type, isPaid: match.is_paid, dbName: match.name } : { inDatabase: false };
    });

    return { success: true, results };
  } catch (e) {
    return { success: true, results: {} };
  }
}

// Fetch and cache Google Fonts list for the session
async function getGoogleFontsList() {
  if (googleFontsCache) return googleFontsCache;
  if (googleFontsCachePromise) return googleFontsCachePromise;

  googleFontsCachePromise = (async () => {
    try {
      if (!GOOGLE_FONTS_API_KEY || GOOGLE_FONTS_API_KEY === '__GOOGLE_FONTS_API_KEY__') {
        console.warn('Google Fonts API key not configured');
        return new Map();
      }
      const response = await fetch(
        `https://www.googleapis.com/webfonts/v1/webfonts?key=${GOOGLE_FONTS_API_KEY}&sort=popularity`
      );
      if (!response.ok) return new Map();
      const data = await response.json();
      const map = new Map();
      (data.items || []).forEach(font => {
        map.set(font.family.toLowerCase(), font.family);
      });
      googleFontsCache = map;
      return map;
    } catch (e) {
      console.error('Google Fonts API failed:', e);
      return new Map();
    } finally {
      googleFontsCachePromise = null;
    }
  })();

  return googleFontsCachePromise;
}

// Check if a font name matches a known foundry
function matchFoundry(fontName) {
  const lower = fontName.toLowerCase();
  for (const foundry of FOUNDRY_FONTS) {
    if (foundry.nameIncludes && lower.includes(foundry.nameIncludes)) {
      return { source: foundry.source, url: foundry.buildUrl(fontName) };
    }
    if (foundry.patterns.some(pattern => lower === pattern || lower.startsWith(pattern + ' '))) {
      return { source: foundry.source, url: foundry.buildUrl(fontName) };
    }
  }
  return null;
}

const CONCATENATED_FONT_NAMES = {
  'generalsans': 'General Sans', 'ibmplexmono': 'IBM Plex Mono', 'ibmplexsans': 'IBM Plex Sans',
  'ibmplexserif': 'IBM Plex Serif', 'ibmplexsanscondensed': 'IBM Plex Sans Condensed',
  'spacegrotesk': 'Space Grotesk', 'spacemono': 'Space Mono', 'sourcesanspro': 'Source Sans Pro',
  'sourceserifpro': 'Source Serif Pro', 'sourcecodepro': 'Source Code Pro',
  'sourcesans3': 'Source Sans 3', 'sourceserif4': 'Source Serif 4', 'worksans': 'Work Sans',
  'publicsans': 'Public Sans', 'opensans': 'Open Sans', 'plexmono': 'Plex Mono',
  'plexsans': 'Plex Sans', 'plusjakartasans': 'Plus Jakarta Sans', 'dmserif': 'DM Serif',
  'dmserifdisplay': 'DM Serif Display', 'dmseriftext': 'DM Serif Text', 'dmsans': 'DM Sans',
  'dmmono': 'DM Mono', 'redhatdisplay': 'Red Hat Display', 'redhattext': 'Red Hat Text',
  'redhatmono': 'Red Hat Mono', 'playfairdisplay': 'Playfair Display',
  'librefranklin': 'Libre Franklin', 'librebaskerville': 'Libre Baskerville',
  'librecaslontext': 'Libre Caslon Text', 'firasans': 'Fira Sans', 'firacode': 'Fira Code',
  'firamono': 'Fira Mono', 'jetbrainsmono': 'JetBrains Mono', 'robotomono': 'Roboto Mono',
  'robotoslab': 'Roboto Slab', 'robotocondensed': 'Roboto Condensed', 'robotoflex': 'Roboto Flex',
  'robotserif': 'Roboto Serif', 'nunitosans': 'Nunito Sans', 'josefinsans': 'Josefin Sans',
  'josefinslab': 'Josefin Slab', 'crimsontext': 'Crimson Text', 'crimsonpro': 'Crimson Pro',
  'ptserif': 'PT Serif', 'ptsans': 'PT Sans', 'ptmono': 'PT Mono', 'ebgaramond': 'EB Garamond',
  'cormorantgaramond': 'Cormorant Garamond', 'frankruhllibre': 'Frank Ruhl Libre',
  'bevietnampro': 'Be Vietnam Pro', 'bricolagegrotesque': 'Bricolage Grotesque',
  'instrumentsans': 'Instrument Sans', 'instrumentserif': 'Instrument Serif',
  'splinesans': 'Spline Sans', 'splinesansmono': 'Spline Sans Mono',
  'hankengrotesk': 'Hanken Grotesk', 'cabinetgrotesk': 'Cabinet Grotesk',
  'clashgrotesk': 'Clash Grotesk', 'clashdisplay': 'Clash Display',
  'satoshi': 'Satoshi', 'switzer': 'Switzer', 'suprema': 'Suprema',
  'synegrotesk': 'Syne Grotesk',
};

function splitCamelCaseName(name) {
  const lookupResult = CONCATENATED_FONT_NAMES[name.toLowerCase()];
  if (lookupResult) return lookupResult;
  const spaced = name.replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced !== name ? spaced : null;
}

// Full font identification
async function identifyFonts(fontNames) {
  if (!fontNames || fontNames.length === 0) return { success: true, results: {} };

  const altNameMap = {};
  const allNamesToCheck = [...fontNames];
  fontNames.forEach(name => {
    const alt = splitCamelCaseName(name);
    if (alt && !fontNames.includes(alt)) {
      altNameMap[alt] = name;
      allNamesToCheck.push(alt);
    }
  });

  const dbResult = await checkFontsInDatabase(allNamesToCheck);
  const rawDbResults = dbResult.results || {};

  const dbResults = {};
  fontNames.forEach(name => {
    if (rawDbResults[name]?.inDatabase) {
      dbResults[name] = rawDbResults[name];
    } else {
      const alt = splitCamelCaseName(name);
      if (alt && rawDbResults[alt]?.inDatabase) {
        dbResults[name] = rawDbResults[alt];
      } else {
        dbResults[name] = { inDatabase: false };
      }
    }
  });

  const googleFontsMap = await getGoogleFontsList();

  const results = {};
  fontNames.forEach(name => {
    const lower = name.toLowerCase();

    if (dbResults[name]?.inDatabase) {
      results[name] = {
        source: 'fontpair',
        slug: dbResults[name].slug,
        fontType: dbResults[name].fontType,
        isPaid: dbResults[name].isPaid,
        displayName: dbResults[name].dbName || name,
        url: null
      };
      return;
    }

    if (SYSTEM_FONTS.has(lower)) {
      results[name] = { source: 'system', url: null };
      return;
    }

    const altName = splitCamelCaseName(name);
    const altLower = altName ? altName.toLowerCase() : null;
    if (googleFontsMap.has(lower) || (altLower && googleFontsMap.has(altLower))) {
      const officialName = googleFontsMap.get(lower) || googleFontsMap.get(altLower);
      results[name] = {
        source: 'google',
        displayName: officialName,
        url: `https://fonts.google.com/specimen/${officialName.replace(/\s+/g, '+')}`
      };
      return;
    }

    const foundryMatch = matchFoundry(name) || (altName ? matchFoundry(altName) : null);
    if (foundryMatch) {
      results[name] = foundryMatch;
      return;
    }

    results[name] = {
      source: 'commercial',
      url: `https://www.google.com/search?q=${encodeURIComponent(name + ' font')}`
    };
  });

  return { success: true, results };
}

// Save inspiration to Supabase
async function saveInspiration(data) {
  const storage = await chrome.storage.local.get(['accessToken', 'user', 'isPro', 'saveCount']);

  if (!storage.accessToken || !storage.user) {
    throw new Error('Not authenticated');
  }

  // Enforce free save limit
  const currentCount = storage.saveCount || 0;
  if (!storage.isPro && currentCount >= FREE_SAVE_LIMIT) {
    throw new Error('FREE_LIMIT_REACHED');
  }

  // Upload screenshot if present
  let screenshotUrl = null;
  if (data.screenshotDataUrl) {
    screenshotUrl = await uploadScreenshot(data.screenshotDataUrl, storage.accessToken);
  }

  // Insert into saved_inspirations
  let cleanUrl;
  try {
    const urlObj = new URL(data.url);
    cleanUrl = urlObj.origin + urlObj.pathname.replace(/\/$/, '');
  } catch {
    cleanUrl = data.url.replace(/\/$/, '');
  }
  const primaryColor = detectPrimaryColor(data.colors || []);
  // Extract heading/body font weights from fontWeightData
  let headingFontWeight = 700;
  let bodyFontWeight = 400;
  const fontList = data.fonts || [];
  const fwd = data.fontWeightData || {};
  if (fontList.length >= 1 && fwd[fontList[0]]) {
    headingFontWeight = fwd[fontList[0]].primaryWeight || 700;
  }
  if (fontList.length >= 2 && fwd[fontList[1]]) {
    bodyFontWeight = fwd[fontList[1]].primaryWeight || 400;
  }

  const body = {
    user_id: storage.user.id,
    url: cleanUrl,
    title: data.title || null,
    screenshot_url: screenshotUrl,
    fonts: fontList,
    colors: data.colors || [],
    primary_color: primaryColor,
    heading_font_weight: headingFontWeight,
    body_font_weight: bodyFontWeight,
    status: 'pending'
  };

  const response = await supabaseFetch(
    `${SUPABASE_URL}/rest/v1/saved_inspirations`,
    {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || 'Failed to save');
  }

  const result = await response.json();

  // Optimistically increment save count
  await chrome.storage.local.set({ saveCount: currentCount + 1 });

  return { success: true, id: result[0]?.id, saveCount: currentCount + 1 };
}

// Upload screenshot to Supabase Storage
async function uploadScreenshot(dataUrl, accessToken) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();

  const filename = `ext-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const path = `extension/${filename}`;

  const uploadResponse = await fetch(
    `${SUPABASE_URL}/storage/v1/object/inspirations/${path}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': blob.type
      },
      body: blob
    }
  );

  if (!uploadResponse.ok) {
    throw new Error('Screenshot upload failed');
  }

  return `${SUPABASE_URL}/storage/v1/object/public/inspirations/${path}`;
}

// Detect the most chromatic color from a palette
function detectPrimaryColor(colors) {
  if (!colors || colors.length === 0) return null;

  function hexToHSL(hex) {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  let bestColor = null;
  let bestScore = -1;

  for (const color of colors) {
    if (!color || typeof color !== 'string') continue;
    try {
      const hsl = hexToHSL(color);
      if (hsl.s < 10 || hsl.l > 90 || hsl.l < 10) continue;
      const score = hsl.s * (1 - Math.abs(hsl.l - 50) / 50);
      if (score > bestScore) {
        bestScore = score;
        bestColor = color;
      }
    } catch (e) {
      continue;
    }
  }

  return bestColor;
}
