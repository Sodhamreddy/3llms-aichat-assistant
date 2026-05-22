import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PLAYWRIGHT_SERVER } from '../config/api';
import { attachClientId, ensureClientId, saveStoredUser } from '../utils/clientIdentity';

const MODEL_DEFS = [
  { key: 'openai', name: 'ChatGPT', color: '#10a37f', apiLabel: 'OpenAI API key', apiPlaceholder: 'sk-...', apiField: 'openai' },
  { key: 'claude', name: 'Claude', color: '#d97757', apiLabel: 'Anthropic API key', apiPlaceholder: 'sk-ant-...', apiField: 'anthropic' },
  { key: 'gemini', name: 'Gemini', color: '#4285f4', apiLabel: 'Google API key', apiPlaceholder: 'AIza...', apiField: 'google' },
];

const stepTitles = ['Account', 'Verify', 'Flow', 'Mode', 'Connect', 'Review'];
const MotionDiv = motion.div;

const OnboardingPage = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [authMode, setAuthMode] = useState('signup');
  const [clientId, setClientId] = useState(() => ensureClientId());
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState('browser');
  const [models, setModels] = useState({
    openai: { enabled: true, apiKey: '' },
    claude: { enabled: true, apiKey: '' },
    gemini: { enabled: true, apiKey: '' },
  });
  const [browserAuth, setBrowserAuth] = useState({ openai: false, claude: false, gemini: false });
  const [showKey, setShowKey] = useState({ openai: false, claude: false, gemini: false });
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [subscribeNewsletter, setSubscribeNewsletter] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [remoteBrowser, setRemoteBrowser] = useState({
    open: false,
    provider: null,
    loading: false,
    image: '',
    title: '',
    url: '',
    error: '',
    viewport: { width: 1280, height: 800 },
  });
  const remoteActionQueueRef = useRef(Promise.resolve());

  const enabledModels = Object.keys(models).filter(key => models[key].enabled);
  const remoteProvider = MODEL_DEFS.find(model => model.key === remoteBrowser.provider);

  const applyAuthenticatedClient = (client = {}) => {
    const saved = attachClientId(client);
    setClientId(saved.clientId);
    setName(saved.name || name);
    setEmail(saved.email || email);
    if (saved.mode) setMode(saved.mode);
    if (Array.isArray(saved.enabledModels) && saved.enabledModels.length) {
      setModels(prev => Object.fromEntries(
        Object.entries(prev).map(([key, value]) => [
          key,
          { ...value, enabled: saved.enabledModels.includes(key) },
        ])
      ));
    }
    saveStoredUser(saved);
    return saved;
  };

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
      if (authMode === 'login') {
        const res = await fetch(`${PLAYWRIGHT_SERVER}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Login failed.');
        const saved = applyAuthenticatedClient({ ...data.client, onboardingComplete: true });
        onComplete({ ...saved, onboardingComplete: true });
        return;
      }

      const res = await fetch(`${PLAYWRIGHT_SERVER}/auth/signup/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, name: cleanName, email: cleanEmail, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Signup failed.');

      if (data.requiresVerification === false && data.client) {
        applyAuthenticatedClient(data.client);
        setStep(3);
        return;
      }

      if (data.clientId) setClientId(data.clientId);
      setNotice(`Verification code sent to ${cleanEmail}.`);
      setStep(2);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const verifySignup = async () => {
    setError('');
    setNotice('');
    if (!code.trim()) return setError('Enter the verification code from your email.');
    setBusy(true);
    try {
      const res = await fetch(`${PLAYWRIGHT_SERVER}/auth/signup/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, name: name.trim(), email: email.trim(), password, code: code.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Verification failed.');
      applyAuthenticatedClient(data.client);
      setMode('browser');
      setStep(3);
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
      const res = await fetch(`${PLAYWRIGHT_SERVER}/auth/forgot-password`, {
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

  const resendCode = async () => {
    setStep(1);
    setTimeout(() => submitAuth(), 0);
  };

  const toggleModel = (key) => {
    setModels(prev => {
      const next = { ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } };
      return Object.values(next).some(model => model.enabled) ? next : prev;
    });
    setError('');
  };

  const remoteEndpoint = useCallback((provider, action) =>
    `${PLAYWRIGHT_SERVER}/client/${encodeURIComponent(clientId)}/remote-browser/${encodeURIComponent(provider)}/${action}`,
    [clientId]
  );

  const applyRemoteSnapshot = (data) => {
    setRemoteBrowser(prev => ({
      ...prev,
      loading: false,
      error: '',
      image: data.image ? `data:image/jpeg;base64,${data.image}` : prev.image,
      title: data.title || '',
      url: data.url || '',
      viewport: data.viewport || prev.viewport,
    }));
  };

  const openRemoteLogin = async (provider) => {
    const model = MODEL_DEFS.find(item => item.key === provider);
    setRemoteBrowser(prev => ({ ...prev, open: true, provider, loading: true, image: '', title: model?.name || '', url: '', error: '' }));
    try {
      const res = await fetch(remoteEndpoint(provider, 'open'), { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      applyRemoteSnapshot(data);
    } catch (e) {
      setRemoteBrowser(prev => ({ ...prev, loading: false, error: e.message }));
    }
  };

  const refreshRemoteLogin = async () => {
    if (!remoteBrowser.provider) return;
    try {
      const res = await fetch(remoteEndpoint(remoteBrowser.provider, 'screenshot'));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      applyRemoteSnapshot(data);
    } catch (e) {
      setRemoteBrowser(prev => ({ ...prev, error: e.message }));
    }
  };

  const sendRemoteAction = async (action) => {
    const provider = remoteBrowser.provider;
    if (!provider || remoteBrowser.loading) return;
    remoteActionQueueRef.current = remoteActionQueueRef.current.then(async () => {
      const res = await fetch(remoteEndpoint(provider, 'action'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      applyRemoteSnapshot(data);
    }).catch(e => setRemoteBrowser(prev => ({ ...prev, error: e.message })));
  };

  const closeRemoteLogin = async () => {
    const provider = remoteBrowser.provider;
    setRemoteBrowser(prev => ({ ...prev, open: false, provider: null, image: '', error: '' }));
    if (provider) await fetch(remoteEndpoint(provider, 'close'), { method: 'POST' }).catch(() => {});
  };

  const finishRemoteLogin = async () => {
    const provider = remoteBrowser.provider;
    if (!provider) return;
    setRemoteBrowser(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const res = await fetch(remoteEndpoint(provider, 'finish'), { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      if (!data.ok) throw new Error(data.message || 'Login was not detected yet.');
      setBrowserAuth(prev => ({ ...prev, [provider]: true }));
      setRemoteBrowser(prev => ({ ...prev, open: false, provider: null, loading: false, image: '' }));
    } catch (e) {
      setRemoteBrowser(prev => ({ ...prev, loading: false, error: e.message }));
    }
  };

  useEffect(() => {
    if (!remoteBrowser.open || !remoteBrowser.provider) return undefined;
    let active = true;
    let busyPoll = false;
    const poll = async () => {
      if (busyPoll) return;
      busyPoll = true;
      try {
        const res = await fetch(remoteEndpoint(remoteBrowser.provider, 'screenshot'));
        const data = await res.json();
        if (active && res.ok) applyRemoteSnapshot(data);
      } catch {
        // Remote browser polling is best effort.
      }
      busyPoll = false;
    };
    const id = setInterval(poll, 1500);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [remoteBrowser.open, remoteBrowser.provider, remoteEndpoint]);

  const getRemotePoint = (e) => {
    if (!remoteBrowser.image) return null;
    const rect = e.currentTarget.getBoundingClientRect();
    const viewport = remoteBrowser.viewport;
    const imageRatio = viewport.width / viewport.height;
    const boxRatio = rect.width / rect.height;
    let imageWidth = rect.width;
    let imageHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;
    if (boxRatio > imageRatio) {
      imageWidth = rect.height * imageRatio;
      offsetX = (rect.width - imageWidth) / 2;
    } else {
      imageHeight = rect.width / imageRatio;
      offsetY = (rect.height - imageHeight) / 2;
    }
    const localX = e.clientX - rect.left - offsetX;
    const localY = e.clientY - rect.top - offsetY;
    if (localX < 0 || localY < 0 || localX > imageWidth || localY > imageHeight) return null;
    return { x: (localX / imageWidth) * viewport.width, y: (localY / imageHeight) * viewport.height };
  };

  const finishSetup = async () => {
    setError('');
    if (!enabledModels.length) return setError('Select at least one provider.');
    if (mode === 'browser') {
      const missing = enabledModels.filter(key => !browserAuth[key]);
      if (missing.length) {
        const names = MODEL_DEFS.filter(model => missing.includes(model.key)).map(model => model.name).join(', ');
        return setError(`Connect ${names} before finishing Browser Mode setup.`);
      }
    }

    const apiKeys = {};
    MODEL_DEFS.forEach(model => {
      const key = models[model.key].apiKey.trim();
      if (key) apiKeys[model.apiField] = key;
    });
    const completedUser = attachClientId({
      clientId,
      name: name.trim(),
      email: email.trim(),
      mode,
      apiKeys,
      enabledModels,
      onboardingComplete: true,
    });

    await fetch(`${PLAYWRIGHT_SERVER}/auth/preferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, name: name.trim(), email: email.trim(), mode, enabledModels }),
    }).catch(() => {});
    onComplete(completedUser);
  };

  const inputStyle = {
    width: '100%',
    border: '1px solid #dbe3ef',
    borderRadius: 12,
    padding: '0.85rem 1rem',
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
    padding: '0.85rem 1.2rem',
    fontWeight: 800,
    fontFamily: 'inherit',
    cursor: busy ? 'not-allowed' : 'pointer',
    boxShadow: '0 8px 24px rgba(217,119,87,0.22)',
  };

  const ghostButton = {
    border: '1px solid #dbe3ef',
    borderRadius: 12,
    background: '#ffffff',
    color: '#334155',
    padding: '0.85rem 1.1rem',
    fontWeight: 800,
    fontFamily: 'inherit',
    cursor: 'pointer',
  };

  const OrbLeft = () => (
    <div style={{
      width: '42%', minWidth: 300, flexShrink: 0, position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(135deg, #8ecdd4 0%, #9ac8ce 20%, #a0bfc4 38%, #c8a898 60%, #e8a882 78%, #f0b890 100%)',
    }}>
      <div style={{ position: 'absolute', top: '42%', left: '50%', transform: 'translate(-50%, -50%)', width: '90%', height: '70%', background: 'radial-gradient(ellipse at center, rgba(240,160,120,0.55) 0%, rgba(200,130,100,0.3) 45%, transparent 75%)', filter: 'blur(28px)' }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '68%', paddingBottom: '68%', borderRadius: '50%', background: `radial-gradient(circle at 38% 36%, rgba(255,255,255,0.92) 0%, rgba(245,185,170,0.85) 14%, rgba(220,148,140,0.78) 28%, rgba(185,155,195,0.7) 42%, rgba(140,175,195,0.65) 58%, rgba(110,175,185,0.6) 72%, rgba(90,160,175,0.55) 86%, rgba(80,145,158,0.5) 100%)`, boxShadow: '0 0 0 1px rgba(255,255,255,0.18), 0 30px 80px rgba(160,110,90,0.35), inset 0 -20px 60px rgba(90,160,175,0.25), inset 0 10px 30px rgba(255,255,255,0.3)' }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-58%, -62%)', width: '28%', paddingBottom: '18%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(255,255,255,0.65) 0%, transparent 70%)', filter: 'blur(6px)' }} />
      <div style={{ position: 'absolute', top: 28, left: 28, display: 'flex', alignItems: 'center', gap: 10, zIndex: 2 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #7c3aed, #2563eb)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: '1rem' }}>K</div>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.01em', textShadow: '0 1px 6px rgba(0,0,0,0.25)' }}>Kleza TriMind AI</span>
      </div>
    </div>
  );

  const StepProgress = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '1.4rem 2.5rem 0' }}>
      {stepTitles.map((label, index) => {
        const s = index + 1;
        const done = s < step;
        const current = s === step;
        const upcoming = s > step;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: current ? 22 : 8, height: 8, borderRadius: 99, background: done ? '#d97757' : current ? '#d97757' : '#e2e8f0', transition: 'all 0.25s', boxShadow: current ? '0 0 0 3px rgba(217,119,87,0.15)' : 'none' }} />
              {current && <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#d97757', whiteSpace: 'nowrap' }}>{label}</span>}
            </div>
            {index < stepTitles.length - 1 && <div style={{ width: 16, height: 1, background: s < step ? '#d97757' : '#e2e8f0' }} />}
          </div>
        );
      })}
    </div>
  );

  const SplitShell = ({ eyebrow, title, subtitle, children, actions }) => (
    <MotionDiv
      key={step}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.26, ease: 'easeOut' }}
      style={{ position: 'fixed', inset: 0, display: 'flex', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <OrbLeft />
      <div style={{ flex: 1, background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <StepProgress />
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2.5rem 1rem' }}>
          {eyebrow && <div style={{ color: '#d97757', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8 }}>{eyebrow}</div>}
          <h1 style={{ margin: '0 0 0.35rem', fontSize: 'clamp(1.3rem, 2.5vw, 1.75rem)', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>{title}</h1>
          <p style={{ margin: '0 0 1.4rem', color: '#64748b', fontSize: '0.87rem', lineHeight: 1.6 }}>{subtitle}</p>
          {children}
        </div>
        <div style={{ flexShrink: 0, padding: '0.85rem 2.5rem 1.4rem', borderTop: '1px solid #f1f5f9' }}>
          {error && <div style={{ color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.6rem 0.8rem', fontSize: '0.79rem', fontWeight: 600, marginBottom: '0.75rem' }}>{error}</div>}
          {notice && <div style={{ color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: '0.6rem 0.8rem', fontSize: '0.79rem', fontWeight: 600, marginBottom: '0.75rem' }}>{notice}</div>}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>{actions}</div>
        </div>
      </div>
    </MotionDiv>
  );

  const renderStep = () => {
    if (step === 1) {
      const isLogin = authMode === 'login';
      const formValid = isLogin
        ? email.trim() && password.length >= 6
        : name.trim() && email.trim() && password.length >= 8 && agreedToTerms;

      return (
        <MotionDiv
          key="step1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{ position: 'fixed', inset: 0, display: 'flex', fontFamily: 'Inter, system-ui, sans-serif' }}
        >
          {/* ── Left: orb panel ── */}
          <div style={{
            width: '45%', minWidth: 320, flexShrink: 0, position: 'relative', overflow: 'hidden',
            background: 'linear-gradient(135deg, #8ecdd4 0%, #9ac8ce 20%, #a0bfc4 38%, #c8a898 60%, #e8a882 78%, #f0b890 100%)',
          }}>
            {/* Ambient glow behind orb */}
            <div style={{
              position: 'absolute', top: '42%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '90%', height: '70%',
              background: 'radial-gradient(ellipse at center, rgba(240,160,120,0.55) 0%, rgba(200,130,100,0.3) 45%, transparent 75%)',
              filter: 'blur(28px)',
            }} />

            {/* Orb sphere */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '68%', paddingBottom: '68%',
              borderRadius: '50%',
              background: `
                radial-gradient(circle at 38% 36%,
                  rgba(255,255,255,0.92) 0%,
                  rgba(245,185,170,0.85) 14%,
                  rgba(220,148,140,0.78) 28%,
                  rgba(185,155,195,0.7) 42%,
                  rgba(140,175,195,0.65) 58%,
                  rgba(110,175,185,0.6) 72%,
                  rgba(90,160,175,0.55) 86%,
                  rgba(80,145,158,0.5) 100%
                )
              `,
              boxShadow: `
                0 0 0 1px rgba(255,255,255,0.18),
                0 30px 80px rgba(160,110,90,0.35),
                inset 0 -20px 60px rgba(90,160,175,0.25),
                inset 0 10px 30px rgba(255,255,255,0.3)
              `,
            }} />

            {/* Soft specular highlight */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-58%, -62%)',
              width: '28%', paddingBottom: '18%',
              borderRadius: '50%',
              background: 'radial-gradient(ellipse, rgba(255,255,255,0.65) 0%, transparent 70%)',
              filter: 'blur(6px)',
            }} />

            {/* Logo top-left */}
            <div style={{ position: 'absolute', top: 28, left: 28, display: 'flex', alignItems: 'center', gap: 10, zIndex: 2 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #7c3aed, #2563eb)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: '1rem' }}>K</div>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.01em', textShadow: '0 1px 6px rgba(0,0,0,0.25)' }}>Kleza TriMind AI</span>
            </div>
          </div>

          {/* ── Right: form panel ── */}
          <div style={{
            flex: 1, background: '#ffffff', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '2.5rem clamp(1.5rem, 6vw, 4.5rem)',
            overflowY: 'auto',
          }}>
            <div style={{ width: '100%', maxWidth: 400 }}>
              <h1 style={{ margin: '0 0 0.35rem', fontSize: 'clamp(1.5rem, 3vw, 1.9rem)', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>
                {isLogin ? 'Log in' : 'Sign up'}
              </h1>
              <p style={{ margin: '0 0 1.75rem', color: '#64748b', fontSize: '0.88rem', lineHeight: 1.55 }}>
                {isLogin ? 'Welcome back. Log in to your Kleza TriMind account.' : 'Sign up for free to access to any of our products'}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Display name — signup only */}
                {!isLogin && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Display name</label>
                    <input
                      value={name} onChange={e => setName(e.target.value)}
                      placeholder="Your name"
                      style={{ ...inputStyle, border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '0.7rem 0.9rem' }}
                    />
                  </div>
                )}

                {/* Email */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Email address</label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    style={{ ...inputStyle, border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '0.7rem 0.9rem' }}
                  />
                </div>

                {/* Password */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>Password</label>
                    <button onClick={() => setShowPassword(p => !p)} type="button" style={{ border: 'none', background: 'none', color: '#64748b', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {showPassword
                          ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                          : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                        }
                      </svg>
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={isLogin ? '••••••••' : 'Create a password'}
                    style={{ ...inputStyle, border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '0.7rem 0.9rem' }}
                  />
                  {!isLogin && (
                    <p style={{ margin: '5px 0 0', fontSize: '0.74rem', color: '#94a3b8' }}>
                      Use 8 or more characters with a mix of letters, numbers &amp; symbols
                    </p>
                  )}
                </div>

                {/* Checkboxes — signup only */}
                {!isLogin && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                      <input
                        type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)}
                        style={{ marginTop: 2, accentColor: '#d97757', width: 15, height: 15, flexShrink: 0 }}
                      />
                      <span style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 }}>
                        Agree to our{' '}
                        <span style={{ color: '#2563eb', textDecoration: 'underline', cursor: 'pointer' }}>Terms of use</span>
                        {' '}and{' '}
                        <span style={{ color: '#2563eb', textDecoration: 'underline', cursor: 'pointer' }}>Privacy Policy</span>
                      </span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <input
                        type="checkbox" checked={subscribeNewsletter} onChange={e => setSubscribeNewsletter(e.target.checked)}
                        style={{ accentColor: '#d97757', width: 15, height: 15, flexShrink: 0 }}
                      />
                      <span style={{ fontSize: '0.82rem', color: '#475569' }}>Subscribe to our monthly newsletter</span>
                    </label>
                  </div>
                )}

                {/* Forgot password — login only */}
                {isLogin && (
                  <button onClick={sendPasswordReset} disabled={busy} type="button" style={{ border: 'none', background: 'none', color: '#2563eb', fontWeight: 600, cursor: 'pointer', textAlign: 'right', padding: 0, fontFamily: 'inherit', fontSize: '0.82rem' }}>
                    Forgot password?
                  </button>
                )}

                {/* Error / Notice */}
                {error && <div style={{ color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.65rem 0.8rem', fontSize: '0.8rem', fontWeight: 600 }}>{error}</div>}
                {notice && <div style={{ color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: '0.65rem 0.8rem', fontSize: '0.8rem', fontWeight: 600 }}>{notice}</div>}

                {/* Submit */}
                <button
                  onClick={submitAuth} disabled={busy || (!isLogin && !formValid)}
                  style={{
                    width: '100%', border: 'none', borderRadius: 8,
                    background: busy || (!isLogin && !formValid) ? '#e2e8f0' : 'linear-gradient(135deg, #d97757, #e8896a)',
                    color: busy || (!isLogin && !formValid) ? '#94a3b8' : '#ffffff',
                    padding: '0.8rem', fontWeight: 700, fontSize: '0.9rem',
                    cursor: busy || (!isLogin && !formValid) ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: busy || (!isLogin && !formValid) ? 'none' : '0 4px 14px rgba(217,119,87,0.3)',
                    transition: 'all 0.15s',
                  }}
                >
                  {busy ? 'Please wait...' : isLogin ? 'Log in' : 'Sign up'}
                </button>

                {/* Toggle link */}
                <p style={{ margin: 0, textAlign: 'center', fontSize: '0.83rem', color: '#64748b' }}>
                  {isLogin ? "Don't have an account? " : 'Already have an account? '}
                  <button
                    onClick={() => { setAuthMode(isLogin ? 'signup' : 'login'); setError(''); setNotice(''); }}
                    type="button"
                    style={{ border: 'none', background: 'none', color: '#2563eb', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0, fontSize: '0.83rem' }}
                  >
                    {isLogin ? 'Sign up' : 'Log in'}
                  </button>
                </p>
              </div>
            </div>
          </div>
        </MotionDiv>
      );
    }

    if (step === 2) {
      return (
        <SplitShell
          eyebrow="Email verification"
          title="Check your inbox"
          subtitle={<>We sent a 6-digit code to <strong style={{ color: '#0f172a' }}>{email}</strong>. Enter it below to confirm your account.</>}
          actions={
            <>
              <button onClick={() => setStep(1)} style={ghostButton}>Back</button>
              <button disabled={busy} onClick={verifySignup} style={primaryButton}>{busy ? 'Checking…' : 'Verify and continue'}</button>
            </>
          }
        >
          <div style={{ maxWidth: 400, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input
              value={code}
              onChange={e => setCode(e.target.value.replace(/\s/g, ''))}
              placeholder="6-digit code"
              maxLength={6}
              style={{ ...inputStyle, border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '0.85rem 1rem', textAlign: 'center', fontSize: '1.4rem', letterSpacing: '0.2em', fontWeight: 700 }}
            />
            <button onClick={resendCode} disabled={busy} style={{ border: 'none', background: 'none', color: '#2563eb', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.83rem', textAlign: 'left', padding: 0 }}>
              Resend code
            </button>
          </div>
        </SplitShell>
      );
    }

    if (step === 3) {
      const cards = [
        { num: 1, title: 'Ask once', body: 'Write one prompt in TriMind AI.' },
        { num: 2, title: 'Run providers', body: 'Selected models answer simultaneously from saved accounts or keys.' },
        { num: 3, title: 'Compare', body: 'Each model result stays visible side by side for easy comparison.' },
        { num: 4, title: 'Synthesize', body: 'Claude prepares one final, consolidated answer from all results.' },
      ];
      return (
        <SplitShell
          eyebrow="Setup guide"
          title="How your prompt runs"
          subtitle="One prompt — three models answer in parallel, then Claude synthesises the best response."
          actions={
            <>
              <button onClick={() => setStep(2)} style={ghostButton}>Back</button>
              <button onClick={() => setStep(4)} style={primaryButton}>Next</button>
            </>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            {cards.map((c, index) => (
              <MotionDiv key={c.title} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.07 }}
                style={{ border: `1.5px solid ${index % 2 === 0 ? '#e5e7eb' : '#fed7aa'}`, borderRadius: 14, padding: '1rem 1.1rem', background: index % 2 === 0 ? '#f8fafc' : '#fff7ed' }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#0f172a', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.7rem' }}>{c.num}</div>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem', marginBottom: '0.3rem' }}>{c.title}</div>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem', lineHeight: 1.6 }}>{c.body}</p>
              </MotionDiv>
            ))}
          </div>
        </SplitShell>
      );
    }

    if (step === 4) {
      return (
        <SplitShell
          eyebrow="Connection mode"
          title="Choose how to connect"
          subtitle="Browser Mode uses your existing accounts — no API keys needed. Switch to API Mode if you prefer direct key access."
          actions={
            <>
              <button onClick={() => setStep(3)} style={ghostButton}>Back</button>
              <button onClick={() => setStep(5)} style={primaryButton}>Continue</button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {[
              { key: 'browser', title: 'Browser Mode', badge: 'Recommended', text: 'Log in to ChatGPT, Claude, and Gemini inside a secure server browser — no API keys required.', points: ['No API keys needed', 'Uses your existing accounts', 'Isolated server browser profile'], color: '#7c3aed' },
              { key: 'api', title: 'API Mode', badge: 'Optional', text: 'Paste provider API keys and let the workflow call the APIs directly for faster, more stable responses.', points: ['Faster & more stable', 'Requires provider API keys', 'Great for power users'], color: '#16a34a' },
            ].map(option => {
              const selected = mode === option.key;
              return (
                <button key={option.key} onClick={() => setMode(option.key)} style={{ textAlign: 'left', border: `2px solid ${selected ? option.color : '#e5e7eb'}`, borderRadius: 14, background: selected ? `${option.color}08` : '#fafafa', padding: '1rem 1.2rem', cursor: 'pointer', boxShadow: selected ? `0 6px 24px ${option.color}18` : 'none', transition: 'all 0.18s', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${selected ? option.color : '#cbd5e1'}`, background: selected ? option.color : 'transparent', flexShrink: 0, marginTop: 2, display: 'grid', placeItems: 'center' }}>
                    {selected && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>{option.title}</span>
                      <span style={{ borderRadius: 99, background: selected ? option.color : '#f1f5f9', color: selected ? '#fff' : '#64748b', padding: '0.15rem 0.6rem', fontWeight: 700, fontSize: '0.65rem' }}>{option.badge}</span>
                    </div>
                    <p style={{ margin: '0 0 0.6rem', color: '#64748b', fontSize: '0.82rem', lineHeight: 1.55 }}>{option.text}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {option.points.map(pt => (
                        <span key={pt} style={{ fontSize: '0.72rem', fontWeight: 600, color: selected ? option.color : '#64748b', background: selected ? `${option.color}10` : '#f1f5f9', borderRadius: 99, padding: '0.2rem 0.6rem' }}>{pt}</span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </SplitShell>
      );
    }

    if (step === 5) {
      return (
        <SplitShell
          eyebrow={mode === 'browser' ? 'Connect accounts' : 'API keys'}
          title={mode === 'browser' ? 'Connect your LLM accounts' : 'Add your provider keys'}
          subtitle={mode === 'browser' ? 'Click Connect to open a secure login window for each model. Click Finish after signing in.' : 'Paste your API keys below. Keys are stored locally and sent with every request.'}
          actions={
            <>
              <button onClick={() => setStep(4)} style={ghostButton}>Back</button>
              <button onClick={() => setStep(6)} style={primaryButton}>Review setup</button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {MODEL_DEFS.map(model => {
              const state = models[model.key];
              const connected = browserAuth[model.key];
              return (
                <div key={model.key} style={{ border: `1.5px solid ${state.enabled ? model.color + '40' : '#e5e7eb'}`, borderRadius: 12, padding: '0.9rem 1.1rem', background: state.enabled ? `${model.color}06` : '#fafafa', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: model.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem', marginBottom: 2 }}>{model.name}</div>
                    <div style={{ fontSize: '0.74rem', color: connected ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>
                      {mode === 'browser' ? (connected ? '● Connected' : '● Not connected') : model.apiLabel}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                    <button onClick={() => toggleModel(model.key)} style={{ width: 40, height: 22, borderRadius: 999, border: 'none', background: state.enabled ? model.color : '#cbd5e1', padding: 2, cursor: 'pointer', flexShrink: 0 }}>
                      <span style={{ display: 'block', width: 18, height: 18, borderRadius: '50%', background: '#fff', transform: state.enabled ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 0.18s' }} />
                    </button>
                    {mode === 'browser' ? (
                      <button onClick={() => openRemoteLogin(model.key)} disabled={!state.enabled}
                        style={{ border: `1.5px solid ${connected ? '#16a34a' : model.color}`, borderRadius: 8, background: connected ? '#ecfdf5' : `${model.color}`, color: connected ? '#047857' : '#fff', padding: '0.4rem 0.9rem', fontWeight: 700, fontSize: '0.78rem', cursor: state.enabled ? 'pointer' : 'not-allowed', opacity: state.enabled ? 1 : 0.45, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                        {connected ? '✓ Connected' : `Connect`}
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <input type={showKey[model.key] ? 'text' : 'password'} value={state.apiKey} disabled={!state.enabled}
                          onChange={e => setModels(prev => ({ ...prev, [model.key]: { ...prev[model.key], apiKey: e.target.value } }))}
                          placeholder={model.apiPlaceholder}
                          style={{ ...inputStyle, border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '0.4rem 0.7rem', fontSize: '0.78rem', width: 180 }} />
                        <button onClick={() => setShowKey(prev => ({ ...prev, [model.key]: !prev[model.key] }))} style={{ ...ghostButton, padding: '0.4rem 0.65rem', fontSize: '0.73rem' }}>
                          {showKey[model.key] ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SplitShell>
      );
    }

    return (
      <SplitShell
        eyebrow="Review"
        title="You're all set"
        subtitle="Your setup is saved. Next time you log in you'll go straight to the chat interface."
        actions={
          <>
            <button onClick={() => setStep(5)} style={ghostButton}>Back</button>
            <button onClick={finishSetup} style={primaryButton}>Start chatting</button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Account summary */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '0.6rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Account</div>
            {[['Name', name], ['Email', email], ['Mode', mode === 'browser' ? 'Browser Mode' : 'API Mode']].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 1rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.84rem' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>{label}</span>
                <span style={{ color: '#0f172a', fontWeight: 700 }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Providers summary */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '0.6rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Providers</div>
            {MODEL_DEFS.map(model => {
              const enabled = enabledModels.includes(model.key);
              const connected = browserAuth[model.key];
              const statusText = !enabled ? 'Disabled' : mode === 'browser' ? (connected ? 'Connected' : 'Not connected') : 'Enabled';
              const statusColor = !enabled ? '#94a3b8' : connected || mode === 'api' ? '#16a34a' : '#f59e0b';
              return (
                <div key={model.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 1rem', borderBottom: '1px solid #f1f5f9', fontSize: '0.84rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: '#0f172a' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: enabled ? model.color : '#cbd5e1' }} />
                    {model.name}
                  </span>
                  <span style={{ color: statusColor, fontWeight: 700, fontSize: '0.78rem' }}>{statusText}</span>
                </div>
              );
            })}
          </div>
        </div>
      </SplitShell>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f4f0', fontFamily: 'Inter, system-ui, sans-serif', overflow: 'hidden' }}>
      <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>

      {remoteBrowser.open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.66)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem' }}>
          <div style={{ width: 'min(1500px, 100%)', height: 'min(920px, calc(100vh - 1.5rem))', background: '#ffffff', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 70px rgba(0,0,0,0.35)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', padding: '0.85rem 1rem', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 900, color: '#0f172a' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: remoteProvider?.color || '#64748b' }} />
                  {remoteProvider?.name || 'Remote Browser'}
                </div>
                <div style={{ color: '#64748b', fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 720 }}>{remoteBrowser.title || remoteBrowser.url}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[
                  ['Back', () => sendRemoteAction({ type: 'back' })],
                  ['Reload', () => sendRemoteAction({ type: 'reload' })],
                  ['Refresh', refreshRemoteLogin],
                  ['Finish', finishRemoteLogin],
                  ['Close', closeRemoteLogin],
                ].map(([label, fn]) => (
                  <button key={label} onClick={fn} disabled={remoteBrowser.loading && label === 'Finish'} style={{ ...ghostButton, padding: '0.5rem 0.8rem', background: label === 'Finish' ? (remoteProvider?.color || '#2563eb') : '#ffffff', color: label === 'Finish' ? '#ffffff' : '#334155' }}>{label}</button>
                ))}
              </div>
            </div>
            <div style={{ background: '#111827', padding: '0.75rem', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div
                tabIndex={0}
                onPointerDown={e => {
                  const point = getRemotePoint(e);
                  if (!point) return;
                  e.preventDefault();
                  e.currentTarget.focus();
                  sendRemoteAction({ type: 'click', x: point.x, y: point.y });
                }}
                onDoubleClick={e => {
                  const point = getRemotePoint(e);
                  if (!point) return;
                  e.preventDefault();
                  sendRemoteAction({ type: 'dblclick', x: point.x, y: point.y });
                }}
                onWheel={e => {
                  e.preventDefault();
                  sendRemoteAction({ type: 'wheel', deltaX: e.deltaX, deltaY: e.deltaY });
                }}
                onKeyDown={e => {
                  const special = new Set(['Enter', 'Tab', 'Backspace', 'Delete', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);
                  if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    const mod = e.metaKey ? 'Meta' : 'Control';
                    sendRemoteAction({ type: 'press', key: `${mod}+${e.key.length === 1 ? e.key.toUpperCase() : e.key}` });
                  } else if (e.key.length === 1) {
                    e.preventDefault();
                    sendRemoteAction({ type: 'type', text: e.key });
                  } else if (special.has(e.key)) {
                    e.preventDefault();
                    sendRemoteAction({ type: 'press', key: e.key });
                  }
                }}
                onPaste={e => {
                  const text = e.clipboardData.getData('text');
                  if (!text) return;
                  e.preventDefault();
                  sendRemoteAction({ type: 'type', text });
                }}
                style={{ width: '100%', height: '100%', minHeight: 0, background: '#0f172a', outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, overflow: 'hidden', cursor: remoteBrowser.image ? 'crosshair' : 'default', touchAction: 'none' }}
              >
                {remoteBrowser.image
                  ? <img src={remoteBrowser.image} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none', pointerEvents: 'none' }} />
                  : <div style={{ color: '#cbd5e1', fontWeight: 900 }}>{remoteBrowser.loading ? 'Opening...' : 'No preview'}</div>}
              </div>
              {remoteBrowser.error && <div style={{ color: '#fecaca', fontWeight: 800, fontSize: '0.82rem', marginTop: '0.75rem' }}>{remoteBrowser.error}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnboardingPage;
