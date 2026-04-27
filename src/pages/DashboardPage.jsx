import HistoryTable from '../components/HistoryTable';

const DashboardPage = ({ history = [], usage = {}, onNavigate }) => {
  const runs = history.length;
  const { totalTokens = 0, totalInputTokens = 0, totalOutputTokens = 0, totalCost = 0 } = usage;

  const geminiRuns = history.filter(h => h.best?.includes('Gemini')).length;
  const claudeRuns = history.filter(h => h.best?.includes('Claude')).length;
  const gptRuns    = history.filter(h => h.best?.includes('GPT')).length;
  const topModel   = runs === 0 ? '—'
    : geminiRuns >= claudeRuns && geminiRuns >= gptRuns ? 'Gemini 1.5'
    : claudeRuns >= gptRuns ? 'Claude-3' : 'GPT-4o';

  const statCards = [
    { icon: '🚀', label: 'Total Runs',    value: runs,                         sub: 'all time',                       color: '#2563eb' },
    { icon: '🪙', label: 'Total Tokens',  value: totalTokens.toLocaleString(), sub: `${totalInputTokens.toLocaleString()} in · ${totalOutputTokens.toLocaleString()} out`, color: '#7c3aed' },
    { icon: '💵', label: 'Total API Cost',value: `$${totalCost.toFixed(6)}`,   sub: 'Gemini 1.5 Flash actual',        color: '#059669' },
    { icon: '🏆', label: 'Top Model',     value: topModel,                     sub: runs > 0 ? 'most used' : 'run a prompt first', color: '#f59e0b' },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem' }}>
          Welcome back, John! 👋
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
          Here's your PromptHub AI overview.{' '}
          {runs === 0
            ? 'Run your first prompt to see data populate here.'
            : <span>You've run <strong style={{ color: '#2563eb' }}>{runs} prompt{runs !== 1 ? 's' : ''}</strong> so far.</span>
          }
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', marginBottom: '2rem' }}>
        {statCards.map((s, i) => (
          <div key={i} style={{ background: 'white', borderRadius: '20px', padding: '1.5rem', border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <div style={{ width: '40px', height: '40px', background: s.color + '15', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginBottom: '1rem' }}>{s.icon}</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', marginBottom: '3px', letterSpacing: '-0.03em' }}>{s.value}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#0f172a', marginBottom: '2px' }}>{s.label}</div>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Token breakdown + Quick action */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Token breakdown */}
        <div style={{ background: 'white', borderRadius: '20px', padding: '1.75rem', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontWeight: '700', color: '#0f172a', margin: '0 0 3px', fontSize: '0.95rem' }}>Gemini API Usage</h3>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>Gemini 1.5 Flash · $0.075/$0.30 per 1M tokens</p>
            </div>
            <span style={{ fontSize: '1.3rem', fontWeight: '800', color: '#059669' }}>${totalCost.toFixed(6)}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            {[
              { label: 'Input Tokens',  value: totalInputTokens,  color: '#2563eb', note: '$0.075/1M' },
              { label: 'Output Tokens', value: totalOutputTokens, color: '#7c3aed', note: '$0.30/1M' },
              { label: 'Total Tokens',  value: totalTokens,       color: '#059669', note: 'combined' },
            ].map(t => (
              <div key={t.label} style={{ background: '#f8fafc', borderRadius: '12px', padding: '0.85rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: t.color }}>{t.value.toLocaleString()}</div>
                <div style={{ fontSize: '0.68rem', fontWeight: '700', color: '#334155', marginTop: '2px' }}>{t.label}</div>
                <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>{t.note}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick action */}
        <div style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)', borderRadius: '20px', padding: '1.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⌨️</div>
            <h3 style={{ fontWeight: '800', color: 'white', margin: '0 0 6px', fontSize: '1rem' }}>Run a Prompt</h3>
            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.75)', margin: 0 }}>Send to all AI models and compare responses side-by-side.</p>
          </div>
          <button
            onClick={() => onNavigate('prompt-runner')}
            style={{ marginTop: '1.25rem', padding: '0.7rem', background: 'white', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '0.875rem', color: '#2563eb', cursor: 'pointer' }}
          >
            Open Prompt Runner →
          </button>
        </div>
      </div>

      {/* Recent history */}
      <div style={{ background: 'white', borderRadius: '20px', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 1.75rem', borderBottom: history.length > 0 ? '1px solid #f8fafc' : 'none' }}>
          <div>
            <h3 style={{ fontWeight: '700', color: '#0f172a', margin: '0 0 3px', fontSize: '0.95rem' }}>Recent Activity</h3>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>Your last 5 prompt runs</p>
          </div>
          {history.length > 0 && (
            <button onClick={() => onNavigate('results-history')} style={{ padding: '0.5rem 1rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', color: '#2563eb', fontWeight: '600', fontSize: '0.78rem', cursor: 'pointer' }}>
              View All →
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 2rem', color: '#94a3b8' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div>
            <div style={{ fontWeight: '600', fontSize: '0.95rem', color: '#64748b', marginBottom: '4px' }}>No runs yet</div>
            <div style={{ fontSize: '0.8rem' }}>Once you run a prompt, your history will appear here and persist across sessions.</div>
          </div>
        ) : (
          <HistoryTable history={history.slice(0, 5)} />
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
