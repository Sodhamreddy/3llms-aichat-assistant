import { useCallback, useEffect, useState } from 'react';
import { API_SERVER } from '../config/api';

const providerLabels = { openai: 'ChatGPT', claude: 'Claude', gemini: 'Gemini' };

const formatDate = (value) => {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

const statusColor = (status) => {
  const clean = String(status || '').toLowerCase();
  if (clean.includes('complete') || clean === 'api') return { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' };
  if (clean.includes('pending')) return { bg: '#fffbeb', color: '#b45309', border: '#fde68a' };
  return { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' };
};

const Pill = ({ children, status }) => {
  const s = statusColor(status || children);
  return (
    <span style={{ display: 'inline-flex', border: `1px solid ${s.border}`, background: s.bg, color: s.color, borderRadius: 999, padding: '0.22rem 0.55rem', fontSize: '0.68rem', fontWeight: 900, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
};

const Metric = ({ label, value, note, color }) => (
  <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '1.1rem', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
    <div style={{ width: 36, height: 4, borderRadius: 99, background: color, marginBottom: '1rem' }} />
    <div style={{ color: '#0f172a', fontWeight: 900, fontSize: '1.65rem', lineHeight: 1 }}>{value}</div>
    <div style={{ color: '#334155', fontWeight: 900, fontSize: '0.78rem', marginTop: '0.55rem' }}>{label}</div>
    <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: '0.25rem' }}>{note}</div>
  </div>
);

const AdminPortal = () => {
  const [email, setEmail] = useState('navadeepu24@gmail.com');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(() => localStorage.getItem('excelliq_admin_token') || '');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadAnalytics = useCallback(async (authToken = token) => {
    if (!authToken) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API_SERVER}/admin/analytics`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Unable to load admin analytics.');
      setData(payload);
    } catch (e) {
      setError(e.message);
      if (/invalid|expired|log in/i.test(e.message)) {
        localStorage.removeItem('excelliq_admin_token');
        setToken('');
      }
    } finally {
      setBusy(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    const id = setTimeout(() => loadAnalytics(token), 0);
    return () => clearTimeout(id);
  }, [token, loadAnalytics]);

  const login = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API_SERVER}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Admin login failed.');
      localStorage.setItem('excelliq_admin_token', payload.token);
      setToken(payload.token);
      setPassword('');
      await loadAnalytics(payload.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('excelliq_admin_token');
    setToken('');
    setData(null);
  };

  if (!token) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f4f0', display: 'grid', placeItems: 'center', padding: '1.5rem', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ width: 'min(960px, 100%)', display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#ffffff', borderRadius: 20, border: '1px solid #e5e7eb', boxShadow: '0 24px 70px rgba(15,23,42,0.12)', overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(135deg, #111827, #2f3545)', color: '#ffffff', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 460 }}>
            <div>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #7c3aed, #2563eb)', display: 'grid', placeItems: 'center', fontWeight: 900, marginBottom: '1.4rem' }}>K</div>
              <div style={{ color: '#fed7aa', fontSize: '0.74rem', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Admin portal</div>
              <h1 style={{ fontSize: '2rem', lineHeight: 1.1, margin: '0.7rem 0 0' }}>Kleza Excelliq AI operations</h1>
              <p style={{ color: '#cbd5e1', lineHeight: 1.6, marginTop: '1rem' }}>
                A separate admin page for API-mode user analytics, onboarding state, and model preferences.
              </p>
            </div>
            <div style={{ display: 'grid', gap: '0.65rem', color: '#e5e7eb', fontSize: '0.88rem' }}>
              <span>Direct URL: /admin</span>
              <span>Separate from the chat interface</span>
            </div>
          </div>
          <form onSubmit={login} style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.45rem' }}>Admin login</h2>
            <p style={{ margin: '0.45rem 0 1.4rem', color: '#64748b', lineHeight: 1.5 }}>Use the configured admin email and password.</p>
            <label style={{ color: '#334155', fontWeight: 900, fontSize: '0.74rem', marginBottom: 6 }}>EMAIL</label>
            <input value={email} onChange={e => setEmail(e.target.value)} style={{ border: '1px solid #dbe3ef', borderRadius: 12, padding: '0.85rem 1rem', fontSize: '0.92rem', marginBottom: '1rem' }} />
            <label style={{ color: '#334155', fontWeight: 900, fontSize: '0.74rem', marginBottom: 6 }}>PASSWORD</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ border: '1px solid #dbe3ef', borderRadius: 12, padding: '0.85rem 1rem', fontSize: '0.92rem', marginBottom: '1rem' }} />
            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 12, padding: '0.75rem 0.9rem', fontWeight: 800, fontSize: '0.82rem', marginBottom: '1rem' }}>{error}</div>}
            <button disabled={busy} style={{ border: 'none', borderRadius: 12, background: 'linear-gradient(135deg, #d97757, #e8896a)', color: '#ffffff', padding: '0.9rem 1rem', fontWeight: 900, cursor: busy ? 'not-allowed' : 'pointer', boxShadow: '0 8px 24px rgba(217,119,87,0.22)' }}>
              {busy ? 'Signing in...' : 'Open admin dashboard'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const totals = data?.totals || {};
  const users = data?.users || [];

  return (
    <div style={{ minHeight: '100vh', background: '#f5f4f0', fontFamily: 'Inter, system-ui, sans-serif', padding: '1.5rem' }}>
      <div style={{ maxWidth: 1480, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ color: '#d97757', fontSize: '0.74rem', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Admin portal</div>
            <h1 style={{ margin: 0, color: '#0f172a', fontSize: '1.85rem', fontWeight: 900 }}>User Analytics</h1>
            <p style={{ margin: '0.4rem 0 0', color: '#64748b' }}>Signed-in users, API setup status, and model preferences.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.7rem' }}>
            <button onClick={() => loadAnalytics()} disabled={busy} style={{ border: '1px solid #dbe3ef', background: '#ffffff', borderRadius: 10, padding: '0.65rem 1rem', fontWeight: 900, cursor: busy ? 'not-allowed' : 'pointer' }}>{busy ? 'Refreshing...' : 'Refresh'}</button>
            <button onClick={logout} style={{ border: '1px solid #fecaca', background: '#fff', color: '#b91c1c', borderRadius: 10, padding: '0.65rem 1rem', fontWeight: 900, cursor: 'pointer' }}>Log out</button>
          </div>
        </div>

        {error && <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', borderRadius: 12, padding: '1rem', marginBottom: '1rem', fontWeight: 800 }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <Metric label="Signed-in Users" value={totals.users ?? 0} note="Supabase auth accounts" color="#2563eb" />
          <Metric label="Completed Setup" value={totals.onboardingComplete ?? 0} note="Finished onboarding" color="#059669" />
          <Metric label="API Mode Users" value={totals.apiMode ?? 0} note="n8n workflow users" color="#d97757" />
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.2rem', borderBottom: '1px solid #edf2f7' }}>
            <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1rem' }}>Signed-in Users</h2>
            <p style={{ margin: '0.25rem 0 0', color: '#94a3b8', fontSize: '0.78rem' }}>Updated {formatDate(data?.generatedAt)}</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#64748b', textAlign: 'left', fontSize: '0.72rem' }}>
                  {['User', 'Client ID', 'Mode', 'Enabled Models', 'Last Sign-in', 'Setup'].map(header => (
                    <th key={header} style={{ padding: '0.75rem 1rem', fontWeight: 900 }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} style={{ borderTop: '1px solid #edf2f7' }}>
                    <td style={{ padding: '0.9rem 1rem', verticalAlign: 'top' }}>
                      <div style={{ color: '#0f172a', fontWeight: 900 }}>{user.name || 'Unnamed user'}</div>
                      <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: 3 }}>{user.email}</div>
                    </td>
                    <td style={{ padding: '0.9rem 1rem', color: '#334155', fontSize: '0.78rem', verticalAlign: 'top' }}>{user.clientId || 'Missing'}</td>
                    <td style={{ padding: '0.9rem 1rem', verticalAlign: 'top' }}><Pill>{user.mode}</Pill></td>
                    <td style={{ padding: '0.9rem 1rem', color: '#334155', fontSize: '0.78rem', verticalAlign: 'top' }}>{user.enabledModels?.length ? user.enabledModels.map(model => providerLabels[model] || model).join(', ') : 'None'}</td>
                    <td style={{ padding: '0.9rem 1rem', color: '#334155', fontSize: '0.78rem', verticalAlign: 'top' }}>{formatDate(user.lastSignInAt)}</td>
                    <td style={{ padding: '0.9rem 1rem', verticalAlign: 'top' }}><Pill status={user.onboardingComplete ? 'complete' : 'pending'}>{user.onboardingComplete ? 'complete' : 'pending'}</Pill></td>
                  </tr>
                ))}
                {!users.length && !busy && (
                  <tr><td colSpan="6" style={{ color: '#94a3b8', padding: '2rem', textAlign: 'center' }}>No users found yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPortal;
