import { useEffect, useMemo, useState } from 'react';

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
          margin: level === 1 ? '0 0 10px' : '14px 0 7px',
          fontSize: level === 1 ? '1.35rem' : level === 2 ? '1.18rem' : '1rem',
          lineHeight: 1.35,
          fontWeight: 750,
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
        <div key={`table-${i}`} style={{ overflowX: 'auto', margin: '12px 0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr>
                {headers.map((cell, idx) => (
                  <th key={`th-${idx}`} style={{ textAlign: 'left', padding: '9px 11px', border: '1px solid #e5e7eb', background: '#f9fafb', color: '#111827' }}>
                    {renderInlineMarkdown(cell, `th-${idx}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr key={`tr-${rowIdx}`}>
                  {headers.map((_, cellIdx) => (
                    <td key={`td-${rowIdx}-${cellIdx}`} style={{ padding: '9px 11px', border: '1px solid #e5e7eb', verticalAlign: 'top' }}>
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
          {items.map((item, idx) => <li key={`li-${idx}`} style={{ margin: '3px 0' }}>{renderInlineMarkdown(item, `li-${i}-${idx}`)}</li>)}
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
      <p key={`p-${i}`} style={{ margin: '0 0 10px' }}>
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

const modelMeta = {
  claude: { label: 'Claude', color: '#d97757', bg: '#fff7ed' },
  openai: { label: 'ChatGPT', color: '#10a37f', bg: '#f0fdf4' },
  gemini: { label: 'Gemini', color: '#4285f4', bg: '#eff6ff' },
};

const getPrimaryResponse = (chat) =>
  chat?.responses?.claude || chat?.responses?.openai || chat?.responses?.gemini || '';

const getCopyText = (chat) => {
  if (!chat) return '';
  const parts = [`User: ${chat.prompt}`, `Claude: ${getPrimaryResponse(chat)}`];
  (chat.followUps || []).forEach(item => {
    parts.push(`User: ${item.question}`);
    parts.push(`Claude: ${item.answer}`);
  });
  return parts.join('\n\n');
};

const ResultsHistoryPage = ({ history = [], selectedId, onSelect }) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? history.filter(h => h.prompt?.toLowerCase().includes(q)) : history;
  }, [history, search]);

  const selected = history.find(h => h.id === selectedId) || filtered[0] || history[0] || null;

  useEffect(() => {
    if (!selectedId && selected?.id && onSelect) onSelect(selected.id);
  }, [selectedId, selected?.id, onSelect]);

  const sourceResponses = selected?.responses
    ? ['claude', 'openai', 'gemini'].filter(key => selected.responses[key]).map(key => ({ key, text: selected.responses[key], ...modelMeta[key] }))
    : [];

  return (
    <div style={{
      height: 'calc(100vh - 5rem)',
      minHeight: '640px',
      display: 'grid',
      gridTemplateColumns: '300px minmax(0, 1fr)',
      gap: '1rem',
    }}>
      <aside style={{
        background: '#ffffff',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: '16px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ padding: '14px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontWeight: 750, color: '#111827', marginBottom: '10px' }}>History</div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search chats"
            style={{
              width: '100%',
              border: '1px solid #e5e7eb',
              borderRadius: '10px',
              padding: '9px 10px',
              outline: 'none',
              fontFamily: 'inherit',
              fontSize: '0.85rem',
              background: '#f9fafb',
            }}
          />
        </div>

        <div style={{ overflowY: 'auto', padding: '8px' }}>
          {filtered.length ? filtered.map(chat => {
            const active = selected?.id === chat.id;
            return (
              <button
                key={chat.id}
                onClick={() => onSelect && onSelect(chat.id)}
                title={chat.prompt}
                style={{
                  width: '100%',
                  border: 'none',
                  background: active ? '#f3f4f6' : 'transparent',
                  borderRadius: '10px',
                  padding: '10px 11px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: '#111827',
                  marginBottom: '3px',
                  fontFamily: 'inherit',
                }}
              >
                <div style={{ fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chat.prompt}</div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px' }}>{chat.date}</div>
              </button>
            );
          }) : (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem' }}>
              No chats found.
            </div>
          )}
        </div>
      </aside>

      <section style={{
        background: '#ffffff',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        overflow: 'hidden',
      }}>
        {selected ? (
          <>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 750, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selected.prompt}</div>
                <div style={{ fontSize: '0.76rem', color: '#9ca3af', marginTop: '3px' }}>{selected.date}</div>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(getCopyText(selected))}
                style={{ border: '1px solid #e5e7eb', background: '#ffffff', borderRadius: '9px', padding: '7px 10px', cursor: 'pointer', color: '#6b7280', fontWeight: 650, fontSize: '0.78rem' }}
              >
                Copy
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '28px 18px' }}>
              <div style={{ maxWidth: '820px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>
                <div style={{ alignSelf: 'flex-end', maxWidth: '78%', background: '#1f2937', color: '#ffffff', borderRadius: '18px 18px 4px 18px', padding: '12px 14px', lineHeight: 1.6, fontSize: '0.95rem' }}>
                  {selected.prompt}
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#d97757', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 750, flexShrink: 0 }}>C</div>
                  <div style={{ flex: 1, minWidth: 0, color: '#1f2937', lineHeight: 1.72, fontSize: '0.98rem' }}>
                    <MarkdownBlock text={getPrimaryResponse(selected) || 'No response saved for this chat.'} />
                  </div>
                </div>

                {(selected.followUps || []).map((item, index) => (
                  <div key={`${selected.id}-followup-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                    <div style={{ alignSelf: 'flex-end', maxWidth: '78%', background: '#1f2937', color: '#ffffff', borderRadius: '18px 18px 4px 18px', padding: '12px 14px', lineHeight: 1.6, fontSize: '0.95rem' }}>
                      {item.question}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#d97757', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 750, flexShrink: 0 }}>C</div>
                      <div style={{ flex: 1, minWidth: 0, color: '#1f2937', lineHeight: 1.72, fontSize: '0.98rem' }}>
                        <MarkdownBlock text={item.answer} />
                      </div>
                    </div>
                  </div>
                ))}

                {sourceResponses.length > 1 && (
                  <details style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                    <summary style={{ cursor: 'pointer', color: '#6b7280', fontSize: '0.84rem', fontWeight: 700 }}>View all model responses</summary>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                      {sourceResponses.map(source => (
                        <div key={source.key} style={{ border: `1px solid ${source.color}30`, background: source.bg, borderRadius: '12px', padding: '13px 14px' }}>
                          <div style={{ color: source.color, fontWeight: 800, fontSize: '0.78rem', marginBottom: '8px' }}>{source.label}</div>
                          <div style={{ color: '#334155', lineHeight: 1.65, fontSize: '0.9rem' }}>
                            <MarkdownBlock text={source.text} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
            Run your first prompt to start a chat history.
          </div>
        )}
      </section>
    </div>
  );
};

export default ResultsHistoryPage;
