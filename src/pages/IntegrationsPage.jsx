import { useState } from 'react';

const WEBHOOK = 'https://n8n.kleza.io/webhook/bf39cd7e-9f1b-4b3e-98eb-8b746cd2b510/chat';

const IntegrationsPage = () => {
  const [copied, setCopied] = useState(false);
  const [channels, setChannels] = useState({ slack: true, email: false, whatsapp: false, sheets: true });

  const copy = () => {
    navigator.clipboard.writeText(WEBHOOK);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleCh = key => setChannels(prev => ({ ...prev, [key]: !prev[key] }));

  const Toggle = ({ on, onClick }) => (
    <div onClick={onClick} style={{ width: '44px', height: '24px', borderRadius: '24px', background: on ? '#2563eb' : '#e2e8f0', position: 'relative', cursor: 'pointer', transition: 'background 0.3s', flexShrink: 0 }}>
      <div style={{ width: '18px', height: '18px', background: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: on ? '23px' : '3px', transition: 'left 0.3s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
    </div>
  );

  const card = { background: 'white', borderRadius: '20px', padding: '1.75rem', border: '1px solid #f1f5f9', marginBottom: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' };

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem' }}>🔗 Integrations</h1>
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
          Connect PromptHub AI to your external tools. Route AI results to Slack, Sheets, email, and more.
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
        <h3 style={{ fontWeight: '700', color: '#0f172a', marginBottom: '1.25rem', fontSize: '0.95rem' }}>🔑 API Keys</h3>
        {[
          { name: 'Google Gemini API', status: 'Connected', color: '#4285f4', key: 'AIza••••••••••X1', emoji: '🌐' },
          { name: 'Anthropic Claude API', status: 'Not configured', color: '#d97757', key: '', emoji: '🔶' },
          { name: 'OpenAI API', status: 'Not configured', color: '#10a37f', key: '', emoji: '🟢' },
        ].map(api => (
          <div key={api.name} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem 0', borderBottom: '1px solid #f8fafc' }}>
            <span style={{ fontSize: '1.3rem' }}>{api.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '600', fontSize: '0.875rem', color: '#0f172a' }}>{api.name}</div>
              <div style={{ fontSize: '0.72rem', color: api.status === 'Connected' ? '#16a34a' : '#94a3b8', fontWeight: '600' }}>{api.status}</div>
            </div>
            {api.key
              ? <code style={{ fontSize: '0.75rem', color: '#64748b', background: '#f8fafc', padding: '4px 10px', borderRadius: '6px' }}>{api.key}</code>
              : <button style={{ padding: '0.45rem 1rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#2563eb', fontWeight: '600', fontSize: '0.75rem', cursor: 'pointer' }}>+ Add Key</button>
            }
          </div>
        ))}
      </div>

      {/* Output Channels */}
      <div style={card}>
        <h3 style={{ fontWeight: '700', color: '#0f172a', marginBottom: '1.25rem', fontSize: '0.95rem' }}>📡 Output Channels</h3>
        <p style={{ fontSize: '0.83rem', color: '#64748b', marginBottom: '1.25rem' }}>
          Automatically forward AI results to your preferred services after each run.
        </p>
        {[
          { key: 'slack', icon: '💬', name: 'Slack', desc: 'Post AI responses to a Slack channel' },
          { key: 'email', icon: '📧', name: 'Email', desc: 'Receive results in your inbox after each run' },
          { key: 'whatsapp', icon: '📱', name: 'WhatsApp', desc: 'Send summaries via WhatsApp Business API' },
          { key: 'sheets', icon: '📊', name: 'Google Sheets', desc: 'Auto-log all results to a spreadsheet' },
        ].map(ch => (
          <div key={ch.key} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem 0', borderBottom: '1px solid #f8fafc' }}>
            <span style={{ fontSize: '1.3rem' }}>{ch.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '600', fontSize: '0.875rem', color: '#0f172a' }}>{ch.name}</div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{ch.desc}</div>
            </div>
            <Toggle on={channels[ch.key]} onClick={() => toggleCh(ch.key)} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default IntegrationsPage;
