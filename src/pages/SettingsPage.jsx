import { useState } from 'react';

const SettingsPage = ({ usage = {}, onResetUsage }) => {
  const [name, setName]   = useState('John Doe');
  const [email, setEmail] = useState('john@example.com');
  const [saved, setSaved] = useState(false);
  const [prefs, setPrefs] = useState({ emailNotif: true, autoSave: true, showTokens: false, darkMode: false });

  const { totalTokens = 0, totalInputTokens = 0, totalOutputTokens = 0, totalCost = 0 } = usage;

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };
  const togglePref = key => setPrefs(prev => ({ ...prev, [key]: !prev[key] }));

  const inputStyle = { width: '100%', padding: '0.65rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.875rem', outline: 'none', color: '#334155', boxSizing: 'border-box', background: 'white' };
  const card = { background: 'white', borderRadius: '20px', padding: '1.75rem', border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' };

  const Toggle = ({ on, onClick }) => (
    <div onClick={onClick} style={{ width: '40px', height: '22px', borderRadius: '22px', background: on ? '#2563eb' : '#e2e8f0', position: 'relative', cursor: 'pointer', transition: 'background 0.3s', flexShrink: 0 }}>
      <div style={{ width: '16px', height: '16px', background: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: on ? '21px' : '3px', transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem' }}>⚙️ Settings</h1>
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Manage your profile, preferences, and API usage.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

        {/* Profile */}
        <div style={card}>
          <h3 style={{ fontWeight: '700', color: '#0f172a', marginBottom: '1.5rem', fontSize: '0.95rem' }}>👤 Profile</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: '800', color: 'white', flexShrink: 0 }}>JD</div>
            <div>
              <div style={{ fontWeight: '700', color: '#0f172a' }}>{name}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Gemini 1.5 Flash · Active</div>
            </div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Display Name</label>
            <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
          </div>
          <button onClick={save} style={{
            width: '100%', padding: '0.7rem', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '0.875rem', transition: 'all 0.3s',
            background: saved ? '#dcfce7' : 'linear-gradient(135deg, #2563eb, #7c3aed)',
            color: saved ? '#16a34a' : 'white'
          }}>{saved ? '✓ Saved!' : 'Save Changes'}</button>
        </div>

        {/* Real API Usage */}
        <div style={card}>
          <h3 style={{ fontWeight: '700', color: '#0f172a', marginBottom: '1.5rem', fontSize: '0.95rem' }}>🪙 API Usage</h3>
          <div style={{ textAlign: 'center', padding: '1.25rem', background: 'linear-gradient(135deg, #eff6ff, #f5f3ff)', borderRadius: '16px', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#059669', letterSpacing: '-0.03em' }}>${totalCost.toFixed(6)}</div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Total Gemini API cost</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{totalTokens.toLocaleString()} tokens used</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
            {[
              { label: 'Input tokens',  value: totalInputTokens,  rate: '$0.075 / 1M tokens',  color: '#2563eb' },
              { label: 'Output tokens', value: totalOutputTokens, rate: '$0.30 / 1M tokens',   color: '#7c3aed' },
              { label: 'Total tokens',  value: totalTokens,       rate: 'combined',             color: '#0f172a' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '0.875rem', color: '#0f172a' }}>{r.label}</div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{r.rate}</div>
                </div>
                <span style={{ fontWeight: '800', color: r.color, fontSize: '0.95rem' }}>{r.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', textAlign: 'center' }}>
            Gemini 1.5 Flash pricing · actual API billing
          </div>
        </div>

        {/* Preferences */}
        <div style={card}>
          <h3 style={{ fontWeight: '700', color: '#0f172a', marginBottom: '1.5rem', fontSize: '0.95rem' }}>🎨 Preferences</h3>
          {[
            { key: 'emailNotif', label: 'Email notification on run complete' },
            { key: 'autoSave',   label: 'Auto-save results to history' },
            { key: 'showTokens', label: 'Show token counts on model cards' },
            { key: 'darkMode',   label: 'Enable dark mode (coming soon)' },
          ].map(p => (
            <div key={p.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 0', borderBottom: '1px solid #f8fafc' }}>
              <span style={{ fontSize: '0.875rem', color: '#334155' }}>{p.label}</span>
              <Toggle on={prefs[p.key]} onClick={() => togglePref(p.key)} />
            </div>
          ))}
        </div>

        {/* Danger zone */}
        <div style={{ ...card, border: '1px solid #fee2e2' }}>
          <h3 style={{ fontWeight: '700', color: '#dc2626', marginBottom: '1.5rem', fontSize: '0.95rem' }}>⚠️ Danger Zone</h3>
          {[
            { label: 'Reset Usage Stats', desc: 'Clear token counts and cost totals', action: 'Reset', fn: () => { if (window.confirm('Reset all usage stats?')) onResetUsage(); } },
            { label: 'Clear All History', desc: 'Delete all saved prompt results permanently', action: 'Clear', fn: () => {} },
            { label: 'Delete Account',   desc: 'Permanently remove your account and data', action: 'Delete', danger: true, fn: () => {} },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 0', borderBottom: '1px solid #fff1f2' }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '0.875rem', color: '#0f172a' }}>{item.label}</div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>{item.desc}</div>
              </div>
              <button onClick={item.fn} style={{
                padding: '0.45rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.75rem',
                background: item.danger ? '#fee2e2' : '#f8fafc',
                border: `1px solid ${item.danger ? '#fca5a5' : '#e2e8f0'}`,
                color: item.danger ? '#dc2626' : '#64748b'
              }}>{item.action}</button>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default SettingsPage;
