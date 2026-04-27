import { useState } from 'react';

const ResponseModal = ({ row, onClose }) => {
  const responses = row.responses || {};
  const tabs = [
    { key: 'gemini', label: 'Gemini 1.5', color: '#4285f4', bg: '#eef2ff', text: responses.gemini },
    { key: 'claude', label: 'Claude-3', color: '#d97757', bg: '#fff7ed', text: responses.claude },
    { key: 'openai', label: 'GPT-4o', color: '#10a37f', bg: '#f0fdf4', text: responses.openai },
  ].filter(t => t.text);

  const [activeTab, setActiveTab] = useState(tabs[0]?.key || 'gemini');
  const activeResponse = tabs.find(t => t.key === activeTab) || tabs[0];

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: '760px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}
      >
        {/* Modal header */}
        <div style={{ padding: '1.5rem 1.75rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, paddingRight: '1rem' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '5px' }}>Prompt</div>
            <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#0f172a', lineHeight: '1.5' }}>{row.prompt}</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>{row.date}</div>
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: '#f1f5f9', borderRadius: '10px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '1rem', color: '#64748b', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >✕</button>
        </div>

        {/* Tabs */}
        {tabs.length > 1 && (
          <div style={{ display: 'flex', gap: '6px', padding: '1rem 1.75rem 0' }}>
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  padding: '0.45rem 1rem', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  fontWeight: '700', fontSize: '0.78rem',
                  background: activeTab === t.key ? t.bg : 'transparent',
                  color: activeTab === t.key ? t.color : '#94a3b8',
                  transition: 'all 0.15s'
                }}
              >{t.label}</button>
            ))}
          </div>
        )}

        {/* Response body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '1.25rem 1.75rem 1.75rem' }}>
          {activeResponse ? (
            <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '1.25rem 1.5rem' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: '700', color: activeResponse.color, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.75rem' }}>
                {activeResponse.label} Response
              </div>
              <div style={{ fontSize: '0.875rem', color: '#334155', lineHeight: '1.75', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {activeResponse.text}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.875rem' }}>
              No response data saved for this run.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const HistoryTable = ({ history = [], showAll = false }) => {
  const [selected, setSelected] = useState(null);

  return (
    <>
      <div style={{ background: 'white', marginTop: showAll ? '0' : '2rem', padding: '1.5rem', borderRadius: '24px', border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>📜 Prompt History</h3>
          {!showAll && <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{history.length} entries</span>}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              {['Prompt', 'Date', 'Best Model', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ padding: '0.75rem 1rem', fontSize: '0.72rem', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.length > 0 ? history.map((row) => (
              <tr
                key={row.id}
                onClick={() => setSelected(row)}
                style={{ borderBottom: '1px solid #f8fafc', transition: 'background 0.15s', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '1rem', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.875rem', color: '#334155' }}>
                  {row.prompt}
                </td>
                <td style={{ padding: '1rem', fontSize: '0.8rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>{row.date}</td>
                <td style={{ padding: '1rem' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '600',
                    background: row.best?.includes('Gemini') ? '#eef2ff' : row.best?.includes('Claude') ? '#fff7ed' : '#f0fdf4',
                    color: row.best?.includes('Gemini') ? '#4285f4' : row.best?.includes('Claude') ? '#d97757' : '#10a37f'
                  }}>{row.best}</span>
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#16a34a' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }} />
                    {row.status}
                  </div>
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      onClick={e => { e.stopPropagation(); setSelected(row); }}
                      style={{ border: 'none', background: '#eff6ff', borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '600', color: '#2563eb' }}
                      title="View full response"
                    >View</button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                  No prompt history yet. Run your first prompt above!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && <ResponseModal row={selected} onClose={() => setSelected(null)} />}
    </>
  );
};

export default HistoryTable;
