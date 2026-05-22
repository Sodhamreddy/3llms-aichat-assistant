import PromptControl from '../components/PromptControl';

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const PromptRunnerPage = ({ onRunComplete, onFollowUpComplete }) => (
  <div style={{
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    minHeight: '100vh',
    padding: '2rem 2rem 160px',
    background: '#f5f4f0',
    width: '100%',
  }}>
    {/* Greeting */}
    <p style={{
      fontSize: '0.875rem', color: '#a8a29e', fontWeight: '400',
      letterSpacing: '-0.01em', marginBottom: '10px', textAlign: 'center',
    }}>
      {getGreeting()}, Sodham
    </p>

    {/* Arena-style serif heading */}
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
      What would you like to do?
    </h1>

    <PromptControl onRunComplete={onRunComplete} onFollowUpComplete={onFollowUpComplete} />
  </div>
);

export default PromptRunnerPage;
