import { useState, useEffect, useRef } from 'react';

// Pricing per 1M tokens (input / output)
const PRICING = {
  openai: { input: 0.40  / 1_000_000, output: 1.60  / 1_000_000 }, // GPT-4.1 mini
  claude: { input: 0.80  / 1_000_000, output: 4.00  / 1_000_000 }, // Claude Haiku 4.5
  gemini: { input: 0.075 / 1_000_000, output: 0.30  / 1_000_000 }, // Gemini 1.5 Flash
};

const calcCost = (key, input, output) =>
  input * PRICING[key].input + output * PRICING[key].output;

const SUGGESTIONS = [
  { icon: '✍️', label: 'Write something' },
  { icon: '🔍', label: 'Compare models' },
  { icon: '💡', label: 'Brainstorm ideas' },
  { icon: '🧮', label: 'Analyze data' },
];

/* ─── Error Parser ────────────────────────────────────────────────── */
const parseError = (text) => {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.startsWith('error:') || t.includes('error:')) {
    if (t.includes('quota') || t.includes('rate limit') || t.includes('too many requests') || t.includes('429'))
      return { icon: '⚠️', title: 'Rate Limit / Quota Exceeded', detail: 'Your API quota has been exhausted or the rate limit was hit. Try again later or upgrade your plan.' };
    if (t.includes('unauthorized') || t.includes('invalid api key') || t.includes('api key') || t.includes('authentication') || t.includes('401'))
      return { icon: '🔑', title: 'Invalid API Key', detail: 'The API key configured in n8n is missing or incorrect. Check your credentials.' };
    if (t.includes('bad request') || t.includes('invalid') || t.includes('parameters') || t.includes('400'))
      return { icon: '🚫', title: 'Bad Request', detail: 'The request parameters are invalid or unsupported by this model.' };
    if (t.includes('not found') || t.includes('model') || t.includes('404'))
      return { icon: '🔍', title: 'Model Not Found', detail: 'The requested model does not exist or is not available on this account.' };
    if (t.includes('timeout') || t.includes('timed out') || t.includes('408'))
      return { icon: '⏱️', title: 'Request Timed Out', detail: 'The model took too long to respond. Try a shorter prompt.' };
    if (t.includes('server') || t.includes('500') || t.includes('502') || t.includes('503'))
      return { icon: '🛠️', title: 'Server Error', detail: 'The AI provider returned a server-side error. Try again in a moment.' };
    return { icon: '❌', title: 'Request Failed', detail: 'An unexpected error occurred while contacting this model.' };
  }
  return null;
};

const ErrorBlock = ({ error }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    height: '100%', minHeight: '160px', gap: '10px', padding: '12px',
    textAlign: 'center',
  }}>
    <span style={{ fontSize: '2rem' }}>{error.icon}</span>
    <div style={{ fontWeight: '700', fontSize: '0.85rem', color: '#dc2626' }}>{error.title}</div>
    <div style={{
      fontSize: '0.75rem', color: '#6b7280', lineHeight: '1.6',
      background: '#fef2f2', border: '1px solid #fecaca',
      borderRadius: '8px', padding: '8px 12px', maxWidth: '240px',
    }}>{error.detail}</div>
  </div>
);

