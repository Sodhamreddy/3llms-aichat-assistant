import { useState, useEffect } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { useRef } from 'react';

/* ── Animation helpers ───────────────────────────────────────────────── */
const fadeUp   = (delay = 0) => ({ hidden: { opacity: 0, y: 32 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] } } });
const fadeIn   = (delay = 0) => ({ hidden: { opacity: 0 },        show: { opacity: 1, transition: { duration: 0.5, delay } } });
const stagger  = (staggerChildren = 0.1) => ({ hidden: {}, show: { transition: { staggerChildren } } });

const Section = ({ children, style = {} }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? 'show' : 'hidden'} style={style}>
      {children}
    </motion.div>
  );
};

/* ── Brand colours ───────────────────────────────────────────────────── */
const C = {
  bg:      '#f5f4f0',
  dark:    '#1a1814',
  accent:  '#d97757',
  blue:    '#2563eb',
  purple:  '#7c3aed',
  gpt:     '#10a37f',
  claude:  '#d97757',
  gemini:  '#4285f4',
  muted:   '#78716c',
  border:  'rgba(0,0,0,0.07)',
};

const MODELS = [
  { key: 'openai', name: 'ChatGPT',  sub: 'GPT-4.1 Mini',         color: C.gpt,    icon: '🤖', desc: 'Structured answers, code, and detailed breakdowns with pinpoint accuracy.' },
  { key: 'claude', name: 'Claude',   sub: 'Haiku 4.5',             color: C.claude, icon: '🟠', desc: 'Deep reasoning, nuanced writing, and final synthesis across all responses.' },
  { key: 'gemini', name: 'Gemini',   sub: '1.5 Flash',             color: C.gemini, icon: '🔵', desc: 'Lightning fast with real-time knowledge and creative lateral thinking.' },
];

const FEATURES = [
  { icon: '⚡', title: 'Parallel Responses',    desc: 'All three models answer simultaneously — no waiting in queue. Get results in seconds, not minutes.' },
  { icon: '🧠', title: 'Claude Synthesis',       desc: 'Claude reads every response and distills the strongest points into one definitive final answer.' },
  { icon: '🔍', title: 'Side-by-Side Compare',   desc: 'Toggle any model\'s raw response to see exactly what each AI said and why it differs.' },
  { icon: '📚', title: 'Full History',            desc: 'Every prompt, every answer, every follow-up — searchable and organised by date automatically.' },
  { icon: '🔑', title: 'Your Own API Keys',       desc: 'Bring your own keys. Responses come from your account — no middleman, no data sharing.' },
  { icon: '🌐', title: 'Browser Mode',            desc: 'No API keys at all? Use your logged-in browser sessions and get responses for free.' },
];

const STEPS = [
  { n: '01', title: 'Type your prompt',       desc: 'Ask anything — a question, a task, a creative brief. One prompt, sent to all models at once.' },
  { n: '02', title: 'Models race to answer',  desc: 'ChatGPT, Claude and Gemini each generate their own independent response in parallel.' },
  { n: '03', title: 'Get the best answer',    desc: 'Claude reads all three, removes duplicates and weak points, and delivers one polished result.' },
];

