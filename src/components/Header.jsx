const NAV_ITEMS = [
  { id: 'prompt-runner',   label: 'Prompt Runner' },
  { id: 'results-history', label: 'History' },
  { id: 'settings',        label: 'Settings' },
];

const Header = ({ usage = {}, activePage = 'prompt-runner', onPageChange }) => {
  const { totalTokens = 0, totalCost = 0 } = usage;

  return (
    <header style={{
      height: '56px',
      display: 'flex', alignItems: 'center',
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: 'rgba(245,244,239,0.95)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(0,0,0,0.07)',
      padding: '0 1.25rem',
      gap: '0.75rem'
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexShrink: 0 }}>
        <div style={{
          width: '30px', height: '30px',
          background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
          borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.8rem', fontWeight: '800', color: 'white',
        }}>K</div>
        <span style={{ fontSize: '0.95rem', fontWeight: '700', color: '#1a1a1a' }}>Kleza Excelliq AI</span>
      </div>

      <div style={{ width: '1px', height: '20px', background: 'rgba(0,0,0,0.1)', flexShrink: 0, margin: '0 4px' }} />

      {/* Nav */}
      <nav style={{ display: 'flex', gap: '1px', flex: 1 }}>
        {NAV_ITEMS.map(item => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              style={{
                padding: '5px 13px', borderRadius: '7px', border: 'none',
                background: isActive ? 'rgba(0,0,0,0.07)' : 'transparent',
                color: isActive ? '#1a1a1a' : '#6b7280',
                fontSize: '0.83rem', fontWeight: isActive ? '600' : '400',
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >{item.label}</button>
          );
        })}
      </nav>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {totalTokens > 0 && (
          <div style={{
            fontSize: '0.75rem', color: '#6b7280',
            background: 'rgba(0,0,0,0.05)', padding: '4px 10px', borderRadius: '20px',
          }}>
            <span style={{ fontWeight: '600', color: '#1a1a1a' }}>{totalTokens.toLocaleString()}</span> tkn
            <span style={{ margin: '0 4px', color: '#d1d5db' }}>·</span>
            <span style={{ fontWeight: '600', color: '#059669' }}>${totalCost.toFixed(4)}</span>
          </div>
        )}
        <div style={{
          width: '30px', height: '30px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.68rem', fontWeight: '700', color: 'white', cursor: 'pointer',
        }}>S</div>
      </div>
    </header>
  );
};

export default Header;