/* ─── Model Card ──────────────────────────────────────────────────── */
const ModelCard = ({ name, color, status, response, elapsed, tokens, costUSD, isEstimate, onManualPaste, fullWidth }) => {
  const [displayed, setDisplayed] = useState('');
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const timer = useRef(null);
  const errorInfo = status === 'complete' ? parseError(response) : null;

  useEffect(() => {
    clearInterval(timer.current);
    if (status === 'complete' && response && !parseError(response)) {
      let i = 0;
      timer.current = setInterval(() => {
        setDisplayed(response.slice(0, i));
        i++;
        if (i > response.length) clearInterval(timer.current);
      }, 4);
    }
    if (status === 'idle') { setDisplayed(''); setPasteMode(false); setPasteText(''); }
    return () => clearInterval(timer.current);
  }, [status, response]);

  const handlePasteSubmit = () => {
    if (!pasteText.trim()) return;
    onManualPaste(pasteText.trim());
    setPasteMode(false);
    setPasteText('');
  };

  const running  = status === 'running';
  const complete = status === 'complete';

  return (
    <div style={{
      flex: fullWidth ? 'none' : 1,
      width: fullWidth ? '100%' : undefined,
      minWidth: fullWidth ? undefined : '280px',
      background: errorInfo ? '#fffbfb' : '#ffffff',
      border: `1.5px solid ${running ? color + '50' : errorInfo ? '#fecaca' : 'rgba(0,0,0,0.07)'}`,
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
        flex: 1, minHeight: fullWidth ? '300px' : '220px', maxHeight: fullWidth ? '600px' : '280px',
        padding: '16px', fontSize: '0.875rem', lineHeight: '1.75',
        color: '#374151', overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        {pasteMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
            <textarea
              autoFocus
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handlePasteSubmit(); }}
              placeholder="Paste Claude's response here… (Ctrl+Enter to confirm)"
              style={{
                flex: 1, width: '100%', border: `1.5px solid ${color}60`,
                borderRadius: '10px', padding: '10px', fontSize: '0.85rem',
                lineHeight: '1.6', resize: 'none', outline: 'none',
                fontFamily: 'inherit', color: '#374151', background: '#fafafa',
                minHeight: '140px',
              }}
            />
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setPasteMode(false); setPasteText(''); }} style={{
                padding: '5px 12px', borderRadius: '8px', border: '1px solid #e5e7eb',
                background: 'white', color: '#6b7280', fontSize: '0.75rem', cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={handlePasteSubmit} disabled={!pasteText.trim()} style={{
                padding: '5px 12px', borderRadius: '8px', border: 'none',
                background: pasteText.trim() ? color : '#e5e7eb',
                color: pasteText.trim() ? 'white' : '#9ca3af',
                fontSize: '0.75rem', cursor: pasteText.trim() ? 'pointer' : 'not-allowed', fontWeight: '600',
              }}>Set Response</button>
            </div>
          </div>
        ) : status === 'idle' ? (
          <div style={{
            height: '180px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '8px',
            color: '#d1d5db'
          }}>
            <span style={{ fontSize: '1.75rem', animation: 'float 4s ease-in-out infinite' }}>💤</span>
            <span style={{ fontSize: '0.8rem', fontWeight: '500' }}>Awaiting input…</span>
          </div>
        ) : errorInfo ? (
          <ErrorBlock error={errorInfo} />
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
        {!errorInfo && <Chip icon="🪙" val={tokens != null ? `${Number(tokens).toLocaleString()} tkn` : '—'} suffix={isEstimate && tokens > 0 ? ' ~' : ''} />}
        {!errorInfo && costUSD > 0 && <Chip icon="💵" val={`$${costUSD.toFixed(6)}`} green />}
        {errorInfo && <span style={{ fontSize: '0.67rem', color: '#f87171', fontWeight: '600' }}>No tokens used</span>}
        {onManualPaste && complete && !pasteMode && (
          <button
            onClick={() => setPasteMode(true)}
            title="Paste response manually"
            style={{
              padding: '3px 8px', borderRadius: '6px', border: `1px solid ${color}40`,
              background: `${color}10`, color: color,
              display: 'flex', alignItems: 'center', gap: '3px',
              cursor: 'pointer', fontSize: '0.65rem', fontWeight: '600',
            }}
          >📋 Paste</button>
        )}
        <button
          onClick={() => navigator.clipboard.writeText(response || '')}
          title="Copy"
          style={{
            marginLeft: onManualPaste ? '4px' : 'auto', width: '26px', height: '26px', borderRadius: '6px',
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

const PLAYWRIGHT_URL = 'http://localhost:3001/run-prompt';
const N8N_URL        = 'https://n8n.kleza.io/webhook/bf39cd7e-9f1b-4b3e-98eb-8b746cd2b510/chat';

/* ─── Main Control ────────────────────────────────────────────────── */
const PromptControl = ({ onRunComplete }) => {
  const [prompt, setPrompt]       = useState('');
  const [status, setStatus]       = useState('idle');
  const [content, setContent]     = useState({ openai: '', claude: '', gemini: '' });
  const [elapsed, setElapsed]     = useState(null);
  const [usePlaywright, setUsePlaywright] = useState(false);
  const [modelStats, setModelStats] = useState({
    openai: { tokens: null, cost: null, isEstimate: false },
    claude: { tokens: null, cost: null, isEstimate: false },
    gemini: { tokens: null, cost: null, isEstimate: false },
  });
  const textareaRef               = useRef(null);

  /* Auto-grow textarea */
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [prompt]);

  const buildStats = (key, text) => {
    const inp = Math.ceil(prompt.length / 4);
    const out = Math.ceil((text || '').length / 4);
    return { tokens: inp + out, cost: calcCost(key, inp, out), isEstimate: true };
  };

  const handleRunPlaywright = async () => {
    setStatus('running');
    setContent({ openai: '', claude: '', gemini: '' });
    const t0 = Date.now();

    try {
      const res = await fetch(PLAYWRIGHT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || res.statusText);
      }

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const event = JSON.parse(line.slice(6));

          if (event.type === 'partial') {
            setContent(prev => ({ ...prev, ...event }));
          } else if (event.type === 'complete') {
            finalResult = event;
          } else if (event.type === 'error') {
            throw new Error(event.message);
          }
        }
      }

      if (!finalResult) throw new Error('No complete event from Playwright server.');

      const { openai: oR, claude: cR, gemini: gR, elapsed: el } = finalResult;
      const newStats = {
        openai: buildStats('openai', oR),
        claude: buildStats('claude', cR),
        gemini: buildStats('gemini', gR),
      };

      setContent({ openai: oR || 'No response.', claude: cR || 'No response.', gemini: gR || 'No response.' });
      setElapsed(el || ((Date.now() - t0) / 1000).toFixed(2));
      setModelStats(newStats);

      const totalTokens = newStats.openai.tokens + newStats.claude.tokens + newStats.gemini.tokens;
      const totalCost   = newStats.openai.cost   + newStats.claude.cost   + newStats.gemini.cost;
      if (onRunComplete) onRunComplete({
        prompt, openai: oR, claude: cR, gemini: gR,
        tokenData: { totalTokens, runCost: totalCost, isEstimate: true },
      });
      setStatus('complete');
    } catch (e) {
      console.error(e);
      setStatus('idle');
      alert(`Playwright server error: ${e.message}\n\nMake sure you ran: cd playwright-server && node server.js`);
    }
  };

  const handleRunN8N = async () => {
    setStatus('running');
    const t0 = Date.now();

    try {
      const res  = await fetch(N8N_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatInput: prompt })
      });
      const elapsedVal = ((Date.now() - t0) / 1000).toFixed(2);
      const data = await res.json();
      const raw  = Array.isArray(data) && data.length > 0 ? data[0] : data;

      const openaiRes = raw.openai || raw.gpt   || '';
      const claudeRes = raw.claude || raw.anthropic || '';
      const geminiRes = raw.gemini || raw.google || '';

      const usageRaw = raw.usage || {};
      const promptIn = Math.ceil(prompt.length / 4);

      const resolveStats = (key, responseText) => {
        const u = usageRaw[key];
        if (u && (u.input || u.input_tokens)) {
          const inp = u.input || u.input_tokens || 0;
          const out = u.output || u.output_tokens || 0;
          return { tokens: inp + out, cost: calcCost(key, inp, out), isEstimate: false };
        }
        const inp = promptIn;
        const out = Math.ceil((responseText || '').length / 4);
        return { tokens: inp + out, cost: calcCost(key, inp, out), isEstimate: true };
      };

      const newModelStats = {
        openai: resolveStats('openai', openaiRes),
        claude: resolveStats('claude', claudeRes),
        gemini: resolveStats('gemini', geminiRes),
      };

      const totalCost   = newModelStats.openai.cost   + newModelStats.claude.cost   + newModelStats.gemini.cost;
      const totalTokens = newModelStats.openai.tokens + newModelStats.claude.tokens + newModelStats.gemini.tokens;

      setContent({
        openai: openaiRes || 'OpenAI node not active.',
        claude: claudeRes || 'Claude node not active.',
        gemini: geminiRes || 'No Gemini response.',
      });
      setElapsed(elapsedVal);
      setModelStats(newModelStats);

      if (onRunComplete) onRunComplete({
        prompt, openai: openaiRes, claude: claudeRes, gemini: geminiRes,
        tokenData: { totalTokens, runCost: totalCost, isEstimate: newModelStats.gemini.isEstimate },
      });
      setStatus('complete');
    } catch (e) {
      console.error(e);
      setStatus('idle');
      alert('Failed to reach n8n workflow.');
    }
  };

  const handleRun = () => usePlaywright ? handleRunPlaywright() : handleRunN8N();

  const handleManualPaste = (key, text) => {
    setContent(prev => ({ ...prev, [key]: text }));
    const est = Math.ceil(text.length / 4);
    setModelStats(prev => ({
      ...prev,
      [key]: { tokens: est, cost: calcCost(key, Math.ceil(prompt.length / 4), est), isEstimate: true },
    }));
    if (status !== 'complete') setStatus('complete');
  };

  const models = [
    { name: 'OpenAI GPT-4.1 Mini',    color: '#10a37f', key: 'openai', response: content.openai },
    { name: usePlaywright ? 'Claude — Final Synthesis' : 'Claude Haiku 4.5', color: '#d97757', key: 'claude', response: content.claude },
    { name: 'Google Gemini 1.5 Flash', color: '#4285f4', key: 'gemini', response: content.gemini },
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
            {status === 'complete' && (() => {
              const keys = ['openai', 'claude', 'gemini'];
              const successKeys = keys.filter(k => !parseError(content[k]));
              const totalTokens = successKeys.reduce((s, k) => s + (modelStats[k].tokens || 0), 0);
              const totalCost   = successKeys.reduce((s, k) => s + (modelStats[k].cost   || 0), 0);
              const anyEstimate = successKeys.some(k => modelStats[k].isEstimate);
              if (successKeys.length === 0) return null;
              return (
                <span style={{ fontSize: '0.72rem', color: '#9ca3af', alignSelf: 'center' }}>
                  {anyEstimate ? '~' : ''}{Number(totalTokens).toLocaleString()} tkn ·{' '}
                  <span style={{ color: '#059669', fontWeight: '600' }}>${totalCost.toFixed(6)}</span>
                </span>
              );
            })()}
          </div>

          {/* Mode toggle — two buttons */}
          <div style={{
            display: 'flex', alignItems: 'center',
            background: '#f3f4f6', borderRadius: '20px',
            padding: '3px', gap: '2px',
          }}>
            <button
              onClick={() => setUsePlaywright(false)}
              title="n8n API mode"
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 12px', borderRadius: '16px', border: 'none',
                background: !usePlaywright ? '#ffffff' : 'transparent',
                color: !usePlaywright ? '#1a1a1a' : '#9ca3af',
                fontSize: '0.72rem', fontWeight: '600', cursor: 'pointer',
                boxShadow: !usePlaywright ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              <span>⚡</span>
              <span>API</span>
            </button>
            <button
              onClick={() => setUsePlaywright(true)}
              title="Playwright browser mode"
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 12px', borderRadius: '16px', border: 'none',
                background: usePlaywright ? '#ffffff' : 'transparent',
                color: usePlaywright ? '#7c3aed' : '#9ca3af',
                fontSize: '0.72rem', fontWeight: '600', cursor: 'pointer',
                boxShadow: usePlaywright ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              <span>🎭</span>
              <span>Browser</span>
            </button>
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

      {/* ── Model Cards ── */}
      {status !== 'idle' && !usePlaywright && (
        <div style={{
          display: 'flex', gap: '1rem', overflowX: 'auto',
          paddingBottom: '0.5rem', marginTop: '1.5rem', width: '100%',
        }}>
          {models.map(m => {
            const ms = modelStats[m.key];
            return (
              <ModelCard
                key={m.key}
                name={m.name}
                color={m.color}
                status={status}
                response={m.response}
                elapsed={status === 'complete' ? elapsed : null}
                tokens={status === 'complete' ? ms.tokens : null}
                costUSD={status === 'complete' ? ms.cost : 0}
                isEstimate={ms.isEstimate}
                onManualPaste={(text) => handleManualPaste(m.key, text)}
              />
            );
          })}
        </div>
      )}

      {/* ── Playwright mode: source pills + big Claude synthesis ── */}
      {status !== 'idle' && usePlaywright && (
        <div style={{ marginTop: '1.5rem', width: '100%' }}>
          {/* Source status row */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {[
              { key: 'openai',  label: 'ChatGPT',  color: '#10a37f' },
              { key: 'gemini',  label: 'Gemini',   color: '#4285f4' },
            ].map(s => {
              const done = status === 'complete' && content[s.key] && !content[s.key].startsWith('Error');
              const running = status === 'running';
              return (
                <div key={s.key} style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '6px 14px', borderRadius: '20px',
                  background: done ? `${s.color}10` : '#f3f4f6',
                  border: `1px solid ${done ? s.color + '30' : '#e5e7eb'}`,
                  fontSize: '0.78rem', fontWeight: '600',
                  color: done ? s.color : '#9ca3af',
                }}>
                  <span style={{
                    width: '7px', height: '7px', borderRadius: '50%',
                    background: done ? s.color : running ? s.color : '#d1d5db',
                    display: 'inline-block',
                    animation: running ? 'blink 0.8s ease infinite' : 'none',
                  }} />
                  {s.label}
                  <span style={{ fontWeight: '400', opacity: 0.7 }}>
                    {done ? ' ✓ collected' : running ? ' collecting…' : ''}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Claude synthesis — full width */}
          <ModelCard
            name="Claude — Final Synthesis"
            color="#d97757"
            status={status}
            response={content.claude}
            elapsed={status === 'complete' ? elapsed : null}
            tokens={status === 'complete' ? modelStats.claude.tokens : null}
            costUSD={status === 'complete' ? modelStats.claude.cost : 0}
            isEstimate={modelStats.claude.isEstimate}
            onManualPaste={(text) => handleManualPaste('claude', text)}
            fullWidth
          />
        </div>
      )}
    </div>
  );
};

export default PromptControl;