/* ── Animated hero mockup ────────────────────────────────────────────── */
const HeroMockup = () => {
  const cards = [
    { name: 'ChatGPT', color: C.gpt,    delay: 0.2, text: 'Fault tolerance is the primary advantage — when one node fails, others continue serving requests seamlessly.' },
    { name: 'Claude',  color: C.claude, delay: 0.45, text: 'Scalability and resilience are key. The CAP theorem explains the core availability vs. consistency trade-off.' },
    { name: 'Gemini',  color: C.gemini, delay: 0.7, text: 'Modern architectures prioritise eventual consistency. Real-world examples include Cassandra and DynamoDB.' },
  ];

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '860px', margin: '0 auto' }}>
      {/* Browser chrome */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{ background: 'white', borderRadius: '16px', boxShadow: '0 32px 100px rgba(0,0,0,0.14)', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)' }}
      >
        {/* Top bar */}
        <div style={{ background: '#f9f8f7', borderBottom: '1px solid #ede9e4', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {['#ff5f57','#febc2e','#28c840'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
          <div style={{ flex: 1, margin: '0 12px', background: '#ede9e4', borderRadius: '6px', padding: '3px 10px', fontSize: '0.68rem', color: '#9ca3af', textAlign: 'center' }}>kleza-excelliq-ai</div>
        </div>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#f5f4f0' }}>
          {/* Prompt bubble */}
          <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.55, duration: 0.4 }}
            style={{ alignSelf: 'flex-end', background: '#1c1c1c', color: '#f5f5f5', borderRadius: '14px 14px 4px 14px', padding: '9px 15px', fontSize: '0.78rem', maxWidth: '60%', lineHeight: 1.5 }}
          >
            What are the main advantages of distributed systems?
          </motion.div>

          {/* 3 model cards — side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {cards.map((card) => (
              <motion.div
                key={card.name}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: card.delay + 0.55, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                style={{ background: 'white', border: `1px solid ${card.color}28`, borderRadius: '10px', overflow: 'hidden' }}
              >
                <div style={{ padding: '6px 9px', background: card.color + '0e', borderBottom: `1px solid ${card.color}18`, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: card.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.63rem', fontWeight: 700, color: card.color }}>{card.name}</span>
                </div>
                <div style={{ padding: '9px', fontSize: '0.69rem', color: '#374151', lineHeight: 1.65 }}>{card.text}</div>
              </motion.div>
            ))}
          </div>

          {/* Synthesis card — full width */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ background: 'linear-gradient(135deg, #fff7f4, #fff)', border: `2px solid ${C.accent}35`, borderRadius: '10px' }}
          >
            <div style={{ padding: '7px 12px', borderBottom: `1px solid ${C.accent}18`, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.accent, flexShrink: 0 }} />
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: C.accent }}>Claude · Final Synthesis</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: '#9ca3af', fontWeight: 600 }}>✨ Best of all 3</span>
            </div>
            <div style={{ padding: '10px 12px', fontSize: '0.73rem', color: '#1c1c1c', lineHeight: 1.7, fontWeight: 500 }}>
              Distributed systems offer three core advantages: <strong>fault tolerance</strong> (node failures don't halt the system), <strong>horizontal scalability</strong> (add capacity by adding nodes), and <strong>geographic distribution</strong> for low-latency global access…
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Floating badges */}
      <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', top: -16, right: -10, background: 'white', border: '1px solid #ede9e4', borderRadius: '10px', padding: '6px 13px', boxShadow: '0 8px 24px rgba(0,0,0,0.09)', fontSize: '0.72rem', fontWeight: 700, color: '#1c1c1c', display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        <span>⚡</span> 3 models answered in 4.2s
      </motion.div>
      <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        style={{ position: 'absolute', bottom: 24, left: -16, background: 'white', border: '1px solid #ede9e4', borderRadius: '10px', padding: '6px 13px', boxShadow: '0 8px 24px rgba(0,0,0,0.09)', fontSize: '0.72rem', fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        <span>✓</span> Synthesis ready
      </motion.div>
    </div>
  );
};

