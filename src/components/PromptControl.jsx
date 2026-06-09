import React, { useState, useEffect, useRef } from 'react';
import { PLAYWRIGHT_SERVER } from '../config/api';
import { ensureClientId } from '../utils/clientIdentity';

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

const RESEARCH_STEPS = [
  { icon: '🔍', text: 'Searching the web…' },
  { icon: '📄', text: 'Reading sources…' },
  { icon: '🧠', text: 'Analyzing information…' },
  { icon: '✏️', text: 'Synthesizing findings…' },
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
const renderInlineMarkdown = (text, keyPrefix = 'inline') => {
  const parts = String(text).split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={key}>{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
      return <code key={key} style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: '4px', fontSize: '0.87em', fontFamily: 'monospace', color: '#1c1c1c' }}>{part.slice(1, -1)}</code>;
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) return <a key={key} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>{linkMatch[1]}</a>;
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

    if (trimmed.startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(
        <pre key={`code-${i}`} style={{
          background: '#1a1a1a', color: '#e5e7eb', borderRadius: '10px',
          padding: '14px 16px', overflowX: 'auto', fontSize: '0.82rem',
          lineHeight: 1.6, margin: '10px 0', fontFamily: 'monospace',
        }}>
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const Tag = `h${level}`;
      blocks.push(
        <Tag key={`h-${i}`} style={{
          margin: level === 1 ? '4px 0 10px' : '18px 0 6px',
          fontSize: level === 1 ? '1.08rem' : level === 2 ? '0.97rem' : '0.9rem',
          lineHeight: 1.4,
          fontWeight: 700,
          color: '#1c1c1c',
          letterSpacing: '-0.01em',
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
        <ListTag key={`list-${i}`} style={{ margin: '6px 0 12px', paddingLeft: '1.4rem' }}>
          {items.map((item, idx) => (
            <li key={`li-${idx}`} style={{ margin: '4px 0', lineHeight: 1.7 }}>{renderInlineMarkdown(item, `li-${i}-${idx}`)}</li>
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
      <p key={`p-${i}`} style={{ margin: '0 0 12px', color: '#2d2d2d' }}>
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

/* Normalize ChatGPT / Gemini responses to structured markdown.
   Handles: Gemini +1 citations, **bold** headings, ASCII box/tree diagrams, plain-text headings.
   Key fixes: look past blank lines for next content, detect colon-ending headings. */
const normalizeToMarkdown = (text) => {
  if (!text) return text;

  const lines = String(text).replace(/\r\n/g, '\n').split('\n');

  // ── Step 1: strip Gemini citation lines (+1, +2, [1], [2]) ──────────────
  const filtered = lines.filter(
    l => !/^\s*\+\d+\s*$/.test(l) && !/^\s*\[\d+\]\s*$/.test(l)
  );

  // ── Step 2: detect ASCII box/tree diagram (many lines starting with |) ──
  const nonEmpty = filtered.filter(l => l.trim());
  const pipeLines = nonEmpty.filter(l => /^\s*\|/.test(l.trim()));
  if (pipeLines.length > 0 && pipeLines.length >= nonEmpty.length * 0.35) {
    const result = [];
    for (const line of filtered) {
      const t = line.trim();
      if (!t) continue;
      if (/^[\s|+\-=]+$/.test(t)) continue;
      const leadingPipes = (t.match(/^(\|\s*)+/)?.[0] || '').match(/\|/g)?.length ?? 0;
      const depth = Math.max(0, leadingPipes - 1);
      const content = t.replace(/^(\|\s*)+/, '').replace(/(\s*\|)+\s*$/, '').trim();
      if (!content || /^[+\-=]+$/.test(content)) continue;
      result.push(depth === 0 ? `## ${content}` : `${'  '.repeat(depth - 1)}- ${content}`);
    }
    if (result.length > 0) return result.join('\n');
  }

  // ── Step 3: per-line normalization for regular text ─────────────────────
  return filtered.map((line, i) => {
    const t = line.trim();
    if (!t) return '';

    // Already a markdown heading — leave alone
    if (/^#{1,4}\s/.test(t)) return line;

    // Standalone bold line: **Some Heading** or **Some Heading:** → ## Some Heading
    if (/^\*\*[^*]+\*\*\s*:?\s*$/.test(t)) {
      return '## ' + t.replace(/^\*\*/, '').replace(/\*\*\s*:?\s*$/, '');
    }

    // Plain-text heading heuristic
    const noMarkdown   = !/[*_`#\[\]]/.test(t);
    const noSentence   = !t.includes('. ') && !t.endsWith('.') && !t.endsWith(',') && !t.endsWith('!');
    const notList      = !/^[-*•\d]/.test(t);
    const notTransition = !/^(However|Moreover|Therefore|Additionally|Furthermore|Also|But|And|Yet|Still)\b/i.test(t);

    if (noMarkdown && noSentence && notList && notTransition) {
      // Pattern 1: short line ending with colon → almost always a section label
      if (t.endsWith(':') && t.length <= 60) {
        return '## ' + t.slice(0, -1);
      }
      // Pattern 2: short isolated line preceded by blank, followed by real content
      // (look ahead past blank lines so we don't miss headings separated by empty lines)
      const prevIsBlank = !(filtered[i - 1] || '').trim();
      let nextContent = '';
      for (let j = i + 1; j < filtered.length; j++) {
        if ((filtered[j] || '').trim()) { nextContent = filtered[j].trim(); break; }
      }
      if (prevIsBlank && t.length <= 55 && nextContent.length > 40) {
        return '## ' + t;
      }
    }

    return line;
  }).join('\n');
};

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: color, flexShrink: 0,
          }} />
          <span style={{ fontWeight: '600', fontSize: '0.83rem', color: '#1c1c1c', letterSpacing: '-0.01em' }}>{name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {complete && (
            <button
              onClick={() => navigator.clipboard.writeText(response || '')}
              title="Copy response"
              style={{
                padding: '3px 9px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.1)',
                background: 'transparent', color: '#78716c', fontSize: '0.7rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              Copy
            </button>
          )}
          <span style={{
            fontSize: '0.65rem', padding: '3px 9px', borderRadius: '20px', fontWeight: '600',
            background: complete ? '#f0fdf4' : running ? `${color}10` : '#f5f5f5',
            color: complete ? '#16a34a' : running ? color : '#9ca3af',
            border: `1px solid ${complete ? '#bbf7d0' : running ? color + '30' : '#e5e7eb'}`,
          }}>
            {running
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>◌</span>
                  Running
                </span>
              : complete ? 'Done' : 'Idle'
            }
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{
        flex: 1, minHeight: fullWidth ? '120px' : '200px', maxHeight: fullWidth ? '500px' : '400px',
        padding: '16px 18px', fontSize: '0.9rem', lineHeight: '1.8',
        color: '#1c1c1c', overflowY: 'auto',
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

      {/* Footer — token stats */}
      {complete && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
          padding: '8px 18px 10px',
          borderTop: '1px solid rgba(0,0,0,0.05)',
        }}>
          {elapsed != null && <Chip icon="⏱" val={`${elapsed}s`} />}
          {!errorInfo && tokens != null && (
            <Chip icon="🪙" val={`${Number(tokens).toLocaleString()} tokens`} suffix={isEstimate ? ' ~' : ''} />
          )}
          {!errorInfo && costUSD > 0 && <Chip icon="💵" val={`$${costUSD.toFixed(6)}`} green />}
          {errorInfo && <span style={{ fontSize: '0.67rem', color: '#f87171', fontWeight: '600' }}>No tokens used</span>}
          {onManualPaste && !pasteMode && (
            <button
              onClick={() => setPasteMode(true)}
              title="Paste response manually"
              style={{
                padding: '2px 8px', borderRadius: '6px', border: `1px solid ${color}40`,
                background: `${color}08`, color: color,
                cursor: 'pointer', fontSize: '0.65rem', fontWeight: '600', fontFamily: 'inherit',
              }}
            >Paste manually</button>
          )}
        </div>
      )}
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

const CopyBtn = ({ text, label = '' }) => {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        padding: '5px 11px', borderRadius: '8px',
        border: '1px solid rgba(0,0,0,0.09)',
        background: copied ? '#f0fdf4' : '#ffffff',
        color: copied ? '#16a34a' : '#6b7280',
        fontSize: '0.72rem', fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!copied) e.currentTarget.style.background = '#f9fafb'; }}
      onMouseLeave={e => { if (!copied) e.currentTarget.style.background = '#ffffff'; }}
    >
      {copied
        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      }
      {copied ? 'Copied!' : (label || 'Copy')}
    </button>
  );
};

/* ─── Battle Card ─────────────────────────────────────────────────── */
const BattleCard = ({ name, color, content, isRunning, minimized, onToggleMinimize }) => {
  const [displayed, setDisplayed] = useState('');
  const timerRef = useRef(null);
  const hasContent = content && content !== 'Synthesizing…' && content !== 'Synthesizing selected responses…';

  useEffect(() => {
    clearInterval(timerRef.current);
    if (hasContent) {
      let i = 0;
      timerRef.current = setInterval(() => {
        i += 6;
        setDisplayed(content.slice(0, i));
        if (i >= content.length) { setDisplayed(content); clearInterval(timerRef.current); }
      }, 2);
    } else {
      setDisplayed('');
    }
    return () => clearInterval(timerRef.current);
  }, [content]);

  return (
    <div style={{
      flex: 1, minWidth: '260px',
      background: '#fff',
      border: `1.5px solid ${isRunning ? color + '45' : hasContent ? color + '28' : 'rgba(0,0,0,0.07)'}`,
      borderRadius: '16px', overflow: 'hidden',
      boxShadow: isRunning ? `0 0 0 3px ${color}12, 0 6px 24px rgba(0,0,0,0.07)` : '0 2px 8px rgba(0,0,0,0.04)',
      transform: isRunning ? 'translateY(-2px)' : 'none',
      transition: 'all 0.3s ease',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '10px 14px',
        background: `linear-gradient(135deg, ${color}15, ${color}05)`,
        borderBottom: minimized ? 'none' : `1px solid ${color}18`,
        borderRadius: minimized ? '14px' : undefined,
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#1c1c1c', letterSpacing: '-0.01em' }}>{name}</span>
        <span style={{
          marginLeft: 'auto', fontSize: '0.65rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 600,
          background: hasContent ? '#f0fdf4' : isRunning ? `${color}12` : '#f5f5f5',
          color: hasContent ? '#16a34a' : isRunning ? color : '#9ca3af',
          border: `1px solid ${hasContent ? '#bbf7d0' : isRunning ? color + '30' : '#e5e7eb'}`,
        }}>
          {isRunning
            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>◌</span> Running
              </span>
            : hasContent ? 'Done' : 'Waiting…'}
        </span>
        {onToggleMinimize && (
          <div
            onClick={onToggleMinimize}
            title={minimized ? 'Expand' : 'Minimize'}
            style={{ cursor: 'pointer', width: 20, height: 20, borderRadius: '50%', border: '1px solid rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#9ca3af', flexShrink: 0, marginLeft: '4px', background: 'rgba(255,255,255,0.7)' }}
          >
            {minimized ? '▲' : '▼'}
          </div>
        )}
      </div>
      {!minimized && (
        <div style={{
          flex: 1, padding: '14px 16px', fontSize: '0.85rem', lineHeight: 1.72,
          color: '#2d2d2d', maxHeight: '360px', overflowY: 'auto', minHeight: '110px',
        }}>
          {isRunning && !hasContent
            ? <div style={{ display: 'flex', gap: '5px', alignItems: 'center', paddingTop: '6px' }}>
                {[0, 0.25, 0.5].map((d, i) => (
                  <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: color, opacity: 0.4, animation: 'blink 1s ease infinite', animationDelay: `${d}s` }} />
                ))}
              </div>
            : hasContent
              ? <>
                  <MarkdownBlock text={displayed || content} />
                  {displayed.length < content.length
                    ? <span style={{ color, animation: 'blink 0.8s ease infinite', fontWeight: 'bold' }}>▋</span>
                    : <div style={{ marginTop: '10px' }}><CopyBtn text={content} /></div>
                  }
                </>
              : <span style={{ color: '#d1d5db', fontSize: '0.8rem', fontStyle: 'italic' }}>Waiting for response…</span>
          }
        </div>
      )}
    </div>
  );
};

const PLAYWRIGHT_URL = `${PLAYWRIGHT_SERVER}/run-prompt`;
const FOLLOWUP_URL   = `${PLAYWRIGHT_SERVER}/follow-up`;
const N8N_URL        = `${PLAYWRIGHT_SERVER}/api/n8n-chat`;

/* ─── Main Control ────────────────────────────────────────────────── */
const PromptControl = ({ onRunComplete, onFollowUpComplete }) => {
  const [prompt, setPrompt]             = useState('');
  const [submittedPrompt, setSubmittedPrompt] = useState('');
  const [status, setStatus]       = useState('idle');
  const [content, setContent]     = useState({ openai: '', claude: '', gemini: '' });
  const [elapsed, setElapsed]     = useState(null);
  const [usePlaywright, setUsePlaywright] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem('ph_user') || '{}');
      return u.mode === 'browser';
    } catch { return false; }
  });
  const [selectedModels, setSelectedModels] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem('ph_user') || '{}');
      return u.enabledModels?.length ? u.enabledModels : ['openai', 'gemini', 'claude'];
    } catch { return ['openai', 'gemini', 'claude']; }
  });
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [followUps, setFollowUps] = useState([]);
  const [followUpStatus, setFollowUpStatus] = useState('idle');
  const [pendingFollowUp, setPendingFollowUp] = useState('');
  const [modelStats, setModelStats] = useState({
    openai: { tokens: null, cost: null, isEstimate: false },
    claude: { tokens: null, cost: null, isEstimate: false },
    gemini: { tokens: null, cost: null, isEstimate: false },
  });
  const [deepResearch, setDeepResearch] = useState(false);
  const [researchStepIdx, setResearchStepIdx] = useState(0);
  const [mode, setMode]           = useState('battle'); // 'invisible' | 'battle'
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [battlePhase, setBattlePhase] = useState('cards');
  const [minimizedCards, setMinimizedCards] = useState({});
  const [synthesis, setSynthesis] = useState('');
  const [showGptPanel, setShowGptPanel]     = useState(false);
  const [showGeminiPanel, setShowGeminiPanel] = useState(false);
  const textareaRef               = useRef(null);
  const historyIdRef              = useRef(null);
  const bottomRef                 = useRef(null);
  const sessionIdRef              = useRef(`session-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const abortControllerRef        = useRef(null);

  /* Auto-grow textarea */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, 200);
    el.style.height = next + 'px';
    el.style.overflowY = el.scrollHeight > 200 ? 'auto' : 'hidden';
  }, [prompt, followUpQuestion]);

  /* Cycle research step label while running in deep research mode */
  useEffect(() => {
    if (status !== 'running' || !deepResearch) { setResearchStepIdx(0); return; }
    const iv = setInterval(() => setResearchStepIdx(i => (i + 1) % RESEARCH_STEPS.length), 2500);
    return () => clearInterval(iv);
  }, [status, deepResearch]);

  /* Auto-scroll to bottom when follow-up is sent or answer arrives */
  useEffect(() => {
    if (pendingFollowUp || followUps.length > 0) {
      const scrollBottom = () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      scrollBottom();
      // second pass after React finishes painting the new bubbles
      const t = setTimeout(scrollBottom, 120);
      return () => clearTimeout(t);
    }
  }, [followUps, pendingFollowUp]);


  const buildStats = (key, text) => {
    const inp = Math.ceil(prompt.length / 4);
    const out = Math.ceil((text || '').length / 4);
    return { tokens: inp + out, cost: calcCost(key, inp, out), isEstimate: true };
  };

  const modelNames = { openai: 'ChatGPT', gemini: 'Gemini', claude: 'Claude' };
  const isNoResponseText = (text) =>
    !String(text || '').trim() || /^No response(?: received)?(?: from Gemini)?\.?$/i.test(String(text || '').trim());
  const selectedLabel = selectedModels.length === 3
    ? 'All models'
    : selectedModels.map(k => modelNames[k]).join(' + ');

  const toggleModel = (key) => {
    setSelectedModels(prev => {
      if (prev.includes(key) && prev.length === 1) return prev;
      return prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
    });
  };

  const getConnectedBrowserModels = async (clientId, requestedModels) => {
    const res = await fetch(`${PLAYWRIGHT_SERVER}/client/${encodeURIComponent(clientId)}/sessions`);
    if (!res.ok) return requestedModels;
    const data = await res.json().catch(() => ({}));
    const sessions = data.sessions || {};
    return requestedModels.filter(key => sessions[key]?.status === 'connected');
  };

  const handleStop = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setStatus('idle');
  };

  const handleRunPlaywright = async () => {
    abortControllerRef.current = new AbortController();
    setStatus('running');
    setContent({ openai: '', claude: '', gemini: '' });
    setFollowUps([]);
    setFollowUpQuestion('');
    setFollowUpStatus('idle');
    setBattlePhase('cards');
    setShowGptPanel(false);
    setShowGeminiPanel(false);
    setSynthesis('');
    setMinimizedCards({});
    const t0 = Date.now();

    try {
      const clientId = ensureClientId();
      const activeModels = await getConnectedBrowserModels(clientId, selectedModels);
      if (!activeModels.length) {
        throw new Error('No connected browser LLM accounts found. Open Settings and connect at least one model.');
      }
      if (activeModels.length !== selectedModels.length) {
        setSelectedModels(activeModels);
      }

      const res = await fetch(PLAYWRIGHT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, prompt, selectedModels: activeModels, deepResearch }),
        signal: abortControllerRef.current?.signal,
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
            // claudeRaw is Claude's direct answer — show it in the card immediately
            const update = { ...event };
            if (update.claudeRaw) { update.claude = update.claudeRaw; delete update.claudeRaw; }
            setContent(prev => ({ ...prev, ...update }));
          } else if (event.type === 'complete') {
            finalResult = event;
          } else if (event.type === 'error') {
            throw new Error(event.message);
          }
        }
      }

      if (!finalResult) throw new Error('No complete event from Playwright server.');

      const { openai: oR, claude: cR, claudeRaw: cRaw, gemini: gR, elapsed: el } = finalResult;
      // cRaw = Claude's direct answer (for the card); cR = synthesis (for the bubble)
      const claudeCardText = cRaw || cR || 'No response.';
      const newStats = {
        openai: activeModels.includes('openai') ? buildStats('openai', oR) : { tokens: null, cost: null, isEstimate: false },
        claude: activeModels.includes('claude') ? buildStats('claude', claudeCardText) : { tokens: null, cost: null, isEstimate: false },
        gemini: activeModels.includes('gemini') ? buildStats('gemini', gR) : { tokens: null, cost: null, isEstimate: false },
      };

      setContent(prev => ({
        openai: activeModels.includes('openai') ? (oR || prev.openai || 'No response.') : '',
        claude: activeModels.includes('claude') ? claudeCardText : '',
        gemini: activeModels.includes('gemini')
          ? (isNoResponseText(gR) ? (prev.gemini || gR || 'No response.') : gR)
          : '',
      }));
      setSynthesis(extractClaudeOutput(cR || ''));
      setElapsed(el || ((Date.now() - t0) / 1000).toFixed(2));
      setModelStats(newStats);

      const totalTokens = (newStats.openai.tokens || 0) + (newStats.claude.tokens || 0) + (newStats.gemini.tokens || 0);
      const totalCost   = (newStats.openai.cost || 0) + (newStats.claude.cost || 0) + (newStats.gemini.cost || 0);
      if (onRunComplete) historyIdRef.current = onRunComplete({
        prompt, openai: activeModels.includes('openai') ? oR : '', claude: activeModels.includes('claude') ? cR : '', stage1Claude: activeModels.includes('claude') ? claudeCardText : '', gemini: activeModels.includes('gemini') ? gR : '',
        tokenData: { totalTokens, runCost: totalCost, isEstimate: true },
        elapsed: el || ((Date.now() - t0) / 1000).toFixed(2),
      });
      setStatus('complete');
    } catch (e) {
      if (e.name === 'AbortError') { setStatus('idle'); return; }
      console.error(e);
      setStatus('idle');
      alert(`Playwright server error: ${e.message}\n\nMake sure you ran: cd playwright-server && node server.js`);
    }
  };

  const handleRunN8N = async () => {
    abortControllerRef.current = new AbortController();
    setStatus('running');
    setBattlePhase('cards');
    setShowGptPanel(false);
    setShowGeminiPanel(false);
    setSynthesis('');
    setMinimizedCards({});
    const t0 = Date.now();

    try {
      const res  = await fetch(N8N_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: ensureClientId(), chatInput: prompt, selectedModels, deepResearch, sessionId: sessionIdRef.current, apiKeys: (() => { try { return JSON.parse(localStorage.getItem('ph_user') || '{}').apiKeys || {}; } catch { return {}; } })() }),
        signal: abortControllerRef.current?.signal,
      });
      const elapsedVal = ((Date.now() - t0) / 1000).toFixed(2);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || res.statusText || 'n8n workflow failed.');
      const raw  = Array.isArray(data) && data.length > 0 ? data[0] : data;

      // Stage 1: individual model answers (never fall back to the synthesis field)
      const openaiRes    = raw.openai || raw.gpt || '';
      const claudeRes    = raw.claude || raw.anthropic || '';
      const geminiRes    = raw.gemini || raw.google || '';
      // Stage 2: Claude's final synthesis — comes from raw.output (or raw.synthesis)
      const synthesisText = raw.output || raw.synthesis || '';

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
        openai: selectedModels.includes('openai') ? (openaiRes || 'No response from OpenAI.') : '',
        claude: claudeRes || '',
        gemini: selectedModels.includes('gemini') ? (geminiRes || 'No response from Gemini.') : '',
      });
      setSynthesis(extractClaudeOutput(synthesisText));
      setElapsed(elapsedVal);
      setModelStats(newModelStats);

      if (onRunComplete) historyIdRef.current = onRunComplete({
        prompt, openai: selectedModels.includes('openai') ? openaiRes : '', claude: synthesisText || claudeRes, stage1Claude: claudeRes, gemini: selectedModels.includes('gemini') ? geminiRes : '',
        tokenData: { totalTokens, runCost: totalCost, isEstimate: newModelStats.gemini.isEstimate },
        elapsed: elapsedVal,
      });
      setStatus('complete');
    } catch (e) {
      if (e.name === 'AbortError') { setStatus('idle'); return; }
      console.error(e);
      const message = e.message || 'Unknown error';
      if (/gateway|time-?out|timeout|504/i.test(message)) {
        setContent({
          openai: 'n8n took too long to return the API response. Retrying this prompt through Browser Mode...',
          claude: 'n8n took too long to return the API response. Retrying this prompt through Browser Mode...',
          gemini: 'n8n took too long to return the API response. Retrying this prompt through Browser Mode...',
        });
        setSynthesis('n8n timed out while returning the workflow response, so Excelliq is retrying through the connected browser sessions.');
        await handleRunPlaywright();
        return;
      }
      setStatus('idle');
      alert(`Failed to reach n8n workflow: ${message}`);
    }
  };

  const handleRun = () => {
    setSubmittedPrompt(prompt);
    setPrompt('');
    if (usePlaywright || deepResearch) handleRunPlaywright(); else handleRunN8N();
  };

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

    setFollowUpQuestion('');
    setPendingFollowUp(question);
    setFollowUpStatus('running');
    const t0 = Date.now();

    try {
      let answer;
      let followUpModels = { openai: '', claude: '', gemini: '', synthesis: '' };

      if (!usePlaywright) {
        // API mode: embed full conversation context in chatInput (no sessionId) so n8n
        // routes through all 3 models instead of the session-memory-only Claude path.
        const prevHistory = followUps.map((fu, i) =>
          `Follow-up ${i + 1}: ${fu.question}\nAnswer: ${fu.synthesis || fu.answer}`
        ).join('\n\n');
        const contextualInput = [
          `Original question: ${prompt}`,
          `Previous answer: ${synthesis || content.claude || ''}`,
          prevHistory,
          `New follow-up: ${question}`,
        ].filter(Boolean).join('\n\n');

        const res = await fetch(N8N_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: ensureClientId(), chatInput: contextualInput, selectedModels, deepResearch: false }),
        });
        if (!res.ok) throw new Error(res.statusText);
        const data = await res.json();
        const raw = Array.isArray(data) && data.length > 0 ? data[0] : data;
        const openaiAns    = raw.openai || raw.gpt || '';
        const claudeAns    = raw.claude || raw.anthropic || '';
        const geminiAns    = raw.gemini || raw.google || '';
        // If only Claude is selected, use its direct answer — no redundant synthesis
        const synthesisAns = (selectedModels.length === 1 && selectedModels[0] === 'claude')
          ? (claudeAns || 'No response.')
          : (raw.output || claudeAns || 'No response.');
        answer = synthesisAns;
        followUpModels = { openai: openaiAns, claude: claudeAns, gemini: geminiAns, synthesis: synthesisAns };
      } else {
        // Browser mode: Playwright server runs all selected models with embedded context
        const previousAnswer = formatClaudeContext();
        const res = await fetch(FOLLOWUP_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: ensureClientId(), originalPrompt: prompt, previousAnswer, followUpQuestion: question, selectedModels }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || res.statusText);
        }
        const data = await res.json();
        // server now returns { openai, claude, gemini, output }
        const openaiAns = data.openai || '';
        const claudeAns = data.claude || '';
        const geminiAns = data.gemini || '';
        const synthesisAns = data.output || claudeAns || 'No response.';
        answer = synthesisAns;
        followUpModels = { openai: openaiAns, claude: claudeAns, gemini: geminiAns, synthesis: synthesisAns };
        setModelStats(prev => ({ ...prev, claude: buildStats('claude', claudeAns) }));
      }

      const followUpElapsed = ((Date.now() - t0) / 1000).toFixed(2);

      setFollowUps(prev => [...prev, { question, answer, elapsed: followUpElapsed, ...followUpModels }]);
      if (onFollowUpComplete) onFollowUpComplete({
        historyId: historyIdRef.current,
        prompt,
        question,
        answer,
        elapsed: followUpElapsed,
      });
    } catch (e) {
      console.error(e);
      setFollowUpQuestion(question);
      const errMsg = !usePlaywright
        ? `n8n error: ${e.message}`
        : e.message.includes('Failed to fetch')
          ? 'Cannot reach the browser server. Make sure node server.js is running in playwright-server/.'
          : e.message;
      setFollowUps(prev => [...prev, { question, answer: `⚠️ Error: ${errMsg}`, openai: '', claude: '', gemini: '', synthesis: '' }]);
    } finally {
      setFollowUpStatus('idle');
      setPendingFollowUp('');
    }
  };

  const extractClaudeOutput = (text) => {
    if (!text) return text;
    let s = String(text);

    // Strip synthesis prompt instructions if they leaked into the output
    const instructionMarkers = [
      /\nSynthesize the above into one clear/i,
      /\nReturn ONLY the final synthesized answer/i,
      /\nUse ## for section headings/i,
      /\nAnswer this question directly with your best response:/i,
    ];
    for (const marker of instructionMarkers) {
      const idx = s.search(marker);
      if (idx > 100) { s = s.slice(0, idx).trim(); break; }
    }

    // Strip knowledge-cutoff / web-search disclaimers
    s = s
      .replace(/\n{1,2}(?:However[,—–]?\s*)?(?:my|My) (?:reliable )?knowledge (?:cuts? off|cutoff)[\s\S]{0,400}/gi, '')
      .replace(/\n{1,2}(?:For what(?:'s| is) actually|For the (?:real-time|latest|freshest|actual) picture)[\s\S]{0,300}/gi, '')
      .replace(/\n{1,2}(?:You could also|Want me to do|I(?:'d|'d) recommend checking)[\s\S]{0,200}/gi, '')
      .trim();

    // Extract from "Claude responded:" markers if present (scraped UI chrome)
    const matches = [...s.matchAll(/Claude responded:\s*([\s\S]+?)(?=\nClaude responded:|\n(?:Opus|Sonnet|Haiku)\s|\nClaude is AI|$)/gi)];
    if (matches.length) {
      return matches[matches.length - 1][1]
        .replace(/\n(Opus|Sonnet|Haiku)\s.*/s, '')
        .replace(/\nClaude is AI.*/s, '')
        .replace(/\nShare\s*$/m, '')
        .trim();
    }
    return s;
  };

  const claudeDisplay = extractClaudeOutput(content.claude);

  const models = [
    { name: 'OpenAI GPT-4.1 Mini',    color: '#10a37f', key: 'openai', response: content.openai },
    { name: usePlaywright ? 'Claude — Final Synthesis' : 'Claude Haiku 4.5', color: '#d97757', key: 'claude', response: claudeDisplay },
    { name: 'Google Gemini 1.5 Flash', color: '#4285f4', key: 'gemini', response: content.gemini },
  ].filter(m => m.key === 'claude' || selectedModels.includes(m.key));

  const canRun = prompt.trim().length > 0 && status !== 'running' && followUpStatus !== 'running';
  const canFollowUp = status === 'complete' && Boolean(content.claude) && followUpQuestion.trim().length > 0 && followUpStatus !== 'running' && !pendingFollowUp;
  const composerIsFollowUp = status === 'complete' && Boolean(content.claude);
  const composerValue = composerIsFollowUp ? followUpQuestion : prompt;
  const canSubmitComposer = composerIsFollowUp ? canFollowUp : canRun;
  const handleComposerSubmit = () => composerIsFollowUp ? handleFollowUp() : handleRun();

  const closeAllMenus = () => { setModelMenuOpen(false); };

  return (
    <div style={{ width: '100%', paddingBottom: '150px' }}>

      {/* ── Top-bar mode selector ── */}
      <div style={{ position: 'fixed', top: '10px', left: '252px', zIndex: 200 }}>
        {modeMenuOpen && (
          <div onClick={() => setModeMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 198 }} />
        )}
        <div style={{ position: 'relative', zIndex: 199 }}>
          <button
            onClick={() => { setModeMenuOpen(v => !v); setModelMenuOpen(false); }}
            disabled={status === 'running' || followUpStatus === 'running'}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 13px', borderRadius: '10px',
              border: '1px solid rgba(0,0,0,0.10)',
              background: mode === 'battle' ? '#fff8f1' : '#ffffff',
              color: mode === 'battle' ? '#d97757' : '#374151',
              fontSize: '0.78rem', fontWeight: 700,
              cursor: status === 'running' || followUpStatus === 'running' ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              opacity: status === 'running' || followUpStatus === 'running' ? 0.6 : 1,
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            {mode === 'battle'
              ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            }
            {mode === 'battle' ? 'Battle Mode' : 'Invisible Mode'}
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.45 }}><polyline points="6 9 12 15 18 9"/></svg>
          </button>

          {modeMenuOpen && (
            <div style={{
              position: 'absolute',
              top: '38px',
              left: 0,
              width: '200px',
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '14px',
              boxShadow: '0 12px 30px rgba(0,0,0,0.13)',
              padding: '6px',
              zIndex: 201,
            }}>
              {[
                {
                  value: 'invisible',
                  label: 'Invisible Mode',
                  desc: 'Clean Claude synthesis only',
                  icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
                  accent: '#374151',
                },
                {
                  value: 'battle',
                  label: 'Battle Mode',
                  desc: 'Live 3-way race → synthesis',
                  icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
                  accent: '#d97757',
                },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setMode(opt.value); setModeMenuOpen(false); }}
                  style={{
                    width: '100%', textAlign: 'left',
                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                    padding: '9px 10px', borderRadius: '9px', border: 'none',
                    background: mode === opt.value ? `${opt.accent}0f` : 'transparent',
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { if (mode !== opt.value) e.currentTarget.style.background = '#f9fafb'; }}
                  onMouseLeave={e => { if (mode !== opt.value) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ color: opt.accent, marginTop: '2px', flexShrink: 0 }}>{opt.icon}</span>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: mode === opt.value ? opt.accent : '#1c1c1c', lineHeight: 1.3 }}>{opt.label}</div>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '2px' }}>{opt.desc}</div>
                  </div>
                  {mode === opt.value && (
                    <svg style={{ marginLeft: 'auto', marginTop: '3px', flexShrink: 0, color: opt.accent }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

    <div style={{ display: 'none', maxWidth: '860px', margin: '0 auto', width: '100%' }}>

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
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRun(); } }}
          placeholder="Ask your 3 AI experts anything… (Shift+Enter for new line)"
          rows={3}
          style={{
            width: '100%', display: 'block',
            background: 'transparent', border: 'none', outline: 'none',
            resize: 'none', overflowY: 'hidden',
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

      {/* ── BATTLE MODE output ── */}
      {mode === 'battle' && status !== 'idle' && (
        <div style={{ width: '100%', maxWidth: '900px', marginLeft: 'auto', marginRight: 'auto', marginTop: '1.5rem' }}>

          {/* User question bubble */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
            <div style={{ maxWidth: '72%', background: '#1c1c1c', color: '#f5f5f5', borderRadius: '16px 16px 4px 16px', padding: '11px 15px', fontSize: '0.92rem', lineHeight: 1.65, whiteSpace: 'pre-wrap', letterSpacing: '-0.01em' }}>{submittedPrompt}</div>
          </div>


          {/* 3 model response panels — side by side, capped to chat width */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'flex-start' }}>
            {[
              { key: 'openai', name: 'ChatGPT', color: '#10a37f', text: extractClaudeOutput(content.openai) },
              { key: 'gemini', name: 'Gemini',  color: '#4285f4', text: extractClaudeOutput(content.gemini) },
              { key: 'claude', name: 'Claude',  color: '#d97757', text: claudeDisplay },
            ].filter(m => m.key === 'claude' ? (status === 'running' || !!m.text) : selectedModels.includes(m.key)).map(m => {
              const panelRunning = status === 'running' && !m.text;
              const panelHasContent = !!(m.text);
              const isMin = !!minimizedCards[m.key];
              return (
                <div key={m.key} style={{ flex: 1, minWidth: '260px', border: `1px solid ${m.color}25`, borderRadius: '14px', overflow: 'hidden', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
                  {/* Panel header */}
                  <div style={{ padding: '9px 14px', background: `${m.color}0a`, borderBottom: isMin ? 'none' : `1px solid ${m.color}18`, borderRadius: isMin ? '14px' : undefined, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, fontSize: '0.83rem', color: '#1c1c1c', letterSpacing: '-0.01em' }}>{m.name}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.65rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 600, background: panelHasContent ? '#f0fdf4' : panelRunning ? `${m.color}12` : '#f5f5f5', color: panelHasContent ? '#16a34a' : panelRunning ? m.color : '#9ca3af', border: `1px solid ${panelHasContent ? '#bbf7d0' : panelRunning ? m.color + '30' : '#e5e7eb'}` }}>
                      {panelRunning
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>◌</span> Running</span>
                        : panelHasContent ? 'Done' : 'Waiting…'}
                    </span>
                    <div onClick={() => setMinimizedCards(p => ({ ...p, [m.key]: !p[m.key] }))} title={isMin ? 'Expand' : 'Minimize'} style={{ cursor: 'pointer', width: 20, height: 20, borderRadius: '50%', border: '1px solid rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#9ca3af', flexShrink: 0, marginLeft: '4px', background: 'rgba(255,255,255,0.7)' }}>
                      {isMin ? '▲' : '▼'}
                    </div>
                  </div>
                  {/* Panel content — scrollable, max 320px */}
                  {!isMin && (
                    <div style={{ padding: '14px 16px', fontSize: '0.88rem', lineHeight: 1.72, color: '#2d2d2d', maxHeight: '320px', overflowY: 'auto' }}>
                      {panelRunning
                        ? <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>{[0, 0.25, 0.5].map((d, i) => <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: m.color, opacity: 0.4, animation: 'blink 1s ease infinite', animationDelay: `${d}s` }} />)}</div>
                        : panelHasContent
                          ? <><MarkdownBlock text={normalizeToMarkdown(m.text)} /><div style={{ marginTop: '10px' }}><CopyBtn text={m.text} /></div></>
                          : <span style={{ color: '#d1d5db', fontSize: '0.8rem', fontStyle: 'italic' }}>Waiting for response…</span>
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Final synthesis — appears once complete */}
          {status === 'complete' && (synthesis || claudeDisplay) && (
            <div style={{ maxWidth: '900px', marginLeft: 'auto', marginRight: 'auto' }}>
              {/* Claude synthesis bubble */}
              <div style={{ display: 'flex', gap: '11px', alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#d97757', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: '700', flexShrink: 0 }}>C</div>
                <div style={{ flex: 1, minWidth: 0, color: '#1c1c1c', lineHeight: 1.8, fontSize: '0.92rem', background: '#fff', border: '1.5px solid rgba(217,119,87,0.2)', borderRadius: '4px 16px 16px 16px', padding: '16px 20px', boxShadow: '0 2px 12px rgba(217,119,87,0.08)', letterSpacing: '-0.01em' }}>
                  <MarkdownBlock text={synthesis || claudeDisplay} />
                </div>
              </div>
              {/* Time + Copy row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', paddingLeft: '39px' }}>
                {elapsed != null && <Chip icon="⏱" val={`${elapsed}s`} />}
                {(synthesis || claudeDisplay) && <CopyBtn text={synthesis || claudeDisplay} label="Copy response" />}
              </div>

              {/* Follow-up bubbles — Battle Mode (3 panels + synthesis per follow-up) */}
              {(followUps.length > 0 || pendingFollowUp) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '12px' }}>
                  {followUps.map((item, index) => (
                    <div key={`${item.question}-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {/* User question bubble */}
                      <div style={{ alignSelf: 'flex-end', maxWidth: '72%', background: '#1c1c1c', color: '#f5f5f5', borderRadius: '14px 14px 4px 14px', padding: '10px 14px', fontSize: '0.9rem', lineHeight: 1.65, whiteSpace: 'pre-wrap', letterSpacing: '-0.01em' }}>{item.question}</div>

                      {/* 3 model panels — show if any of the 3 have content */}
                      {(item.openai || item.gemini || item.claude) && !item.answer.startsWith('⚠️') && (
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                          {[
                            { key: 'openai', name: 'ChatGPT', color: '#10a37f', text: extractClaudeOutput(item.openai) },
                            { key: 'gemini', name: 'Gemini',  color: '#4285f4', text: extractClaudeOutput(item.gemini) },
                            { key: 'claude', name: 'Claude',  color: '#d97757', text: extractClaudeOutput(item.claude) },
                          ].filter(m => (m.key === 'claude' ? true : selectedModels.includes(m.key)) && m.text).map(m => (
                            <div key={m.key} style={{ flex: 1, minWidth: '240px', border: `1px solid ${m.color}25`, borderRadius: '12px', overflow: 'hidden', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
                              <div style={{ padding: '8px 12px', background: `${m.color}0a`, borderBottom: `1px solid ${m.color}18`, display: 'flex', alignItems: 'center', gap: '7px' }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                                <span style={{ fontWeight: 600, fontSize: '0.78rem', color: '#1c1c1c' }}>{m.name}</span>
                                <span style={{ marginLeft: 'auto', fontSize: '0.6rem', padding: '2px 7px', borderRadius: '8px', fontWeight: 600, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>Done</span>
                              </div>
                              <div style={{ padding: '12px 14px', fontSize: '0.85rem', lineHeight: 1.7, color: '#2d2d2d', maxHeight: '260px', overflowY: 'auto' }}>
                                <MarkdownBlock text={normalizeToMarkdown(m.text)} />
                                <div style={{ marginTop: '8px' }}><CopyBtn text={m.text} /></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Synthesis bubble */}
                      {item.answer.startsWith('⚠️') ? (
                        <div style={{ color: '#dc2626', fontSize: '0.88rem', padding: '10px 14px', background: '#fef2f2', borderRadius: '10px', border: '1px solid #fecaca' }}>{item.answer}</div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#d97757', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: '700', flexShrink: 0 }}>C</div>
                            <div style={{ flex: 1, minWidth: 0, background: '#ffffff', color: '#1c1c1c', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '4px 14px 14px 14px', padding: '14px 18px', fontSize: '0.9rem', lineHeight: 1.78, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', letterSpacing: '-0.01em' }}>
                              <MarkdownBlock text={item.synthesis || item.answer} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '38px' }}>
                            {item.elapsed && <Chip icon="⏱" val={`${item.elapsed}s`} />}
                            <CopyBtn text={item.synthesis || item.answer} />
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  {/* Pending follow-up loading state */}
                  {pendingFollowUp && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ alignSelf: 'flex-end', maxWidth: '72%', background: '#1c1c1c', color: '#f5f5f5', borderRadius: '14px 14px 4px 14px', padding: '10px 14px', fontSize: '0.9rem', lineHeight: 1.65, whiteSpace: 'pre-wrap', letterSpacing: '-0.01em' }}>{pendingFollowUp}</div>
                      {/* Loading panels */}
                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        {[
                          { key: 'openai', name: 'ChatGPT', color: '#10a37f' },
                          { key: 'gemini', name: 'Gemini',  color: '#4285f4' },
                          { key: 'claude', name: 'Claude',  color: '#d97757' },
                        ].filter(m => selectedModels.includes(m.key)).map(m => (
                          <div key={m.key} style={{ flex: 1, minWidth: '240px', border: `1px solid ${m.color}25`, borderRadius: '12px', overflow: 'hidden', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
                            <div style={{ padding: '8px 12px', background: `${m.color}0a`, borderBottom: `1px solid ${m.color}18`, display: 'flex', alignItems: 'center', gap: '7px' }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                              <span style={{ fontWeight: 600, fontSize: '0.78rem', color: '#1c1c1c' }}>{m.name}</span>
                              <span style={{ marginLeft: 'auto', fontSize: '0.6rem', padding: '2px 7px', borderRadius: '8px', fontWeight: 600, background: `${m.color}12`, color: m.color, border: `1px solid ${m.color}30` }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>◌</span> Running</span>
                              </span>
                            </div>
                            <div style={{ padding: '14px 16px', display: 'flex', gap: '5px', alignItems: 'center' }}>
                              {[0, 0.25, 0.5].map((d, i) => <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: m.color, opacity: 0.4, animation: 'blink 1s ease infinite', animationDelay: `${d}s` }} />)}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#d97757', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: '700', flexShrink: 0 }}>C</div>
                        <div style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '4px 14px 14px 14px', padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          {[0, 0.28, 0.56].map((d, i) => (
                            <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97757', display: 'inline-block', animation: 'blink 1.1s ease infinite', animationDelay: `${d}s` }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} style={{ height: 1 }} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── INVISIBLE MODE output (clean Claude bubble) ── */}
      {mode === 'invisible' && status !== 'idle' && (
        <div style={{ marginTop: '1.5rem', width: '100%', maxWidth: '900px', marginLeft: 'auto', marginRight: 'auto' }}>

          {/* Deep Research banner */}
          {deepResearch && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem', padding: '10px 16px', background: 'linear-gradient(135deg, #7c3aed15, #2563eb10)', border: '1px solid #7c3aed30', borderRadius: '14px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <span style={{ fontWeight: '700', fontSize: '0.82rem', color: '#7c3aed' }}>Deep Research</span>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>·</span>
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{status === 'running' ? 'Searching and synthesizing from the web…' : 'Research complete'}</span>
              {status === 'complete' && <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#16a34a', fontWeight: '600', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '8px' }}>✓ Done</span>}
            </div>
          )}

          {/* Source status pills for Playwright/deep research */}
          {(usePlaywright || deepResearch) && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              {[{ key: 'openai', label: deepResearch ? 'ChatGPT Web' : 'ChatGPT', color: '#10a37f' }, { key: 'gemini', label: deepResearch ? 'Gemini Web' : 'Gemini', color: '#4285f4' }]
                .filter(s => selectedModels.includes(s.key)).map(s => {
                  const done = status === 'complete' && content[s.key] && !content[s.key].startsWith('Error');
                  const running = status === 'running';
                  return (
                    <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '20px', background: done ? `${s.color}0d` : 'rgba(0,0,0,0.04)', border: `1px solid ${done ? s.color + '25' : 'rgba(0,0,0,0.08)'}`, fontSize: '0.75rem', fontWeight: '500', color: done ? s.color : '#9ca3af', letterSpacing: '-0.01em' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, background: done ? s.color : running ? s.color : '#d1d5db', animation: running ? 'blink 0.8s ease infinite' : 'none' }} />
                      {s.label}
                      {done && <span style={{ opacity: 0.6 }}>✓</span>}
                      {running && <span style={{ opacity: 0.6 }}>…</span>}
                    </div>
                  );
                })}
            </div>
          )}

          {/* Chat bubbles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ alignSelf: 'flex-end', maxWidth: '72%', background: '#1c1c1c', color: '#f5f5f5', borderRadius: '16px 16px 4px 16px', padding: '11px 15px', fontSize: '0.92rem', lineHeight: 1.65, whiteSpace: 'pre-wrap', letterSpacing: '-0.01em' }}>{submittedPrompt}</div>
            <div style={{ display: 'flex', gap: '11px', alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#d97757', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: '700', flexShrink: 0 }}>C</div>
              <div style={{ flex: 1, minWidth: 0, color: '#1c1c1c', lineHeight: 1.8, fontSize: '0.92rem', background: '#ffffff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '4px 16px 16px 16px', padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', letterSpacing: '-0.01em' }}>
                {status === 'running'
                  ? deepResearch
                    ? <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ fontSize: '1.2rem', animation: 'float 1.5s ease-in-out infinite' }}>{RESEARCH_STEPS[researchStepIdx].icon}</span><span style={{ color: '#6b7280', fontSize: '0.9rem', fontStyle: 'italic' }}>{RESEARCH_STEPS[researchStepIdx].text}</span></div>
                    : <span style={{ color: '#6b7280', fontStyle: 'italic' }}>Thinking…</span>
                  : <MarkdownBlock text={claudeDisplay} />
                }
              </div>
            </div>
          </div>

          {/* Time + Copy row */}
          {status === 'complete' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', paddingLeft: '39px' }}>
              {elapsed != null && <Chip icon="⏱" val={`${elapsed}s`} />}
              {claudeDisplay && <CopyBtn text={claudeDisplay} label="Copy response" />}
            </div>
          )}

          {/* Follow-ups */}
          {status === 'complete' && (followUps.length > 0 || pendingFollowUp) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
              {followUps.map((item, index) => (
                <div key={`${item.question}-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ alignSelf: 'flex-end', maxWidth: '72%', background: '#1c1c1c', color: '#f5f5f5', borderRadius: '14px 14px 4px 14px', padding: '10px 14px', fontSize: '0.9rem', lineHeight: 1.65, whiteSpace: 'pre-wrap', letterSpacing: '-0.01em' }}>{item.question}</div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#d97757', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: '700', flexShrink: 0 }}>C</div>
                    <div style={{ flex: 1, minWidth: 0, background: '#ffffff', color: '#1c1c1c', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '4px 14px 14px 14px', padding: '14px 18px', fontSize: '0.9rem', lineHeight: 1.78, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', letterSpacing: '-0.01em' }}>
                      <MarkdownBlock text={item.answer} />
                      {!item.answer.startsWith('⚠️') && (
                        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {item.elapsed && <Chip icon="⏱" val={`${item.elapsed}s`} />}
                          <CopyBtn text={item.answer} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {/* In-flight follow-up: show question bubble + loading dots immediately */}
              {pendingFollowUp && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ alignSelf: 'flex-end', maxWidth: '72%', background: '#1c1c1c', color: '#f5f5f5', borderRadius: '14px 14px 4px 14px', padding: '10px 14px', fontSize: '0.9rem', lineHeight: 1.65, whiteSpace: 'pre-wrap', letterSpacing: '-0.01em' }}>
                    {pendingFollowUp}
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#d97757', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: '700', flexShrink: 0 }}>C</div>
                    <div style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '4px 14px 14px 14px', padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {[0, 0.28, 0.56].map((d, i) => (
                        <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97757', display: 'inline-block', animation: 'blink 1.1s ease infinite', animationDelay: `${d}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} style={{ height: 1 }} />
            </div>
          )}
        </div>
      )}
      <div style={{
        position: 'fixed',
        left: 'calc(240px + 2rem)',
        right: '2rem',
        bottom: '22px',
        zIndex: 80,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        {modelMenuOpen && (
        <div onClick={() => setModelMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 190 }} />
      )}
      <div style={{
          width: 'min(780px, 100%)',
          background: '#ffffff',
          border: '1px solid rgba(0,0,0,0.09)',
          borderRadius: '20px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.05)',
          overflow: 'visible',
          pointerEvents: 'auto',
          position: 'relative',
          zIndex: 195,
        }}>
          <textarea
            ref={textareaRef}
            value={composerValue}
            onChange={e => composerIsFollowUp ? setFollowUpQuestion(e.target.value) : setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComposerSubmit(); } }}
            placeholder={composerIsFollowUp ? 'Ask Claude a follow-up… (Shift+Enter for new line)' : 'Ask anything… (Shift+Enter for new line)'}
            rows={2}
            disabled={status === 'running' || followUpStatus === 'running' || Boolean(pendingFollowUp)}
            style={{
              width: '100%',
              display: 'block',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              overflowY: 'hidden',
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
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  border: '1.5px solid rgba(0,0,0,0.1)',
                  background: modelMenuOpen ? '#1c1c1c' : 'white',
                  color: modelMenuOpen ? 'white' : '#1c1c1c',
                  cursor: status === 'running' || followUpStatus === 'running' ? 'not-allowed' : 'pointer',
                  fontSize: '0.78rem', fontWeight: 700, letterSpacing: '-0.01em',
                  transition: 'all 0.18s ease',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}
              >
                <span style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                  {selectedModels.includes('openai') && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10a37f', display: 'inline-block', transition: 'opacity 0.2s' }} />}
                  {selectedModels.includes('claude') && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#d97757', display: 'inline-block', transition: 'opacity 0.2s' }} />}
                  {selectedModels.includes('gemini') && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4285f4', display: 'inline-block', transition: 'opacity 0.2s' }} />}
                </span>
                {selectedLabel}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
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
                  zIndex: 200,
                }}>
                  {(() => {
                    let enabledModels = ['openai', 'gemini', 'claude'];
                    try { const u = JSON.parse(localStorage.getItem('ph_user') || '{}'); if (u.enabledModels?.length) enabledModels = u.enabledModels; } catch {}
                    return [
                      { key: 'openai', label: 'ChatGPT' },
                      { key: 'gemini', label: 'Gemini' },
                      { key: 'claude', label: 'Claude' },
                    ].filter(m => enabledModels.includes(m.key)).map(model => (
                      <label key={model.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.86rem', color: '#374151' }}>
                        <input
                          type="checkbox"
                          checked={selectedModels.includes(model.key)}
                          onChange={() => toggleModel(model.key)}
                        />
                        {model.label}
                      </label>
                    ));
                  })()}
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af', padding: '6px 8px 2px' }}>
                    Claude always creates the final synthesis.
                  </div>
                </div>
              )}
              {!deepResearch && (
                <div style={{ display: 'flex', alignItems: 'center', background: '#ede9e3', borderRadius: '20px', padding: '3px', gap: '2px' }}>
                  <button
                    onClick={() => setUsePlaywright(false)}
                    style={{
                      padding: '5px 13px',
                      borderRadius: '17px',
                      border: 'none',
                      background: !usePlaywright ? 'linear-gradient(135deg, #d97757, #e8896a)' : 'transparent',
                      color: !usePlaywright ? '#ffffff' : '#78716c',
                      fontSize: '0.72rem', fontWeight: 700, letterSpacing: '-0.01em',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: !usePlaywright ? '0 2px 8px rgba(217,119,87,0.45)' : 'none',
                    }}
                  >API</button>
                  <button
                    onClick={() => setUsePlaywright(true)}
                    style={{
                      padding: '5px 13px',
                      borderRadius: '17px',
                      border: 'none',
                      background: usePlaywright ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : 'transparent',
                      color: usePlaywright ? '#ffffff' : '#78716c',
                      fontSize: '0.72rem', fontWeight: 700, letterSpacing: '-0.01em',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: usePlaywright ? '0 2px 8px rgba(124,58,237,0.45)' : 'none',
                    }}
                  >Browser</button>
                </div>
              )}

              {/* Deep Research toggle */}
              <button
                onClick={() => {
                  const next = !deepResearch;
                  setDeepResearch(next);
                  if (next) setUsePlaywright(true);
                }}
                disabled={status === 'running' || followUpStatus === 'running'}
                title={deepResearch ? 'Turn off Deep Research' : 'Deep Research — searches the web for comprehensive answers'}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '6px 13px', borderRadius: '20px',
                  border: deepResearch ? 'none' : '1.5px solid rgba(0,0,0,0.1)',
                  background: deepResearch
                    ? 'linear-gradient(135deg, #7c3aed, #2563eb)'
                    : 'white',
                  color: deepResearch ? '#ffffff' : '#78716c',
                  fontSize: '0.78rem', fontWeight: 700, letterSpacing: '-0.01em',
                  cursor: status === 'running' || followUpStatus === 'running' ? 'not-allowed' : 'pointer',
                  transition: 'all 0.22s ease',
                  boxShadow: deepResearch ? '0 3px 14px rgba(124,58,237,0.45)' : '0 1px 4px rgba(0,0,0,0.06)',
                  whiteSpace: 'nowrap',
                  opacity: status === 'running' || followUpStatus === 'running' ? 0.6 : 1,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                Deep Research
              </button>

            </div>
            {status === 'running' ? (
              <button
                onClick={handleStop}
                title="Stop"
                style={{
                  width: '38px', height: '38px', borderRadius: '50%', border: 'none',
                  background: '#ef4444', color: '#ffffff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                  boxShadow: '0 0 0 3px rgba(239,68,68,0.2)',
                  transition: 'transform 0.12s, box-shadow 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 0 0 5px rgba(239,68,68,0.25)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.2)'; }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
              </button>
            ) : (
              <button
                onClick={handleComposerSubmit}
                disabled={!canSubmitComposer}
                style={{
                  width: '38px', height: '38px', borderRadius: '50%', border: 'none',
                  background: canSubmitComposer ? '#1a1a1a' : '#e5e7eb',
                  color: canSubmitComposer ? '#ffffff' : '#9ca3af',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: canSubmitComposer ? 'pointer' : 'not-allowed',
                  flexShrink: 0, transition: 'background 0.15s',
                }}
                title={composerIsFollowUp ? 'Ask follow-up' : 'Run'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptControl;
