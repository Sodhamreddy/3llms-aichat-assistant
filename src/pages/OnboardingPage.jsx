import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGoogleLogin } from '@react-oauth/google';
import { API_SERVER } from '../config/api';
import { attachClientId, ensureClientId, saveStoredUser } from '../utils/clientIdentity';

const MODEL_DEFS = [
  { key: 'openai', name: 'ChatGPT', color: '#10a37f', apiLabel: 'OpenAI API key', apiPlaceholder: 'sk-...', apiField: 'openai' },
  { key: 'claude', name: 'Claude', color: '#d97757', apiLabel: 'Anthropic API key', apiPlaceholder: 'sk-ant-...', apiField: 'anthropic' },
  { key: 'gemini', name: 'Gemini', color: '#4285f4', apiLabel: 'Google API key', apiPlaceholder: 'AIza...', apiField: 'google' },
];

const MotionDiv = motion.div;

const OnboardingPage = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [authMode, setAuthMode] = useState('signup');
  const [clientId, setClientId] = useState(() => ensureClientId());
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [models, setModels] = useState({
    openai: { enabled: true, apiKey: '' },
    claude: { enabled: true, apiKey: '' },
    gemini: { enabled: true, apiKey: '' },
  });
  const [showKey, setShowKey] = useState({ openai: false, claude: false, gemini: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const enabledModels = Object.keys(models).filter(key => models[key].enabled);

  const inputStyle = {
    width: '100%',
    border: '1px solid #dbe3ef',
    borderRadius: 10,
    padding: '0.82rem 0.95rem',
    fontSize: '0.92rem',
    outline: 'none',
    color: '#0f172a',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    background: '#ffffff',
  };

  const primaryButton = {
    border: 'none',
    borderRadius: 12,
    background: 'linear-gradient(135deg, #d97757, #e8896a)',
    color: '#ffffff',
    padding: '0.85rem 1.15rem',
    fontWeight: 900,
    cursor: busy ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 8px 24px rgba(217,119,87,0.22)',
  };

  const ghostButton = {
    border: '1px solid #dbe3ef',
    borderRadius: 12,
    background: '#ffffff',
    color: '#334155',
    padding: '0.85rem 1.05rem',
    fontWeight: 900,
    cursor: 'pointer',
    fontFamily: 'inherit',
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

  const completeGoogleAuth = async (tokenResponse) => {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const res = await fetch(`${API_SERVER}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: tokenResponse.access_token, clientId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Google sign-in failed.');
      const saved = saveClient(data.client);
      if (saved.onboardingComplete) {
        onComplete({ ...saved, onboardingComplete: true });
        return;
      }
      setStep(2);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: completeGoogleAuth,
    onError: () => setError('Google sign-in was cancelled or failed.'),
    scope: 'openid email profile',
  });

  const submitAuth = async () => {
    setError('');
    setNotice('');
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    if (authMode === 'signup' && !cleanName) return setError('Enter your display name.');
    if (!cleanEmail) return setError('Enter your email address.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (authMode === 'signup' && !agreedToTerms) return setError('Please agree to the Terms of use and Privacy Policy.');

    setBusy(true);
    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/signup/start';
      const res = await fetch(`${API_SERVER}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, name: cleanName, email: cleanEmail, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Authentication failed.');
      const saved = saveClient(data.client);
      if (authMode === 'login' && saved.onboardingComplete) {
        onComplete({ ...saved, onboardingComplete: true });
        return;
      }
      setStep(2);
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
    setBusy(true);
    try {
      const res = await fetch(`${API_SERVER}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Unable to send reset email.');
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
      return Object.values(next).some(model => model.enabled) ? next : prev;
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
      name: name.trim(),
      email: email.trim(),
      mode: 'api',
      apiKeys,
      enabledModels,
      onboardingComplete: true,
    });

    await fetch(`${API_SERVER}/auth/preferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, name: name.trim(), email: email.trim(), mode: 'api', enabledModels }),
    }).catch(() => {});

    saveStoredUser(completedUser);
    onComplete(completedUser);
  };

  const Shell = ({ eyebrow, title, subtitle, children, actions }) => (
    <MotionDiv
      key={step}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.24 }}
      style={{ width: 'min(1060px, calc(100vw - 2rem))', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 22, boxShadow: '0 24px 70px rgba(15,23,42,0.11)', overflow: 'hidden' }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', minHeight: 560 }}>
        <aside style={{ background: 'linear-gradient(135deg, #111827, #2f3545)', color: '#fff', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #d97757, #e8896a)', display: 'grid', placeItems: 'center', fontWeight: 900, marginBottom: '1.35rem' }}>K</div>
            <div style={{ color: '#fed7aa', fontSize: '0.74rem', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{eyebrow}</div>
            <h1 style={{ fontSize: '2rem', lineHeight: 1.1, margin: '0.65rem 0 0' }}>{title}</h1>
            <p style={{ color: '#cbd5e1', lineHeight: 1.65, marginTop: '1rem' }}>{subtitle}</p>
          </div>
          <div style={{ display: 'grid', gap: 9, fontSize: '0.86rem', color: '#e5e7eb' }}>
            <span>API Mode only</span>
            <span>n8n workflow orchestration</span>
            <span>Claude final synthesis</span>
          </div>
        </aside>
        <section style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>{children}</div>
          {(error || notice) && (
            <div style={{ marginTop: '1rem' }}>
              {error && <div style={{ color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '0.7rem 0.85rem', fontSize: '0.82rem', fontWeight: 800 }}>{error}</div>}
              {notice && <div style={{ color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, padding: '0.7rem 0.85rem', fontSize: '0.82rem', fontWeight: 800 }}>{notice}</div>}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.35rem' }}>{actions}</div>
        </section>
      </div>
    </MotionDiv>
  );

  const renderStep = () => {
    if (step === 1) {
      const isLogin = authMode === 'login';
      return (
        <Shell
          eyebrow="Welcome"
          title={isLogin ? 'Log in to Excelliq' : 'Create your account'}
          subtitle="Use Excelliq with provider API keys routed through the configured n8n workflow."
          actions={<button onClick={submitAuth} disabled={busy} style={primaryButton}>{busy ? 'Please wait...' : isLogin ? 'Log in' : 'Sign up'}</button>}
        >
          <div style={{ display: 'grid', gap: '0.85rem', maxWidth: 430 }}>
            <button onClick={() => googleLogin()} disabled={busy} style={{ ...ghostButton, width: '100%' }}>Continue with Google</button>
            {!isLogin && <input value={name} onChange={e => setName(e.target.value)} placeholder="Display name" style={inputStyle} />}
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" style={inputStyle} />
            <div style={{ position: 'relative' }}>
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" style={{ ...inputStyle, paddingRight: 72 }} />
              <button type="button" onClick={() => setShowPassword(value => !value)} style={{ position: 'absolute', right: 8, top: 8, border: 'none', background: '#f8fafc', color: '#64748b', borderRadius: 8, padding: '0.42rem 0.6rem', fontWeight: 800, cursor: 'pointer' }}>{showPassword ? 'Hide' : 'Show'}</button>
            </div>
            {!isLogin && (
              <label style={{ display: 'flex', gap: 9, color: '#64748b', fontSize: '0.82rem', lineHeight: 1.5 }}>
                <input type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} />
                I agree to the Terms of use and Privacy Policy.
              </label>
            )}
            {isLogin && <button type="button" onClick={sendPasswordReset} style={{ border: 'none', background: 'none', color: '#2563eb', fontWeight: 800, textAlign: 'left', cursor: 'pointer' }}>Forgot password?</button>}
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button type="button" onClick={() => { setAuthMode(isLogin ? 'signup' : 'login'); setError(''); setNotice(''); }} style={{ border: 'none', background: 'none', color: '#2563eb', fontWeight: 800, cursor: 'pointer', padding: 0 }}>
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
          eyebrow="API setup"
          title="Add provider keys"
          subtitle="Keys are stored in this browser and sent to the n8n workflow with each request."
          actions={<><button onClick={() => setStep(1)} style={ghostButton}>Back</button><button onClick={() => setStep(3)} style={primaryButton}>Review setup</button></>}
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
                    <button onClick={() => setShowKey(prev => ({ ...prev, [model.key]: !prev[model.key] }))} style={ghostButton}>{showKey[model.key] ? 'Hide' : 'Show'}</button>
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
        eyebrow="Review"
        title="You're all set"
        subtitle="Your workspace is configured for API Mode. You can update keys later from Integrations or Settings."
        actions={<><button onClick={() => setStep(2)} style={ghostButton}>Back</button><button onClick={finishSetup} style={primaryButton}>Start chatting</button></>}
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
              const hasKey = Boolean(models[model.key].apiKey.trim());
              return (
                <div key={model.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#0f172a', fontWeight: 800 }}>{model.name}</span>
                  <span style={{ color: enabled ? '#047857' : '#94a3b8', fontWeight: 900 }}>{enabled ? (hasKey ? 'Key added' : 'Enabled') : 'Disabled'}</span>
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
