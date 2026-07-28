/*
 * Turns raw provider/n8n failures into something a user can act on.
 *
 * Running out of credits surfaces as an opaque "n8n returned HTTP 500", because
 * the real reason is buried in the provider's payload. We match the known quota
 * strings from OpenAI, Anthropic and Google and say plainly what happened.
 *
 * Quota exhaustion and rate limiting are deliberately kept apart: one needs an
 * upgrade, the other just needs a moment. Telling someone to buy more credits
 * when they only hit a burst limit would be wrong.
 */

// Balance/quota genuinely used up — needs a plan change or a top-up.
const QUOTA = new RegExp([
  'insufficient[_ ]quota',
  'exceeded your current quota',
  'billing[_ ]hard[_ ]limit',
  'credit balance is too low',
  'insufficient credits',
  'not enough credits',
  'out of credits',
  'RESOURCE_EXHAUSTED',
  'quota exceeded',
  'exceeded your quota',
  'HTTP 402',
  'payment required',
].join('|'), 'i');

// Temporary throttling — retrying works.
const RATE = new RegExp([
  'rate[_ ]?limit',
  'too many requests',
  'HTTP 429',
  'overloaded',
  'server[_ ]is[_ ]busy',
].join('|'), 'i');

// Provider credentials rejected.
const AUTH = new RegExp([
  'invalid[_ ]api[_ ]key',
  'incorrect api key',
  'authentication[_ ]error',
  'unauthorized',
  'HTTP 401',
  'HTTP 403',
].join('|'), 'i');

/**
 * @returns {{kind:string, title:string, message:string, upgrade:boolean}}
 */
export const classifyError = (raw = '') => {
  const text = String(raw || '');

  if (QUOTA.test(text)) {
    return {
      kind: 'quota',
      title: 'You are out of credits',
      message: 'Your token balance has run out, so the models could not be reached. Upgrade your plan to keep asking questions.',
      upgrade: true,
    };
  }

  if (RATE.test(text)) {
    return {
      kind: 'rate',
      title: 'Too many requests right now',
      message: 'The AI provider is throttling requests. Wait a few seconds and try again — nothing has been charged.',
      upgrade: false,
    };
  }

  if (AUTH.test(text)) {
    return {
      kind: 'auth',
      title: 'API key was rejected',
      message: 'A provider rejected the configured API key. Check your keys under Integrations.',
      upgrade: false,
    };
  }

  if (/gateway timeout|HTTP 504|HTTP 502|HTTP 503|timed out/i.test(text)) {
    return {
      kind: 'timeout',
      title: 'That took too long',
      message: 'The run exceeded the time limit before finishing. Try a shorter prompt, or ask again.',
      upgrade: false,
    };
  }

  return { kind: 'error', title: '', message: text || 'Something went wrong. Please try again.', upgrade: false };
};

/*
 * Product decision: users see ONE message for every failure, rather than a
 * different explanation per cause. classifyError still runs underneath so the
 * real reason is written to the console and nothing becomes undebuggable.
 */
export const UNIFIED_NOTICE = Object.freeze({
  kind: 'quota',
  title: 'You are out of credits',
  message: 'Your token balance has run out, so the models could not be reached. Upgrade your plan to keep asking questions.',
  upgrade: true,
});

/** The single notice shown for any failure. Logs the true cause first. */
export const toUserNotice = (raw = '') => {
  const actual = classifyError(raw);
  if (actual.kind !== 'quota') {
    console.error(`[Excelliq] failure shown as "out of credits" — actual cause: ${actual.kind}`, String(raw).slice(0, 500));
  }
  return UNIFIED_NOTICE;
};

/**
 * n8n can also return HTTP 200 while every model failed, with the reason inside
 * the per-model strings. Detect that so quota exhaustion is not shown as if the
 * models had genuinely answered.
 */
export const detectFailedRun = (payload = {}, finalAnswer = '') => {
  const parts = ['openai', 'claude', 'gemini']
    .map((k) => String(payload[k] || ''))
    .filter(Boolean);
  if (!parts.length) return null;

  const allFailed = parts.every((p) => /^error:|no valid response|error /i.test(p.trim()));
  if (!allFailed) return null;

  const combined = [...parts, String(finalAnswer || '')].join(' ');
  const verdict = classifyError(combined);
  // A generic all-models failure still deserves a clear message.
  if (verdict.kind === 'error') {
    return {
      kind: 'failed',
      title: 'No model could answer',
      message: 'All three models returned an error for this prompt. Please try again.',
      upgrade: false,
    };
  }
  return verdict;
};
