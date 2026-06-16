const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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
    // .env is optional for non-admin local server usage.
  }
}

loadRootEnv();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const adminEmails = String(process.env.SUPABASE_ADMIN_EMAILS || process.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean);
const portalEmail = String(process.env.ADMIN_PORTAL_EMAIL || '').trim().toLowerCase();
const portalPassword = String(process.env.ADMIN_PORTAL_PASSWORD || '');
const portalSecret = process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || 'local-admin-secret';
const ADMIN_TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw Object.assign(new Error('Supabase admin access is not configured on the server.'), { status: 503 });
  }
}

function getBearerToken(req) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signPayload(payload) {
  return crypto
    .createHmac('sha256', portalSecret)
    .update(payload)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function createAdminPortalSession({ email, password }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!portalEmail || !portalPassword) {
    throw Object.assign(new Error('Admin portal credentials are not configured.'), { status: 503 });
  }
  if (cleanEmail !== portalEmail || !safeEqual(password, portalPassword)) {
    throw Object.assign(new Error('Invalid admin email or password.'), { status: 401 });
  }

  const payload = base64Url(JSON.stringify({
    sub: portalEmail,
    role: 'admin',
    exp: Date.now() + ADMIN_TOKEN_TTL_MS,
  }));
  const signature = signPayload(payload);
  return {
    token: `${payload}.${signature}`,
    admin: { email: portalEmail },
    expiresAt: new Date(Date.now() + ADMIN_TOKEN_TTL_MS).toISOString(),
  };
}

function verifyAdminPortalToken(token) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature || !safeEqual(signature, signPayload(payload))) return null;

  try {
    const data = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (data.role !== 'admin' || data.sub !== portalEmail || Number(data.exp || 0) < Date.now()) return null;
    return { id: 'admin-portal', email: data.sub };
  } catch {
    return null;
  }
}

async function requireAdmin(req) {
  requireSupabaseAdmin();

  const token = getBearerToken(req);
  if (!token) {
    throw Object.assign(new Error('Log in again with an admin account to open this page.'), { status: 401 });
  }

  const portalAdmin = verifyAdminPortalToken(token);
  if (portalAdmin) return portalAdmin;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    throw Object.assign(new Error('Your login session is invalid or expired.'), { status: 401 });
  }

  const email = String(data.user.email || '').toLowerCase();
  if (!adminEmails.length || !adminEmails.includes(email)) {
    throw Object.assign(new Error('This account is not allowed to view admin analytics.'), { status: 403 });
  }

  return data.user;
}

async function listAllAuthUsers() {
  const users = [];
  let page = 1;

  while (page < 100) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < 1000) break;
    page += 1;
  }

  return users;
}

function byKey(rows, key) {
  return new Map((rows || []).map(row => [row[key], row]));
}

function countBy(users, predicate) {
  return users.reduce((total, user) => total + (predicate(user) ? 1 : 0), 0);
}

async function getAdminAnalytics(req) {
  const adminUser = await requireAdmin(req);

  const [authUsers, profilesResult, preferencesResult] = await Promise.all([
    listAllAuthUsers(),
    supabaseAdmin.from('profiles').select('*'),
    supabaseAdmin.from('client_preferences').select('*'),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (preferencesResult.error) throw preferencesResult.error;

  const profilesById = byKey(profilesResult.data, 'id');
  const preferencesByUserId = byKey(preferencesResult.data, 'user_id');

  const users = authUsers
    .map(user => {
      const profile = profilesById.get(user.id) || {};
      const preferences = preferencesByUserId.get(user.id) || {};

      return {
        id: user.id,
        email: profile.email || user.email || '',
        name: profile.name || user.user_metadata?.name || '',
        clientId: profile.client_id || user.user_metadata?.client_id || '',
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at,
        onboardingComplete: Boolean(profile.onboarding_complete),
        mode: preferences.mode || 'api',
        enabledModels: Array.isArray(preferences.enabled_models) ? preferences.enabled_models : [],
      };
    })
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    admin: {
      id: adminUser.id,
      email: adminUser.email,
    },
    totals: {
      users: users.length,
      onboardingComplete: countBy(users, user => user.onboardingComplete),
      apiMode: countBy(users, user => user.mode === 'api'),
    },
    users,
  };
}

module.exports = {
  createAdminPortalSession,
  getAdminAnalytics,
};
