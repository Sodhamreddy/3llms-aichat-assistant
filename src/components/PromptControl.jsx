import { useState, useEffect, useRef } from 'react';

const GEMINI_INPUT_COST  = 0.075  / 1_000_000;
const GEMINI_OUTPUT_COST = 0.30   / 1_000_000;

const SUGGESTIONS = [
  { icon: '✍️', label: 'Write something' },
  { icon: '🔍', label: 'Compare models' },
  { icon: '💡', label: 'Brainstorm ideas' },
  { icon: '🧮', label: 'Analyze data' },
];

/* ─── Model Card ──────────────────────────────────────────────────── */
const ModelCard = ({ name, color, status, response, elapsed, tokens, costUSD, isEstimate }) => {
  const [displayed, setDisplayed] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    clearInterval(timer.current);
    if (status === 'complete' && response) {
      let i = 0;
      timer.current = setInterval(() => {
        setDisplayed(response.slice(0, i));
        i++;
        if (i > response.length) clearInterval(timer.current);
      }, 4);
    }
    if (status === 'idle') setDisplayed('');
    return () => clearInterval(timer.current);
  }, [status, response]);

  const running  = status === 'running';
  const complete = status === 'complete';

  return (
    <div style={{
      flex: 1, minWidth: '280px',
      background: '#ffffff',
      border: `1.5px solid ${running ? color + '50' : 'rgba(0,0,0,0.07)'}`,
      borderRadius: '18px',
      overflow: 'hidden',
      boxShadow: running
        ? `0 0 0 4px ${color}12, 0 8px 28px rgba(0,0,0,0.07)`
        : '0 2px 8px rgba(0,0,0,0.04)',
      transition: 'all 0.3s ease',
      transform: running ? 'translateY(-2px)' : 'none',
      display: 'flex', flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: color,
            boxShadow: `0 0 0 3px ${color}20`,
          }} />
          <div>
            <div style={{ fontWeight: '600', fontSize: '0.875rem', color: '#1a1a1a' }}>{name}</div>
            <div style={{ fontSize: '0.6rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '500' }}>Active Node</div>
          </div>
        </div>
        <span style={{
          fontSize: '0.65rem', padding: '3px 9px', borderRadius: '20px', fontWeight: '600',
          background: complete ? '#f0fdf4' : running ? `${color}10` : '#f5f5f5',
          color: complete ? '#16a34a' : running ? color : '#9ca3af',
          border: `1px solid ${complete ? '#bbf7d0' : running ? color + '30' : '#e5e7eb'}`,
        }}>
          {running ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>◌</span>Running</span> : complete ? 'Done' : 'Idle'}
        </span>
      </div>

      {/* Body */}
      <div style={{
        flex: 1, minHeight: '220px', maxHeight: '280px',
        padding: '16px', fontSize: '0.875rem', lineHeight: '1.75',
        color: '#374151', overflowY: 'auto',
      }}>
        {status === 'idle' ? (
          <div style={{
            height: '180px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '8px',
            color: '#d1d5db'
          }}>
            <span style={{ fontSize: '1.75rem', animation: 'float 4s ease-in-out infinite' }}>💤</span>
            <span style={{ fontSize: '0.8rem', fontWeight: '500' }}>Awaiting input…</span>
          </div>
        ) : (
          <div style={{ whiteSpace: 'pre-wrap' }}>
            {displayed}
            {running && <span style={{ color, animation: 'blink 0.8s ease infinite', fontWeight: 'bold' }}>▋</span>}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
        padding: '10px 16px',
        borderTop: '1px solid rgba(0,0,0,0.05)',
        background: '#fafafa'
      }}>
        <Chip icon="⏱" val={elapsed != null ? `${elapsed}s` : '—'} />
        <Chip icon="🪙" val={tokens != null ? `${Number(tokens).toLocaleString()} tkn` : '—'} suffix={isEstimate && tokens > 0 ? ' ~' : ''} />
        {costUSD > 0 && <Chip icon="💵" val={`$${costUSD.toFixed(6)}`} green />}
        <button
          onClick={() => navigator.clipboard.writeText(response || '')}
          title="Copy"
          style={{
            marginLeft: 'auto', width: '26px', height: '26px', borderRadius: '6px',
            background: 'white', border: '1px solid #e5e7eb',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: '0.7rem', color: '#6b7280'
          }}
        >📋</button>
      </div>
    </div>
  );
};

const Chip = ({ icon, val, suffix = '', green = false }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: '3px',
    fontSize: '0.67rem', fontWeight: '600', padding: '3px 7px', borderRadius: '6px',
    background: green ? '#f0fdf4' : '#f3f4f6',
    color: green ? '#059669' : '#6b7280',
  }}>{icon} {val}{suffix}</span>
);

