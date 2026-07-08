import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import DashboardPage from './pages/DashboardPage';
import PromptRunnerPage from './pages/PromptRunnerPage';
import LLMModelsPage from './pages/LLMModelsPage';
import ResultsHistoryPage from './pages/ResultsHistoryPage';
import AutomationsPage from './pages/AutomationsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import IntegrationsPage from './pages/IntegrationsPage';
import SettingsPage from './pages/SettingsPage';
import AdminPortal from './pages/AdminPortal';
import OnboardingPage from './pages/OnboardingPage';
import LandingPage from './pages/LandingPage';
import ArchitectureDiagram from './pages/ArchitectureDiagram';
import ResetPasswordPage from './pages/ResetPasswordPage';
import { attachClientId } from './utils/clientIdentity';

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

function ChatApp() {
  const [onboardingDone, setOnboardingDone] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem('ph_user') || '{}');
      return Boolean(u.onboardingComplete);
    } catch { return false; }
  });

  // Show landing only on first-ever visit (before onboarding is complete)
  const [landingDone, setLandingDone] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem('ph_user') || '{}');
      return Boolean(u.onboardingComplete); // skip landing if already onboarded
    } catch { return false; }
  });

  const handleOnboardingComplete = (userData) => {
    localStorage.setItem('ph_user', JSON.stringify(attachClientId({ ...userData, onboardingComplete: true })));
    setOnboardingDone(true);
  };

  const isMobile = useIsMobile();
  const [activePage,      setActivePage]      = useState('prompt-runner');
  const [sidebarOpen,     setSidebarOpen]     = useState(() => typeof window === 'undefined' || window.innerWidth > 768);
  const [chatKey,         setChatKey]         = useState(0);
  const [activeHistoryId, setActiveHistoryId] = useState(null);

  const handleHistorySelect = (id) => {
    setActiveHistoryId(id);
    setActivePage('results-history');
  };

  const handleNewChat = () => {
    setActivePage('prompt-runner');
    setChatKey(k => k + 1);
  };

  const [usage, setUsage] = useState(() => {
    try { const s = localStorage.getItem('ph_usage'); return s ? JSON.parse(s) : { totalInputTokens:0, totalOutputTokens:0, totalTokens:0, totalCost:0 }; }
    catch { return { totalInputTokens:0, totalOutputTokens:0, totalTokens:0, totalCost:0 }; }
  });

  const [history, setHistory] = useState(() => {
    try { const s = localStorage.getItem('ph_history'); return s ? JSON.parse(s) : []; }
    catch { return []; }
  });

  useEffect(() => { localStorage.setItem('ph_usage',   JSON.stringify(usage)); },            [usage]);
  useEffect(() => { localStorage.setItem('ph_history', JSON.stringify(history.slice(0,100))); }, [history]);

  const handleRunComplete = ({ prompt, gemini, claude, openai, stage1Claude, tokenData, elapsed }) => {
    if (tokenData) setUsage(prev => ({
      totalInputTokens:  prev.totalInputTokens  + (tokenData.inputTokens  || 0),
      totalOutputTokens: prev.totalOutputTokens + (tokenData.outputTokens || 0),
      totalTokens:       prev.totalTokens       + (tokenData.totalTokens  || 0),
      totalCost:         prev.totalCost         + (tokenData.runCost      || 0),
    }));
    const id = Date.now();
    setHistory(prev => [{
      id, prompt,
      date: new Date().toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' }),
      best: gemini ? 'Gemini 3.1 Pro' : claude ? 'Claude Opus 4.6' : 'GPT-5.2',
      status: 'Complete', responses:{ gemini, claude, openai, stage1Claude: stage1Claude || '' },
      tokenData: tokenData || null,
      elapsed: elapsed || null,
      followUps: [],
    }, ...prev]);
    return id;
  };

  const handleFollowUpComplete = ({ historyId, question, answer, elapsed }) => {
    setHistory(prev => prev.map(item =>
      item.id === historyId
        ? { ...item, followUps: [...(item.followUps || []), { question, answer, elapsed: elapsed || null }] }
        : item
    ));
  };

  const handleHistoryDelete = (id) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  if (!landingDone) {
    return <LandingPage onGetStarted={() => setLandingDone(true)} />;
  }

  if (!onboardingDone) {
    return <OnboardingPage onComplete={handleOnboardingComplete} />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'prompt-runner':   return <PromptRunnerPage key={chatKey} onRunComplete={handleRunComplete} onFollowUpComplete={handleFollowUpComplete} />;
      case 'dashboard':       return <DashboardPage history={history} usage={usage} onNavigate={setActivePage} />;
      case 'llm-models':      return <LLMModelsPage />;
      case 'results-history': return <ResultsHistoryPage history={history} selectedId={activeHistoryId} onFollowUpComplete={handleFollowUpComplete} />;
      case 'automations':     return <AutomationsPage />;
      case 'analytics':       return <AnalyticsPage history={history} usage={usage} />;
      case 'integrations':    return <IntegrationsPage />;
      case 'settings':        return <SettingsPage usage={usage} onResetUsage={() => setUsage({ totalInputTokens:0, totalOutputTokens:0, totalTokens:0, totalCost:0 })} />;
      case 'architecture':    return <ArchitectureDiagram />;
      default: return null;
    }
  };

  const sidebar = (
    <Sidebar
      activePage={activePage}
      onPageChange={(p) => { setActivePage(p); if (isMobile) setSidebarOpen(false); }}
      onNewChat={() => { handleNewChat(); if (isMobile) setSidebarOpen(false); }}
      onCollapse={() => setSidebarOpen(false)}
      history={history}
      onHistorySelect={(id) => { handleHistorySelect(id); if (isMobile) setSidebarOpen(false); }}
      onHistoryDelete={handleHistoryDelete}
    />
  );

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      {/* Sidebar — overlay drawer on mobile, inline column on desktop */}
      {isMobile ? (
        sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(10,20,40,0.45)', zIndex: 95, backdropFilter: 'blur(1px)' }}>
            <div onClick={e => e.stopPropagation()}>{sidebar}</div>
          </div>
        )
      ) : (
        <div style={{
          width: sidebarOpen ? '240px' : '0',
          overflow: 'hidden',
          transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
          flexShrink: 0,
        }}>
          {sidebarOpen && sidebar}
        </div>
      )}

      {/* Main */}
      <main style={{
        flex: 1, minWidth: 0, background: '#f5f4f0', minHeight:'100vh',
        display: activePage === 'prompt-runner' ? 'flex' : 'block',
        flexDirection: 'column',
        position: 'relative',
        transition: 'margin-left 0.22s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Floating panel-open button when sidebar is closed */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            title="Open sidebar"
            style={{
              position: 'fixed', top: '14px', left: '12px', zIndex: 90,
              background: isMobile ? 'rgba(255,255,255,0.9)' : 'none',
              border: isMobile ? '1px solid rgba(0,0,0,0.1)' : 'none',
              padding: isMobile ? '8px' : '5px', borderRadius: isMobile ? '10px' : '6px',
              boxShadow: isMobile ? '0 4px 14px rgba(0,0,0,0.12)' : 'none',
              color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={e => !isMobile && (e.currentTarget.style.background = 'rgba(0,0,0,0.06)')}
            onMouseLeave={e => !isMobile && (e.currentTarget.style.background = 'none')}
          >
            <svg width={isMobile ? 20 : 16} height={isMobile ? 20 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
          </button>
        )}

        {activePage === 'prompt-runner'
          ? renderPage()
          : activePage === 'results-history'
            ? renderPage()
            : <div style={{ padding: isMobile ? '4rem 1.05rem 2rem' : '2.5rem 2.5rem 3rem', maxWidth:'1200px' }}>{renderPage()}</div>
        }
      </main>
    </div>
  );
}

const isPasswordResetRoute = () => {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return window.location.pathname.startsWith('/reset-password')
    || hashParams.get('type') === 'recovery'
    || Boolean(hashParams.get('access_token') && hashParams.get('refresh_token'));
};

function App() {
  if (window.location.pathname.startsWith('/admin')) return <AdminPortal />;
  if (isPasswordResetRoute()) return <ResetPasswordPage />;
  return <ChatApp />;
}

export default App;
