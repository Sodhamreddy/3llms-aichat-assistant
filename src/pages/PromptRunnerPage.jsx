import { useState, useEffect } from 'react';
import PromptControl from '../components/PromptControl';

const useIsMobile = (bp = 768) => {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth <= bp);
  useEffect(() => {
    const fn = () => setM(window.innerWidth <= bp);
    fn();
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, [bp]);
  return m;
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

<<<<<<< HEAD
const getUserName = () => {
  try {
    const user = JSON.parse(localStorage.getItem('ph_user') || '{}');
    const fullName = String(user.name || user.displayName || user.email?.split('@')[0] || 'there').trim();
    return fullName.split(/\s+/)[0] || 'there';
  } catch {
    return 'there';
  }
};

const taglines = [
  'What should we solve first?',
  'Ready to ask something brilliant?',
  'What are we building today?',
  'What idea should we sharpen?',
  'What question needs three minds?',
  'Where should Excelliq begin?',
  'What do you want to explore?',
  'Let\'s turn a thought into an answer.',
  'What needs a smarter second look?',
  'What decision are we making today?',
];

const getTagline = () => taglines[Math.floor(Math.random() * taglines.length)];

const MODES = [
  { key: 'battle',    icon: '⚡', label: 'Battle Mode',    sub: 'Live 3-way race → synthesis' },
  { key: 'invisible', icon: '👁', label: 'Invisible Mode', sub: 'Clean Claude synthesis only' },
];

const PromptRunnerPage = ({ onRunComplete, onFollowUpComplete }) => {
  const [tagline] = useState(() => getTagline());
  const [mode, setMode] = useState('battle');
  const [modeOpen, setModeOpen] = useState(false);
  const isMobile = useIsMobile();

  const currentMode = MODES.find(m => m.key === mode);

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh',
      padding: isMobile ? '4.75rem 1rem 140px' : '2rem 2rem 160px',
      background: '#f5f4f0',
      width: '100%',
      position: 'relative',
    }}>

      {/* Mode selector — top-right on mobile (clears the menu button), top-left on desktop */}
      <div style={{ position: 'absolute', top: isMobile ? '1rem' : '1.25rem', left: isMobile ? 'auto' : '1.5rem', right: isMobile ? '1rem' : 'auto' }}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setModeOpen(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'white', border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: 999, padding: '6px 14px',
              fontSize: '0.8rem', fontWeight: 700, color: '#1c1c1c',
              cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
              fontFamily: 'inherit',
            }}
          >
            <span>{currentMode.icon}</span>
            <span>{currentMode.label}</span>
            <span style={{ fontSize: '0.6rem', opacity: 0.45, marginLeft: 2 }}>▼</span>
          </button>

          {modeOpen && (
            <div
              style={{
                position: 'absolute', top: '110%', left: isMobile ? 'auto' : 0, right: isMobile ? 0 : 'auto',
                background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                padding: '6px', zIndex: 50, minWidth: 220,
              }}
            >
              {MODES.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => { setMode(opt.key); setModeOpen(false); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', borderRadius: 10, border: 'none',
                    background: mode === opt.key ? '#fff7f4' : 'transparent',
                    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>{opt.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: mode === opt.key ? '#d97757' : '#1c1c1c' }}>{opt.label}</div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{opt.sub}</div>
                  </div>
                  {mode === opt.key && <span style={{ color: '#d97757', fontSize: '0.8rem' }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Greeting */}
      <p style={{
        fontSize: '0.875rem', color: '#a8a29e', fontWeight: '400',
        letterSpacing: '-0.01em', marginBottom: '10px', textAlign: 'center',
      }}>
        {getGreeting()}, {getUserName()}
      </p>

      {/* Tagline */}
      <h1 style={{
        fontFamily: "'Lora', Georgia, serif",
        fontSize: 'clamp(1.75rem, 4vw, 2.6rem)',
        fontWeight: '500',
        color: '#1c1c1c',
        letterSpacing: '-0.02em',
        marginBottom: '2.25rem',
        textAlign: 'center',
        lineHeight: 1.25,
      }}>
        {tagline}
      </h1>

      <PromptControl
        onRunComplete={onRunComplete}
        onFollowUpComplete={onFollowUpComplete}
        mode={mode}
        onModeChange={setMode}
      />
    </div>
  );
};
=======
const PromptRunnerPage = ({ onRunComplete, onFollowUpComplete }) => (
  <div style={{
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    minHeight: '100vh',
    padding: '2rem 2rem 4rem',
    background: '#f5f4ef',
    width: '100%',
  }}>
    <h1 style={{
      fontSize: '2.25rem', fontWeight: '700', color: '#1a1a1a',
      letterSpacing: '-0.03em', marginBottom: '1.75rem',
      textAlign: 'center', lineHeight: 1.2,
    }}>
      {getGreeting()}, Sodham
    </h1>

    <PromptControl onRunComplete={onRunComplete} onFollowUpComplete={onFollowUpComplete} />
  </div>
);
>>>>>>> 78b2a68a (code updated according vasudha comments)

export default PromptRunnerPage;
