import PromptControl from '../components/PromptControl';

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const PromptRunnerPage = ({ onRunComplete }) => (
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

    <PromptControl onRunComplete={onRunComplete} />
  </div>
);

export default PromptRunnerPage;
