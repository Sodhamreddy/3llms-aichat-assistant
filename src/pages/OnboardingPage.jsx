import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGoogleLogin } from '@react-oauth/google';
import { supabase } from '../utils/supabase';
import { attachClientId, ensureClientId, loadStoredUser, saveStoredUser } from '../utils/clientIdentity';

// ── Brand system (matches the landing page design tokens) ───────────────
const PRIMARY   = '#0d46d8';   // brand blue
const BRAND_2   = '#1b67e8';   // brand blue (light stop)
const SECONDARY = '#132a63';   // brand ink
const BRAND_GRAD = `linear-gradient(135deg, ${PRIMARY} 0%, ${BRAND_2} 100%)`;
const SERIF = "'Instrument Serif', Georgia, serif";

// Google sign-in only works when a real OAuth client id is configured. When it's
// missing, Google's GSI script throws "Missing required parameter client_id",
// so we must not mount the Google login hook at all in that case.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GOOGLE_ENABLED = Boolean(GOOGLE_CLIENT_ID);

const MODEL_DEFS = [
  { key: 'openai', name: 'ChatGPT', color: SECONDARY, apiLabel: 'OpenAI API key', apiPlaceholder: 'sk-...', apiField: 'openai' },
  { key: 'claude', name: 'Claude', color: PRIMARY, apiLabel: 'Anthropic API key', apiPlaceholder: 'sk-ant-...', apiField: 'anthropic' },
  { key: 'gemini', name: 'Gemini', color: SECONDARY, apiLabel: 'Google API key', apiPlaceholder: 'AIza...', apiField: 'google' },
];

const inputStyle = {
  width: '100%',
  border: '1px solid #dce8ff',
  borderRadius: 12,
  padding: '0.82rem 0.95rem',
  fontSize: '0.92rem',
  outline: 'none',
  color: '#0f172a',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  background: '#ffffff',
};

