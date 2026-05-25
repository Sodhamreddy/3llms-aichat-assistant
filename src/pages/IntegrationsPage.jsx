import { useState } from 'react';

const WEBHOOK = 'https://n8n.kleza.io/webhook/bf39cd7e-9f1b-4b3e-98eb-8b746cd2b510/chat';

const API_DEFS = [
  { name: 'OpenAI API',          field: 'openai',    color: '#10a37f', emoji: '🟢', placeholder: 'sk-...' },
  { name: 'Anthropic Claude API', field: 'anthropic', color: '#d97757', emoji: '🔶', placeholder: 'sk-ant-...' },
  { name: 'Google Gemini API',   field: 'google',    color: '#4285f4', emoji: '🌐', placeholder: 'AIza...' },
];

const readKeys = () => {
  try { return JSON.parse(localStorage.getItem('ph_user') || '{}').apiKeys || {}; }
  catch { return {}; }
};

const saveKeys = (keys) => {
  try {
    const user = JSON.parse(localStorage.getItem('ph_user') || '{}');
    localStorage.setItem('ph_user', JSON.stringify({ ...user, apiKeys: keys }));
  } catch {}
};

const IntegrationsPage = () => {
  const [copied, setCopied] = useState(false);
  const [keys, setKeys] = useState(readKeys);
  const [editing, setEditing] = useState({});
  const [draft, setDraft] = useState({});
  const [saved, setSaved] = useState({});
  const [visible, setVisible] = useState({});

  const copy = () => {
    navigator.clipboard.writeText(WEBHOOK);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startEdit = (field) => {
    setDraft(d => ({ ...d, [field]: keys[field] || '' }));
    setEditing(e => ({ ...e, [field]: true }));
  };

  const cancelEdit = (field) => {
    setEditing(e => ({ ...e, [field]: false }));
    setDraft(d => ({ ...d, [field]: '' }));
  };

  const commitKey = (field) => {
    const value = (draft[field] || '').trim();
    const next = { ...keys };
    if (value) next[field] = value;
    else delete next[field];
    setKeys(next);
    saveKeys(next);
    setEditing(e => ({ ...e, [field]: false }));
    setSaved(s => ({ ...s, [field]: true }));
    setTimeout(() => setSaved(s => ({ ...s, [field]: false })), 2000);
  };

  const removeKey = (field) => {
    const next = { ...keys };
    delete next[field];
    setKeys(next);
    saveKeys(next);
  };

  const card = { background: 'white', borderRadius: '20px', padding: '1.75rem', border: '1px solid #f1f5f9', marginBottom: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' };

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem' }}>🔗 Integrations</h1>
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
          Manage the n8n webhook and provider API keys used by Kleza Excelliq AI.
        </p>
      </div>

      {/* n8n Webhook */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
          <div style={{ width: '46px', height: '46px', background: '#ff634710', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>⚡</div>
          <div>
            <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.95rem' }}>n8n Workflow Webhook</div>
            <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: '600' }}>● Connected & Active</div>
          </div>
        </div>
        <p style={{ fontSize: '0.83rem', color: '#64748b', marginBottom: '1rem', lineHeight: '1.6' }}>
          All prompts are sent to this n8n webhook. The workflow routes your input through configured AI chains and returns responses to the dashboard.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.65rem 1rem', fontSize: '0.78rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
            {WEBHOOK}
          </div>
          <button onClick={copy} style={{ padding: '0.65rem 1.1rem', background: copied ? '#dcfce7' : '#eff6ff', border: `1px solid ${copied ? '#bbf7d0' : '#bfdbfe'}`, borderRadius: '10px', color: copied ? '#16a34a' : '#2563eb', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {copied ? '✓ Copied' : '📋 Copy URL'}
          </button>
        </div>
      </div>

      {/* API Keys */}
      <div style={card}>
        <h3 style={{ fontWeight: '700', color: '#0f172a', marginBottom: '0.5rem', fontSize: '0.95rem' }}>🔑 API Keys</h3>
        <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '1.25rem', lineHeight: '1.6' }}>
          Keys are stored locally in your browser and sent to the n8n workflow with every request.
        </p>
        {API_DEFS.map(api => {
          const hasKey = Boolean(keys[api.field]);
          const isEditing = editing[api.field];
          const isSaved = saved[api.field];
          const isVisible = visible[api.field];
          const maskedKey = hasKey
            ? (keys[api.field].slice(0, 6) + '••••••••••' + keys[api.field].slice(-4))
            : '';

          return (
            <div key={api.field} style={{ padding: '1rem 0', borderBottom: '1px solid #f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: isEditing ? '0.75rem' : 0 }}>
                <span style={{ fontSize: '1.3rem' }}>{api.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '0.875rem', color: '#0f172a' }}>{api.name}</div>
                  <div style={{ fontSize: '0.72rem', fontWeight: '600', color: hasKey ? '#16a34a' : '#94a3b8' }}>
                    {isSaved ? '✓ Saved' : hasKey ? '● Connected' : '● Not configured'}
                  </div>
                </div>
                {hasKey && !isEditing && (
                  <code style={{ fontSize: '0.75rem', color: '#64748b', background: '#f8fafc', padding: '4px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isVisible ? keys[api.field] : maskedKey}
                    <span
                      onClick={() => setVisible(v => ({ ...v, [api.field]: !v[api.field] }))}
                      style={{ cursor: 'pointer', color: '#94a3b8', fontSize: '0.8rem' }}
                      title={isVisible ? 'Hide' : 'Show'}
                    >{isVisible ? '🙈' : '👁'}</span>
                  </code>
                )}
                {!isEditing && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => startEdit(api.field)}
                      style={{ padding: '0.45rem 1rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#2563eb', fontWeight: '600', fontSize: '0.75rem', cursor: 'pointer' }}
                    >{hasKey ? '✏️ Edit' : '+ Add Key'}</button>
                    {hasKey && (
                      <button
                        onClick={() => removeKey(api.field)}
                        style={{ padding: '0.45rem 0.8rem', background: 'white', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontWeight: '600', fontSize: '0.75rem', cursor: 'pointer' }}
                        title="Remove key"
                      >✕</button>
                    )}
                  </div>
                )}
              </div>

              {isEditing && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', paddingLeft: '2.3rem' }}>
                  <input
                    autoFocus
                    type="text"
                    value={draft[api.field] || ''}
                    onChange={e => setDraft(d => ({ ...d, [api.field]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') commitKey(api.field); if (e.key === 'Escape') cancelEdit(api.field); }}
                    placeholder={api.placeholder}
                    style={{ flex: 1, border: `1.5px solid ${api.color}60`, borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.8rem', fontFamily: 'monospace', outline: 'none', color: '#0f172a' }}
                  />
                  <button
                    onClick={() => commitKey(api.field)}
                    style={{ padding: '0.5rem 0.9rem', background: api.color, border: 'none', borderRadius: '8px', color: 'white', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer' }}
                  >Save</button>
                  <button
                    onClick={() => cancelEdit(api.field)}
                    style={{ padding: '0.5rem 0.9rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#64748b', fontWeight: '600', fontSize: '0.75rem', cursor: 'pointer' }}
                  >Cancel</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default IntegrationsPage;