/* ── Main component ──────────────────────────────────────────────────── */
const LandingPage = ({ onGetStarted }) => {
  const [scrollY, setScrollY] = useState(0);
  const [navSolid, setNavSolid] = useState(false);

  useEffect(() => {
    const fn = () => { setScrollY(window.scrollY); setNavSolid(window.scrollY > 40); };
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const navLinks = ['Features', 'How it works', 'Models'];

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', background: C.bg, color: C.dark, overflowX: 'hidden' }}>

      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <motion.nav
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          padding: '0 2.5rem',
          background: navSolid ? 'rgba(245,244,240,0.92)' : 'transparent',
          backdropFilter: navSolid ? 'blur(14px)' : 'none',
          borderBottom: navSolid ? '1px solid rgba(0,0,0,0.07)' : 'none',
          transition: 'background 0.3s, border 0.3s',
          height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <div style={{ width: 30, height: 30, borderRadius: '8px', background: 'linear-gradient(135deg, #7c3aed, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800, color: 'white' }}>K</div>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: C.dark, letterSpacing: '-0.02em' }}>Kleza Excelliq AI</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          {navLinks.map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(/ /g, '-')}`}
              style={{ fontSize: '0.85rem', color: C.muted, fontWeight: 500, textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => e.target.style.color = C.dark}
              onMouseLeave={e => e.target.style.color = C.muted}
            >{l}</a>
          ))}
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={onGetStarted}
            style={{ padding: '0.5rem 1.25rem', background: C.dark, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit' }}
          >Get Started →</motion.button>
        </div>
      </motion.nav>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', padding: '100px 2.5rem 80px', maxWidth: '1200px', margin: '0 auto', gap: '4rem' }}>
        <div style={{ flex: 1 }}>
          <motion.div variants={fadeIn(0.1)} initial="hidden" animate="show"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'white', border: '1px solid rgba(0,0,0,0.09)', borderRadius: '100px', padding: '5px 14px', fontSize: '0.75rem', fontWeight: 600, color: C.muted, marginBottom: '1.75rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10a37f', display: 'inline-block' }} />
            Powered by ChatGPT · Claude · Gemini
          </motion.div>

          <motion.h1 variants={fadeUp(0.15)} initial="hidden" animate="show"
            style={{ fontSize: 'clamp(2.6rem, 5vw, 4rem)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.04em', marginBottom: '1.25rem', color: C.dark }}
          >
            Three AI Minds.{' '}
            <span style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              One Perfect Answer.
            </span>
          </motion.h1>

          <motion.p variants={fadeUp(0.25)} initial="hidden" animate="show"
            style={{ fontSize: '1.05rem', color: C.muted, lineHeight: 1.75, maxWidth: '480px', marginBottom: '2rem' }}
          >
            Ask once. ChatGPT, Claude, and Gemini all respond simultaneously.
            Then Claude reads every answer and synthesizes the single best response — so you don't have to.
          </motion.p>

          <motion.div variants={fadeUp(0.35)} initial="hidden" animate="show" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <motion.button
              whileHover={{ scale: 1.03, boxShadow: '0 8px 30px rgba(217,119,87,0.35)' }}
              whileTap={{ scale: 0.97 }}
              onClick={onGetStarted}
              style={{ padding: '0.85rem 2rem', background: C.accent, color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'box-shadow 0.2s' }}
            >Start for free →</motion.button>
            <motion.a href="#how-it-works"
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              style={{ padding: '0.85rem 1.75rem', background: 'white', color: C.dark, border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
            >▶ See how it works</motion.a>
          </motion.div>

          {/* Social proof */}
          <motion.div variants={fadeIn(0.5)} initial="hidden" animate="show"
            style={{ marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.78rem', color: C.muted }}
          >
            <div style={{ display: 'flex' }}>
              {['#7c3aed','#2563eb','#10a37f','#d97757'].map((c,i) => (
                <div key={i} style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: '2px solid white', marginLeft: i ? -8 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', color: 'white', fontWeight: 700 }}>K</div>
              ))}
            </div>
            <span>Join teams using Kleza Excelliq AI for research & decisions</span>
          </motion.div>
        </div>

        {/* Hero visual */}
        <motion.div
          initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          style={{ flex: 1, display: 'flex', justifyContent: 'center' }}
        >
          <HeroMockup />
        </motion.div>
      </section>

      {/* ── Stats strip ────────────────────────────────────────────── */}
      <section style={{ padding: '0 2.5rem' }}>
        <Section style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <motion.div variants={stagger(0.1)}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', background: 'white', borderRadius: '20px', border: '1px solid rgba(0,0,0,0.07)', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.05)' }}
          >
            {[
              { val: '3',     label: 'AI models running in parallel',    icon: '⚡' },
              { val: '1',     label: 'Synthesized answer per prompt',     icon: '🧠' },
              { val: '<5s',   label: 'Average response time',             icon: '⏱' },
              { val: '100%',  label: 'Private — your keys, your data',    icon: '🔒' },
            ].map((s, i) => (
              <motion.div key={i} variants={fadeUp(i * 0.08)}
                style={{ padding: '2rem 1.5rem', textAlign: 'center', borderRight: i < 3 ? '1px solid rgba(0,0,0,0.06)' : 'none', position: 'relative' }}
              >
                <div style={{ fontSize: '1.1rem', marginBottom: '10px' }}>{s.icon}</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: C.accent, letterSpacing: '-0.04em', lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: '0.78rem', color: C.muted, marginTop: '8px', fontWeight: 500, lineHeight: 1.5 }}>{s.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </Section>
      </section>

      {/* ── How it works ───────────────────────────────────────────── */}
      <section id="how-it-works" style={{ padding: '100px 2.5rem', maxWidth: '1100px', margin: '0 auto' }}>
        <Section>
          <motion.div variants={fadeUp(0)} style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.accent, display: 'block', marginBottom: '12px' }}>How it works</span>
            <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', fontWeight: 800, letterSpacing: '-0.03em', color: C.dark }}>Simple as asking a question</h2>
          </motion.div>

          <motion.div variants={stagger(0.15)} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5px', background: 'rgba(0,0,0,0.06)', borderRadius: '20px', overflow: 'hidden' }}>
            {STEPS.map((step, i) => (
              <motion.div key={i} variants={fadeUp(i * 0.1)}
                whileHover={{ background: 'white', zIndex: 1 }}
                style={{ background: '#faf9f7', padding: '2.5rem 2rem', transition: 'background 0.2s', cursor: 'default', position: 'relative' }}
              >
                <div style={{ fontSize: '3rem', fontWeight: 900, color: C.accent, opacity: 0.35, letterSpacing: '-0.05em', lineHeight: 1, marginBottom: '1.25rem' }}>{step.n}</div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: C.dark, marginBottom: '0.6rem', letterSpacing: '-0.02em' }}>{step.title}</h3>
                <p style={{ fontSize: '0.875rem', color: C.muted, lineHeight: 1.75 }}>{step.desc}</p>
                {i < 2 && (
                  <div style={{ position: 'absolute', right: -12, top: '50%', transform: 'translateY(-50%)', zIndex: 2, fontSize: '1.2rem', color: 'rgba(0,0,0,0.2)' }}>→</div>
                )}
              </motion.div>
            ))}
          </motion.div>
        </Section>
      </section>

      {/* ── Features ───────────────────────────────────────────────── */}
      <section id="features" style={{ padding: '80px 2.5rem', background: 'white' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <Section>
            <motion.div variants={fadeUp(0)} style={{ textAlign: 'center', marginBottom: '4rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.blue, display: 'block', marginBottom: '12px' }}>Features</span>
              <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', fontWeight: 800, letterSpacing: '-0.03em', color: C.dark }}>Everything you need,<br/>nothing you don't</h2>
            </motion.div>

            <motion.div variants={stagger(0.08)} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              {FEATURES.map((f, i) => (
                <motion.div key={i} variants={fadeUp(i * 0.06)}
                  whileHover={{ y: -4, boxShadow: '0 16px 48px rgba(0,0,0,0.08)' }}
                  style={{ padding: '1.75rem', background: C.bg, borderRadius: '16px', border: '1px solid rgba(0,0,0,0.05)', transition: 'box-shadow 0.2s, transform 0.2s' }}
                >
                  <div style={{ fontSize: '1.6rem', marginBottom: '1rem' }}>{f.icon}</div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: C.dark, marginBottom: '0.5rem' }}>{f.title}</h3>
                  <p style={{ fontSize: '0.83rem', color: C.muted, lineHeight: 1.7 }}>{f.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </Section>
        </div>
      </section>

      {/* ── Models ─────────────────────────────────────────────────── */}
      <section id="models" style={{ padding: '100px 2.5rem', maxWidth: '1100px', margin: '0 auto' }}>
        <Section>
          <motion.div variants={fadeUp(0)} style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.purple, display: 'block', marginBottom: '12px' }}>The Models</span>
            <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', fontWeight: 800, letterSpacing: '-0.03em', color: C.dark }}>The world's best AI,<br/>working together</h2>
          </motion.div>

          <motion.div variants={stagger(0.12)} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
            {MODELS.map((m, i) => (
              <motion.div key={m.key} variants={fadeUp(i * 0.1)}
                whileHover={{ y: -6, boxShadow: `0 24px 60px ${m.color}20` }}
                style={{ background: 'white', border: `1.5px solid ${m.color}25`, borderRadius: '20px', padding: '2rem', transition: 'box-shadow 0.25s, transform 0.25s', position: 'relative', overflow: 'hidden' }}
              >
                <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: m.color + '08', borderRadius: '0 20px 0 80px' }} />
                <div style={{ width: 44, height: 44, borderRadius: '12px', background: m.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', marginBottom: '1.25rem' }}>{m.icon}</div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: m.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{m.sub}</div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: C.dark, marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>{m.name}</h3>
                <p style={{ fontSize: '0.85rem', color: C.muted, lineHeight: 1.7 }}>{m.desc}</p>
                <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600, color: m.color }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: m.color }} />
                  Always active
                </div>
              </motion.div>
            ))}
          </motion.div>
        </Section>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────── */}
      <section style={{ padding: '0 2.5rem 80px' }}>
        <Section style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <motion.div variants={fadeUp(0)}
            style={{ background: C.dark, borderRadius: '24px', padding: '5rem 3rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}
          >
            {/* Decorative blobs */}
            <div style={{ position: 'absolute', top: -60, left: -60, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.25), transparent 70%)' }} />
            <div style={{ position: 'absolute', bottom: -60, right: -60, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.25), transparent 70%)' }} />
            <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(217,119,87,0.12), transparent 70%)' }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              <motion.h2 variants={fadeUp(0.05)}
                style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)', fontWeight: 800, color: 'white', letterSpacing: '-0.04em', marginBottom: '1rem', lineHeight: 1.15 }}
              >
                Ready to think with<br />
                <span style={{ background: `linear-gradient(135deg, ${C.accent}, #f59e0b)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>three minds at once?</span>
              </motion.h2>
              <motion.p variants={fadeUp(0.1)}
                style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.55)', marginBottom: '2.5rem', maxWidth: '480px', margin: '0 auto 2.5rem', lineHeight: 1.7 }}
              >
                No subscription. No setup fee. Bring your API keys or use your browser logins — start getting better answers in under 2 minutes.
              </motion.p>
              <motion.button
                variants={fadeUp(0.15)}
                whileHover={{ scale: 1.04, boxShadow: '0 12px 40px rgba(217,119,87,0.45)' }}
                whileTap={{ scale: 0.97 }}
                onClick={onGetStarted}
                style={{ padding: '1rem 2.5rem', background: C.accent, color: 'white', border: 'none', borderRadius: '14px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'box-shadow 0.2s' }}
              >
                Get started — it's free →
              </motion.button>
            </div>
          </motion.div>
        </Section>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid rgba(0,0,0,0.07)', padding: '2rem 2.5rem', maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: 24, height: 24, borderRadius: '6px', background: 'linear-gradient(135deg, #7c3aed, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: 'white' }}>K</div>
          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: C.dark }}>Kleza Excelliq AI</span>
        </div>
        <div style={{ fontSize: '0.75rem', color: C.muted }}>© 2026 Kleza Solutions. All rights reserved.</div>
        <div style={{ display: 'flex', gap: '1.25rem' }}>
          {['Privacy', 'Terms', 'Support'].map(l => (
            <a key={l} href="#" style={{ fontSize: '0.78rem', color: C.muted, textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => e.target.style.color = C.dark}
              onMouseLeave={e => e.target.style.color = C.muted}
            >{l}</a>
          ))}
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
