import { useState, useEffect, useRef } from 'react';

/* ── SVG Icons ─────────────────────────────────────────────── */
const I = (d, extra = {}) => (props) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
    {d}
  </svg>
);

const ISearch    = I(<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>);
const IChat      = I(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>);
const IGrid      = I(<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>);
const IClock     = I(<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>);
const IChart     = I(<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>);
const ISettings  = I(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>);
const IChevDown  = I(<polyline points="6 9 12 15 18 9"/>);
const IChevUp    = I(<polyline points="18 15 12 9 6 15"/>);
const IPlus      = I(<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>);
const IPanel     = I(<><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></>);
const ILink      = I(<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>);
const IZap       = I(<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>);
const IBrain     = I(<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2"/>);
const IApp       = I(<><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></>);
const IPalette   = I(<><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></>);
const IKeyboard  = I(<><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/></>);
const IHelp      = I(<><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></>);
const ILogout    = I(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>);
const IDownload  = I(<><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></>);

/* ── Nav config ────────────────────────────────────────────── */
const MAIN_NAV = [
  { id: 'prompt-runner',   icon: IChat,     label: 'Chats' },
  { id: 'dashboard',       icon: IGrid,     label: 'Projects' },
  { id: 'results-history', icon: IClock,    label: 'History' },
  { id: 'analytics',       icon: IChart,    label: 'Analytics' },
  { id: 'settings',        icon: ISettings, label: 'Customize' },
];

const MORE_NAV = [
  { id: 'integrations', icon: ILink,  label: 'Integrations' },
  { id: 'automations',  icon: IZap,   label: 'Automations' },
  { id: 'llm-models',   icon: IBrain, label: 'LLM Models' },
];

const PROFILE_MENU = [
  { icon: IApp,      label: 'Get the app',        action: 'app' },
  { icon: ISettings, label: 'Settings',           action: 'settings' },
  { icon: IPalette,  label: 'Appearance',         action: 'appearance' },
  { icon: IKeyboard, label: 'Keyboard shortcuts', action: 'shortcuts' },
  { icon: IHelp,     label: 'Help & Support',     action: 'help' },
];

/* ── Sidebar ───────────────────────────────────────────────── */
const Sidebar = ({ activePage, onPageChange, onCollapse, history = [] }) => {
  const [moreOpen,    setMoreOpen]    = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const profileRef = useRef(null);
  const searchRef  = useRef(null);

  /* Close profile popup on outside click */
  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileOpen]);

  /* ESC key closes everything */
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { setProfileOpen(false); setSearchOpen(false); setSearchQuery(''); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  /* Search filter */
  const filteredHistory = searchQuery.trim()
    ? history.filter(h => h.prompt.toLowerCase().includes(searchQuery.toLowerCase()))
    : history;
  const recents = filteredHistory.slice(0, 14);

  const handleProfileAction = (action) => {
    setProfileOpen(false);
    if (action === 'settings')  onPageChange('settings');
    if (action === 'app')       alert('Desktop app coming soon!');
    if (action === 'appearance') alert('Appearance settings coming soon!');
    if (action === 'shortcuts') alert('Ctrl+Enter — Run prompt\nEsc — Close popups\nCtrl+K — Search');
    if (action === 'help')      window.open('mailto:support@kleza.io', '_blank');
    if (action === 'logout')    { localStorage.clear(); window.location.reload(); }
  };

  const NavBtn = ({ item }) => {
    const isActive = activePage === item.id;
    const Icon = item.icon;
    return (
      <button
        onClick={() => onPageChange(item.id)}
        className={`s-item${isActive ? ' s-item-active' : ''}`}
        style={{ marginBottom: '1px' }}
      >
        <span style={{ color: isActive ? '#111827' : '#6b7280', flexShrink: 0, display: 'flex' }}>
          <Icon />
        </span>
        {item.label}
      </button>
    );
  };

  return (
    <div style={{
      width: '260px', height: '100vh',
      background: '#ffffff',
      borderRight: '1px solid rgba(0,0,0,0.07)',
      position: 'fixed', left: 0, top: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column',
    }}>

      {/* ── Logo + collapse ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 14px 6px' }}>
        <span style={{ fontSize: '1.0625rem', fontWeight: '600', color: '#111827', letterSpacing: '-0.01em', userSelect: 'none' }}>
          Kleza AI
        </span>
        <Btn title="Close sidebar" onClick={onCollapse}><IPanel /></Btn>
      </div>

      {/* ── New chat ── */}
      <div style={{ padding: '4px 10px 6px' }}>
        <button
          onClick={() => onPageChange('prompt-runner')}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 12px', borderRadius: '8px',
            border: '1px solid rgba(0,0,0,0.1)',
            background: 'white', color: '#374151', fontSize: '0.875rem',
            cursor: 'pointer', transition: 'background 0.1s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
          onMouseLeave={e => e.currentTarget.style.background = 'white'}
        >
          <IPlus style={{ width: 14, height: 14 }} /> New chat
        </button>
      </div>

      {/* ── Search row ── */}
      <div style={{ padding: '0 10px 2px' }}>
        {searchOpen ? (
          <div style={{ position: 'relative' }}>
            <ISearch style={{
              position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
              width: 14, height: 14, color: '#9ca3af', pointerEvents: 'none'
            }} />
            <input
              ref={searchRef}
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search chats…"
              style={{
                width: '100%', padding: '7px 10px 7px 32px',
                border: '1px solid rgba(0,0,0,0.12)', borderRadius: '8px',
                background: '#f9fafb', fontSize: '0.875rem', color: '#111827',
                outline: 'none', fontFamily: 'inherit',
              }}
            />
          </div>
        ) : (
          <button
            className="s-item"
            onClick={() => setSearchOpen(true)}
            style={{ color: '#374151', marginBottom: '1px' }}
          >
            <span style={{ color: '#6b7280', display: 'flex' }}><ISearch /></span>
            Search
          </button>
        )}
      </div>

      {/* ── Main nav ── */}
      <nav style={{ padding: '0 8px' }}>
        {MAIN_NAV.map(item => <NavBtn key={item.id} item={item} />)}

        {/* More toggle */}
        <button
          className="s-item"
          onClick={() => setMoreOpen(v => !v)}
          style={{ marginBottom: '1px' }}
        >
          <span style={{ color: '#6b7280', display: 'flex' }}>
            {moreOpen ? <IChevUp /> : <IChevDown />}
          </span>
          More
        </button>

        {/* More items */}
        {moreOpen && (
          <div style={{ marginLeft: '8px', borderLeft: '1.5px solid rgba(0,0,0,0.07)', paddingLeft: '8px' }}>
            {MORE_NAV.map(item => <NavBtn key={item.id} item={item} />)}
          </div>
        )}
      </nav>

      {/* ── Recents ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 0' }}>
        {recents.length > 0 && (
          <>
            <p style={{
              fontSize: '0.6875rem', fontWeight: '500', color: '#9ca3af',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              padding: '4px 10px 4px', marginTop: '4px'
            }}>Recents</p>
            {recents.map(h => (
              <button
                key={h.id}
                className="s-recent"
                onClick={() => onPageChange('results-history')}
                title={h.prompt}
              >{h.prompt}</button>
            ))}
          </>
        )}
      </div>

      {/* ── Profile popup ── */}
      {profileOpen && (
        <div
          ref={profileRef}
          style={{
            position: 'absolute', bottom: '62px', left: '10px', right: '10px',
            background: '#ffffff',
            border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: '12px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
            zIndex: 200, overflow: 'hidden', padding: '6px',
          }}
        >
          {/* Profile header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px 10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.8rem', fontWeight: '600', color: 'white',
            }}>S</div>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#111827' }}>Sodham</div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>sodham@kleza.io</div>
            </div>
          </div>

          <div style={{ height: '1px', background: 'rgba(0,0,0,0.07)', margin: '2px 0 6px' }} />

          {/* Menu items */}
          {PROFILE_MENU.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.action}
                onClick={() => handleProfileAction(item.action)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 12px', borderRadius: '8px', border: 'none',
                  background: 'transparent', color: '#374151', fontSize: '0.875rem',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ color: '#6b7280', display: 'flex', flexShrink: 0 }}><Icon /></span>
                {item.label}
              </button>
            );
          })}

          <div style={{ height: '1px', background: 'rgba(0,0,0,0.07)', margin: '6px 0' }} />

          {/* Logout */}
          <button
            onClick={() => handleProfileAction('logout')}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px 12px', borderRadius: '8px', border: 'none',
              background: 'transparent', color: '#dc2626', fontSize: '0.875rem',
              cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ display: 'flex', flexShrink: 0 }}><ILogout /></span>
            Log out
          </button>
        </div>
      )}

      {/* ── User row ── */}
      <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', padding: '8px 10px' }}>
        <button
          onClick={() => setProfileOpen(v => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
            padding: '6px 8px', borderRadius: '8px', border: 'none',
            background: profileOpen ? 'rgba(0,0,0,0.05)' : 'transparent',
            cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => { if (!profileOpen) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
          onMouseLeave={e => { if (!profileOpen) e.currentTarget.style.background = 'transparent'; }}
        >
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.75rem', fontWeight: '600', color: 'white',
          }}>S</div>
          <div style={{ flex: 1, overflow: 'hidden', textAlign: 'left' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: '500', color: '#111827', lineHeight: 1.3 }}>Sodham</div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.3 }}>Kleza</div>
          </div>
          <span style={{ color: '#9ca3af', flexShrink: 0, display: 'flex' }}><IDownload /></span>
        </button>
      </div>
    </div>
  );
};

/* Small icon button helper */
const Btn = ({ children, onClick, title }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      background: 'none', border: 'none', padding: '5px', borderRadius: '6px',
      color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center',
      transition: 'background 0.1s',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
    onMouseLeave={e => e.currentTarget.style.background = 'none'}
  >{children}</button>
);

export default Sidebar;
