import { useState, useEffect, useRef } from 'react';

/* ── Icons ─────────────────────────────────────────────────────── */
const Ico = (d) => (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...props}>{d}</svg>
);

const IPlus     = Ico(<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>);
const ISearch   = Ico(<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>);
const IClock    = Ico(<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>);
const IMore     = Ico(<><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>);
const IPanel    = Ico(<><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></>);
const IChevDown = Ico(<polyline points="6 9 12 15 18 9"/>);
const ISettings = Ico(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 1 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>);
const IGrid     = Ico(<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></>);
const IZap      = Ico(<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>);
const ILink     = Ico(<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>);
const IBrain    = Ico(<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2"/>);
const IChart    = Ico(<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>);
const ILogout   = Ico(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>);
const IHelp     = Ico(<><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></>);

/* ── More sub-nav items ─────────────────────────────────────── */
const MORE_NAV = [
  { id: 'integrations',   icon: ILink,    label: 'Integrations' },
  { id: 'settings',       icon: ISettings,label: 'Settings' },
];

/* ── Group history by date ──────────────────────────────────── */
function groupByDate(items) {
  const groups = {};
  const now = new Date();
  items.forEach(h => {
    const d = new Date(h.id);
    const diffDays = Math.floor((now - d) / 86400000);
    const key = diffDays === 0 ? 'Today'
      : diffDays === 1 ? 'Yesterday'
      : diffDays < 7   ? 'This week'
      : diffDays < 30  ? 'This month'
      : 'Older';
    if (!groups[key]) groups[key] = [];
    groups[key].push(h);
  });
  return groups;
}

/* ── Sidebar ─────────────────────────────────────────────────── */
const NavItem = ({ id, icon, label, activePage, onPageChange }) => {
  const active = activePage === id;
  return (
    <button
      onClick={() => onPageChange(id)}
      className={`s-item${active ? ' s-item-active' : ''}`}
    >
      <span style={{ color: active ? '#1c1c1c' : '#78716c', display: 'flex', flexShrink: 0 }}>
        {icon()}
      </span>
      {label}
    </button>
  );
};

const Sidebar = ({ activePage, onPageChange, onNewChat, onCollapse, history = [], onHistorySelect }) => {
  const [moreOpen,    setMoreOpen]    = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const profileRef = useRef(null);

  const storedUser   = (() => { try { return JSON.parse(localStorage.getItem('ph_user') || '{}'); } catch { return {}; } })();
  const displayName  = storedUser.name  || 'User';
  const displayEmail = storedUser.email || '';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  useEffect(() => {
    if (!profileOpen) return;
    const fn = (e) => { if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [profileOpen]);

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') { setProfileOpen(false); setSearchOpen(false); setSearchQuery(''); } };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, []);

  const filteredHistory = searchQuery.trim()
    ? history.filter(h => h.prompt.toLowerCase().includes(searchQuery.toLowerCase()))
    : history;

  const groups = groupByDate(filteredHistory.slice(0, 30));
  const groupOrder = ['Today', 'Yesterday', 'This week', 'This month', 'Older'];

  const handleProfileAction = (action) => {
    setProfileOpen(false);
    if (action === 'settings') onPageChange('settings');
    if (action === 'help')     window.open('mailto:support@kleza.io', '_blank');
    if (action === 'logout') {
      localStorage.removeItem('ph_user');
      window.location.reload();
    }
  };

  return (
    <div style={{
      width: '240px', height: '100vh',
      background: '#ebe9e4',
      position: 'fixed', left: 0, top: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column',
      borderRight: '1px solid rgba(0,0,0,0.06)',
    }}>

      {/* ── Logo ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 12px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '26px', height: '26px', borderRadius: '7px',
            background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.7rem', fontWeight: '800', color: 'white', flexShrink: 0,
          }}>K</div>
          <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#1c1c1c', letterSpacing: '-0.02em' }}>
            Kleza Excelliq AI
          </span>
        </div>
        <button
          onClick={onCollapse}
          title="Close sidebar"
          style={{ background: 'none', border: 'none', padding: '4px', borderRadius: '6px', color: '#a8a29e', cursor: 'pointer', display: 'flex' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.06)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <IPanel />
        </button>
      </div>

      {/* ── Top nav ── */}
      <div style={{ padding: '2px 8px 4px' }}>

        {/* New Chat */}
        <button
          onClick={onNewChat}
          className="s-item"
          style={{ gap: '9px', marginBottom: '1px' }}
        >
          <span style={{ color: '#78716c', display: 'flex', flexShrink: 0 }}><IPlus /></span>
          New Chat
        </button>

        {/* Search */}
        {searchOpen ? (
          <div style={{ position: 'relative', margin: '1px 0' }}>
            <ISearch style={{
              position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
              color: '#a8a29e', pointerEvents: 'none', width: 13, height: 13,
            }} />
            <input
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onBlur={() => { if (!searchQuery) setSearchOpen(false); }}
              placeholder="Search chats…"
              style={{
                width: '100%', padding: '6px 10px 6px 30px',
                border: '1px solid rgba(0,0,0,0.12)', borderRadius: '7px',
                background: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', color: '#1c1c1c',
                outline: 'none', fontFamily: 'inherit',
              }}
            />
          </div>
        ) : (
          <button className="s-item" onClick={() => setSearchOpen(true)} style={{ marginBottom: '1px' }}>
            <span style={{ color: '#78716c', display: 'flex', flexShrink: 0 }}><ISearch /></span>
            Search
          </button>
        )}

        {/* History */}
        <NavItem id="results-history" icon={IClock} label="History" activePage={activePage} onPageChange={onPageChange} />

        {/* More */}
        <button
          className="s-item"
          onClick={() => setMoreOpen(v => !v)}
          style={{ marginTop: '1px' }}
        >
          <span style={{ color: '#78716c', display: 'flex', flexShrink: 0 }}><IMore /></span>
          More
          <span style={{ marginLeft: 'auto', color: '#a8a29e', display: 'flex', transition: 'transform 0.2s', transform: moreOpen ? 'rotate(180deg)' : 'none' }}>
            <IChevDown />
          </span>
        </button>

        {moreOpen && (
          <div style={{ marginLeft: '6px', paddingLeft: '8px', borderLeft: '1.5px solid rgba(0,0,0,0.1)', marginTop: '2px' }}>
            {MORE_NAV.map(item => (
              <NavItem key={item.id} id={item.id} icon={item.icon} label={item.label} activePage={activePage} onPageChange={onPageChange} />
            ))}
          </div>
        )}
      </div>

      {/* ── Divider ── */}
      <div style={{ height: '1px', background: 'rgba(0,0,0,0.07)', margin: '6px 12px' }} />

      {/* ── Recent chats ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
        {groupOrder.map(group => {
          const items = groups[group];
          if (!items || items.length === 0) return null;
          return (
            <div key={group}>
              <span className="s-label">{group}</span>
              {items.map(h => (
                <button
                  key={h.id}
                  className="s-recent"
                  onClick={() => { if (onHistorySelect) onHistorySelect(h.id); else onPageChange('results-history'); }}
                  title={h.prompt}
                >
                  {h.prompt}
                </button>
              ))}
            </div>
          );
        })}
        {filteredHistory.length === 0 && (
          <p style={{ fontSize: '0.8rem', color: '#a8a29e', padding: '6px 10px' }}>
            {searchQuery ? 'No results' : 'No chats yet'}
          </p>
        )}
      </div>

      {/* ── Profile popup ── */}
      {profileOpen && (
        <div
          ref={profileRef}
          style={{
            position: 'absolute', bottom: '60px', left: '10px', right: '10px',
            background: '#ffffff', border: '1px solid rgba(0,0,0,0.09)',
            borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.10)',
            zIndex: 200, overflow: 'hidden', padding: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px 10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', fontWeight: '700', color: 'white',
            }}>{avatarLetter}</div>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1c1c1c' }}>{displayName}</div>
              <div style={{ fontSize: '0.72rem', color: '#a8a29e' }}>{displayEmail}</div>
            </div>
          </div>
          <div style={{ height: '1px', background: 'rgba(0,0,0,0.07)', margin: '2px 0 4px' }} />
          {[
            { icon: ISettings, label: 'Settings', action: 'settings' },
            { icon: IHelp,     label: 'Help & Support', action: 'help' },
          ].map(item => (
            <button key={item.action} onClick={() => handleProfileAction(item.action)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '9px', padding: '7px 12px', borderRadius: '8px', border: 'none', background: 'transparent', color: '#374151', fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ color: '#78716c', display: 'flex' }}><item.icon /></span>
              {item.label}
            </button>
          ))}
          <div style={{ height: '1px', background: 'rgba(0,0,0,0.07)', margin: '4px 0' }} />
          <button onClick={() => handleProfileAction('logout')}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '9px', padding: '7px 12px', borderRadius: '8px', border: 'none', background: 'transparent', color: '#dc2626', fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }}
            onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ display: 'flex' }}><ILogout /></span>
            Log out
          </button>
        </div>
      )}

      {/* ── User row ── */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid rgba(0,0,0,0.07)' }}>
        <button
          onClick={() => setProfileOpen(v => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '9px',
            padding: '6px 8px', borderRadius: '8px', border: 'none',
            background: profileOpen ? 'rgba(0,0,0,0.06)' : 'transparent',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.12s',
          }}
          onMouseEnter={e => { if (!profileOpen) e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; }}
          onMouseLeave={e => { if (!profileOpen) e.currentTarget.style.background = 'transparent'; }}
        >
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.7rem', fontWeight: '700', color: 'white',
          }}>{avatarLetter}</div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: '500', color: '#1c1c1c', lineHeight: 1.3, letterSpacing: '-0.01em' }}>{displayName}</div>
            <div style={{ fontSize: '0.72rem', color: '#a8a29e', lineHeight: 1.3 }}>{displayEmail || 'Kleza'}</div>
          </div>
          <span style={{ color: '#a8a29e', display: 'flex' }}><IChevDown /></span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