/* ─── Main Control ────────────────────────────────────────────────── */
const PromptControl = ({ onRunComplete }) => {
  const [prompt, setPrompt]       = useState('');
  const [status, setStatus]       = useState('idle');
  const [content, setContent]     = useState({ openai: '', claude: '', gemini: '' });
  const [stats, setStats]         = useState({ elapsed: null, totalTokens: null, runCost: null, isEstimate: false });
  const textareaRef               = useRef(null);

  /* Auto-grow textarea */
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [prompt]);

  const handleRun = async () => {
    if (!prompt.trim() || status === 'running') return;
    setStatus('running');
    const t0 = Date.now();

    try {
      const res  = await fetch('https://n8n.kleza.io/webhook/bf39cd7e-9f1b-4b3e-98eb-8b746cd2b510/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatInput: prompt })
      });
      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
      const data    = await res.json();
      const raw     = Array.isArray(data) && data.length > 0 ? data[0] : data;

      let openaiRes = '', claudeRes = '', geminiRes = '';
      if (raw.openai || raw.claude || raw.gemini) {
        openaiRes = raw.openai || raw.gpt || '';
        claudeRes = raw.claude || raw.anthropic || '';
        geminiRes = raw.gemini || raw.google || '';
      } else {
        const text = raw.text || raw.output || raw.message || (typeof data === 'string' ? data : '');
        const slice = (src, from, to) => {
          const a = src.toLowerCase().indexOf(from.toLowerCase());
          if (a === -1) return '';
          const dash = src.indexOf('---', a);
          if (dash === -1) return '';
          let s = dash;
          while (s < src.length && /[-\n\r ]/.test(src[s])) s++;
          if (to) {
            const b = src.toLowerCase().indexOf(to.toLowerCase(), s);
            if (b !== -1) { let e = b; while (e > s && /[-\n\r ]/.test(src[e-1])) e--; return src.slice(s, e).trim(); }
          }
          return src.slice(s).trim();
        };
        openaiRes = slice(text, 'OpenAI', 'Claude') || slice(text, 'GPT', 'Claude');
        claudeRes = slice(text, 'Claude', 'Gemini');
        geminiRes = slice(text, 'Gemini', null);
        if (!openaiRes && !claudeRes && !geminiRes) geminiRes = text;
      }

      const meta = raw.usageMetadata || raw.usage || raw.tokenUsage || null;
      let inputTokens, outputTokens, totalTokens, isEstimate;
      if (meta) {
        inputTokens  = meta.promptTokenCount    || meta.input_tokens  || meta.inputTokens  || 0;
        outputTokens = meta.candidatesTokenCount || meta.output_tokens || meta.outputTokens || 0;
        totalTokens  = meta.totalTokenCount      || meta.totalTokens  || inputTokens + outputTokens;
        isEstimate   = false;
      } else {
        const active = geminiRes || claudeRes || openaiRes || '';
        inputTokens  = Math.ceil(prompt.length / 4);
        outputTokens = Math.ceil(active.length / 4);
        totalTokens  = inputTokens + outputTokens;
        isEstimate   = true;
      }
      const runCost = inputTokens * GEMINI_INPUT_COST + outputTokens * GEMINI_OUTPUT_COST;

      setContent({
        openai: openaiRes || 'OpenAI node not active.',
        claude: claudeRes || 'Claude node not active.',
        gemini: geminiRes || 'No Gemini response.',
      });
      setStats({ elapsed, totalTokens, runCost, isEstimate });
      if (onRunComplete) onRunComplete({ prompt, gemini: geminiRes, claude: claudeRes, openai: openaiRes, tokenData: { inputTokens, outputTokens, totalTokens, runCost, isEstimate } });
      setStatus('complete');
    } catch (e) {
      console.error(e);
      setStatus('idle');
      alert('Failed to reach n8n workflow.');
    }
  };

  const isActive = t => t && !t.includes('not active') && !t.includes('No response') && !t.includes('No Gemini');

  const models = [
    { name: 'OpenAI GPT-4o',      color: '#10a37f', key: 'openai', response: content.openai },
    { name: 'Anthropic Claude-3', color: '#d97757', key: 'claude', response: content.claude },
    { name: 'Google Gemini 1.5',  color: '#4285f4', key: 'gemini', response: content.gemini },
  ];

  const canRun = prompt.trim().length > 0 && status !== 'running';

  return (
    <div style={{ width: '100%' }}>
    <div style={{ maxWidth: '860px', margin: '0 auto', width: '100%' }}>

      {/* ── Input Card — Claude.ai exact style ── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: '20px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
        overflow: 'hidden',
        marginBottom: '14px',
      }}>
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleRun(); }}
          placeholder="Ask your 3 AI experts anything…"
          rows={3}
          style={{
            width: '100%', display: 'block',
            background: 'transparent', border: 'none', outline: 'none',
            resize: 'none', overflow: 'hidden',
            padding: '18px 20px 10px',
            color: '#1a1a1a', fontSize: '1rem', lineHeight: '1.6',
            fontFamily: 'inherit', fontWeight: '400',
          }}
        />

        {/* Bottom bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px 14px',
        }}>
          {/* Left chips */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {stats.runCost != null && (
              <span style={{ fontSize: '0.72rem', color: '#9ca3af', alignSelf: 'center' }}>
                {stats.isEstimate ? '~' : ''}{Number(stats.totalTokens).toLocaleString()} tkn ·{' '}
                <span style={{ color: '#059669', fontWeight: '600' }}>${stats.runCost.toFixed(6)}</span>
              </span>
            )}
          </div>

          {/* Right: Send button — Claude's circular dark button */}
          <button
            onClick={handleRun}
            disabled={!canRun}
            style={{
              width: '38px', height: '38px', borderRadius: '50%', border: 'none',
              background: canRun ? '#1a1a1a' : '#e5e7eb',
              color: canRun ? '#ffffff' : '#9ca3af',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: canRun ? 'pointer' : 'not-allowed',
              fontSize: '1rem', lineHeight: 1,
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => { if (canRun) e.currentTarget.style.background = '#111111'; }}
            onMouseLeave={e => { if (canRun) e.currentTarget.style.background = '#1a1a1a'; }}
            title="Run (Ctrl+Enter)"
          >
            {status === 'running'
              ? <span style={{ fontSize: '0.8rem', animation: 'spin 1s linear infinite', display: 'inline-block' }}>◌</span>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
            }
          </button>
        </div>
      </div>

      {/* ── Suggestion chips — Claude style ── */}
      {status === 'idle' && (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
          {SUGGESTIONS.map(s => (
            <button
              key={s.label}
              onClick={() => setPrompt(s.label)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', borderRadius: '20px',
                background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.1)',
                color: '#374151', fontSize: '0.83rem', fontWeight: '400',
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s',
                backdropFilter: 'blur(4px)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.8)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      )}

    </div>{/* end inner 860px wrapper */}

      {/* ── Model Cards — full width, below input ── */}
      {status !== 'idle' && (
        <div style={{
          display: 'flex', gap: '1rem', overflowX: 'auto',
          paddingBottom: '0.5rem', marginTop: '1.5rem',
          width: '100%',
        }}>
          {models.map(m => {
            const active = status === 'complete' && isActive(m.response);
            return (
              <ModelCard
                key={m.key}
                name={m.name}
                color={m.color}
                status={status}
                response={m.response}
                elapsed={active ? stats.elapsed : status === 'complete' ? '—' : null}
                tokens={active ? stats.totalTokens : status === 'complete' ? 0 : null}
                costUSD={active ? stats.runCost : 0}
                isEstimate={stats.isEstimate}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PromptControl;
