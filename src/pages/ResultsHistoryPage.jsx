import { useState } from 'react';
import HistoryTable from '../components/HistoryTable';

const FILTERS = ['All', 'Gemini', 'Claude', 'GPT'];

const ResultsHistoryPage = ({ history = [] }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const filtered = history.filter(h => {
    const matchSearch = h.prompt.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'All' || h.best?.toLowerCase().includes(filter.toLowerCase());
    return matchSearch && matchFilter;
  });

  const exportCSV = () => {
    const rows = [['Prompt', 'Date', 'Best Model', 'Status'], ...filtered.map(h => [h.prompt, h.date, h.best, h.status])];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'prompt-history.csv';
    a.click();
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem' }}>📜 Results History</h1>
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
          View, search, and export all past prompt runs. Click any row to see the full AI response.
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{
          flex: 1, minWidth: '220px', background: 'white', borderRadius: '12px',
          border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', padding: '0 1rem'
        }}>
          <span style={{ color: '#94a3b8' }}>🔍</span>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by prompt text..."
            style={{ flex: 1, border: 'none', background: 'transparent', padding: '0.7rem 0.5rem', outline: 'none', fontSize: '0.875rem', color: '#334155' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1rem' }}>✕</button>
          )}
        </div>

        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '0.6rem 1.1rem', borderRadius: '10px', cursor: 'pointer',
            border: `1px solid ${filter === f ? '#2563eb' : '#e2e8f0'}`,
            background: filter === f ? '#eff6ff' : 'white',
            color: filter === f ? '#2563eb' : '#64748b',
            fontWeight: '600', fontSize: '0.8rem', transition: 'all 0.15s'
          }}>{f === 'All' ? 'All Models' : f}</button>
        ))}

        <button onClick={exportCSV} style={{
          padding: '0.6rem 1.1rem', borderRadius: '10px', cursor: 'pointer',
          border: '1px solid #e2e8f0', background: 'white', color: '#64748b',
          fontWeight: '600', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px'
        }}>📥 Export CSV</button>
      </div>

      {/* Summary row */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Runs', value: history.length, color: '#2563eb' },
          { label: 'Showing', value: filtered.length, color: '#7c3aed' },
          { label: 'This Week', value: history.filter(h => Date.now() - h.id < 7 * 24 * 60 * 60 * 1000).length, color: '#059669' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', borderRadius: '14px', padding: '0.85rem 1.25rem', border: '1px solid #f1f5f9', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: '800', color: s.color }}>{s.value}</span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '500' }}>{s.label}</span>
          </div>
        ))}
      </div>

      <HistoryTable history={filtered} showAll />
    </div>
  );
};

export default ResultsHistoryPage;
