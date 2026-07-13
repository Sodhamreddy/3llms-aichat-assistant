import { useEffect } from 'react';

/*
 * Excelliq landing page — exact copy of the triple-ai-muse.lovable.app design.
 * The page itself is served from /public/landing/ (self-contained HTML + JS + CSS
 * mirrored from the Lovable build) and embedded full-screen. Its CTA buttons
 * (Start Free / Book Demo / Contact sales) post a message back to this component,
 * which hands control to the onboarding flow via onGetStarted.
 *
 * The previous hand-built landing page is preserved in LandingPageOld.jsx.
 */
const LandingPage = ({ onGetStarted }) => {
  useEffect(() => {
    const onMessage = (e) => {
      if (e.data && e.data.type === 'excelliq-get-started') onGetStarted();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onGetStarted]);

  return (
    <iframe
      src="/landing/index.html"
      title="Excelliq — Three AI minds. One trusted answer."
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        border: 'none',
        display: 'block',
        background: '#fff',
      }}
    />
  );
};

export default LandingPage;
