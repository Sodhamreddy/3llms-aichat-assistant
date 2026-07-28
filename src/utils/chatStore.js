import { supabase } from './supabase';

/*
 * Chat history persistence.
 *
 * History used to live in a single global `ph_history` localStorage key, which
 * meant it never followed the account (log in elsewhere -> "No chats yet") and
 * two people sharing a browser could see each other's chats.
 *
 * Now:
 *   - Supabase `chats` table is the source of truth, keyed by auth user id.
 *   - localStorage is a per-user offline cache (`ph_history::<uid>`), so the UI
 *     still paints instantly and keeps working if Supabase is unreachable.
 *
 * Every Supabase call degrades to cache-only on error, so the app keeps working
 * before the SQL migration has been run.
 */

const LEGACY_KEY = 'ph_history';
const cacheKey = (uid) => `ph_history::${uid || 'anon'}`;

let tableMissing = false;   // stop retrying once we know the table isn't there

/** The signed-in Supabase user id, or null when auth is off/logged out. */
export const getUserId = async () => {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id || null;
  } catch {
    return null;
  }
};

// ── local cache ──────────────────────────────────────────────────────────────
export const readCache = (uid) => {
  try {
    const raw = localStorage.getItem(cacheKey(uid));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore corrupt cache */ }
  return [];
};

export const writeCache = (uid, history) => {
  try {
    localStorage.setItem(cacheKey(uid), JSON.stringify(history.slice(0, 100)));
  } catch { /* quota exceeded — cache is best-effort */ }
};

/** Read the pre-migration global key without consuming it. */
export const readLegacy = () => {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    const legacy = raw ? JSON.parse(raw) : [];
    return Array.isArray(legacy) ? legacy : [];
  } catch {
    return [];
  }
};

/**
 * One-time migration: chats saved under the old global key are claimed by the
 * first user who signs in on this browser, then the global key is removed so a
 * second account on the same machine can't inherit them.
 *
 * Only ever called with a real uid — while signed out we read the legacy key
 * but leave it in place, so a later login can still claim those chats.
 */
export const claimLegacyHistory = (uid) => {
  if (!uid) return readLegacy();
  try {
    const legacy = readLegacy();
    localStorage.removeItem(LEGACY_KEY);
    if (legacy.length === 0) return [];
    const existing = readCache(uid);
    if (existing.length === 0) writeCache(uid, legacy);
    return existing.length === 0 ? legacy : existing;
  } catch {
    return [];
  }
};

// ── row <-> UI shape ─────────────────────────────────────────────────────────
const rowToItem = (r) => ({
  id: Number(r.id),
  prompt: r.prompt,
  date: r.date_label || new Date(r.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
  best: r.best,
  status: r.status || 'Complete',
  responses: r.responses || {},
  tokenData: r.token_data || null,
  elapsed: r.elapsed ?? null,
  followUps: r.follow_ups || [],
});

const itemToRow = (item, uid) => ({
  id: item.id,
  user_id: uid,
  prompt: item.prompt,
  date_label: item.date,
  best: item.best,
  status: item.status || 'Complete',
  responses: item.responses || {},
  token_data: item.tokenData || null,
  elapsed: item.elapsed ?? null,
  follow_ups: item.followUps || [],
});

const isMissingTable = (error) =>
  error && (error.code === '42P01' || /relation .*chats.* does not exist/i.test(error.message || ''));

// ── remote ───────────────────────────────────────────────────────────────────
/** Fetch this user's chats. Returns null when Supabase can't answer. */
export const fetchRemote = async (uid) => {
  if (!supabase || !uid || tableMissing) return null;
  try {
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', uid)
      .order('id', { ascending: false })
      .limit(100);
    if (error) {
      if (isMissingTable(error)) tableMissing = true;
      return null;
    }
    return (data || []).map(rowToItem);
  } catch {
    return null;
  }
};

/** Insert or update one chat. Fire-and-forget; cache already holds the value. */
export const upsertRemote = async (item, uid) => {
  if (!supabase || !uid || tableMissing) return false;
  try {
    const { error } = await supabase.from('chats').upsert(itemToRow(item, uid), { onConflict: 'id' });
    if (error) {
      if (isMissingTable(error)) tableMissing = true;
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

export const deleteRemote = async (id, uid) => {
  if (!supabase || !uid || tableMissing) return false;
  try {
    const { error } = await supabase.from('chats').delete().eq('id', id).eq('user_id', uid);
    if (error) {
      if (isMissingTable(error)) tableMissing = true;
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

/** Push a whole local history up once, used right after a first login. */
export const pushAll = async (history, uid) => {
  if (!supabase || !uid || tableMissing || !history.length) return false;
  try {
    const { error } = await supabase
      .from('chats')
      .upsert(history.slice(0, 100).map((h) => itemToRow(h, uid)), { onConflict: 'id' });
    if (error) {
      if (isMissingTable(error)) tableMissing = true;
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

/** Merge remote + local by id, newest first. */
export const mergeById = (a = [], b = []) => {
  const seen = new Map();
  for (const item of [...a, ...b]) {
    if (item && item.id != null && !seen.has(item.id)) seen.set(item.id, item);
  }
  return [...seen.values()].sort((x, y) => Number(y.id) - Number(x.id)).slice(0, 100);
};
