const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const AnalyticsPage = ({ history = [], usage = {} }) => {
  const runs = history.length;
  const { totalTokens = 0, totalInputTokens = 0, totalOutputTokens = 0, totalCost = 0 } = usage;
  const gemini = history.filter(h => h.best?.includes('Gemini')).length;
  const claude = history.filter(h => h.best?.includes('Claude')).length;
  const openai = history.filter(h => h.best?.includes('GPT')).length;

  const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - todayIdx);
  startOfWeek.setHours(0, 0, 0, 0);
  const barHeights = Array(7).fill(0).map((_, i) => {
    const dayStart = new Date(startOfWeek);
    dayStart.setDate(startOfWeek.getDate() + i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);
    return history.filter(h => h.id >= dayStart.getTime() && h.id < dayEnd.getTime()).length;
  });
  const maxBar = Math.max(...barHeights, 1);

  const stats = [
    { label: 'Total Runs',    value: runs,                          icon: '🚀', color: '#2563eb', sub: 'all time' },
    { label: 'Input Tokens',  value: totalInputTokens.toLocaleString(), icon: '📥', color: '#7c3aed', sub: '$0.075 per 1M tokens' },
    { label: 'Output Tokens', value: totalOutputTokens.toLocaleString(), icon: '📤', color: '#059669', sub: '$0.30 per 1M tokens' },
    { label: 'Total API Cost',value: `$${totalCost.toFixed(6)}`,   icon: '💵', color: '#f59e0b', sub: 'Gemini 3.1 Pro actual' },
  ];

  const modelBreakdown = [
    { name: 'Gemini 3.1 Pro', count: gemini, color: '#4285f4' },
    { name: 'Claude Opus 4.6', count: claude, color: '#d97757' },
    { name: 'GPT-5.2', count: openai, color: '#10a37f' },
  ];

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem' }}>📈 Analytics</h1>
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
          Track your AI usage, monitor credit consumption, and analyze response performance over time.
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        {stats.map((s, i) => (
          <div key={i} style={{ background: 'white', borderRadius: '20px', padding: '1.5rem', border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', background: s.color + '15', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>{s.icon}</div>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', marginBottom: '3px', letterSpacing: '-0.03em' }}>{s.value}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#0f172a', marginBottom: '2px' }}>{s.label}</div>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* Bar chart */}
        <div style={{ background: 'white', borderRadius: '24px', padding: '2rem', border: '1px solid #f1f5f9' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontWeight: '700', color: '#0f172a', margin: '0 0 4px' }}>Weekly Activity</h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>Prompt runs per day this week</p>
          </div>
          <div style={{ height: '160px', display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
            {barHeights.map((h, i) => {
              const isToday = i === todayIdx;
              const pct = (h / maxBar) * 100;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '0.62rem', color: '#94a3b8', fontWeight: '600' }}>{h}</span>
                  <div style={{
                    width: '100%', height: `${Math.max(pct, 5)}%`, minHeight: '6px',
                    background: isToday ? 'linear-gradient(180deg, #2563eb, #7c3aed)' : '#f1f5f9',
                    borderRadius: '8px 8px 4px 4px', transition: 'height 0.8s ease',
                    boxShadow: isToday ? '0 4px 12px rgba(37,99,235,0.3)' : 'none'
                  }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #f8fafc' }}>
            {DAYS.map((d, i) => (
              <span key={d} style={{ fontSize: '0.62rem', color: i === todayIdx ? '#2563eb' : '#94a3b8', fontWeight: i === todayIdx ? '800' : '600', flex: 1, textAlign: 'center' }}>{d}</span>
            ))}
          </div>
        </div>

        {/* Model breakdown */}
        <div style={{ background: 'white', borderRadius: '24px', padding: '2rem', border: '1px solid #f1f5f9' }}>
          <h3 style={{ fontWeight: '700', color: '#0f172a', margin: '0 0 4px' }}>Model Usage</h3>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 1.75rem' }}>Runs by AI model</p>

          {modelBreakdown.map(m => {
            const pct = runs > 0 ? Math.round((m.count / runs) * 100) : 0;
            return (
              <div key={m.name} style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: '600', color: '#334155' }}>{m.name}</span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{m.count} runs</span>
                </div>
                <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: m.color, borderRadius: '8px', transition: 'width 1s ease' }} />
                </div>
              </div>
            );
          })}

          <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: '#f8fafc', borderRadius: '16px' }}>
            <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>Total Estimated Cost</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.03em' }}>${(runs * 0.0012).toFixed(4)}</div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>Based on {runs} runs × $0.0012</div>
          </div>
        </div>
      </div>

      {/* Gemini API cost breakdown */}
      <div style={{ background: 'white', borderRadius: '24px', padding: '2rem', border: '1px solid #f1f5f9', marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ fontWeight: '700', color: '#0f172a', margin: '0 0 4px' }}>Gemini API Cost Breakdown</h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>Gemini 3.1 Pro pricing · actual usage</p>
          </div>
          <span style={{ fontSize: '1.5rem', fontWeight: '800', color: '#059669' }}>${totalCost.toFixed(6)}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
          {[
            { label: 'Input Tokens',  value: totalInputTokens,  rate: '$0.075/1M',  cost: (totalInputTokens  * 0.075 / 1_000_000), color: '#2563eb' },
            { label: 'Output Tokens', value: totalOutputTokens, rate: '$0.30/1M',   cost: (totalOutputTokens * 0.30  / 1_000_000), color: '#7c3aed' },
            { label: 'Total Tokens',  value: totalTokens,       rate: 'combined',   cost: null,                                     color: '#0f172a' },
            { label: 'Total Cost',    value: null,              rate: 'USD actual', cost: totalCost,                                color: '#059669' },
          ].map(item => (
            <div key={item.label} style={{ background: '#f8fafc', borderRadius: '14px', padding: '1.1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: '800', color: item.color, marginBottom: '4px' }}>
                {item.value !== null ? item.value.toLocaleString() : `$${item.cost.toFixed(6)}`}
              </div>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#334155' }}>{item.label}</div>
              <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: '2px' }}>{item.rate}</div>
              {item.cost !== null && item.value !== null && (
                <div style={{ fontSize: '0.65rem', color: '#059669', fontWeight: '700', marginTop: '4px' }}>${item.cost.toFixed(6)}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
