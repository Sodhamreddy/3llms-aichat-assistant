import { useState } from 'react';

const MODELS = [
  {
    id: 'gemini', name: 'Google Gemini 3.1 Pro', provider: 'Google',
    color: '#4285f4', bg: '#eef2ff', active: true,
    costIn: '$0.000125 / 1k', costOut: '$0.000375 / 1k',
    context: '1M tokens', speed: '~2.1s',
    strengths: ['Long context', 'Creative writing', 'Multimodal', 'Code'],
    desc: "Google's most capable multimodal model. Excellent for long documents, creative tasks, and rich context."
  },
  {
    id: 'claude', name: 'Anthropic Claude Opus 4.6', provider: 'Anthropic',
    color: '#d97757', bg: '#fff7ed', active: false,
    costIn: '$0.003 / 1k', costOut: '$0.015 / 1k',
    context: '200k tokens', speed: '~0.8s',
    strengths: ['Reasoning', 'Code', 'Analysis', 'Safety'],
    desc: "Anthropic's flagship model. Best for structured analysis, code review, and nuanced reasoning tasks."
  },
  {
    id: 'openai', name: 'OpenAI GPT-5.2', provider: 'OpenAI',
    color: '#10a37f', bg: '#f0fdf4', active: false,
    costIn: '$0.005 / 1k', costOut: '$0.015 / 1k',
    context: '128k tokens', speed: '~1.2s',
    strengths: ['General purpose', 'Vision', 'Functions', 'JSON mode'],
    desc: "OpenAI's most versatile model. Great for general-purpose tasks, tool calling, and structured outputs."
  },
];

const LLMModelsPage = () => {
  const [states, setStates] = useState(() =>
    Object.fromEntries(MODELS.map(m => [m.id, m.active]))
  );
  const toggle = id => setStates(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem' }}>🧠 LLM Models</h1>
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
          Compare AI models side-by-side and toggle which ones participate in your prompt runs.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '1.5rem' }}>
        {MODELS.map(m => {
          const on = states[m.id];
          return (
            <div key={m.id} style={{
              background: 'white', borderRadius: '24px', padding: '1.75rem',
              border: `2px solid ${on ? m.color + '30' : '#f1f5f9'}`,
              boxShadow: on ? `0 8px 24px ${m.color}18` : '0 2px 8px rgba(0,0,0,0.03)',
              transition: 'all 0.3s ease'
            }}>
              {/* Header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '46px', height: '46px', background: m.bg, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>🤖</div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#0f172a' }}>{m.name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '500' }}>{m.provider}</div>
                  </div>
                </div>
                <div
                  onClick={() => toggle(m.id)}
                  title={on ? 'Deactivate' : 'Activate'}
                  style={{
                    width: '44px', height: '24px', borderRadius: '24px',
                    background: on ? m.color : '#e2e8f0',
                    position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.3s'
                  }}
                >
                  <div style={{
                    width: '18px', height: '18px', background: 'white', borderRadius: '50%',
                    position: 'absolute', top: '3px', left: on ? '23px' : '3px',
                    transition: 'left 0.3s cubic-bezier(0.4,0,0.2,1)', boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
                  }} />
                </div>
              </div>

              <p style={{ fontSize: '0.83rem', color: '#64748b', lineHeight: '1.6', marginBottom: '1.1rem' }}>{m.desc}</p>

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '1.1rem' }}>
                {[['⚡ Speed', m.speed], ['📚 Context', m.context], ['📥 Input', m.costIn], ['📤 Output', m.costOut]].map(([label, val]) => (
                  <div key={label} style={{ background: '#f8fafc', borderRadius: '12px', padding: '0.65rem 0.85rem' }}>
                    <div style={{ fontSize: '0.62rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>{label}</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#334155' }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Strengths */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {m.strengths.map(s => (
                  <span key={s} style={{ padding: '3px 9px', background: m.bg, color: m.color, borderRadius: '20px', fontSize: '0.68rem', fontWeight: '700' }}>{s}</span>
                ))}
              </div>

              {/* Status badge */}
              <div style={{ marginTop: '1.1rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: on ? '#16a34a' : '#94a3b8' }}>
                  {on ? '● Active in runs' : '○ Inactive'}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Click toggle to {on ? 'disable' : 'enable'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LLMModelsPage;
