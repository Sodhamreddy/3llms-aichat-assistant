import { useEffect, useRef, useState, useCallback } from 'react';
import { ensureClientId, loadStoredUser } from '../utils/clientIdentity';

const N8N_URL = import.meta.env.VITE_N8N_URL || '/n8n-proxy/webhook/bf39cd7e-9f1b-4b3e-98eb-8b746cd2b510/chat';

const MODEL_DEFS = [
  { key: 'openai', name: 'ChatGPT', color: '#10a37f' },
  { key: 'claude', name: 'Claude', color: '#d97757' },
  { key: 'gemini', name: 'Gemini', color: '#4285f4' },
];

const PRICING = {
  openai: { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
  claude: { input: 0.80 / 1_000_000, output: 4.00 / 1_000_000 },
  gemini: { input: 0.075 / 1_000_000, output: 0.30 / 1_000_000 },
};

const calcCost = (key, inputTokens, outputTokens) =>
  ((inputTokens || 0) * PRICING[key].input) + ((outputTokens || 0) * PRICING[key].output);

const readUserConfig = () => {
  const user = loadStoredUser();
  return {
    enabledModels: user.enabledModels?.length ? user.enabledModels : ['openai', 'gemini', 'claude'],
    apiKeys: user.apiKeys || {},
  };
};

const renderInline = (text, kp = 'i') =>
  String(text).split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
    const key = `${kp}-${i}`;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={key}>{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={key} style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 4, fontSize: '0.87em' }}>{part.slice(1, -1)}</code>;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return <a key={key} href={link[2]} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>{link[1]}</a>;
    return part;
  });

const isTableSep = line => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
const parseRow = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());

