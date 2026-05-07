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

<<<<<<< HEAD
const readUserConfig = () => {
  const user = loadStoredUser();
  return {
    enabledModels: user.enabledModels?.length ? user.enabledModels : ['openai', 'gemini', 'claude'],
    apiKeys: user.apiKeys || {},
  };
};
=======
/* ─── Model Card ──────────────────────────────────────────────────── */
const renderInlineMarkdown = (text, keyPrefix = 'inline') => {
  const parts = String(text).split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={key}>{part.slice(1, -1)}</em>;
    return part;
  });
};

const parseTableRow = (line) =>
  line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());

const isTableSeparator = (line) =>
  /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);

const MarkdownBlock = ({ text }) => {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) { i++; continue; }

    if (/^---+$/.test(trimmed)) {
      blocks.push(<hr key={`hr-${i}`} style={{ border: 0, borderTop: '1px solid #e5e7eb', margin: '12px 0' }} />);
      i++;
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const Tag = `h${level}`;
      blocks.push(
        <Tag key={`h-${i}`} style={{
          margin: level === 1 ? '0 0 10px' : '12px 0 6px',
          fontSize: level === 1 ? '1.15rem' : level === 2 ? '1.05rem' : '0.95rem',
          lineHeight: 1.35,
          fontWeight: 700,
          color: '#111827',
        }}>
          {renderInlineMarkdown(heading[2], `h-${i}`)}
        </Tag>
      );
      i++;
      continue;
    }

    if (trimmed.includes('|') && lines[i + 1] && isTableSeparator(lines[i + 1])) {
      const headers = parseTableRow(trimmed);
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].trim().includes('|')) {
        rows.push(parseTableRow(lines[i]));
        i++;
      }
      blocks.push(
        <div key={`table-${i}`} style={{ overflowX: 'auto', margin: '10px 0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
            <thead>
              <tr>
                {headers.map((cell, idx) => (
                  <th key={`th-${idx}`} style={{ textAlign: 'left', padding: '8px 10px', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 700, color: '#111827' }}>
                    {renderInlineMarkdown(cell, `th-${idx}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr key={`tr-${rowIdx}`}>
                  {headers.map((_, cellIdx) => (
                    <td key={`td-${rowIdx}-${cellIdx}`} style={{ padding: '8px 10px', border: '1px solid #e5e7eb', verticalAlign: 'top' }}>
                      {renderInlineMarkdown(row[cellIdx] || '', `td-${rowIdx}-${cellIdx}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
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
        i++;
      }
      const ListTag = ordered ? 'ol' : 'ul';
      blocks.push(
        <ListTag key={`list-${i}`} style={{ margin: '6px 0 10px', paddingLeft: '1.3rem' }}>
          {items.map((item, idx) => (
            <li key={`li-${idx}`} style={{ margin: '2px 0' }}>{renderInlineMarkdown(item, `li-${i}-${idx}`)}</li>
          ))}
        </ListTag>
      );
      continue;
    }

    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4})\s+/.test(lines[i].trim()) &&
      !/^---+$/.test(lines[i].trim()) &&
      !/^([-*]|\d+\.)\s+/.test(lines[i].trim()) &&
      !(lines[i].trim().includes('|') && lines[i + 1] && isTableSeparator(lines[i + 1]))
    ) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push(
      <p key={`p-${i}`} style={{ margin: '0 0 9px' }}>
        {para.map((line, idx) => (
          <span key={`p-${i}-${idx}`}>
            {renderInlineMarkdown(line, `p-${i}-${idx}`)}
            {idx < para.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
  }

  return <div>{blocks}</div>;
};

const ModelCard = ({ name, color, status, response, elapsed, tokens, costUSD, isEstimate, onManualPaste, fullWidth }) => {
  const [displayed, setDisplayed] = useState('');
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const timer = useRef(null);
  const errorInfo = status === 'complete' ? parseError(response) : null;
>>>>>>> 78b2a68a (code updated according vasudha comments)

const renderInline = (text, kp = 'i') =>
  String(text).split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
    const key = `${kp}-${i}`;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={key}>{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={key} style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 4, fontSize: '0.87em' }}>{part.slice(1, -1)}</code>;
    }
<<<<<<< HEAD
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
=======
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
        flex: 1, minHeight: fullWidth ? '120px' : '220px', maxHeight: fullWidth ? '420px' : '280px',
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
          <div>
            <MarkdownBlock text={displayed} />
            {running && <span style={{ color, animation: 'blink 0.8s ease infinite', fontWeight: 'bold' }}>▋</span>}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        display: 'none', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
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
>>>>>>> 78b2a68a (code updated according vasudha comments)
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

<<<<<<< HEAD
=======
const PLAYWRIGHT_URL = 'http://localhost:3001/run-prompt';
const FOLLOWUP_URL   = 'http://localhost:3001/follow-up';
const N8N_URL        = 'https://n8n.kleza.io/webhook/bf39cd7e-9f1b-4b3e-98eb-8b746cd2b510/chat';

/* ─── Main Control ────────────────────────────────────────────────── */
const PromptControl = ({ onRunComplete, onFollowUpComplete }) => {
  const [prompt, setPrompt]       = useState('');
  const [status, setStatus]       = useState('idle');
  const [content, setContent]     = useState({ openai: '', claude: '', gemini: '' });
  const [elapsed, setElapsed]     = useState(null);
  const [usePlaywright, setUsePlaywright] = useState(false);
  const [selectedModels, setSelectedModels] = useState(['openai', 'gemini', 'claude']);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [followUps, setFollowUps] = useState([]);
  const [followUpStatus, setFollowUpStatus] = useState('idle');
  const [modelStats, setModelStats] = useState({
    openai: { tokens: null, cost: null, isEstimate: false },
    claude: { tokens: null, cost: null, isEstimate: false },
    gemini: { tokens: null, cost: null, isEstimate: false },
  });
  const textareaRef               = useRef(null);
  const historyIdRef              = useRef(null);

  /* Auto-grow textarea */
>>>>>>> 78b2a68a (code updated according vasudha comments)
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
<<<<<<< HEAD
    const input = Math.ceil((submittedPrompt || prompt).length / 4);
    const output = Math.ceil(String(responseText || '').length / 4);
    return { tokens: input + output, cost: calcCost(key, input, output), isEstimate: true };
  };
=======
  }, [prompt]);

  const buildStats = (key, text) => {
    const inp = Math.ceil(prompt.length / 4);
    const out = Math.ceil((text || '').length / 4);
    return { tokens: inp + out, cost: calcCost(key, inp, out), isEstimate: true };
  };

  const modelNames = { openai: 'ChatGPT', gemini: 'Gemini', claude: 'Claude' };
  const selectedLabel = selectedModels.length === 3
    ? 'All models'
    : selectedModels.map(k => modelNames[k]).join(' + ');

  const toggleModel = (key) => {
    setSelectedModels(prev => {
      if (prev.includes(key) && prev.length === 1) return prev;
      return prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
    });
  };

  const handleRunPlaywright = async () => {
    setStatus('running');
    setContent({ openai: '', claude: '', gemini: '' });
    setFollowUps([]);
    setFollowUpQuestion('');
    setFollowUpStatus('idle');
    const t0 = Date.now();

    try {
      const res = await fetch(PLAYWRIGHT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, selectedModels }),
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
        openai: selectedModels.includes('openai') ? buildStats('openai', oR) : { tokens: null, cost: null, isEstimate: false },
        claude: buildStats('claude', cR),
        gemini: selectedModels.includes('gemini') ? buildStats('gemini', gR) : { tokens: null, cost: null, isEstimate: false },
      };

      setContent({
        openai: selectedModels.includes('openai') ? (oR || 'No response.') : '',
        claude: cR || 'No response.',
        gemini: selectedModels.includes('gemini') ? (gR || 'No response.') : '',
      });
      setElapsed(el || ((Date.now() - t0) / 1000).toFixed(2));
      setModelStats(newStats);

      const totalTokens = (newStats.openai.tokens || 0) + (newStats.claude.tokens || 0) + (newStats.gemini.tokens || 0);
      const totalCost   = (newStats.openai.cost || 0) + (newStats.claude.cost || 0) + (newStats.gemini.cost || 0);
      if (onRunComplete) historyIdRef.current = onRunComplete({
        prompt, openai: selectedModels.includes('openai') ? oR : '', claude: cR, gemini: selectedModels.includes('gemini') ? gR : '',
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
>>>>>>> 78b2a68a (code updated according vasudha comments)

  const callWorkflow = async (chatInput, options = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000);
    try {
<<<<<<< HEAD
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
=======
      const res  = await fetch(N8N_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatInput: prompt, selectedModels })
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
        openai: selectedModels.includes('openai') ? resolveStats('openai', openaiRes) : { tokens: null, cost: null, isEstimate: false },
        claude: resolveStats('claude', claudeRes),
        gemini: selectedModels.includes('gemini') ? resolveStats('gemini', geminiRes) : { tokens: null, cost: null, isEstimate: false },
      };

      const totalCost   = (newModelStats.openai.cost || 0) + (newModelStats.claude.cost || 0) + (newModelStats.gemini.cost || 0);
      const totalTokens = (newModelStats.openai.tokens || 0) + (newModelStats.claude.tokens || 0) + (newModelStats.gemini.tokens || 0);

      setContent({
        openai: selectedModels.includes('openai') ? (openaiRes || 'OpenAI node not active.') : '',
        claude: claudeRes || 'Claude node not active.',
        gemini: selectedModels.includes('gemini') ? (geminiRes || 'No Gemini response.') : '',
      });
      setElapsed(elapsedVal);
      setModelStats(newModelStats);

      if (onRunComplete) historyIdRef.current = onRunComplete({
        prompt, openai: selectedModels.includes('openai') ? openaiRes : '', claude: claudeRes, gemini: selectedModels.includes('gemini') ? geminiRes : '',
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

  const formatClaudeContext = (baseAnswer = content.claude, items = followUps) => {
    const parts = [baseAnswer || ''];
    items.forEach((item, index) => {
      parts.push(`Follow-up ${index + 1}: ${item.question}\n\n${item.answer}`);
    });
    return parts.filter(Boolean).join('\n\n---\n\n');
  };

  const handleFollowUp = async () => {
    const question = followUpQuestion.trim();
    if (!question || followUpStatus === 'running') return;

    setFollowUpStatus('running');
    try {
      const previousAnswer = formatClaudeContext();
      const res = await fetch(FOLLOWUP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalPrompt: prompt,
          previousAnswer,
          followUpQuestion: question,
          selectedModels,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || res.statusText);
      }

      const data = await res.json();
      const answer = data.claude || 'No response.';
      const nextFollowUps = [...followUps, { question, answer }];
      const nextThread = formatClaudeContext(content.claude, nextFollowUps);

      setFollowUps(nextFollowUps);
      if (onFollowUpComplete) onFollowUpComplete({
        historyId: historyIdRef.current,
        prompt,
        question,
        answer,
      });
      setFollowUpQuestion('');
      setElapsed(data.elapsed || elapsed);
      setModelStats(prev => ({
        ...prev,
        claude: buildStats('claude', nextThread),
      }));
    } catch (e) {
      console.error(e);
      alert(`Claude follow-up error: ${e.message}`);
    } finally {
      setFollowUpStatus('idle');
    }
  };

  const claudeDisplay = content.claude;

  const models = [
    { name: 'OpenAI GPT-4.1 Mini',    color: '#10a37f', key: 'openai', response: content.openai },
    { name: usePlaywright ? 'Claude — Final Synthesis' : 'Claude Haiku 4.5', color: '#d97757', key: 'claude', response: claudeDisplay },
    { name: 'Google Gemini 1.5 Flash', color: '#4285f4', key: 'gemini', response: content.gemini },
  ].filter(m => m.key === 'claude' || selectedModels.includes(m.key));

  const canRun = prompt.trim().length > 0 && status !== 'running' && followUpStatus !== 'running';
  const canFollowUp = status === 'complete' && usePlaywright && content.claude && followUpQuestion.trim().length > 0 && followUpStatus !== 'running';
  const composerIsFollowUp = status === 'complete' && usePlaywright && Boolean(content.claude);
  const composerValue = composerIsFollowUp ? followUpQuestion : prompt;
  const canSubmitComposer = composerIsFollowUp ? canFollowUp : canRun;
  const handleComposerSubmit = () => composerIsFollowUp ? handleFollowUp() : handleRun();

  return (
    <div style={{ width: '100%', paddingBottom: '150px' }}>
    <div style={{ display: 'none', maxWidth: '860px', margin: '0 auto', width: '100%' }}>
>>>>>>> 78b2a68a (code updated according vasudha comments)

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
<<<<<<< HEAD
=======

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
>>>>>>> 78b2a68a (code updated according vasudha comments)
          <button
            onClick={submitComposer}
            disabled={busy || !composerValue.trim()}
            style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: !busy && composerValue.trim() ? '#1a1a1a' : '#e5e7eb', color: !busy && composerValue.trim() ? '#fff' : '#9ca3af', display: 'grid', placeItems: 'center', cursor: !busy && composerValue.trim() ? 'pointer' : 'not-allowed', flexShrink: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
          </button>
        </div>
      </div>
<<<<<<< HEAD
=======

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
        <div style={{ marginTop: '1.5rem', width: '100%', maxWidth: '900px', marginLeft: 'auto', marginRight: 'auto' }}>
          {/* Source status row */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {[
              { key: 'openai',  label: 'ChatGPT',  color: '#10a37f' },
              { key: 'gemini',  label: 'Gemini',   color: '#4285f4' },
            ].filter(s => selectedModels.includes(s.key)).map(s => {
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
          <div style={{ display: 'none' }}><ModelCard
            name="Claude — Final Synthesis"
            color="#d97757"
            status={status}
            response={claudeDisplay}
            elapsed={status === 'complete' ? elapsed : null}
            tokens={status === 'complete' ? modelStats.claude.tokens : null}
            costUSD={status === 'complete' ? modelStats.claude.cost : 0}
            isEstimate={modelStats.claude.isEstimate}
            onManualPaste={(text) => handleManualPaste('claude', text)}
            fullWidth
          /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{
              alignSelf: 'flex-end',
              maxWidth: '78%',
              background: '#1f2937',
              color: '#ffffff',
              borderRadius: '18px 18px 4px 18px',
              padding: '12px 14px',
              fontSize: '0.95rem',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}>{prompt}</div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: '#d97757',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 750,
                flexShrink: 0,
              }}>C</div>
              <div style={{
                flex: 1,
                minWidth: 0,
                maxWidth: '760px',
                color: '#1f2937',
                lineHeight: 1.72,
                fontSize: '0.98rem',
                background: '#ffffff',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: '16px',
                padding: '16px 18px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              }}>
                {status === 'running' ? 'Synthesizing selected responses...' : <MarkdownBlock text={claudeDisplay} />}
              </div>
            </div>
          </div>
          {status === 'complete' && (
            <>
            {followUps.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px', marginBottom: '12px' }}>
                {followUps.map((item, index) => (
                  <div key={`${item.question}-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{
                      alignSelf: 'flex-end',
                      maxWidth: '78%',
                      background: '#1f2937',
                      color: '#ffffff',
                      borderRadius: '14px 14px 4px 14px',
                      padding: '10px 12px',
                      fontSize: '0.88rem',
                      lineHeight: '1.55',
                      whiteSpace: 'pre-wrap',
                    }}>{item.question}</div>
                    <div style={{
                      alignSelf: 'flex-start',
                      maxWidth: '86%',
                      background: '#ffffff',
                      color: '#1f2937',
                      border: '1px solid rgba(217,119,87,0.22)',
                      borderRadius: '14px 14px 14px 4px',
                      padding: '12px 14px',
                      fontSize: '0.9rem',
                      lineHeight: '1.65',
                      whiteSpace: 'pre-wrap',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    }}><MarkdownBlock text={item.answer} /></div>
                  </div>
                ))}
              </div>
            )}
            <div style={{
              marginTop: '12px',
              background: '#ffffff',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: '14px',
              padding: '10px',
              display: 'none',
              gap: '8px',
              alignItems: 'flex-end',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            }}>
              <textarea
                value={followUpQuestion}
                onChange={e => setFollowUpQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleFollowUp(); }}
                placeholder="Ask Claude a follow-up about this answer..."
                rows={2}
                disabled={followUpStatus === 'running'}
                style={{
                  flex: 1,
                  minHeight: '44px',
                  maxHeight: '120px',
                  resize: 'vertical',
                  border: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                  fontSize: '0.88rem',
                  lineHeight: '1.5',
                  color: '#1f2937',
                  background: 'transparent',
                  padding: '6px 8px',
                }}
              />
              <button
                onClick={handleFollowUp}
                disabled={!canFollowUp}
                title="Ask Claude follow-up"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  border: 'none',
                  background: canFollowUp ? '#d97757' : '#e5e7eb',
                  color: canFollowUp ? '#ffffff' : '#9ca3af',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: canFollowUp ? 'pointer' : 'not-allowed',
                  flexShrink: 0,
                }}
              >
                {followUpStatus === 'running'
                  ? <span style={{ fontSize: '0.8rem', animation: 'spin 1s linear infinite', display: 'inline-block' }}>â—Œ</span>
                  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                }
              </button>
            </div>
            </>
          )}
        </div>
      )}
      <div style={{
        position: 'fixed',
        left: 'calc(260px + 2rem)',
        right: '2rem',
        bottom: '22px',
        zIndex: 80,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{
          width: 'min(860px, 100%)',
          background: '#ffffff',
          border: '1px solid rgba(0,0,0,0.12)',
          borderRadius: '18px',
          boxShadow: '0 10px 34px rgba(0,0,0,0.12)',
          overflow: 'visible',
          pointerEvents: 'auto',
        }}>
          <textarea
            ref={textareaRef}
            value={composerValue}
            onChange={e => composerIsFollowUp ? setFollowUpQuestion(e.target.value) : setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleComposerSubmit(); }}
            placeholder={composerIsFollowUp ? 'Ask Claude a follow-up...' : 'Ask your selected AI experts anything...'}
            rows={2}
            disabled={status === 'running' || followUpStatus === 'running'}
            style={{
              width: '100%',
              display: 'block',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              overflow: 'hidden',
              padding: '16px 18px 8px',
              color: '#1a1a1a',
              fontSize: '0.98rem',
              lineHeight: '1.55',
              fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '8px 12px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
              <button
                onClick={() => setModelMenuOpen(v => !v)}
                disabled={status === 'running' || followUpStatus === 'running'}
                style={{
                  padding: '7px 11px',
                  borderRadius: '10px',
                  border: '1px solid #e5e7eb',
                  background: '#ffffff',
                  color: '#374151',
                  cursor: status === 'running' || followUpStatus === 'running' ? 'not-allowed' : 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                }}
              >
                {selectedLabel}
              </button>
              {modelMenuOpen && (
                <div style={{
                  position: 'absolute',
                  bottom: '42px',
                  left: 0,
                  width: '210px',
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.14)',
                  padding: '8px',
                }}>
                  {[
                    { key: 'openai', label: 'ChatGPT' },
                    { key: 'gemini', label: 'Gemini' },
                    { key: 'claude', label: 'Claude' },
                  ].map(model => (
                    <label key={model.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.86rem', color: '#374151' }}>
                      <input
                        type="checkbox"
                        checked={selectedModels.includes(model.key)}
                        onChange={() => toggleModel(model.key)}
                      />
                      {model.label}
                    </label>
                  ))}
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af', padding: '6px 8px 2px' }}>
                    Claude always creates the final synthesis.
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', background: '#f3f4f6', borderRadius: '18px', padding: '3px', gap: '2px' }}>
                <button
                  onClick={() => setUsePlaywright(false)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: '15px',
                    border: 'none',
                    background: !usePlaywright ? '#ffffff' : 'transparent',
                    color: !usePlaywright ? '#111827' : '#9ca3af',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >API</button>
                <button
                  onClick={() => setUsePlaywright(true)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: '15px',
                    border: 'none',
                    background: usePlaywright ? '#ffffff' : 'transparent',
                    color: usePlaywright ? '#7c3aed' : '#9ca3af',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >Browser</button>
              </div>
            </div>
            <button
              onClick={handleComposerSubmit}
              disabled={!canSubmitComposer}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                border: 'none',
                background: canSubmitComposer ? '#1a1a1a' : '#e5e7eb',
                color: canSubmitComposer ? '#ffffff' : '#9ca3af',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: canSubmitComposer ? 'pointer' : 'not-allowed',
                flexShrink: 0,
              }}
              title={composerIsFollowUp ? 'Ask follow-up' : 'Run'}
            >
              {(status === 'running' || followUpStatus === 'running')
                ? <span style={{ fontSize: '0.8rem', animation: 'spin 1s linear infinite', display: 'inline-block' }}>...</span>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
              }
            </button>
          </div>
        </div>
      </div>
>>>>>>> 78b2a68a (code updated according vasudha comments)
    </div>
  );
};

export default PromptControl;