const ghostButton = {
  border: '1px solid #dce8ff',
  borderRadius: 999,
  background: '#ffffff',
  color: '#0d46d8',
  padding: '0.85rem 1.3rem',
  fontWeight: 900,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

// ── Official multicolour Google "G" ───────────────────────────────────────
const GoogleIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden style={{ flexShrink: 0 }}>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

// ── Shell lives OUTSIDE the component so its reference never changes ──────
const useIsMobile = (bp = 768) => {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth <= bp);
  useEffect(() => {
    const fn = () => setM(window.innerWidth <= bp);
    fn();
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, [bp]);
  return m;
};

const Shell = ({ step, eyebrow, title, subtitle, children, actions, error, notice }) => {
  const isMobile = useIsMobile();
  return (
  <motion.div
    key={step}
    initial={{ opacity: 0, y: 18 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -12 }}
    transition={{ duration: 0.24 }}
    style={{ width: 'min(1060px, calc(100vw - 1.5rem))', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 22, boxShadow: '0 24px 70px rgba(15,23,42,0.11)', overflow: 'hidden' }}
  >
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '0.9fr 1.1fr', minHeight: isMobile ? 'auto' : 560 }}>
      <aside style={{ position: 'relative', background: `linear-gradient(150deg, ${SECONDARY} 10%, #0d46d8 130%)`, color: '#fff', padding: isMobile ? '1.6rem 1.4rem' : '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}>
        {/* animated background accents */}
        <motion.div
          animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.75, 0.5] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          style={{ position: 'absolute', top: -90, right: -70, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(27,103,232,0.5), transparent 70%)', pointerEvents: 'none' }}
        />
        <motion.div
          animate={{ scale: [1, 1.18, 1], opacity: [0.35, 0.55, 0.35] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          style={{ position: 'absolute', bottom: -100, left: -80, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(27,103,232,0.32), transparent 70%)', pointerEvents: 'none' }}
        />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '7px 12px', display: 'inline-flex', marginBottom: '1.75rem', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
            <img src="/logo%20new.svg" alt="Excelliq" style={{ height: 50, width: 'auto', maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
          </div>
          <div style={{ color: '#9fc1f5', fontSize: '0.74rem', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{eyebrow}</div>
          <h1 style={{ fontSize: '2.5rem', lineHeight: 1.08, margin: '0.65rem 0 0', fontFamily: SERIF, fontWeight: 400, letterSpacing: '-0.01em' }}>{title}</h1>
          <p style={{ color: '#cbd5e1', lineHeight: 1.65, marginTop: '1rem' }}>{subtitle}</p>
        </div>
      </aside>
      <section style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1 }}>{children}</div>
        {(error || notice) && (
          <div style={{ marginTop: '1rem' }}>
            {error  && <div style={{ color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '0.7rem 0.85rem', fontSize: '0.82rem', fontWeight: 800 }}>{error}</div>}
            {notice && <div style={{ color: PRIMARY, background: '#eef4ff', border: '1px solid #cfe0fb', borderRadius: 10, padding: '0.7rem 0.85rem', fontSize: '0.82rem', fontWeight: 800 }}>{notice}</div>}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.35rem' }}>{actions}</div>
      </section>
    </div>
  </motion.div>
  );
};

// ── Google button — isolates useGoogleLogin so the hook only mounts when a
//    client id exists (otherwise GSI throws and blanks the app) ──────────────
const GoogleAuthButton = ({ onSuccess, onError, busy }) => {
  const googleLogin = useGoogleLogin({
    onSuccess,
    onError,
    scope: 'openid email profile',
  });
  return (
    <button
      onClick={() => googleLogin()}
      disabled={busy}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#9ab4e0'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(15,23,42,0.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#dbe3ef'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(15,23,42,0.04)'; }}
      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11, border: '1px solid #dce8ff', borderRadius: 999, background: '#ffffff', color: '#1f2937', padding: '0.9rem 1.05rem', fontWeight: 800, fontSize: '0.95rem', cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: '0 1px 2px rgba(15,23,42,0.04)', transition: 'border-color 0.15s, box-shadow 0.15s' }}
    >
      <GoogleIcon /> Continue with Google
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const OnboardingPage = ({ onComplete }) => {
  const [step,          setStep]          = useState(1);
  const [authMode,      setAuthMode]      = useState('signup');
  const [clientId,      setClientId]      = useState(() => ensureClientId());
  const [name,          setName]          = useState('');
  const [email,         setEmail]         = useState('');
  const [password,      setPassword]      = useState('');
  const [showPassword,  setShowPassword]  = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [models,        setModels]        = useState({
    openai: { enabled: true, apiKey: '' },
    claude: { enabled: true, apiKey: '' },
    gemini: { enabled: true, apiKey: '' },
  });
  const [showKey, setShowKey] = useState({ openai: false, claude: false, gemini: false });
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState('');
  const [notice,  setNotice]  = useState('');

  const enabledModels = Object.keys(models).filter(key => models[key].enabled);

  const primaryButton = {
    border: 'none',
    borderRadius: 999,
    background: BRAND_GRAD,
    color: '#ffffff',
    padding: '0.85rem 1.5rem',
    fontWeight: 900,
    cursor: busy ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 1px 2px rgba(19,42,99,0.04), 0 8px 24px -12px rgba(13,70,216,0.6)',
  };

  const saveClient = (client = {}) => {
    const saved = attachClientId({ ...client, mode: 'api' });
    setClientId(saved.clientId);
    setName(saved.name || name);
    setEmail(saved.email || email);
    if (Array.isArray(saved.enabledModels) && saved.enabledModels.length) {
      setModels(prev => Object.fromEntries(Object.entries(prev).map(([key, value]) => [
        key,
        { ...value, enabled: saved.enabledModels.includes(key) },
      ])));
    }
    saveStoredUser(saved);
    return saved;
  };

  // Finalise onboarding straight after auth — keys are added later in Settings.
  const completeOnboarding = (client = {}) => {
    const completedUser = attachClientId({
      ...client,
      clientId: client.clientId || clientId,
      mode: 'api',
      enabledModels: Array.isArray(client.enabledModels) && client.enabledModels.length ? client.enabledModels : ['openai', 'claude', 'gemini'],
      onboardingComplete: true,
    });
    saveStoredUser(completedUser);
    onComplete(completedUser);
  };

  // ── Google OAuth — get profile directly from Google, no backend needed ──
  const completeGoogleAuth = async (tokenResponse) => {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      // Fetch user profile from Google userinfo endpoint
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
      });
      if (!profileRes.ok) throw new Error('Failed to get Google profile.');
      const profile = await profileRes.json();

      const googleUser = {
        name:  profile.name  || profile.given_name || '',
        email: profile.email || '',
        googleId: profile.sub,
        picture:  profile.picture || '',
        clientId,
      };

      const saved = saveClient(googleUser);
      setName(googleUser.name);
      setEmail(googleUser.email);

      completeOnboarding(saved);
    } catch (e) {
      setError(e.message || 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const submitAuth = async () => {
    setError('');
    setNotice('');
    const cleanName  = name.trim();
    const cleanEmail = email.trim();
    if (authMode === 'signup' && !cleanName)   return setError('Enter your display name.');
    if (!cleanEmail)                            return setError('Enter your email address.');
    if (password.length < 6)                   return setError('Password must be at least 6 characters.');
    if (authMode === 'signup' && !agreedToTerms) return setError('Please agree to the Terms of use and Privacy Policy.');

    if (!supabase) return setError('Authentication is not configured. Please contact support.');

    setBusy(true);
    try {
      if (authMode === 'login') {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (authError) throw new Error(authError.message);

        const stored = loadStoredUser();
        const saved = saveClient({
          ...stored,
          clientId,
          name:  data.user?.user_metadata?.name || stored.name || cleanName,
          email: data.user?.email || cleanEmail,
        });
        completeOnboarding(saved);
        return;
      }

      // signup
      const { error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { name: cleanName } },
      });
      if (authError) throw new Error(authError.message);

      const saved = saveClient({ clientId, name: cleanName, email: cleanEmail });
      completeOnboarding(saved);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const sendPasswordReset = async () => {
    setError('');
    setNotice('');
    if (!email.trim()) return setError('Enter your email first.');
    if (!supabase) return setError('Authentication is not configured. Please contact support.');
    setBusy(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw new Error(resetError.message);
      setNotice('Password reset email sent. Check your inbox.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleModel = (key) => {
    setModels(prev => {
      const next = { ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } };
      return Object.values(next).some(m => m.enabled) ? next : prev;
    });
  };

  const finishSetup = async () => {
    setError('');
    if (!enabledModels.length) return setError('Select at least one provider.');

    const apiKeys = {};
    MODEL_DEFS.forEach(model => {
      const key = models[model.key].apiKey.trim();
      if (key) apiKeys[model.apiField] = key;
    });

    const completedUser = attachClientId({
      clientId,
      name:  name.trim(),
      email: email.trim(),
      mode:  'api',
      apiKeys,
      enabledModels,
      onboardingComplete: true,
    });

    saveStoredUser(completedUser);
    onComplete(completedUser);
  };

  const renderStep = () => {
    if (step === 1) {
      const isLogin = authMode === 'login';
      return (
        <Shell
          step={step}
          eyebrow="Welcome"
          title={isLogin ? 'Log in to Excelliq' : 'Create your account'}
          subtitle="Use Excelliq with your own provider API keys — three models, one synthesised answer."
          error={error}
          notice={notice}
          actions={<button onClick={submitAuth} disabled={busy} style={primaryButton}>{busy ? 'Please wait...' : isLogin ? 'Log in' : 'Sign up'}</button>}
        >
          <div style={{ display: 'grid', gap: '0.85rem', maxWidth: 430 }}>
            {GOOGLE_ENABLED && (
              <>
                <GoogleAuthButton
                  onSuccess={completeGoogleAuth}
                  onError={() => setError('Google sign-in was cancelled or failed.')}
                  busy={busy}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#94a3b8', fontSize: '0.74rem', fontWeight: 800, margin: '0.15rem 0' }}>
                  <span style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                  OR
                  <span style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                </div>
              </>
            )}
            {!isLogin && (
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Display name"
                style={inputStyle}
              />
            )}
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email address"
              style={inputStyle}
            />
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                style={{ ...inputStyle, paddingRight: 72 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{ position: 'absolute', right: 8, top: 8, border: 'none', background: '#f8fafc', color: '#64748b', borderRadius: 8, padding: '0.42rem 0.6rem', fontWeight: 800, cursor: 'pointer' }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {!isLogin && (
              <label style={{ display: 'flex', gap: 9, color: '#64748b', fontSize: '0.82rem', lineHeight: 1.5 }}>
                <input type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} />
                I agree to the Terms of use and Privacy Policy.
              </label>
            )}
            {isLogin && (
              <button type="button" onClick={sendPasswordReset} style={{ border: 'none', background: 'none', color: PRIMARY, fontWeight: 800, textAlign: 'left', cursor: 'pointer' }}>
                Forgot password?
              </button>
            )}
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                onClick={() => { setAuthMode(isLogin ? 'signup' : 'login'); setError(''); setNotice(''); }}
                style={{ border: 'none', background: 'none', color: PRIMARY, fontWeight: 800, cursor: 'pointer', padding: 0 }}
              >
                {isLogin ? 'Sign up' : 'Log in'}
              </button>
            </p>
          </div>
        </Shell>
      );
    }

    if (step === 2) {
      return (
        <Shell
          step={step}
          eyebrow="API setup"
          title="Add provider keys"
          subtitle="Keys are stored in this browser and sent directly to each provider with every request."
          error={error}
          notice={notice}
          actions={
            <>
              <button onClick={() => setStep(1)} style={ghostButton}>Back</button>
              <button onClick={() => setStep(3)} style={primaryButton}>Review setup</button>
            </>
          }
        >
          <div style={{ display: 'grid', gap: '0.8rem' }}>
            {MODEL_DEFS.map(model => {
              const state = models[model.key];
              return (
                <div key={model.key} style={{ border: `1.5px solid ${state.enabled ? model.color + '40' : '#e5e7eb'}`, borderRadius: 14, padding: '0.95rem', background: state.enabled ? `${model.color}06` : '#fafafa', display: 'grid', gap: '0.7rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: model.color }} />
                    <strong style={{ flex: 1 }}>{model.name}</strong>
                    <button onClick={() => toggleModel(model.key)} style={{ width: 42, height: 24, borderRadius: 999, border: 'none', background: state.enabled ? model.color : '#cbd5e1', padding: 3, cursor: 'pointer' }}>
                      <span style={{ display: 'block', width: 18, height: 18, borderRadius: '50%', background: '#fff', transform: state.enabled ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 0.18s' }} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type={showKey[model.key] ? 'text' : 'password'}
                      value={state.apiKey}
                      disabled={!state.enabled}
                      onChange={e => setModels(prev => ({ ...prev, [model.key]: { ...prev[model.key], apiKey: e.target.value } }))}
                      placeholder={model.apiPlaceholder}
                      style={{ ...inputStyle, fontFamily: 'monospace', opacity: state.enabled ? 1 : 0.55 }}
                    />
                    <button onClick={() => setShowKey(prev => ({ ...prev, [model.key]: !prev[model.key] }))} style={ghostButton}>
                      {showKey[model.key] ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Shell>
      );
    }

    return (
      <Shell
        step={step}
        eyebrow="Review"
        title="You're all set"
        subtitle="Your workspace is configured for API Mode. You can update keys later from Integrations or Settings."
        error={error}
        notice={notice}
        actions={
          <>
            <button onClick={() => setStep(2)} style={ghostButton}>Back</button>
            <button onClick={finishSetup} style={primaryButton}>Start chatting</button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: '0.8rem' }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
            {[['Name', name], ['Email', email], ['Mode', 'API Mode']].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b', fontWeight: 800 }}>{label}</span>
                <span style={{ color: '#0f172a', fontWeight: 900 }}>{value}</span>
              </div>
            ))}
          </div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
            {MODEL_DEFS.map(model => {
              const enabled = enabledModels.includes(model.key);
              const hasKey  = Boolean(models[model.key].apiKey.trim());
              return (
                <div key={model.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#0f172a', fontWeight: 800 }}>{model.name}</span>
                  <span style={{ color: enabled ? PRIMARY : '#94a3b8', fontWeight: 900 }}>{enabled ? (hasKey ? 'Key added' : 'Enabled') : 'Disabled'}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Shell>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f4f0', fontFamily: 'Inter, system-ui, sans-serif', display: 'grid', placeItems: 'center', padding: '1rem' }}>
      <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>
    </div>
  );
};

export default OnboardingPage;
