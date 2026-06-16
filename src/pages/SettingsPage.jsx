import { useState } from 'react';
import { ensureClientId, loadStoredUser } from '../utils/clientIdentity';

const MODEL_DEFS = [
  { key: 'openai', name: 'ChatGPT', color: '#10a37f', field: 'openai', placeholder: 'sk-...' },
  { key: 'claude', name: 'Claude', color: '#d97757', field: 'anthropic', placeholder: 'sk-ant-...' },
  { key: 'gemini', name: 'Gemini', color: '#4285f4', field: 'google', placeholder: 'AIza...' },
];

const SettingsPage = () => {
  const storedUser = loadStoredUser();
  const [name, setName] = useState(storedUser.name || '');
  const [email, setEmail] = useState(storedUser.email || '');
  const [clientId] = useState(() => ensureClientId());
  const [enabled, setEnabled] = useState(() => {
    const models = storedUser.enabledModels || ['openai', 'claude', 'gemini'];
    return { openai: models.includes('openai'), claude: models.includes('claude'), gemini: models.includes('gemini') };
  });
  const [keys, setKeys] = useState(storedUser.apiKeys || {});
  const [visible, setVisible] = useState({});
  const [saved, setSaved] = useState(false);

  const card = { background: 'white', borderRadius: 18, padding: '1.5rem', border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' };
  const inputStyle = { width: '100%', padding: '0.68rem 0.9rem', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.875rem', outline: 'none', color: '#334155', boxSizing: 'border-box', background: 'white' };

  const toggleModel = (key) => {
    setEnabled(prev => {
      const next = { ...prev, [key]: !prev[key] };
      return Object.values(next).some(Boolean) ? next : prev;
    });
  };

  const save = () => {
    const enabledModels = Object.keys(enabled).filter(key => enabled[key]);
    const user = loadStoredUser();
    localStorage.setItem('ph_user', JSON.stringify({
      ...user,
      clientId,
      name: name.trim(),
      email: email.trim(),
      mode: 'api',
      enabledModels,
      apiKeys: keys,
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', marginBottom: '0.5rem' }}>Settings</h1>
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Manage your profile, API keys, and model availability.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div style={card}>
          <h3 style={{ fontWeight: 800, color: '#0f172a', marginBottom: '1.2rem', fontSize: '0.98rem' }}>Profile</h3>
          <div style={{ display: 'grid', gap: '0.95rem' }}>
            <label style={{ display: 'grid', gap: 6, fontSize: '0.74rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>
              Display name
              <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: '0.74rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>
              Email
              <input value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
            </label>
          </div>
        </div>

        <div style={card}>
          <h3 style={{ fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem', fontSize: '0.98rem' }}>API Mode</h3>
          <p style={{ color: '#64748b', fontSize: '0.84rem', lineHeight: 1.6, margin: '0 0 1rem' }}>
            Prompts run through the backend n8n proxy. Provider keys are stored locally in this browser.
          </p>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '0.8rem', color: '#334155', fontSize: '0.82rem' }}>
            Client ID: <strong>{clientId}</strong>
          </div>
        </div>

        <div style={{ ...card, gridColumn: '1 / -1' }}>
          <h3 style={{ fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem', fontSize: '0.98rem' }}>Models and API Keys</h3>
          <p style={{ color: '#64748b', fontSize: '0.84rem', lineHeight: 1.6, margin: '0 0 1.2rem' }}>
            Toggle which providers participate in prompt runs. Claude remains available for final synthesis.
          </p>
          <div style={{ display: 'grid', gap: 12 }}>
            {MODEL_DEFS.map(model => (
              <div key={model.key} style={{ border: `1.5px solid ${enabled[model.key] ? model.color + '40' : '#e5e7eb'}`, background: enabled[model.key] ? `${model.color}06` : '#fafafa', borderRadius: 14, padding: '0.95rem', display: 'grid', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: model.color }} />
                  <strong style={{ flex: 1, color: '#0f172a' }}>{model.name}</strong>
                  <button onClick={() => toggleModel(model.key)} style={{ width: 42, height: 24, borderRadius: 999, border: 'none', background: enabled[model.key] ? model.color : '#cbd5e1', padding: 3, cursor: 'pointer' }}>
                    <span style={{ display: 'block', width: 18, height: 18, borderRadius: '50%', background: '#fff', transform: enabled[model.key] ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 0.18s' }} />
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type={visible[model.field] ? 'text' : 'password'}
                    value={keys[model.field] || ''}
                    onChange={e => setKeys(prev => ({ ...prev, [model.field]: e.target.value }))}
                    placeholder={model.placeholder}
                    disabled={!enabled[model.key]}
                    style={{ ...inputStyle, fontFamily: 'monospace', opacity: enabled[model.key] ? 1 : 0.55 }}
                  />
                  <button onClick={() => setVisible(prev => ({ ...prev, [model.field]: !prev[model.field] }))} style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: 10, color: '#334155', padding: '0.55rem 0.8rem', fontWeight: 800, cursor: 'pointer' }}>
                    {visible[model.field] ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={save} style={{ marginTop: '1.2rem', padding: '0.75rem 1.4rem', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 900, background: saved ? '#dcfce7' : '#d97757', color: saved ? '#047857' : '#fff' }}>
            {saved ? 'Saved' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
