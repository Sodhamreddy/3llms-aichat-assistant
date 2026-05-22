const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { getProfilePath, sanitizeClientId } = require('./session-manager');

const PROFILE_ROOT = path.join(__dirname, 'profiles');
const ACCOUNT_STORE = path.join(PROFILE_ROOT, 'client_accounts.json');
const HASH_ITERATIONS = 120_000;
const HASH_LENGTH = 64;
const HASH_DIGEST = 'sha512';
const DEFAULT_MODE = 'browser';
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

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(ACCOUNT_STORE, 'utf8'));
  } catch {
    return { byEmail: {}, clients: {} };
  }
}

function writeStore(store) {
  ensureDir(PROFILE_ROOT);
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
    profilePath: getProfilePath(record.client_id),
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
    profilePath: getProfilePath(clientId),
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

  const safeClientId = sanitizeClientId(clientId || createClientId());
  const created = await supabaseAdmin.auth.admin.createUser({
    email: cleanEmail,
    password,
    email_confirm: true,
    user_metadata: {
      name: cleanName,
      client_id: safeClientId,
    },
  });

  if (created.error) {
    if (/already|registered|exists/i.test(created.error.message)) {
      throw new Error('An account already exists for this email. Use Log in instead.');
    }
    throw new Error(created.error.message);
  }

  const user = created.data.user;
  if (!user) throw new Error('Supabase did not return a created user.');

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

  getProfilePath(safeClientId);
  return publicSupabaseClient({
    user,
    profile: profileResult.data,
    preferences: preferencesResult.data,
  });
}

async function startSignupSupabase({ name, email, password, clientId }) {
  const cleanName = String(name || '').trim();
  const cleanEmail = normalizeEmail(email);
  if (!cleanName) throw new Error('Display name is required.');
  if (!isValidEmail(cleanEmail)) throw new Error('A valid email is required.');
  validatePassword(password);

  const existing = await findSupabaseUserByEmail(cleanEmail);
  if (existing) {
    const profileResult = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();
    if (profileResult.error) throw new Error(profileResult.error.message);
    if (profileResult.data) throw new Error('An account already exists for this email. Use Log in instead.');
  }

  const safeClientId = sanitizeClientId(clientId || createClientId());
  const otpResult = await supabaseAuth.auth.signInWithOtp({
    email: cleanEmail,
    options: {
      shouldCreateUser: true,
      data: {
        name: cleanName,
        client_id: safeClientId,
      },
    },
  });
  if (otpResult.error) throw new Error(otpResult.error.message);

  return {
    requiresVerification: true,
    email: cleanEmail,
    clientId: safeClientId,
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

  const safeClientId = sanitizeClientId(clientId || user.user_metadata?.client_id || createClientId());
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

  getProfilePath(safeClientId);
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
    const safeClientId = sanitizeClientId(user.user_metadata?.client_id || createClientId());
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

async function sendPasswordResetSupabase({ email }) {
  const cleanEmail = normalizeEmail(email);
  if (!isValidEmail(cleanEmail)) throw new Error('A valid email is required.');

  const resetResult = await supabaseAuth.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo: process.env.APP_URL || process.env.VITE_APP_URL || undefined,
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
  getProfilePath(safeClientId);
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
  loginClient,
  publicClient,
  sendPasswordReset,
  signupClient,
  startSignup,
  upsertClientPreferences,
  verifySignup,
};