const MarkdownBlock = ({ text }) => {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const code = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(<pre key={`code-${i}`} style={{ background: '#111827', color: '#e5e7eb', borderRadius: 10, padding: '12px 14px', overflowX: 'auto', fontSize: '0.82rem', lineHeight: 1.6 }}><code>{code.join('\n')}</code></pre>);
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      blocks.push(<div key={`h-${i}`} style={{ margin: level === 1 ? '4px 0 8px' : '14px 0 6px', fontSize: level === 1 ? '1.08rem' : '0.96rem', fontWeight: 800, color: '#1c1c1c' }}>{renderInline(heading[2], `h-${i}`)}</div>);
      i += 1;
      continue;
    }

    if (trimmed.includes('|') && lines[i + 1] && isTableSep(lines[i + 1])) {
      const headers = parseRow(trimmed);
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].trim().includes('|')) {
        rows.push(parseRow(lines[i]));
        i += 1;
      }
      blocks.push(
        <div key={`table-${i}`} style={{ overflowX: 'auto', margin: '10px 0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead><tr>{headers.map((cell, idx) => <th key={idx} style={{ textAlign: 'left', padding: '7px 9px', border: '1px solid #e5e7eb', background: '#f9fafb' }}>{renderInline(cell, `th-${idx}`)}</th>)}</tr></thead>
            <tbody>{rows.map((row, r) => <tr key={r}>{headers.map((_, c) => <td key={c} style={{ padding: '7px 9px', border: '1px solid #e5e7eb', verticalAlign: 'top' }}>{renderInline(row[c] || '', `td-${r}-${c}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }

    if (/^([-*]|\d+\.)\s+/.test(trimmed)) {
      const ordered = /^\d+\./.test(trimmed);
      const items = [];
      while (i < lines.length && /^([-*]|\d+\.)\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^([-*]|\d+\.)\s+/, ''));
        i += 1;
      }
      const List = ordered ? 'ol' : 'ul';
      blocks.push(<List key={`list-${i}`} style={{ margin: '6px 0 12px', paddingLeft: '1.35rem' }}>{items.map((item, idx) => <li key={idx} style={{ margin: '4px 0', lineHeight: 1.7 }}>{renderInline(item, `li-${idx}`)}</li>)}</List>);
      continue;
    }

    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,4}\s/.test(lines[i].trim()) &&
      !/^([-*]|\d+\.)\s+/.test(lines[i].trim()) &&
      !(lines[i].trim().includes('|') && lines[i + 1] && isTableSep(lines[i + 1]))
    ) {
      para.push(lines[i].trim());
      i += 1;
    }
    blocks.push(<p key={`p-${i}`} style={{ margin: '0 0 11px', lineHeight: 1.75, color: '#2d2d2d' }}>{para.map((line, idx) => <span key={idx}>{renderInline(line, `p-${i}-${idx}`)}{idx < para.length - 1 && <br />}</span>)}</p>);
  }

  return <div>{blocks}</div>;
};

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text || '').then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      })}
      style={{ border: '1px solid #e5e7eb', background: copied ? '#ecfdf5' : '#fff', color: copied ? '#047857' : '#64748b', borderRadius: 8, padding: '5px 10px', fontWeight: 800, fontSize: '0.72rem', cursor: 'pointer' }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
};

const ModelCards = ({ responses, selectedModels }) => {
  const isN8nError = (text) => typeof text === 'string' && (
    text.startsWith('Error:') || text.startsWith('error:') ||
    text.toLowerCase().includes('service unavailable') ||
    text.toLowerCase().includes('try again later')
  );

  const cards = MODEL_DEFS.filter(model => selectedModels.includes(model.key) || model.key === 'claude')
    .map(model => ({ ...model, text: responses[model.key] || '' }))
    .filter(model => model.text);

  if (!cards.length) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, width: '100%' }}>
      {cards.map(card => {
        const hasError = isN8nError(card.text);
        return (
          <div key={card.key} style={{ background: hasError ? '#fffbeb' : '#fff', border: `1px solid ${hasError ? '#fde68a' : card.color + '25'}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 5px rgba(15,23,42,0.05)' }}>
            <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, background: hasError ? '#fef9c3' : `${card.color}0a`, borderBottom: `1px solid ${hasError ? '#fde68a' : card.color + '18'}` }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: hasError ? '#f59e0b' : card.color }} />
              <strong style={{ color: '#1c1c1c', fontSize: '0.84rem', flex: 1 }}>{card.name}</strong>
              {hasError && <span style={{ fontSize: '0.68rem', background: '#fef08a', color: '#92400e', padding: '2px 7px', borderRadius: 99, fontWeight: 700 }}>Unavailable</span>}
            </div>
            <div style={{ padding: '14px 16px', maxHeight: 300, overflowY: 'auto', fontSize: '0.88rem' }}>
              {hasError ? (
                <p style={{ color: '#92400e', fontSize: '0.82rem', lineHeight: 1.6, margin: 0 }}>
                  ⚠️ This model is currently unavailable. Check the API key or node configuration in your n8n workflow.
                </p>
              ) : (
                <>
                  <MarkdownBlock text={card.text} />
                  <CopyButton text={card.text} />
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const PromptControl = ({ onRunComplete, onFollowUpComplete, mode: modeProp, onModeChange }) => {
  const initialConfig = readUserConfig();
  const [prompt, setPrompt] = useState('');
  const [submittedPrompt, setSubmittedPrompt] = useState('');
  const [selectedModels, setSelectedModels] = useState(initialConfig.enabledModels);
  const [modeInternal, setModeInternal] = useState('battle');
  const mode = modeProp ?? modeInternal;
  const setMode = onModeChange ?? setModeInternal;
  const [modeOpen, setModeOpen] = useState(false);
  const [status, setStatus] = useState('idle');
  const [responses, setResponses] = useState({ openai: '', claude: '', gemini: '' });
  const [synthesis, setSynthesis] = useState('');
  const [elapsed, setElapsed] = useState('');
  const [runningElapsed, setRunningElapsed] = useState(0);
  const [error, setError] = useState('');
  const [followUps, setFollowUps] = useState([]);
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [followUpStatus, setFollowUpStatus] = useState('idle');
  const textareaRef = useRef(null);
  const bottomRef = useRef(null);
  const historyIdRef = useRef(null);
  const sessionIdRef = useRef(`session-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const timerRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    el.style.overflowY = el.scrollHeight > 200 ? 'auto' : 'hidden';
  }, [prompt, followUpQuestion]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [synthesis, followUps.length, status, followUpStatus]);

  useEffect(() => {
    if (!modeOpen) return;
    const close = (e) => { if (!e.target.closest('[data-mode-dropdown]')) setModeOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [modeOpen]);

  const toggleModel = (key) => {
    setSelectedModels(prev => {
      const next = prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key];
      return next.length ? next : prev;
    });
  };

  const buildStats = (key, responseText, usage = {}) => {
    if (usage[key] && (usage[key].input || usage[key].input_tokens)) {
      const input = usage[key].input || usage[key].input_tokens || 0;
      const output = usage[key].output || usage[key].output_tokens || 0;
      return { tokens: input + output, cost: calcCost(key, input, output), isEstimate: false };
    }
    const input = Math.ceil((submittedPrompt || prompt).length / 4);
    const output = Math.ceil(String(responseText || '').length / 4);
    return { tokens: input + output, cost: calcCost(key, input, output), isEstimate: true };
  };

  const callWorkflow = async (chatInput, options = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000);
    try {
      const res = await fetch(N8N_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          action: 'sendMessage',
          sessionId: sessionIdRef.current,
          chatInput,
          selectedModels,
        }),
      });
      const raw = await res.text();
      if (raw.trimStart().startsWith('<')) throw new Error('n8n returned an HTML page — check the webhook URL or n8n workflow error.');
      let data;
      try { data = JSON.parse(raw); } catch { throw new Error(`Invalid JSON from n8n: ${raw.slice(0, 120)}`); }
      if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
      return Array.isArray(data) && data.length > 0 ? data[0] : data;
    } finally {
      clearTimeout(timeout);
    }
  };

  const runPrompt = async () => {
    const question = prompt.trim();
    if (!question || status === 'running') return;

    setSubmittedPrompt(question);
    setPrompt('');
    setStatus('running');
    setError('');
    setResponses({ openai: '', claude: '', gemini: '' });
    setSynthesis('');
    setElapsed('');
    setRunningElapsed(0);
    setFollowUps([]);
    const startedAt = Date.now();
    timerRef.current = setInterval(() => {
      setRunningElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    try {
      const raw = await callWorkflow(question);
      const nextResponses = {
        openai: selectedModels.includes('openai') ? (raw.openai || raw.gpt || '') : '',
        claude: raw.claude || raw.anthropic || '',
        gemini: selectedModels.includes('gemini') ? (raw.gemini || raw.google || '') : '',
      };
      const finalAnswer = raw.output || raw.synthesis || nextResponses.claude || 'No response.';
      const elapsedVal = ((Date.now() - startedAt) / 1000).toFixed(2);
      const usage = raw.usage || {};
      const stats = {
        openai: selectedModels.includes('openai') ? buildStats('openai', nextResponses.openai, usage) : { tokens: null, cost: null, isEstimate: false },
        claude: buildStats('claude', nextResponses.claude || finalAnswer, usage),
        gemini: selectedModels.includes('gemini') ? buildStats('gemini', nextResponses.gemini, usage) : { tokens: null, cost: null, isEstimate: false },
      };
      const totalTokens = (stats.openai.tokens || 0) + (stats.claude.tokens || 0) + (stats.gemini.tokens || 0);
      const runCost = (stats.openai.cost || 0) + (stats.claude.cost || 0) + (stats.gemini.cost || 0);

      setResponses(nextResponses);
      setSynthesis(finalAnswer);
      setElapsed(elapsedVal);
      setStatus('complete');
      if (onRunComplete) {
        historyIdRef.current = onRunComplete({
          prompt: question,
          openai: nextResponses.openai,
          gemini: nextResponses.gemini,
          claude: finalAnswer,
          stage1Claude: nextResponses.claude,
          tokenData: { totalTokens, runCost, isEstimate: !usage || Object.keys(usage).length === 0 },
          elapsed: elapsedVal,
        });
      }
    } catch (e) {
      setStatus('idle');
      const msg = e.name === 'AbortError'
        ? 'Request timed out (2 min). Check n8n workflow.'
        : e.message === 'Failed to fetch'
        ? 'Could not reach n8n — check CORS settings in n8n (allow origin: *) or the n8n URL may be wrong.'
        : e.message;
      setError(msg || 'Unknown error from n8n');
    } finally {
      clearInterval(timerRef.current);
    }
  };

  const runFollowUp = async () => {
    const question = followUpQuestion.trim();
    if (!question || followUpStatus === 'running') return;

    setFollowUpQuestion('');
    setFollowUpStatus('running');
    const startedAt = Date.now();
    const previous = [
      `Original question: ${submittedPrompt}`,
      `Previous answer: ${synthesis || responses.claude}`,
      followUps.map((item, index) => `Follow-up ${index + 1}: ${item.question}\nAnswer: ${item.synthesis || item.answer}`).join('\n\n'),
      `New follow-up: ${question}`,
    ].filter(Boolean).join('\n\n');

    try {
      const raw = await callWorkflow(previous);
      const followUpResponses = {
        openai: raw.openai || raw.gpt || '',
        claude: raw.claude || raw.anthropic || '',
        gemini: raw.gemini || raw.google || '',
      };
      const answer = raw.output || raw.synthesis || followUpResponses.claude || 'No response.';
      const elapsedVal = ((Date.now() - startedAt) / 1000).toFixed(2);
      setFollowUps(prev => [...prev, { question, answer, synthesis: answer, elapsed: elapsedVal, ...followUpResponses }]);
      if (onFollowUpComplete) {
        onFollowUpComplete({ historyId: historyIdRef.current, question, answer, elapsed: elapsedVal });
      }
    } catch (e) {
      setFollowUps(prev => [...prev, { question, answer: `Error: ${e.message}`, synthesis: '', openai: '', claude: '', gemini: '' }]);
    } finally {
      setFollowUpStatus('idle');
    }
  };

  const composerIsFollowUp = status === 'complete' && Boolean(synthesis);
  const composerValue = composerIsFollowUp ? followUpQuestion : prompt;
  const setComposerValue = composerIsFollowUp ? setFollowUpQuestion : setPrompt;
  const submitComposer = composerIsFollowUp ? runFollowUp : runPrompt;
  const busy = status === 'running' || followUpStatus === 'running';

  return (
    <div style={{ width: 'min(960px, 100%)', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {(submittedPrompt || status === 'running') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {submittedPrompt && (
            <div style={{ alignSelf: 'flex-end', maxWidth: '72%', background: '#1c1c1c', color: '#f5f5f5', borderRadius: '16px 16px 4px 16px', padding: '11px 15px', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{submittedPrompt}</div>
          )}
          {status === 'running' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#78716c', fontWeight: 700, fontSize: '0.86rem' }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#d97757', animation: 'pulse 1.2s ease-in-out infinite' }} />
              Calling ChatGPT · Claude · Gemini...
              <span style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: 6, fontVariantNumeric: 'tabular-nums' }}>{runningElapsed}s</span>
            </div>
          )}
          {mode === 'battle' && <ModelCards responses={responses} selectedModels={selectedModels} />}
          {synthesis && (
            <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#d97757', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900, flexShrink: 0 }}>C</div>
              <div style={{ flex: 1, minWidth: 0, background: '#fff', border: '1.5px solid rgba(217,119,87,0.2)', borderRadius: '4px 16px 16px 16px', padding: '16px 20px', boxShadow: '0 2px 12px rgba(217,119,87,0.08)' }}>
                <MarkdownBlock text={synthesis} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
                  {elapsed && <span style={{ fontSize: '0.72rem', color: '#9ca3af', background: '#f3f4f6', padding: '4px 8px', borderRadius: 7 }}>{elapsed}s</span>}
                  <CopyButton text={synthesis} />
                </div>
              </div>
            </div>
          )}
          {followUps.map((item, index) => (
            <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ alignSelf: 'flex-end', maxWidth: '72%', background: '#1c1c1c', color: '#f5f5f5', borderRadius: '14px 14px 4px 14px', padding: '10px 14px', lineHeight: 1.65 }}>{item.question}</div>
              {mode === 'battle' && <ModelCards responses={item} selectedModels={selectedModels} />}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '14px 18px' }}>
                <MarkdownBlock text={item.synthesis || item.answer} />
                <CopyButton text={item.synthesis || item.answer} />
              </div>
            </div>
          ))}
          {followUpStatus === 'running' && <div style={{ color: '#78716c', fontWeight: 800, fontSize: '0.86rem' }}>Running your follow-up...</div>}
          <div ref={bottomRef} />
        </div>
      )}

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 12, padding: '0.75rem 0.9rem', fontWeight: 800, fontSize: '0.84rem' }}>{error}</div>
      )}

      <div style={{ background: '#fff', border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
        <textarea
          ref={textareaRef}
          value={composerValue}
          onChange={e => setComposerValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComposer(); } }}
          placeholder={composerIsFollowUp ? 'Ask a follow-up...' : 'Ask anything...'}
          disabled={busy}
          rows={2}
          style={{ width: '100%', display: 'block', background: 'transparent', border: 'none', outline: 'none', resize: 'none', padding: '15px 18px 8px', color: '#1a1a1a', fontSize: '0.96rem', lineHeight: 1.55, fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px 12px', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1, alignItems: 'center' }}>
            {MODEL_DEFS.map(model => (
              <button
                key={model.key}
                onClick={() => toggleModel(model.key)}
                disabled={busy || model.key === 'claude'}
                title={model.key === 'claude' ? 'Claude is always used for synthesis' : model.name}
                style={{ border: `1px solid ${selectedModels.includes(model.key) || model.key === 'claude' ? model.color : '#e5e7eb'}`, background: selectedModels.includes(model.key) || model.key === 'claude' ? `${model.color}10` : '#fff', color: selectedModels.includes(model.key) || model.key === 'claude' ? model.color : '#94a3b8', borderRadius: 999, padding: '5px 10px', fontSize: '0.72rem', fontWeight: 900, cursor: busy || model.key === 'claude' ? 'default' : 'pointer' }}
              >
                {model.name}
              </button>
            ))}
          </div>
          <button
            onClick={submitComposer}
            disabled={busy || !composerValue.trim()}
            style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: !busy && composerValue.trim() ? '#1a1a1a' : '#e5e7eb', color: !busy && composerValue.trim() ? '#fff' : '#9ca3af', display: 'grid', placeItems: 'center', cursor: !busy && composerValue.trim() ? 'pointer' : 'not-allowed', flexShrink: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromptControl;
