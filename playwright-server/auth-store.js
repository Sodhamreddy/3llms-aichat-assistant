const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const DATA_ROOT = path.join(__dirname, 'data');
const ACCOUNT_STORE = path.join(DATA_ROOT, 'client_accounts.json');
const HASH_ITERATIONS = 120_000;
const HASH_LENGTH = 64;
const HASH_DIGEST = 'sha512';
const DEFAULT_MODE = 'api';
const DEFAULT_MODELS = ['openai', 'claude', 'gemini'];

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
    // .env is optional; local JSON auth remains available.
  }
}

loadRootEnv();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const supabaseAuth = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

function isSupabaseEnabled() {
  return Boolean(supabaseAdmin && supabaseAuth);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sanitizeClientId(value) {
  const raw = String(value || 'client_default').trim();
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return safe || 'client_default';
}

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(ACCOUNT_STORE, 'utf8'));
  } catch {
    return { byEmail: {}, clients: {} };
  }
}

function writeStore(store) {
  ensureDir(DATA_ROOT);
  fs.writeFileSync(ACCOUNT_STORE, JSON.stringify(store, null, 2));
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function createClientId() {
  return `client_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(
    String(password || ''),
    salt,
    HASH_ITERATIONS,
    HASH_LENGTH,
    HASH_DIGEST
  ).toString('hex');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  if (String(password || '').length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }
}

async function findSupabaseUserByEmail(email) {
  const cleanEmail = normalizeEmail(email);
  let page = 1;
  while (page < 50) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const found = (data?.users || []).find(user => normalizeEmail(user.email) === cleanEmail);
    if (found) return found;
    if (!data?.users || data.users.length < 1000) break;
    page += 1;
  }
  return null;
}

async function getAvailableSupabaseClientId(preferredClientId, userId) {
  let candidate = sanitizeClientId(preferredClientId || createClientId());

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const existing = await supabaseAdmin
      .from('profiles')
      .select('id, client_id')
      .eq('client_id', candidate)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (!existing.data || existing.data.id === userId) return candidate;
    candidate = sanitizeClientId(createClientId());
  }

  throw new Error('Could not allocate a unique client ID for this account.');
}

function publicClient(record) {
  if (!record) return null;
  return {
    clientId: record.client_id,
    client_id: record.client_id,
    name: record.name,
    email: record.email,
    mode: record.mode || DEFAULT_MODE,
    enabledModels: record.enabled_models || DEFAULT_MODELS,
    onboardingComplete: Boolean(record.onboarding_complete),
  };
}

function publicSupabaseClient({ user, profile, preferences, session }) {
  if (!profile) return null;
  const clientId = profile.client_id;
  return {
    clientId,
    client_id: clientId,
    userId: user?.id || profile.id || preferences?.user_id,
    name: profile.name || user?.user_metadata?.name || '',
    email: profile.email || user?.email || '',
    mode: preferences?.mode || DEFAULT_MODE,
    enabledModels: preferences?.enabled_models || DEFAULT_MODELS,
    onboardingComplete: Boolean(profile.onboarding_complete),
    accessToken: session?.access_token,
    refreshToken: session?.refresh_token,
  };
}

async function signupClientSupabase({ name, email, password, clientId }) {
  const cleanName = String(name || '').trim();
  const cleanEmail = normalizeEmail(email);
  if (!cleanName) throw new Error('Display name is required.');
  if (!isValidEmail(cleanEmail)) throw new Error('A valid email is required.');
  validatePassword(password);

  let safeClientId = sanitizeClientId(clientId || createClientId());
  const created = await supabaseAdmin.auth.admin.createUser({
    email: cleanEmail,
    password,
    email_confirm: true,
    user_metadata: {
      name: cleanName,
      client_id: safeClientId,
    },
  });

  let user = created.data?.user;

  if (created.error) {
    if (/already|registered|exists/i.test(created.error.message)) {
      const existingUser = await findSupabaseUserByEmail(cleanEmail);
      if (!existingUser) throw new Error('An account already exists for this email. Use Log in instead.');

      const existingProfile = await supabaseAdmin
        .from('profiles')
        .select('id')
        .or(`id.eq.${existingUser.id},email.eq.${cleanEmail}`)
        .maybeSingle();
      if (existingProfile.error) throw new Error(existingProfile.error.message);
      if (existingProfile.data) throw new Error('An account already exists for this email. Use Log in instead.');

      const updated = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
        user_metadata: {
          ...(existingUser.user_metadata || {}),
          name: cleanName,
          client_id: safeClientId,
        },
      });
      if (updated.error) throw new Error(updated.error.message);
      user = updated.data.user;
    } else {
      throw new Error(created.error.message);
    }
  }

  if (!user) throw new Error('Supabase did not return a created user.');
  safeClientId = await getAvailableSupabaseClientId(safeClientId, user.id);

  const profileResult = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: user.id,
      client_id: safeClientId,
      name: cleanName,
      email: cleanEmail,
      onboarding_complete: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select()
    .single();
  if (profileResult.error) throw new Error(profileResult.error.message);

  const preferencesResult = await supabaseAdmin
    .from('client_preferences')
    .upsert({
      user_id: user.id,
      mode: DEFAULT_MODE,
      enabled_models: DEFAULT_MODELS,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single();
  if (preferencesResult.error) throw new Error(preferencesResult.error.message);

  return publicSupabaseClient({
    user,
    profile: profileResult.data,
    preferences: preferencesResult.data,
  });
}

async function startSignupSupabase({ name, email, password, clientId }) {
  return {
    requiresVerification: false,
    client: await signupClientSupabase({ name, email, password, clientId }),
  };
}

async function verifySignupSupabase({ name, email, password, clientId, code }) {
  const cleanName = String(name || '').trim();
  const cleanEmail = normalizeEmail(email);
  const cleanCode = String(code || '').trim();
  if (!cleanName) throw new Error('Display name is required.');
  if (!isValidEmail(cleanEmail)) throw new Error('A valid email is required.');
  validatePassword(password);
  if (!cleanCode) throw new Error('Verification code is required.');

  const verifyResult = await supabaseAuth.auth.verifyOtp({
    email: cleanEmail,
    token: cleanCode,
    type: 'email',
  });
  if (verifyResult.error) throw new Error('Verification code is invalid or expired.');

  const user = verifyResult.data.user;
  const session = verifyResult.data.session;
  if (!user) throw new Error('Supabase did not return a verified user.');

  const safeClientId = await getAvailableSupabaseClientId(clientId || user.user_metadata?.client_id || createClientId(), user.id);
  const updateResult = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    user_metadata: {
      ...(user.user_metadata || {}),
      name: cleanName,
      client_id: safeClientId,
    },
  });
  if (updateResult.error) throw new Error(updateResult.error.message);

  const profileResult = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: user.id,
      client_id: safeClientId,
      name: cleanName,
      email: cleanEmail,
      onboarding_complete: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select()
    .single();
  if (profileResult.error) throw new Error(profileResult.error.message);

  const preferencesResult = await supabaseAdmin
    .from('client_preferences')
    .upsert({
      user_id: user.id,
      mode: DEFAULT_MODE,
      enabled_models: DEFAULT_MODELS,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single();
  if (preferencesResult.error) throw new Error(preferencesResult.error.message);

  return publicSupabaseClient({
    user: updateResult.data.user || user,
    session,
    profile: profileResult.data,
    preferences: preferencesResult.data,
  });
}

async function loginClientSupabase({ email, password }) {
  const cleanEmail = normalizeEmail(email);
  if (!isValidEmail(cleanEmail)) throw new Error('A valid email is required.');
  if (!password) throw new Error('Password is required.');

  const loginResult = await supabaseAuth.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });
  if (loginResult.error) throw new Error(loginResult.error.message || 'Email or password is incorrect.');

  const user = loginResult.data.user;
  const session = loginResult.data.session;
  if (!user) throw new Error('No Supabase user returned.');

  let profileResult = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (profileResult.error) throw new Error(profileResult.error.message);

  if (!profileResult.data) {
    const safeClientId = await getAvailableSupabaseClientId(user.user_metadata?.client_id || createClientId(), user.id);
    profileResult = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: user.id,
        client_id: safeClientId,
        name: user.user_metadata?.name || '',
        email: user.email || cleanEmail,
        onboarding_complete: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select()
      .single();
    if (profileResult.error) throw new Error(profileResult.error.message);
  }

  let preferencesResult = await supabaseAdmin
    .from('client_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (preferencesResult.error) throw new Error(preferencesResult.error.message);

  if (!preferencesResult.data) {
    preferencesResult = await supabaseAdmin
      .from('client_preferences')
      .upsert({
        user_id: user.id,
        mode: DEFAULT_MODE,
        enabled_models: DEFAULT_MODELS,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .single();
    if (preferencesResult.error) throw new Error(preferencesResult.error.message);
  }

  return publicSupabaseClient({
    user,
    session,
    profile: profileResult.data,
    preferences: preferencesResult.data,
  });
}

async function googleClientSupabase({ accessToken, clientId }) {
  if (!accessToken) throw new Error('Google sign-in token is required.');

  const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const googleProfile = await googleRes.json().catch(() => ({}));
  if (!googleRes.ok) throw new Error(googleProfile.error_description || 'Google sign-in failed.');

  const cleanEmail = normalizeEmail(googleProfile.email);
  const cleanName = String(googleProfile.name || googleProfile.given_name || cleanEmail.split('@')[0] || '').trim();
  if (!isValidEmail(cleanEmail)) throw new Error('Google did not return a valid email address.');

  let user = await findSupabaseUserByEmail(cleanEmail);
  let safeClientId = sanitizeClientId(clientId || user?.user_metadata?.client_id || createClientId());

  if (!user) {
    const created = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: crypto.randomBytes(32).toString('hex'),
      email_confirm: true,
      user_metadata: {
        name: cleanName,
        client_id: safeClientId,
        provider: 'google',
      },
    });
    if (created.error) throw new Error(created.error.message);
    user = created.data.user;
  } else {
    safeClientId = sanitizeClientId(user.user_metadata?.client_id || clientId || createClientId());
    const updated = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      email_confirm: true,
      user_metadata: {
        ...(user.user_metadata || {}),
        name: cleanName || user.user_metadata?.name || '',
        client_id: safeClientId,
        provider: 'google',
      },
    });
    if (updated.error) throw new Error(updated.error.message);
    user = updated.data.user || user;
  }

  let profileResult = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (profileResult.error) throw new Error(profileResult.error.message);

  if (!profileResult.data) {
    safeClientId = await getAvailableSupabaseClientId(safeClientId, user.id);
    profileResult = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: user.id,
        client_id: safeClientId,
        name: cleanName,
        email: cleanEmail,
        onboarding_complete: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select()
      .single();
    if (profileResult.error) throw new Error(profileResult.error.message);
  }

  let preferencesResult = await supabaseAdmin
    .from('client_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (preferencesResult.error) throw new Error(preferencesResult.error.message);

  if (!preferencesResult.data) {
    preferencesResult = await supabaseAdmin
      .from('client_preferences')
      .upsert({
        user_id: user.id,
        mode: DEFAULT_MODE,
        enabled_models: DEFAULT_MODELS,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .single();
    if (preferencesResult.error) throw new Error(preferencesResult.error.message);
  }

  return publicSupabaseClient({
    user,
    profile: profileResult.data,
    preferences: preferencesResult.data,
  });
}

async function sendPasswordResetSupabase({ email }) {
  const cleanEmail = normalizeEmail(email);
  if (!isValidEmail(cleanEmail)) throw new Error('A valid email is required.');
  const appUrl = (process.env.APP_URL || process.env.VITE_APP_URL || 'http://127.0.0.1:5173').replace(/\/+$/, '');

  const resetResult = await supabaseAuth.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo: `${appUrl}/reset-password`,
  });
  if (resetResult.error) throw new Error(resetResult.error.message);
  return { email: cleanEmail };
}

async function upsertClientPreferencesSupabase({ clientId, name, email, mode, enabledModels }) {
  const safeClientId = sanitizeClientId(clientId);
  let profileResult = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('client_id', safeClientId)
    .maybeSingle();
  if (profileResult.error) throw new Error(profileResult.error.message);

  if (!profileResult.data && email) {
    profileResult = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('email', normalizeEmail(email))
      .maybeSingle();
    if (profileResult.error) throw new Error(profileResult.error.message);
  }
  if (!profileResult.data) return null;

  const profile = profileResult.data;
  const updatedProfile = await supabaseAdmin
    .from('profiles')
    .update({
      name: String(name || profile.name || '').trim(),
      email: normalizeEmail(email || profile.email),
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id)
    .select()
    .single();
  if (updatedProfile.error) throw new Error(updatedProfile.error.message);

  const updatedPreferences = await supabaseAdmin
    .from('client_preferences')
    .upsert({
      user_id: profile.id,
      mode: mode || DEFAULT_MODE,
      enabled_models: Array.isArray(enabledModels) && enabledModels.length ? enabledModels : DEFAULT_MODELS,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single();
  if (updatedPreferences.error) throw new Error(updatedPreferences.error.message);

  return publicSupabaseClient({
    user: { id: profile.id },
    profile: updatedProfile.data,
    preferences: updatedPreferences.data,
  });
}

function signupClientLocal({ name, email, password, clientId }) {
  const cleanName = String(name || '').trim();
  const cleanEmail = normalizeEmail(email);
  if (!cleanName) throw new Error('Display name is required.');
  if (!isValidEmail(cleanEmail)) throw new Error('A valid email is required.');
  validatePassword(password);

  const store = readStore();
  if (store.byEmail[cleanEmail]) {
    throw new Error('An account already exists for this email. Use Log in instead.');
  }

  let safeClientId = sanitizeClientId(clientId || createClientId());
  if (store.clients[safeClientId]) {
    safeClientId = sanitizeClientId(createClientId());
  }
  const now = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString('hex');
  const record = {
    client_id: safeClientId,
    name: cleanName,
    email: cleanEmail,
    password_salt: salt,
    password_hash: hashPassword(password, salt),
    mode: DEFAULT_MODE,
    enabled_models: DEFAULT_MODELS,
    onboarding_complete: false,
    created_at: now,
    updated_at: now,
  };

  store.byEmail[cleanEmail] = safeClientId;
  store.clients[safeClientId] = record;
  writeStore(store);
  return publicClient(record);
}

function startSignupLocal(input) {
  return { requiresVerification: false, client: signupClientLocal(input) };
}

function verifySignupLocal(input) {
  return signupClientLocal(input);
}

function loginClientLocal({ email, password }) {
  const cleanEmail = normalizeEmail(email);
  if (!isValidEmail(cleanEmail)) throw new Error('A valid email is required.');
  if (!password) throw new Error('Password is required.');

  const store = readStore();
  const clientId = store.byEmail[cleanEmail];
  const record = clientId ? store.clients[clientId] : null;
  if (!record) throw new Error('No account found for this email.');

  const submittedHash = hashPassword(password, record.password_salt);
  const savedHash = String(record.password_hash || '');
  const ok = savedHash.length === submittedHash.length &&
    crypto.timingSafeEqual(Buffer.from(submittedHash), Buffer.from(savedHash));
  if (!ok) throw new Error('Email or password is incorrect.');

  return publicClient(record);
}

async function googleClientLocal({ accessToken, email, name, clientId }) {
  let googleEmail = email;
  let googleName = name;
  if (accessToken) {
    const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const googleProfile = await googleRes.json().catch(() => ({}));
    if (!googleRes.ok) throw new Error(googleProfile.error_description || 'Google sign-in failed.');
    googleEmail = googleProfile.email;
    googleName = googleProfile.name || googleProfile.given_name;
  }

  const cleanEmail = normalizeEmail(googleEmail);
  const cleanName = String(googleName || cleanEmail.split('@')[0] || '').trim();
  if (!isValidEmail(cleanEmail)) throw new Error('A valid Google email is required.');

  const store = readStore();
  const existingClientId = store.byEmail[cleanEmail];
  if (existingClientId && store.clients[existingClientId]) return publicClient(store.clients[existingClientId]);

  let safeClientId = sanitizeClientId(clientId || createClientId());
  if (store.clients[safeClientId]) safeClientId = sanitizeClientId(createClientId());

  const now = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString('hex');
  const record = {
    client_id: safeClientId,
    name: cleanName,
    email: cleanEmail,
    password_salt: salt,
    password_hash: hashPassword(crypto.randomBytes(32).toString('hex'), salt),
    auth_provider: 'google',
    mode: DEFAULT_MODE,
    enabled_models: DEFAULT_MODELS,
    onboarding_complete: false,
    created_at: now,
    updated_at: now,
  };

  store.byEmail[cleanEmail] = safeClientId;
  store.clients[safeClientId] = record;
  writeStore(store);
  return publicClient(record);
}

function upsertClientPreferencesLocal({ clientId, name, email, mode, enabledModels }) {
  const safeClientId = sanitizeClientId(clientId);
  const cleanEmail = normalizeEmail(email);
  const store = readStore();
  let record = store.clients[safeClientId];

  if (!record && cleanEmail && store.byEmail[cleanEmail]) {
    record = store.clients[store.byEmail[cleanEmail]];
  }
  if (!record) return null;

  record.name = String(name || record.name || '').trim();
  record.mode = mode || record.mode || DEFAULT_MODE;
  record.enabled_models = Array.isArray(enabledModels) && enabledModels.length
    ? enabledModels
    : record.enabled_models;
  record.onboarding_complete = true;
  record.updated_at = new Date().toISOString();
  store.clients[record.client_id] = record;
  store.byEmail[record.email] = record.client_id;
  writeStore(store);

  return publicClient(record);
}

function sendPasswordResetLocal({ email }) {
  const cleanEmail = normalizeEmail(email);
  if (!isValidEmail(cleanEmail)) throw new Error('A valid email is required.');
  return { email: cleanEmail };
}

async function signupClient(input) {
  if (isSupabaseEnabled()) return signupClientSupabase(input);
  return signupClientLocal(input);
}

async function startSignup(input) {
  if (isSupabaseEnabled()) return startSignupSupabase(input);
  return startSignupLocal(input);
}

async function verifySignup(input) {
  if (isSupabaseEnabled()) return verifySignupSupabase(input);
  return verifySignupLocal(input);
}

async function loginClient(input) {
  if (isSupabaseEnabled()) return loginClientSupabase(input);
  return loginClientLocal(input);
}

async function googleClient(input) {
  if (isSupabaseEnabled()) return googleClientSupabase(input);
  return googleClientLocal(input);
}

async function upsertClientPreferences(input) {
  if (isSupabaseEnabled()) return upsertClientPreferencesSupabase(input);
  return upsertClientPreferencesLocal(input);
}

async function sendPasswordReset(input) {
  if (isSupabaseEnabled()) return sendPasswordResetSupabase(input);
  return sendPasswordResetLocal(input);
}

module.exports = {
  isSupabaseEnabled,
  googleClient,
  loginClient,
  publicClient,
  sendPasswordReset,
  signupClient,
  startSignup,
  upsertClientPreferences,
  verifySignup,
};
