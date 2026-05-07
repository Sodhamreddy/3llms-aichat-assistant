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

function App() {
  const [activePage,   setActivePage]   = useState('prompt-runner');
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);

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

  const handleRunComplete = ({ prompt, gemini, claude, openai, tokenData }) => {
    const id = Date.now();
    if (tokenData) setUsage(prev => ({
      totalInputTokens:  prev.totalInputTokens  + (tokenData.inputTokens  || 0),
      totalOutputTokens: prev.totalOutputTokens + (tokenData.outputTokens || 0),
      totalTokens:       prev.totalTokens       + (tokenData.totalTokens  || 0),
      totalCost:         prev.totalCost         + (tokenData.runCost      || 0),
    }));
    setHistory(prev => [{
      id, prompt,
      date: new Date().toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' }),
      best: gemini ? 'Gemini 1.5' : claude ? 'Claude-3' : 'GPT-4o',
      status: 'Complete', responses:{ gemini, claude, openai },
      followUps: [],
      tokenData: tokenData || null,
    }, ...prev]);
    setSelectedHistoryId(id);
    return id;
  };

  const handleFollowUpComplete = ({ historyId, prompt, question, answer }) => {
    if ((!historyId && !prompt) || !question || !answer) return;
    setHistory(prev => {
      const targetId = historyId || prev.find(chat => chat.prompt === prompt)?.id;
      if (!targetId) return prev;
      return prev.map(chat => (
        chat.id === targetId
          ? { ...chat, followUps: [...(chat.followUps || []), { question, answer, date: new Date().toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' }) }] }
          : chat
      ));
    });
  };

  const openHistoryChat = (id = null) => {
    setSelectedHistoryId(id);
    setActivePage('results-history');
  };

  const renderPage = () => {
    switch (activePage) {
      case 'prompt-runner':   return <PromptRunnerPage onRunComplete={handleRunComplete} onFollowUpComplete={handleFollowUpComplete} />;
      case 'dashboard':       return <DashboardPage history={history} usage={usage} onNavigate={setActivePage} />;
      case 'llm-models':      return <LLMModelsPage />;
      case 'results-history': return <ResultsHistoryPage history={history} selectedId={selectedHistoryId} onSelect={setSelectedHistoryId} />;
      case 'automations':     return <AutomationsPage />;
      case 'analytics':       return <AnalyticsPage history={history} usage={usage} />;
      case 'integrations':    return <IntegrationsPage />;
      case 'settings':        return <SettingsPage usage={usage} onResetUsage={() => setUsage({ totalInputTokens:0, totalOutputTokens:0, totalTokens:0, totalCost:0 })} />;
      default: return null;
    }
  };

  const ml = sidebarOpen ? '260px' : '0';

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      {/* Sidebar */}
      <div style={{
        width: sidebarOpen ? '260px' : '0',
        overflow: 'hidden',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
        flexShrink: 0,
      }}>
        {sidebarOpen && (
          <Sidebar
            activePage={activePage}
            onPageChange={setActivePage}
            onOpenHistory={openHistoryChat}
            onCollapse={() => setSidebarOpen(false)}
            history={history}
          />
        )}
      </div>

      {/* Main */}
      <main style={{
        flex: 1, background: '#f5f4ef', minHeight:'100vh',
        display: activePage === 'prompt-runner' ? 'flex' : 'block',
        flexDirection: 'column',
        position: 'relative',
        transition: 'margin-left 0.25s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Floating panel-open button when sidebar is closed */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            title="Open sidebar"
            style={{
              position: 'fixed', top: '14px', left: '12px', zIndex: 90,
              background: 'none', border: 'none', padding: '5px', borderRadius: '6px',
              color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
          </button>
        )}

        {activePage === 'prompt-runner'
          ? renderPage()
          : <div style={{ padding:'2.5rem 2.5rem 3rem', maxWidth:'1200px' }}>{renderPage()}</div>
        }
      </main>
    </div>
  );
}

export default App;
