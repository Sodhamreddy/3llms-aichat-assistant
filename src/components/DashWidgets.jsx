import React from 'react';

const ComparisonPanel = () => (
  <div className="glass" style={{ padding: '2rem', borderRadius: '28px', flex: 1 }}>
    <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '1.75rem', display: 'flex', alignItems: 'center', gap: '10px', color: '#0f172a' }}>
      <span style={{ fontSize: '1.2rem' }}>💎</span> AI Performance Suite
    </h3>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
      {[
        { label: 'Quality Peak', value: 'Claude-3', sub: '9.8 Logic Rating', color: '#7c3aed' },
        { label: 'Latency Min', value: 'Claude-3', sub: '0.8s Baseline', color: '#2563eb' },
        { label: 'Efficiency', value: 'GPT-4o', sub: '$0.01 / 1k tkn', color: '#059669' },
        { label: 'Creativity', value: 'Gemini 1.5', sub: '9.2 Creative', color: '#3b82f6' },
      ].map((item, i) => (
        <div key={i} style={{ 
          padding: '1.25rem', 
          background: '#fcfcfd', 
          borderRadius: '20px', 
          border: '1px solid rgba(0,0,0,0.03)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
        }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
             {item.label}
          </div>
          <div style={{ fontWeight: '800', color: item.color, fontSize: '1.05rem', letterSpacing: '-0.02em' }}>{item.value}</div>
          <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '2px', fontWeight: '500' }}>{item.sub}</div>
        </div>
      ))}
    </div>
  </div>
);

const AutomationPanel = () => (
  <div className="glass" style={{ padding: '2rem', borderRadius: '28px', width: '360px' }}>
    <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '1.75rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span style={{ fontSize: '1.2rem' }}>🌐</span> Live Orchestration
    </h3>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
      {[
        { name: 'Slack Sync', icon: '💬', active: true },
        { name: 'Email Dispatch', icon: '📧', active: false },
        { name: 'WhatsApp Bot', icon: '📱', active: false },
        { name: 'Sheet Sync', icon: '📊', active: true },
        { name: 'API Webhook', icon: '🔗', active: false },
      ].map((app, i) => (
        <div key={i} style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '0.85rem 1.1rem',
          background: app.active ? 'rgba(37, 99, 235, 0.03)' : 'transparent',
          borderRadius: '16px',
          border: '1px solid ' + (app.active ? 'rgba(37, 99, 235, 0.1)' : 'transparent'),
          transition: 'all 0.3s'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.1rem' }}>{app.icon}</span>
            <span style={{ fontSize: '0.85rem', fontWeight: app.active ? '600' : '400' }}>{app.name}</span>
          </div>
          <div style={{ 
            width: '36px', 
            height: '20px', 
            background: app.active ? 'var(--accent-primary)' : '#e2e8f0',
            borderRadius: '20px',
            position: 'relative',
            cursor: 'pointer'
          }}>
            <div style={{ 
              width: '14px', 
              height: '14px', 
              background: 'white', 
              borderRadius: '50%', 
              position: 'absolute', 
              top: '3px', 
              left: app.active ? '19px' : '3px',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }} />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const AnalyticsWidgets = () => {
  return (
    <div style={{ display: 'flex', gap: '1.75rem', marginTop: '2rem' }}>
      <div className="glass" style={{ padding: '2rem', borderRadius: '28px', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2.5rem' }}>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Infrastructure Usage</p>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', letterSpacing: '-0.03em', marginTop: '4px' }}>1.24M <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: '600' }}>↑ 12%</span></h2>
          </div>
          <span style={{ fontSize: '1.5rem', opacity: 0.8 }}>⚡</span>
        </div>
        <div style={{ height: '140px', display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
          {[30, 45, 35, 60, 55, 80, 75].map((h, i) => (
             <div key={i} style={{ 
               flex: 1, 
               height: `${h}%`, 
               background: i === 5 ? 'linear-gradient(180deg, #2563eb, #7c3aed)' : '#f1f5f9',
               borderRadius: '12px 12px 6px 6px',
               transition: 'height 1s cubic-bezier(0.4, 0, 0.2, 1)',
               boxShadow: i === 5 ? '0 8px 16px rgba(37, 99, 235, 0.2)' : 'none'
             }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', color: '#94a3b8', fontSize: '0.65rem', fontWeight: '600' }}>
          {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => <span key={d}>{d}</span>)}
        </div>
      </div>

      <ComparisonPanel />
      
      <AutomationPanel />
    </div>
  );
};

export default AnalyticsWidgets;
