import { useCallback, useEffect, useRef, useState } from 'react';
import { PLAYWRIGHT_SERVER, REMOTE_LOGIN_MODE, USE_SHARED_BROWSER } from '../config/api';
import { ensureClientId, loadStoredUser } from '../utils/clientIdentity';

const MODEL_DEFS = [
  { key: 'openai', name: 'ChatGPT', color: '#10a37f' },
  { key: 'claude', name: 'Claude', color: '#d97757' },
  { key: 'gemini', name: 'Gemini', color: '#4285f4' },
];

const loadUser = () => {
  return loadStoredUser();
};

const SettingsPage = () => {
  const storedUser = loadUser();
  const [name, setName]   = useState(storedUser.name  || '');
  const [email, setEmail] = useState(storedUser.email || '');
  const [clientId] = useState(() => ensureClientId());
  const [saved, setSaved] = useState(false);

  // API keys & model toggles
  const [modelToggles, setModelToggles] = useState(() => {
    const u = loadUser();
    const enabled = u.enabledModels || ['openai', 'claude', 'gemini'];
    return { openai: enabled.includes('openai'), claude: enabled.includes('claude'), gemini: enabled.includes('gemini') };
  });
  const [keysSaved, setKeysSaved] = useState(false);
  const [chromeStatus, setChromeStatus] = useState('idle'); // 'idle' | 'loading' | 'visible' | 'hidden' | 'error'
  const [chromeMsg,    setChromeMsg]    = useState('');
  const [sessionStatus, setSessionStatus] = useState({});
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
  const [nativeLogin, setNativeLogin] = useState({
    open: false,
    provider: null,
    loading: false,
    error: '',
    message: '',
  });
  const remoteActionQueueRef = useRef(Promise.resolve());
  const remoteActionInFlightRef = useRef(false);
  const remoteTypingBufferRef = useRef('');
  const remoteTypingTimerRef = useRef(null);

  const save = () => {
    const u = loadUser();
    localStorage.setItem('ph_user', JSON.stringify({ ...u, clientId, name: name.trim(), email: email.trim() }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const saveKeys = () => {
    const u = loadUser();
    const enabledModels = Object.keys(modelToggles).filter(k => modelToggles[k]);
    localStorage.setItem('ph_user', JSON.stringify({ ...u, clientId, enabledModels }));
    setKeysSaved(true);
    setTimeout(() => setKeysSaved(false), 2000);
  };

  const toggleModelSetting = (key) => {
    setModelToggles(prev => {
      const next = { ...prev, [key]: !prev[key] };
      if (!Object.values(next).some(Boolean)) return prev;
      return next;
    });
  };
  useEffect(() => {
    let active = true;
    const loadSessions = async () => {
      try {
        const res = await fetch(`${PLAYWRIGHT_SERVER}/client/${encodeURIComponent(clientId)}/sessions`);
        const data = await res.json();
        if (active && res.ok) setSessionStatus(data.sessions || {});
      } catch { /* ignore unavailable server while loading settings */ }
    };
    loadSessions();
    return () => { active = false; };
  }, [clientId]);

  const checkSessions = async () => {
    setChromeStatus('loading');
    setChromeMsg('');
    try {
      const selectedModels = Object.keys(modelToggles).filter(k => modelToggles[k]);
      const res = await fetch(`${PLAYWRIGHT_SERVER}/client/${encodeURIComponent(clientId)}/check-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedModels }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setSessionStatus(data.sessions || {});
      setChromeStatus('hidden');
      setChromeMsg('Session status refreshed.');
    } catch (e) {
      setChromeStatus('error');
      setChromeMsg(e.message);
    }
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

  const openNativeLogin = async (provider) => {
    const model = MODEL_DEFS.find(m => m.key === provider);
    setNativeLogin({
      open: true,
      provider,
      loading: true,
      error: '',
      message: `Opening real Chrome for ${model?.name || 'this provider'}...`,
    });
    setChromeMsg('');
    try {
      const res = await fetch(`${PLAYWRIGHT_SERVER}/client/${encodeURIComponent(clientId)}/show-chrome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.statusText);
      setSessionStatus(data.sessions || {});
      setNativeLogin(prev => ({
        ...prev,
        loading: false,
        error: '',
        message: `${model?.name || 'Provider'} opened in a real Chrome window. Log in there, then click Finish here.`,
      }));
    } catch (e) {
      setNativeLogin(prev => ({ ...prev, loading: false, error: e.message, message: '' }));
    }
  };

  const openPreferredLogin = (provider) => {
    if (REMOTE_LOGIN_MODE === 'native') {
      openNativeLogin(provider);
      return;
    }
    openRemoteLogin(provider);
  };

  const openRemoteLogin = async (provider) => {
    const model = MODEL_DEFS.find(m => m.key === provider);
    setRemoteBrowser(prev => ({ ...prev, open: true, provider, loading: true, image: '', title: model?.name || '', url: '', error: '' }));
    setChromeMsg('');
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
      const res = await fetch(remoteEndpoint(remoteBrowser.provider, 'screenshot'), { method: 'GET' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      applyRemoteSnapshot(data);
    } catch (e) {
      setRemoteBrowser(prev => ({ ...prev, error: e.message }));
    }
  };

  const sendRemoteAction = async (action) => {
    const provider = remoteBrowser.provider;
    if (!provider || remoteBrowser.loading) return Promise.resolve();
    remoteActionQueueRef.current = remoteActionQueueRef.current.then(async () => {
      remoteActionInFlightRef.current = true;
      try {
        const res = await fetch(remoteEndpoint(provider, 'action'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);
        applyRemoteSnapshot(data);
      } finally {
        remoteActionInFlightRef.current = false;
      }
    }).catch(e => {
      remoteActionInFlightRef.current = false;
      setRemoteBrowser(prev => ({ ...prev, error: e.message }));
    });
    return remoteActionQueueRef.current;
  };

  const flushRemoteTyping = () => {
    if (remoteTypingTimerRef.current) {
      clearTimeout(remoteTypingTimerRef.current);
      remoteTypingTimerRef.current = null;
    }
    const text = remoteTypingBufferRef.current;
    remoteTypingBufferRef.current = '';
    return text ? sendRemoteAction({ type: 'type', text }) : Promise.resolve();
  };

  const queueRemoteTyping = (text) => {
    if (!text) return;
    remoteTypingBufferRef.current += text;
    if (remoteTypingTimerRef.current) clearTimeout(remoteTypingTimerRef.current);
    remoteTypingTimerRef.current = setTimeout(() => {
      flushRemoteTyping();
    }, 70);
  };

  const closeRemoteLogin = async () => {
    const provider = remoteBrowser.provider;
    if (remoteTypingTimerRef.current) clearTimeout(remoteTypingTimerRef.current);
    remoteTypingTimerRef.current = null;
    remoteTypingBufferRef.current = '';
    setRemoteBrowser(prev => ({ ...prev, open: false, provider: null, image: '', error: '' }));
    if (provider) {
      await fetch(remoteEndpoint(provider, 'close'), { method: 'POST' }).catch(() => {});
    }
  };

  const finishRemoteLogin = async () => {
    if (!remoteBrowser.provider) return;
    setRemoteBrowser(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const res = await fetch(remoteEndpoint(remoteBrowser.provider, 'finish'), { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setSessionStatus(data.sessions || {});
      setChromeMsg(data.message || '');
      setChromeStatus(data.ok ? 'hidden' : 'error');
      setRemoteBrowser(prev => ({ ...prev, open: false, provider: null, loading: false, image: '' }));
    } catch (e) {
      setRemoteBrowser(prev => ({ ...prev, loading: false, error: e.message }));
    }
  };

  useEffect(() => {
    if (!remoteBrowser.open || !remoteBrowser.provider) return undefined;
    let active = true;
    let busy = false;
    const poll = async () => {
      if (busy || remoteActionInFlightRef.current) return;
      busy = true;
      try {
        const res = await fetch(remoteEndpoint(remoteBrowser.provider, 'screenshot'), { method: 'GET' });
        const data = await res.json();
        if (active && res.ok) applyRemoteSnapshot(data);
      } catch { /* ignore transient screenshot refresh failures */ }
      busy = false;
    };
    const id = setInterval(poll, 900);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [remoteBrowser.open, remoteBrowser.provider, remoteEndpoint]);

  const getRemotePoint = (e) => {
    if (!remoteBrowser.image) return;
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

    return {
      x: (localX / imageWidth) * viewport.width,
      y: (localY / imageHeight) * viewport.height,
    };
  };

  const handleRemotePointerDown = (e) => {
    const point = getRemotePoint(e);
    if (!point) return;
    e.preventDefault();
    e.currentTarget.focus();
    flushRemoteTyping();
    sendRemoteAction({ type: 'click', x: point.x, y: point.y });
  };

  const handleRemoteDoubleClick = (e) => {
    const point = getRemotePoint(e);
    if (!point) return;
    e.preventDefault();
    flushRemoteTyping();
    sendRemoteAction({ type: 'dblclick', x: point.x, y: point.y });
  };

  const handleRemoteWheel = (e) => {
    e.preventDefault();
    flushRemoteTyping();
    sendRemoteAction({ type: 'wheel', deltaX: e.deltaX, deltaY: e.deltaY });
  };

  const handleRemoteKeyDown = (e) => {
    if (!remoteBrowser.open) return;
    const special = new Set(['Enter', 'Tab', 'Backspace', 'Delete', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const mod = e.metaKey ? 'Meta' : 'Control';
      flushRemoteTyping();
      sendRemoteAction({ type: 'press', key: `${mod}+${e.key.length === 1 ? e.key.toUpperCase() : e.key}` });
      return;
    }
    if (e.key.length === 1) {
      e.preventDefault();
      queueRemoteTyping(e.key);
      return;
    }
    if (special.has(e.key)) {
      e.preventDefault();
      flushRemoteTyping();
      sendRemoteAction({ type: 'press', key: e.key });
    }
  };

  const closeNativeLogin = async () => {
    const provider = nativeLogin.provider;
    setNativeLogin({ open: false, provider: null, loading: false, error: '', message: '' });
    if (provider) {
      await fetch(`${PLAYWRIGHT_SERVER}/client/${encodeURIComponent(clientId)}/hide-chrome`, {
        method: 'POST',
      }).catch(() => {});
    }
  };

  const finishNativeLogin = async () => {
    const provider = nativeLogin.provider;
    if (!provider) return;
    setNativeLogin(prev => ({ ...prev, loading: true, error: '', message: 'Checking the login session...' }));
    try {
      const res = await fetch(remoteEndpoint(provider, 'finish'), { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.statusText);
      setSessionStatus(data.sessions || {});
      setChromeMsg(data.message || '');
      setChromeStatus(data.ok ? 'hidden' : 'error');
      if (!data.ok) throw new Error(data.message || 'Login was not detected yet. Keep the Chrome window open and finish the login.');
      setNativeLogin({ open: false, provider: null, loading: false, error: '', message: '' });
    } catch (e) {
      setNativeLogin(prev => ({ ...prev, loading: false, error: e.message, message: '' }));
    }
  };

  const handleRemotePaste = (e) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;
    e.preventDefault();
    queueRemoteTyping(text);
    flushRemoteTyping();
  };

  const inputStyle = { width: '100%', padding: '0.65rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.875rem', outline: 'none', color: '#334155', boxSizing: 'border-box', background: 'white' };
  const card = { background: 'white', borderRadius: '20px', padding: '1.75rem', border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' };

  const Toggle = ({ on, onClick }) => (
    <div onClick={onClick} style={{ width: '40px', height: '22px', borderRadius: '22px', background: on ? '#2563eb' : '#e2e8f0', position: 'relative', cursor: 'pointer', transition: 'background 0.3s', flexShrink: 0 }}>
      <div style={{ width: '16px', height: '16px', background: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: on ? '21px' : '3px', transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </div>
  );

  const remoteProvider = MODEL_DEFS.find(m => m.key === remoteBrowser.provider);

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem' }}>⚙️ Settings</h1>
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Manage your profile, model availability, and browser LLM sessions.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

        {/* Models */}
        <div style={{ ...card, gridColumn: '1 / -1' }}>
          <h3 style={{ fontWeight: '700', color: '#0f172a', marginBottom: '0.4rem', fontSize: '0.95rem' }}>Models</h3>
          <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1.25rem', lineHeight: 1.6 }}>
            Toggle which browser-connected models are available in chat. Changes take effect on the next prompt run.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '1.25rem' }}>
            {MODEL_DEFS.map(m => (
              <div key={m.key} style={{
                border: `1.5px solid ${modelToggles[m.key] ? m.color + '40' : '#e5e7eb'}`,
                borderRadius: '12px', padding: '12px 16px',
                background: modelToggles[m.key] ? m.color + '05' : '#fafafa', transition: 'all 0.2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: m.color }} />
                    <span style={{ fontWeight: '600', fontSize: '0.9rem', color: modelToggles[m.key] ? '#1c1c1c' : '#9ca3af' }}>{m.name}</span>
                  </div>
                  <Toggle on={modelToggles[m.key]} onClick={() => toggleModelSetting(m.key)} />
                </div>
              </div>
            ))}
          </div>
          <button onClick={saveKeys} style={{
            padding: '0.65rem 1.5rem', border: 'none', borderRadius: '10px', cursor: 'pointer',
            fontWeight: '700', fontSize: '0.875rem', fontFamily: 'inherit', transition: 'all 0.3s',
            background: keysSaved ? '#dcfce7' : '#d97757',
            color: keysSaved ? '#16a34a' : 'white',
          }}>{keysSaved ? '✓ Saved!' : 'Save Models'}</button>
        </div>

        {/* Profile */}
        <div style={card}>
          <h3 style={{ fontWeight: '700', color: '#0f172a', marginBottom: '1.5rem', fontSize: '0.95rem' }}>👤 Profile</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: '800', color: 'white', flexShrink: 0 }}>{name ? name.charAt(0).toUpperCase() : 'U'}</div>
            <div>
              <div style={{ fontWeight: '700', color: '#0f172a' }}>{name}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Gemini 1.5 Flash · Active</div>
            </div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Display Name</label>
            <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
          </div>
          <button onClick={save} style={{
            width: '100%', padding: '0.7rem', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '0.875rem', transition: 'all 0.3s',
            background: saved ? '#dcfce7' : 'linear-gradient(135deg, #2563eb, #7c3aed)',
            color: saved ? '#16a34a' : 'white'
          }}>{saved ? '✓ Saved!' : 'Save Changes'}</button>
        </div>

        {/* Browser Login */}
        <div style={{ ...card, gridColumn: '1 / -1' }}>
          <h3 style={{ fontWeight: '700', color: '#0f172a', marginBottom: '0.4rem', fontSize: '0.95rem' }}>Browser LLM Accounts</h3>
          <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1.25rem', lineHeight: 1.6 }}>
            {USE_SHARED_BROWSER
              ? 'Shared Browser Mode is enabled. ChatGPT, Claude, and Gemini are managed from one server-side browser profile for this workspace.'
              : <>Client ID: <strong>{clientId}</strong>. Each connected account is stored in its own browser profile under this client.</>}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
            {MODEL_DEFS.map(m => {
              const session = sessionStatus[m.key] || {};
              const status = session.status || 'expired';
              const connected = status === 'connected';
              const managedStatus = USE_SHARED_BROWSER ? `Managed: ${status}` : status;
              return (
                <div key={m.key} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                  padding: '0.85rem 1rem', background: connected ? m.color + '08' : '#f8fafc',
                  border: `1px solid ${connected ? m.color + '35' : '#e2e8f0'}`, borderRadius: '12px',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                      {m.name}
                    </div>
                    <div style={{ marginTop: '4px', fontSize: '0.72rem', color: connected ? '#16a34a' : status === 'error' ? '#dc2626' : '#64748b', fontWeight: 700, textTransform: 'capitalize' }}>
                      {managedStatus}
                    </div>
                  </div>
                  <button
                    onClick={() => openPreferredLogin(m.key)}
                    disabled={chromeStatus === 'loading' || USE_SHARED_BROWSER}
                    style={{
                      padding: '0.48rem 0.8rem', borderRadius: '9px', border: 'none',
                      background: connected ? '#ffffff' : m.color,
                      color: connected ? m.color : '#ffffff',
                      boxShadow: connected ? 'inset 0 0 0 1px rgba(0,0,0,0.08)' : 'none',
                      cursor: chromeStatus === 'loading' || USE_SHARED_BROWSER ? 'not-allowed' : 'pointer',
                      fontWeight: 700, fontSize: '0.74rem', whiteSpace: 'nowrap',
                    }}
                  >
                    {USE_SHARED_BROWSER ? 'Server managed' : connected ? 'Reconnect' : 'Connect'}
                  </button>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={checkSessions}
              disabled={chromeStatus === 'loading'}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '0.65rem 1.25rem', borderRadius: '12px',
                border: '1px solid #e2e8f0',
                background: 'white',
                color: '#374151',
                cursor: chromeStatus === 'loading' ? 'not-allowed' : 'pointer',
                fontWeight: '700', fontSize: '0.85rem', opacity: chromeStatus === 'loading' ? 0.5 : 1, transition: 'all 0.2s',
              }}
            >
              {chromeStatus === 'loading' ? '⏳ Checking…' : 'Refresh Status'}
            </button>

            {chromeMsg && (
              <span style={{ fontSize: '0.78rem', color: chromeStatus === 'error' ? '#dc2626' : '#16a34a', fontWeight: 500 }}>
                {chromeStatus === 'error' ? '⚠️ ' : '✓ '}{chromeMsg}
              </span>
            )}
          </div>

        </div>
      </div>
      {nativeLogin.open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 320, background: 'rgba(15,23,42,0.58)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ width: 'min(520px, 100%)', background: '#fff', borderRadius: '18px', padding: '1.35rem', boxShadow: '0 24px 70px rgba(15,23,42,0.26)', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.85rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: MODEL_DEFS.find(m => m.key === nativeLogin.provider)?.color || '#64748b' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a' }}>
                  Login in real Chrome
                </h3>
                <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.82rem', lineHeight: 1.55 }}>
                  Use the Chrome window that just opened. It uses this client&apos;s saved browser profile.
                </p>
              </div>
            </div>

            <div style={{ borderRadius: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.95rem', color: '#334155', fontSize: '0.86rem', lineHeight: 1.6, marginBottom: '1rem' }}>
              <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>What to do</div>
              <div>1. Complete the login in the real Chrome window.</div>
              <div>2. Return here after the provider shows your signed-in account.</div>
              <div>3. Click Finish so Excelliq can save the session status.</div>
            </div>

            {nativeLogin.message && <div style={{ color: '#047857', fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.85rem' }}>{nativeLogin.message}</div>}
            {nativeLogin.error && <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '0.75rem', fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.85rem' }}>{nativeLogin.error}</div>}

            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  const provider = nativeLogin.provider;
                  setNativeLogin({ open: false, provider: null, loading: false, error: '', message: '' });
                  openRemoteLogin(provider);
                }}
                disabled={nativeLogin.loading}
                style={{ padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#334155', fontWeight: 800, cursor: nativeLogin.loading ? 'not-allowed' : 'pointer' }}
              >
                Use in-app preview
              </button>
              <button onClick={closeNativeLogin} disabled={nativeLogin.loading} style={{ padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#334155', fontWeight: 800, cursor: nativeLogin.loading ? 'not-allowed' : 'pointer' }}>
                Hide Chrome
              </button>
              <button onClick={finishNativeLogin} disabled={nativeLogin.loading} style={{ padding: '0.65rem 1rem', borderRadius: '10px', border: 'none', background: '#d97757', color: '#fff', fontWeight: 900, cursor: nativeLogin.loading ? 'not-allowed' : 'pointer', opacity: nativeLogin.loading ? 0.65 : 1 }}>
                {nativeLogin.loading ? 'Please wait...' : 'Finish'}
              </button>
            </div>
          </div>
        </div>
      )}
      {remoteBrowser.open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem' }}>
          <div style={{ width: 'min(1500px, 100%)', height: 'min(920px, calc(100vh - 1.5rem))', background: '#ffffff', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.25)', boxShadow: '0 24px 70px rgba(0,0,0,0.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.85rem 1rem', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: remoteProvider?.color || '#64748b', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.92rem' }}>{remoteProvider?.name || 'Remote Browser'}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '620px' }}>{remoteBrowser.title || remoteBrowser.url}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                <button onClick={() => sendRemoteAction({ type: 'back' })} style={{ padding: '0.5rem 0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#334155', fontWeight: 700, cursor: 'pointer' }}>Back</button>
                <button onClick={() => sendRemoteAction({ type: 'reload' })} style={{ padding: '0.5rem 0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#334155', fontWeight: 700, cursor: 'pointer' }}>Reload</button>
                <button onClick={refreshRemoteLogin} style={{ padding: '0.5rem 0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#334155', fontWeight: 700, cursor: 'pointer' }}>Refresh</button>
                <button onClick={finishRemoteLogin} disabled={remoteBrowser.loading} style={{ padding: '0.5rem 0.95rem', borderRadius: '8px', border: 'none', background: remoteProvider?.color || '#2563eb', color: 'white', fontWeight: 800, cursor: remoteBrowser.loading ? 'not-allowed' : 'pointer', opacity: remoteBrowser.loading ? 0.7 : 1 }}>Finish</button>
                <button onClick={closeRemoteLogin} style={{ padding: '0.5rem 0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#334155', fontWeight: 700, cursor: 'pointer' }}>Close</button>
              </div>
            </div>

            <div style={{ background: '#111827', padding: '0.75rem', overflow: 'hidden', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div
                tabIndex={0}
                onPointerDown={handleRemotePointerDown}
                onDoubleClick={handleRemoteDoubleClick}
                onWheel={handleRemoteWheel}
                onKeyDown={handleRemoteKeyDown}
                onPaste={handleRemotePaste}
                style={{ width: '100%', height: '100%', minHeight: 0, background: '#0f172a', outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', overflow: 'hidden', cursor: 'default', touchAction: 'none' }}
              >
                {remoteBrowser.image ? (
                  <img src={remoteBrowser.image} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', userSelect: 'none', pointerEvents: 'none' }} />
                ) : (
                  <div style={{ color: '#cbd5e1', fontWeight: 700 }}>{remoteBrowser.loading ? 'Opening...' : 'No preview'}</div>
                )}
              </div>
              {remoteBrowser.error && (
                <div style={{ marginTop: '0.75rem', color: '#fecaca', fontSize: '0.82rem', fontWeight: 700 }}>{remoteBrowser.error}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;

