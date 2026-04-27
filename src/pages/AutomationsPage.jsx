import { useState } from 'react';

const SAMPLE = [
  { id: 1, name: 'Daily SEO Brief', prompt: 'Give me top 5 SEO trends for today', schedule: 'Every day at 9:00 AM', lastRun: '2 hours ago', active: true },
  { id: 2, name: 'Weekly Content Ideas', prompt: 'Generate 10 blog post ideas for SaaS products', schedule: 'Every Monday at 8:00 AM', lastRun: '5 days ago', active: false },
  { id: 3, name: 'Competitor Analysis', prompt: 'Analyze latest AI tools launched this week', schedule: 'Every Friday at 6:00 PM', lastRun: '3 days ago', active: true },
];

const SCHEDULE_LABELS = { hourly: 'Every hour', daily: 'Every day at 9:00 AM', weekly: 'Every Monday at 8:00 AM' };

const AutomationsPage = () => {
  const [items, setItems] = useState(SAMPLE);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', prompt: '', schedule: 'daily' });

  const toggle = id => setItems(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
  const remove = id => setItems(prev => prev.filter(a => a.id !== id));

  const create = () => {
    if (!form.name.trim() || !form.prompt.trim()) return;
    setItems(prev => [...prev, { id: Date.now(), name: form.name, prompt: form.prompt, schedule: SCHEDULE_LABELS[form.schedule], lastRun: 'Never', active: true }]);
    setForm({ name: '', prompt: '', schedule: 'daily' });
    setCreating(false);
  };

  const inputStyle = {
    padding: '0.7rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0',
    fontSize: '0.875rem', outline: 'none', color: '#334155', background: 'white', width: '100%', boxSizing: 'border-box'
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem' }}>⚡ Automations</h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
            Schedule prompts to run automatically on a set interval. Set once, let AI work for you around the clock.
          </p>
        </div>
        <button onClick={() => setCreating(true)} style={{
          padding: '0.75rem 1.4rem', background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
          border: 'none', borderRadius: '12px', color: 'white', fontWeight: '700', fontSize: '0.875rem',
          cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.25)', whiteSpace: 'nowrap'
        }}>+ Create Automation</button>
      </div>

      {/* Create form */}
      {creating && (
        <div style={{ background: 'white', borderRadius: '20px', padding: '1.75rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontWeight: '700', color: '#0f172a', marginBottom: '1.25rem', fontSize: '1rem' }}>New Automation</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Daily News Summary" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Schedule</label>
              <select value={form.schedule} onChange={e => setForm(f => ({ ...f, schedule: e.target.value }))} style={inputStyle}>
                <option value="hourly">Every hour</option>
                <option value="daily">Every day</option>
                <option value="weekly">Every week</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Prompt Template</label>
            <textarea value={form.prompt} onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))} placeholder="Enter the prompt to run automatically..."
              style={{ ...inputStyle, resize: 'none', height: '80px' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={create} style={{ padding: '0.65rem 1.5rem', background: '#2563eb', border: 'none', borderRadius: '10px', color: 'white', fontWeight: '700', cursor: 'pointer' }}>Create</button>
            <button onClick={() => setCreating(false)} style={{ padding: '0.65rem 1.5rem', background: '#f1f5f9', border: 'none', borderRadius: '10px', color: '#64748b', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total', value: items.length, color: '#2563eb' },
          { label: 'Active', value: items.filter(a => a.active).length, color: '#16a34a' },
          { label: 'Paused', value: items.filter(a => !a.active).length, color: '#94a3b8' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', borderRadius: '14px', padding: '0.85rem 1.25rem', border: '1px solid #f1f5f9', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: '800', color: s.color }}>{s.value}</span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '500' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {items.map(a => (
          <div key={a.id} style={{
            background: 'white', borderRadius: '20px', padding: '1.4rem 1.5rem',
            border: `1px solid ${a.active ? 'rgba(37,99,235,0.15)' : '#f1f5f9'}`,
            display: 'flex', alignItems: 'center', gap: '1.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)', transition: 'all 0.2s'
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                <span style={{ fontWeight: '700', fontSize: '0.95rem', color: '#0f172a' }}>{a.name}</span>
                <span style={{
                  fontSize: '0.65rem', padding: '2px 8px', borderRadius: '8px', fontWeight: '700',
                  background: a.active ? '#dcfce7' : '#f1f5f9', color: a.active ? '#16a34a' : '#94a3b8'
                }}>{a.active ? 'Active' : 'Paused'}</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 6px' }}>"{a.prompt}"</p>
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>🕐 {a.schedule}</span>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>▶ Last: {a.lastRun}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div onClick={() => toggle(a.id)} style={{
                width: '44px', height: '24px', borderRadius: '24px', cursor: 'pointer',
                background: a.active ? '#2563eb' : '#e2e8f0', position: 'relative', transition: 'background 0.3s', flexShrink: 0
              }}>
                <div style={{ width: '18px', height: '18px', background: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: a.active ? '23px' : '3px', transition: 'left 0.3s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
              </div>
              <button onClick={() => remove(a.id)} style={{ border: 'none', background: '#fff1f2', borderRadius: '8px', color: '#ef4444', cursor: 'pointer', padding: '6px 8px', fontSize: '0.75rem', fontWeight: '600' }}>✕</button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', background: 'white', borderRadius: '20px', border: '1px dashed #e2e8f0' }}>
            No automations yet. Create one to get started!
          </div>
        )}
      </div>
    </div>
  );
};

export default AutomationsPage;
