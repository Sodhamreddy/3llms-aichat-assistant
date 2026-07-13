import { useState, useEffect, useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';

/* ── Motion helpers ──────────────────────────────────────────────────── */
const fadeUp  = (delay = 0) => ({ hidden: { opacity: 0, y: 34 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] } } });
const fadeIn  = (delay = 0) => ({ hidden: { opacity: 0 },        show: { opacity: 1, transition: { duration: 0.6, delay } } });
const stagger = (s = 0.1)   => ({ hidden: {}, show: { transition: { staggerChildren: s } } });

const Section = ({ children, style = {}, amount = '-80px' }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: amount });
  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? 'show' : 'hidden'} style={style}>
      {children}
    </motion.div>
  );
};

/* ── Two-colour brand system (from the Excelliq logo) ──────────────────── */
const PRIMARY   = '#1e63d6';   // brand blue
const SECONDARY = '#0a1f4d';   // deep navy
const C = {
  bg:      '#f5f8ff',
  surface: '#ffffff',
  ink:     SECONDARY,
  navy:    SECONDARY,
  accent:  PRIMARY,
  muted:   'rgba(10,31,77,0.58)',
  faint:   'rgba(10,31,77,0.42)',
  border:  'rgba(10,31,77,0.08)',
  gpt:     SECONDARY,
  claude:  PRIMARY,
  gemini:  SECONDARY,
};
const GRAD  = `linear-gradient(135deg, ${PRIMARY}, ${SECONDARY})`;
const SERIF = "'Lora', Georgia, 'Times New Roman', serif";
const SANS  = "Inter, system-ui, sans-serif";

/* ── Shared atoms ────────────────────────────────────────────────────── */
const Eyebrow = ({ children, center, light }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: center ? 'center' : 'flex-start', marginBottom: 18 }}>
    <span style={{ width: 26, height: 2, background: light ? '#7aa7ee' : PRIMARY, borderRadius: 2 }} />
    <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: light ? '#9fc1f5' : PRIMARY }}>{children}</span>
  </div>
);

const heading = (size) => ({ fontFamily: SERIF, fontWeight: 500, fontSize: size, lineHeight: 1.1, letterSpacing: '-0.01em', color: C.ink });

/* ── Monochrome line icons (brand blue / navy only) ───────────────────── */
const I = {
  sparkle: <path d="M12 2l2.1 6L20 10l-5.9 2L12 18l-2.1-6L4 10l5.9-2z" />,
  bolt:    <path d="M13 2 4 14h6l-1 8 9-12h-6z" />,
  search:  <><circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.5" y2="16.5" /></>,
  key:     <><circle cx="8" cy="15" r="4" /><path d="M10.8 12.2 20 3" /><path d="M16 7l3 3" /></>,
  book:    <><path d="M5 4h13v16H6a2 2 0 0 1-1-3.8" /><path d="M5 4a2 2 0 0 0-2 2v12" /></>,
  refresh: <><path d="M20 11a8 8 0 1 0-1.9 5.1" /><polyline points="20 4 20 11 13 11" /></>,
  flask:   <><path d="M9 3h6" /><path d="M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3" /><path d="M7.5 15h9" /></>,
  scale:   <><path d="M12 3v18" /><path d="M5 7h14" /><path d="M5 7l-3 6a3 3 0 0 0 6 0z" /><path d="M19 7l-3 6a3 3 0 0 0 6 0z" /></>,
  wrench:  <path d="M15 4a4 4 0 0 0-5.5 5.2L3 16v5h5l6.8-6.5A4 4 0 0 0 20 9l-3 3-2-2z" />,
  pen:     <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  lock:    <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  shield:  <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  folder:  <path d="M3 8a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
};
const Ico = ({ name, size = 24, color = PRIMARY, strokeWidth = 1.7 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {I[name] || I.sparkle}
  </svg>
);

const MODELS = [
  { key: 'openai', name: 'ChatGPT', sub: 'GPT-5.2', color: C.gpt,    role: 'The precise specialist', desc: 'Structured reasoning, clean code, and meticulous step-by-step breakdowns. ChatGPT brings rigour and accuracy to every prompt.', sample: 'Fault tolerance is the primary advantage — when one node fails, the others keep serving requests with zero downtime.' },
  { key: 'claude', name: 'Claude',  sub: 'Claude Opus 4.6',    color: C.claude, role: 'The synthesiser', desc: 'Deep reasoning and nuanced writing. Claude reads all three answers and composes the single, definitive final response.', sample: 'Distributed systems win on fault tolerance, horizontal scalability, and geographic distribution — here is how each compounds.' },
  { key: 'gemini', name: 'Gemini',  sub: 'Gemini 3.1 Pro',    color: C.gemini, role: 'The fast generalist', desc: 'Lightning-fast with broad, current knowledge and creative lateral thinking — perfect for fresh angles and real-world examples.', sample: 'Modern architectures favour eventual consistency. Cassandra and DynamoDB are the canonical production examples.' },
];

const FEATURES = [
  { icon: 'sparkle', title: 'Claude Synthesis', desc: 'The heart of Excelliq. Claude reads every model\'s answer and distils the strongest reasoning into one definitive, polished response — so you never compare tabs again.', big: true },
  { icon: 'bolt', title: 'Parallel API Calls', desc: 'Your prompt hits all three providers at once. No queue, results in seconds.' },
  { icon: 'search', title: 'Side-by-Side Compare', desc: 'Open any model\'s raw answer to see exactly where they agree — and where they differ.' },
  { icon: 'key', title: 'Your Own API Keys', desc: 'Add OpenAI, Anthropic, and Google keys once. Stored locally — never on our servers.' },
  { icon: 'book', title: 'Full History', desc: 'Every prompt, answer, and follow-up, organised by date and always searchable.' },
  { icon: 'refresh', title: 'Resilient Pipeline', desc: 'A resilient orchestration pipeline — reliable, scalable, enterprise-ready.' },
];

const STEPS = [
  { n: '1', title: 'Ask your question', desc: 'Type your prompt once. It\'s sent to ChatGPT, Claude, and Gemini in parallel — no extra tabs, no copy-paste.', code: '"Compare the strongest arguments on\nboth sides of this decision."' },
  { n: '2', title: 'Three models respond', desc: 'Each answers from its own perspective. One agrees, another pushes back, a third cites what the others missed.', code: 'GPT:    recommends approval\nClaude: flags the hidden risk\nGemini: cites the precedent' },
  { n: '3', title: 'Claude synthesises', desc: 'Claude reads all three answers, reconciles the disagreement, and writes one accountable final response.', code: '✓ One verified answer —\n  every model reconciled' },
];

const USE_CASES = [
  { icon: 'flask', title: 'Researchers', desc: 'Cross-check facts and surface conflicting evidence before you cite a single source.', tags: ['Literature review', 'Fact-checking'] },
  { icon: 'scale', title: 'Analysts', desc: 'Pressure-test a thesis from three angles, then read the one synthesis that reconciles them.', tags: ['Due diligence', 'Risk review'] },
  { icon: 'wrench', title: 'Engineers', desc: 'Compare three implementations, catch the edge case one model missed, ship the safe one.', tags: ['Code review', 'Architecture'] },
  { icon: 'pen', title: 'Writers & founders', desc: 'Three drafts, three voices — Claude blends the sharpest framing into one final piece.', tags: ['Drafting', 'Strategy'] },
];

const COUNCIL_MODES = [
  { name: 'Verify', q: 'Is this claim true?', consensus: '≥ 90%', flow: ['3 rounds', 'Extraction', 'Verdict'],
    roles: [{ m: 'ChatGPT', r: 'Lead Expert' }, { m: 'Gemini', r: 'Source Reviewer' }, { m: 'Claude', r: "Devil's Advocate" }] },
  { name: 'Discover', q: 'What are we missing here?', consensus: '≥ 80%', flow: ['4 rounds', 'Clustering', 'Shortlist'],
    roles: [{ m: 'ChatGPT', r: 'Ideator' }, { m: 'Gemini', r: 'Researcher' }, { m: 'Claude', r: 'Synthesiser' }] },
  { name: 'Strategise', q: 'Which path should we take?', consensus: '≥ 85%', flow: ['3 rounds', 'Trade-off map', 'Recommendation'],
    roles: [{ m: 'ChatGPT', r: 'Optimist' }, { m: 'Gemini', r: 'Analyst' }, { m: 'Claude', r: 'Risk Officer' }] },
  { name: 'Investigate', q: 'What really happened?', consensus: '≥ 90%', flow: ['4 rounds', 'Evidence review', 'Findings'],
    roles: [{ m: 'ChatGPT', r: 'Investigator' }, { m: 'Gemini', r: 'Fact Checker' }, { m: 'Claude', r: 'Skeptic' }] },
  { name: 'Decide', q: "What's the final call?", consensus: '≥ 95%', flow: ['3 rounds', 'Reconciliation', 'Verdict'],
    roles: [{ m: 'ChatGPT', r: 'Proposer' }, { m: 'Gemini', r: 'Challenger' }, { m: 'Claude', r: 'Judge' }] },
];
const ROLE_TINT = { ChatGPT: '#9fc1f5', Gemini: '#6ea4f5', Claude: '#bcd6ff' };

const COMPARE_ROWS = [
  { label: 'Answers from multiple models', single: false, tabs: true, excelliq: true },
  { label: 'One prompt, sent everywhere at once', single: false, tabs: false, excelliq: true },
  { label: 'Models read each other\'s answers', single: false, tabs: false, excelliq: true },
  { label: 'Disagreements surfaced, not hidden', single: false, tabs: false, excelliq: true },
  { label: 'One synthesised final answer', single: true, tabs: false, excelliq: true },
  { label: 'Searchable shared history', single: false, tabs: false, excelliq: true },
];

const FAQS = [
  { q: 'Do I need a subscription?', a: 'No subscription required — you bring your own OpenAI, Anthropic, and Google API keys and pay each provider directly for what you use.' },
  { q: 'Where are my API keys stored?', a: 'Locally, in your browser. Keys are sent straight to each provider and are never stored on our servers or visible to us.' },
  { q: 'Which models run?', a: 'ChatGPT, Claude, and Gemini run in parallel on every prompt. Claude then reads all three answers and composes the single synthesised response.' },
  { q: 'How long does an answer take?', a: 'All three models are called simultaneously, so a full synthesised answer typically arrives in around 10–12 seconds rather than three sequential waits.' },
  { q: 'Can I see each model\'s raw answer?', a: 'Yes. Every model\'s individual response is available side-by-side, so you can see exactly where they agree and where they differ.' },
  { q: 'Is my data private?', a: 'Your prompts go only to the providers you supply keys for. We don\'t train on, sell, or retain your conversations.' },
];

/* NOTE: replace with real customer quotes before publishing. */
const TESTIMONIALS = [
  { quote: 'I used to paste the same question into three tabs and reconcile the answers myself. Excelliq does it in one step — and the synthesis is sharper than any single model.', name: 'Research lead', role: 'Life-sciences team', initials: 'R' },
  { quote: 'For contract review I need to see where the models disagree. Excelliq surfaces the conflict instead of burying it under one confident answer.', name: 'Corporate analyst', role: 'Advisory firm', initials: 'A' },
  { quote: 'Three implementations, one reconciled recommendation. It caught an edge case a single model missed on my last architecture decision.', name: 'Staff engineer', role: 'SaaS platform', initials: 'E' },
];

const TRUST = [
  { icon: 'lock', title: 'Keys stay in your browser', desc: 'Your OpenAI, Anthropic, and Google keys are stored locally and never touch our servers.' },
  { icon: 'shield', title: 'Never trained on your data', desc: 'Your prompts and answers are never used for training, never sold, never retained by us.' },
  { icon: 'bolt', title: 'Sent direct to each provider', desc: 'Requests go straight to the model providers you choose — no detours, no shadow copies.' },
  { icon: 'folder', title: 'Your history, your device', desc: 'Every prompt and answer is organised and searchable, stored locally and under your control.' },
];

/* ── Responsive helper (inline styles can't use media queries) ────────── */
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

/* ── Hero product mock ───────────────────────────────────────────────── */
const HeroMockup = () => {
  const isMobile = useIsMobile();
  const cards = [
    { name: 'ChatGPT', color: C.gpt,    delay: 0.2,  text: 'Fault tolerance is the primary advantage — failures don\'t halt the system.' },
    { name: 'Claude',  color: C.claude, delay: 0.45, text: 'Scalability and resilience are key — the CAP theorem frames the trade-off.' },
    { name: 'Gemini',  color: C.gemini, delay: 0.7,  text: 'Modern stacks favour eventual consistency. Think Cassandra, DynamoDB.' },
  ];
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '860px', margin: '0 auto' }}>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{ background: 'white', borderRadius: '18px', boxShadow: '0 50px 120px rgba(10,31,77,0.24)', overflow: 'hidden', border: '1px solid rgba(10,31,77,0.07)' }}
      >
        <div style={{ background: '#f3f7ff', borderBottom: '1px solid #e3ecfb', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {['rgba(10,31,77,0.18)', 'rgba(10,31,77,0.13)', 'rgba(10,31,77,0.09)'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
          <div style={{ flex: 1, margin: '0 12px', background: '#e3ecfb', borderRadius: '6px', padding: '3px 10px', fontSize: '0.68rem', color: '#7286b0', textAlign: 'center', fontWeight: 600 }}>excelliq.ai</div>
        </div>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#f6f9ff' }}>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.55, duration: 0.4 }}
            style={{ alignSelf: 'flex-end', background: C.ink, color: '#eef4ff', borderRadius: '14px 14px 4px 14px', padding: '9px 15px', fontSize: '0.78rem', maxWidth: '62%', lineHeight: 1.5 }}>
            What are the main advantages of distributed systems?
          </motion.div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '10px' }}>
            {cards.map((card) => (
              <motion.div key={card.name} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: card.delay + 0.55, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                style={{ background: 'white', border: `1px solid ${card.color}28`, borderRadius: '11px', overflow: 'hidden' }}>
                <div style={{ padding: '6px 9px', background: card.color + '0e', borderBottom: `1px solid ${card.color}18`, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: card.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.63rem', fontWeight: 700, color: card.color }}>{card.name}</span>
                </div>
                <div style={{ padding: '9px', fontSize: '0.69rem', color: '#36507e', lineHeight: 1.65 }}>{card.text}</div>
              </motion.div>
            ))}
          </div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ background: 'linear-gradient(135deg, #eaf3ff, #ffffff)', border: `2px solid ${C.accent}40`, borderRadius: '11px' }}>
            <div style={{ padding: '7px 12px', borderBottom: `1px solid ${C.accent}1f`, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.accent, flexShrink: 0 }} />
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: C.accent }}>Excelliq · Final Synthesis</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: '#7286b0', fontWeight: 600 }}>Best of all 3</span>
            </div>
            <div style={{ padding: '10px 12px', fontSize: '0.73rem', color: C.ink, lineHeight: 1.7, fontWeight: 500 }}>
              Distributed systems offer three core advantages: <strong>fault tolerance</strong>, <strong>horizontal scalability</strong>, and <strong>geographic distribution</strong> for low-latency global access…
            </div>
          </motion.div>
        </div>
      </motion.div>
      <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', top: -16, right: -10, background: 'white', border: '1px solid #e3ecfb', borderRadius: '11px', padding: '6px 13px', boxShadow: '0 10px 30px rgba(10,31,77,0.12)', fontSize: '0.72rem', fontWeight: 700, color: C.ink, display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Ico name="bolt" size={13} color={PRIMARY} /> 3 models answered in 4.2s
      </motion.div>
      <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        style={{ position: 'absolute', bottom: 24, left: -16, background: 'white', border: '1px solid #e3ecfb', borderRadius: '11px', padding: '6px 13px', boxShadow: '0 10px 30px rgba(10,31,77,0.12)', fontSize: '0.72rem', fontWeight: 700, color: PRIMARY, display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span>✓</span> Synthesis ready
      </motion.div>
    </div>
  );
};

/* dotted-burst motif echoing the logo */
const DotBurst = ({ style }) => {
  const dots = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    const d = Math.hypot(r - 2, c - 2);
    dots.push({ x: c * 14, y: r * 14, s: Math.max(2, 6 - d), o: Math.max(0.08, 0.5 - d * 0.1) });
  }
  return (
    <div style={{ position: 'absolute', ...style }}>
      {dots.map((d, i) => <span key={i} style={{ position: 'absolute', left: d.x, top: d.y, width: d.s, height: d.s, borderRadius: '50%', background: PRIMARY, opacity: d.o }} />)}
    </div>
  );
};

/* ── Count-up number (animates when scrolled into view) ───────────────── */
const CountUp = ({ value }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const match = String(value).match(/^(\D*)([\d.]+)(\D*)$/);
  const prefix = match ? match[1] : '';
  const target = match ? parseFloat(match[2]) : 0;
  const suffix = match ? match[3] : '';
  const decimals = match && match[2].includes('.') ? match[2].split('.')[1].length : 0;
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let raf, start;
    const dur = 1400;
    const tick = (t) => {
      if (start === undefined) start = t;
      const p = Math.min((t - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target]);
  return <span ref={ref}>{match ? `${prefix}${n.toFixed(decimals)}${suffix}` : value}</span>;
};

/* ── FAQ accordion item ───────────────────────────────────────────────── */
const FaqItem = ({ q, a, open, onToggle }) => (
  <motion.div variants={fadeUp(0)} style={{ background: 'white', border: '1px solid rgba(10,31,77,0.08)', borderRadius: '16px', overflow: 'hidden', boxShadow: open ? '0 14px 40px rgba(10,31,77,0.08)' : '0 2px 10px rgba(10,31,77,0.03)', transition: 'box-shadow 0.25s' }}>
    <button onClick={onToggle}
      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '1.25rem 1.5rem', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: SERIF, fontWeight: 600, fontSize: '1.05rem', color: C.ink }}>
      {q}
      <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.25 }} style={{ flexShrink: 0, fontSize: '1.4rem', fontWeight: 300, color: PRIMARY, lineHeight: 1 }}>+</motion.span>
    </button>
    <motion.div initial={false} animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} style={{ overflow: 'hidden' }}>
      <p style={{ padding: '0 1.5rem 1.4rem', fontSize: '0.92rem', color: C.muted, lineHeight: 1.75, margin: 0 }}>{a}</p>
    </motion.div>
  </motion.div>
);

/* ── Brand logos (monochrome, inherit colour) ─────────────────────────── */
const OpenAILogo = ({ size = 30, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
    <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071.006l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071-.006l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zM8.305 12.863l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
  </svg>
);
const GeminiLogo = ({ size = 30, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
    <path d="M12 0C12 6.627 6.627 12 0 12C6.627 12 12 17.373 12 24C12 17.373 17.373 12 24 12C17.373 12 12 6.627 12 0Z" />
  </svg>
);
const ClaudeLogo = ({ size = 30, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
    <path d="M12 1.6l1.7 4.6 4.6 1.7-4.6 1.7L12 14.2l-1.7-4.6L5.7 7.9l4.6-1.7L12 1.6z" />
    <path d="M18.4 13.2l.9 2.5 2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9.9-2.5z" />
    <path d="M5.6 14.4l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9z" />
  </svg>
);

const MODEL_PICK = [
  { Logo: OpenAILogo, name: 'ChatGPT', model: 'GPT-5.2',        trait: 'Creative & versatile' },
  { Logo: GeminiLogo, name: 'Gemini',  model: 'Gemini 3.1 Pro', trait: 'Analytical & fast' },
  { Logo: ClaudeLogo, name: 'Claude',  model: 'Claude Opus 4.6', trait: 'Precise & reliable' },
];

/* ── Typewriter (types `text` while `active`) ─────────────────────────── */
const Typer = ({ text, active, speed = 16, style }) => {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) { setN(0); return; }
    let i = 0, t;
    const tick = () => { i++; setN(i); if (i < text.length) t = setTimeout(tick, speed); };
    t = setTimeout(tick, speed);
    return () => clearTimeout(t);
  }, [active, text, speed]);
  return <span style={style}>{text.slice(0, n)}</span>;
};

const Caret = () => (
  <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.6, repeat: Infinity, repeatType: 'reverse' }}
    style={{ display: 'inline-block', width: 2, height: '1em', background: PRIMARY, marginLeft: 1, verticalAlign: 'text-bottom', borderRadius: 2 }} />
);

const ThinkingDots = ({ color }) => (
  <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
    {[0, 1, 2].map(i => (
      <motion.span key={i} animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
    ))}
  </span>
);

/* ── Live, looping "ask → 3 answers → synthesis" demo ─────────────────── */
const PROMPT_TEXT = 'What are the main advantages of distributed systems?';
const DEMO_MODELS = [
  { name: 'ChatGPT', color: C.gpt,    Logo: OpenAILogo, text: 'Fault tolerance — when one node fails, the rest keep serving with zero downtime.' },
  { name: 'Gemini',  color: C.gemini, Logo: GeminiLogo, text: 'Horizontal scalability and low-latency reach across regions. Cassandra is the canonical case.' },
  { name: 'Claude',  color: C.claude, Logo: ClaudeLogo, text: 'The real trade-off is consistency vs availability — the CAP theorem frames every decision.' },
];
const SYNTH_TEXT = 'Distributed systems win on three fronts: fault tolerance, horizontal scalability, and geographic reach — balanced against the consistency trade-offs the CAP theorem makes explicit.';

const LiveChatDemo = () => {
  const ref = useRef(null);
  const isMobile = useIsMobile();
  const inView = useInView(ref, { amount: 0.3 });
  const [typed, setTyped] = useState('');
  const [phase, setPhase] = useState(0); // 0 typing · 1 thinking · 2 replies · 3 synthesis
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    const timers = [];
    const wait = (ms) => new Promise(res => timers.push(setTimeout(res, ms)));
    (async () => {
      while (!cancelled) {
        setPhase(0); setTyped('');
        await wait(700);
        for (let i = 1; i <= PROMPT_TEXT.length; i++) {
          if (cancelled) return;
          setTyped(PROMPT_TEXT.slice(0, i));
          await wait(34);
        }
        await wait(550); if (cancelled) return;
        setPhase(1); await wait(1300); if (cancelled) return;
        setPhase(2); await wait(3200); if (cancelled) return;
        setPhase(3); await wait(5200); if (cancelled) return;
        setRun(r => r + 1);
      }
    })();
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, [inView, run]);

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ background: 'white', borderRadius: '18px', boxShadow: '0 40px 100px rgba(10,31,77,0.20)', overflow: 'hidden', border: '1px solid rgba(10,31,77,0.07)' }}>
        {/* window chrome */}
        <div style={{ background: '#f3f7ff', borderBottom: '1px solid #e3ecfb', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {['rgba(10,31,77,0.18)', 'rgba(10,31,77,0.13)', 'rgba(10,31,77,0.09)'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
          <div style={{ flex: 1, margin: '0 12px', background: '#e3ecfb', borderRadius: '6px', padding: '3px 10px', fontSize: '0.68rem', color: '#7286b0', textAlign: 'center', fontWeight: 600 }}>excelliq.ai</div>
        </div>

        <div style={{ padding: '18px', background: '#f6f9ff' }}>
          {/* prompt input row */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'white', border: `1.5px solid ${PRIMARY}33`, borderRadius: 13, padding: '11px 14px', boxShadow: '0 4px 16px rgba(10,31,77,0.05)' }}>
            <span style={{ flex: 1, fontSize: '0.86rem', color: C.ink, lineHeight: 1.5 }}>
              {typed}{phase === 0 && <Caret />}
            </span>
            <div style={{ flexShrink: 0, padding: '7px 14px', borderRadius: 9, background: GRAD, color: 'white', fontSize: '0.76rem', fontWeight: 800 }}>Ask all 3 →</div>
          </div>

          {/* user bubble */}
          <AnimatePresence>
            {phase >= 1 && (
              <motion.div key="user" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}
                style={{ marginTop: 16, alignSelf: 'flex-end', marginLeft: 'auto', maxWidth: '70%', background: C.ink, color: '#eef4ff', borderRadius: '14px 14px 4px 14px', padding: '10px 15px', fontSize: '0.8rem', lineHeight: 1.55 }}>
                {PROMPT_TEXT}
              </motion.div>
            )}
          </AnimatePresence>

          {/* three model answers */}
          <AnimatePresence>
            {phase >= 2 && (
              <motion.div key="models" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10, marginTop: 16 }}>
                {DEMO_MODELS.map((m, i) => (
                  <motion.div key={m.name} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.45, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    style={{ background: 'white', border: `1px solid ${m.color}28`, borderRadius: 11, overflow: 'hidden' }}>
                    <div style={{ padding: '7px 9px', background: m.color + '0e', borderBottom: `1px solid ${m.color}18`, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <m.Logo size={13} color={m.color} />
                      <span style={{ fontSize: '0.63rem', fontWeight: 800, color: m.color }}>{m.name}</span>
                    </div>
                    <div style={{ padding: 9, fontSize: '0.68rem', color: '#36507e', lineHeight: 1.6, minHeight: 64 }}>
                      <Typer text={m.text} active={phase >= 2} speed={14} />
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* synthesis */}
          <AnimatePresence>
            {phase >= 3 && (
              <motion.div key="synth" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                style={{ marginTop: 12, background: 'linear-gradient(135deg, #eaf3ff, #ffffff)', border: `2px solid ${PRIMARY}40`, borderRadius: 11 }}>
                <div style={{ padding: '8px 12px', borderBottom: `1px solid ${PRIMARY}1f`, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Ico name="sparkle" size={14} color={PRIMARY} />
                  <span style={{ fontSize: '0.66rem', fontWeight: 800, color: PRIMARY }}>Excelliq · Final Synthesis</span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: '#7286b0', fontWeight: 700 }}>Best of all 3</span>
                </div>
                <div style={{ padding: '11px 13px', fontSize: '0.76rem', color: C.ink, lineHeight: 1.7, fontWeight: 500, minHeight: 72 }}>
                  <Typer text={SYNTH_TEXT} active={phase >= 3} speed={13} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* floating status chip */}
      <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', top: -14, right: -8, background: 'white', border: '1px solid #e3ecfb', borderRadius: 11, padding: '6px 13px', boxShadow: '0 10px 30px rgba(10,31,77,0.12)', fontSize: '0.72rem', fontWeight: 700, color: phase >= 3 ? PRIMARY : C.ink, display: 'flex', alignItems: 'center', gap: 7 }}>
        {phase === 0 && <>Typing your prompt…</>}
        {phase === 1 && <>Sending to 3 models <ThinkingDots color={PRIMARY} /></>}
        {phase === 2 && <>Models answering <ThinkingDots color={PRIMARY} /></>}
        {phase === 3 && <>✓ Synthesis ready</>}
      </motion.div>
    </div>
  );
};

/* ── Glass Brain / synthesis terminal ─────────────────────────────────── */
const ARCHITECT_LINES = [
  { tag: '[Reads]', text: 'ChatGPT, Claude & Gemini drafts — in parallel' },
  { tag: '[Finds]', text: 'Where they agree, where they conflict, what each missed' },
  { tag: '[Writes]', text: 'One reconciled answer — sharper than any single model' },
];
const ArchitectCard = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <div ref={ref} style={{ width: '100%', maxWidth: 720, margin: '0 auto', background: 'linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))', border: '1px solid rgba(159,193,245,0.22)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.35)' }}>
      <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(159,193,245,0.16)', display: 'flex', alignItems: 'center', gap: 9 }}>
        <Ico name="sparkle" size={15} color="#9fc1f5" />
        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#bcd6ff', fontFamily: 'ui-monospace, monospace' }}>Synthesis Engine → Claude</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#7e95c9', fontFamily: 'ui-monospace, monospace' }}>312ms</span>
      </div>
      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.84rem', lineHeight: 1.6 }}>
        {ARCHITECT_LINES.map((l, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ delay: 0.2 + i * 0.5, duration: 0.4 }}>
            <span style={{ color: '#6ea4f5', fontWeight: 800 }}>{l.tag}</span>{' '}
            <span style={{ color: '#d7e3fb' }}>{l.text}</span>
          </motion.div>
        ))}
      </div>
      <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(159,193,245,0.16)', display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ fontSize: '0.72rem', color: '#bcd6ff', fontWeight: 700 }}>Synthesis</span>
        <span style={{ fontSize: '0.66rem', color: '#9fc1f5', background: 'rgba(110,164,245,0.16)', borderRadius: 6, padding: '2px 8px', fontWeight: 800, letterSpacing: '0.04em' }}>FINAL</span>
        <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.4, repeat: Infinity }} style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: '#6ea4f5' }} />
      </div>
    </div>
  );
};

/* ── Cognitive Council (interactive mode tabs) ────────────────────────── */
const CognitiveCouncil = () => {
  const [active, setActive] = useState(0);
  const mode = COUNCIL_MODES[active];
  return (
    <section id="council" style={{ background: `linear-gradient(180deg, ${SECONDARY}, #07153a)`, padding: '120px 2.5rem', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: 760, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(30,99,214,0.2), transparent 70%)', pointerEvents: 'none' }} />
      <Section style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <motion.div variants={fadeUp(0)} style={{ textAlign: 'center', marginBottom: '2.8rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#9fc1f5', marginBottom: 16 }}>Cognitive Council</div>
          <h2 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 'clamp(2rem, 4vw, 3rem)', color: '#fff', lineHeight: 1.12 }}>
            Three models debate.<br /><span style={{ fontStyle: 'italic', background: 'linear-gradient(135deg, #6ea4f5, #bcd6ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>You get one verdict.</span>
          </h2>
          <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.6)', maxWidth: 540, margin: '1.1rem auto 0', lineHeight: 1.7 }}>
            Five structured debate modes where each model takes an assigned role and argues to consensus — then Claude reconciles it into one defensible answer.
          </p>
        </motion.div>

        {/* mode tabs */}
        <motion.div variants={fadeUp(0.05)} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: '2.2rem' }}>
          {COUNCIL_MODES.map((m, i) => (
            <button key={m.name} onClick={() => setActive(i)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 100, cursor: 'pointer', fontFamily: SANS, fontSize: '0.86rem', fontWeight: 700,
                border: `1px solid ${active === i ? 'rgba(110,164,245,0.6)' : 'rgba(159,193,245,0.18)'}`,
                background: active === i ? 'rgba(30,99,214,0.28)' : 'transparent',
                color: active === i ? '#fff' : 'rgba(255,255,255,0.55)', transition: 'all 0.2s' }}>
              <span style={{ opacity: 0.7 }}>{['①', '②', '③', '④', '⑤'][i]}</span>{m.name}
            </button>
          ))}
        </motion.div>

        {/* scenario card */}
        <AnimatePresence mode="wait">
          <motion.div key={active} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}
            style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(159,193,245,0.16)', borderRadius: 22, padding: '2rem 2.2rem', boxShadow: '0 30px 70px rgba(0,0,0,0.35)' }}>
            <h3 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: '1.4rem', color: '#fff', marginBottom: '1.4rem' }}>{mode.q}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: '1.6rem' }}>
              {mode.roles.map((role, j) => (
                <motion.div key={role.m} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: j * 0.08 }}
                  style={{ background: `${ROLE_TINT[role.m]}0e`, border: `1px solid ${ROLE_TINT[role.m]}33`, borderRadius: 14, padding: '1.1rem 1.2rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: ROLE_TINT[role.m], marginBottom: 5 }}>{role.m}</div>
                  <div style={{ fontSize: '1.02rem', fontWeight: 600, color: '#fff' }}>{role.r}</div>
                </motion.div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.3rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>Stops when:</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#bcd6ff', background: 'rgba(110,164,245,0.14)', borderRadius: 8, padding: '4px 12px' }}>Consensus {mode.consensus}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {mode.flow.map((f, k) => (
                <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#9fc1f5', background: 'rgba(30,99,214,0.18)', borderRadius: 8, padding: '5px 12px' }}>{f}</span>
                  {k < mode.flow.length - 1 && <span style={{ color: 'rgba(159,193,245,0.5)' }}>→</span>}
                </span>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </Section>
    </section>
  );
};

/* ── Page ────────────────────────────────────────────────────────────── */
const LandingPage = ({ onGetStarted }) => {
  const [openFaq, setOpenFaq] = useState(0);
  const [navSolid, setNavSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  useEffect(() => {
    const fn = () => setNavSolid(window.scrollY > 40);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const navLinks = ['Features', 'How it works', 'Models', 'Use cases', 'FAQ'];
  const primaryBtn = { padding: '0.9rem 2.1rem', background: GRAD, color: 'white', border: 'none', borderRadius: '13px', fontWeight: 700, fontSize: '0.96rem', cursor: 'pointer', fontFamily: SANS, boxShadow: '0 12px 30px rgba(30,99,214,0.28)' };

  return (
    <div style={{ fontFamily: SANS, background: C.bg, color: C.ink, overflowX: 'hidden' }}>

      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <motion.nav
        initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          background: (navSolid || menuOpen) ? 'rgba(245,248,255,0.92)' : 'transparent',
          backdropFilter: (navSolid || menuOpen) ? 'blur(16px)' : 'none',
          borderBottom: (navSolid || menuOpen) ? '1px solid rgba(10,31,77,0.07)' : '1px solid transparent',
          transition: 'background 0.3s, border 0.3s', height: isMobile ? '68px' : '116px',
        }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '0 1.15rem' : '0 2.5rem', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <img src="/logo.png" alt="Excelliq" style={{ height: isMobile ? 50 : 104, objectFit: 'contain' }} />
          {isMobile ? (
            <button onClick={() => setMenuOpen(o => !o)} aria-label="Menu"
              style={{ width: 42, height: 42, display: 'grid', placeItems: 'center', gap: 5, background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(10,31,77,0.1)', borderRadius: 11, cursor: 'pointer' }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{ display: 'block', width: 18, height: 2, borderRadius: 2, background: C.navy,
                  transform: menuOpen ? (i === 0 ? 'translateY(7px) rotate(45deg)' : i === 2 ? 'translateY(-7px) rotate(-45deg)' : 'scaleX(0)') : 'none',
                  opacity: menuOpen && i === 1 ? 0 : 1, transition: 'transform 0.25s, opacity 0.2s' }} />
              ))}
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
              {navLinks.map(l => (
                <a key={l} href={`#${l.toLowerCase().replace(/ /g, '-')}`}
                  style={{ fontSize: '0.85rem', color: C.muted, fontWeight: 600, textDecoration: 'none', transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.target.style.color = C.ink)} onMouseLeave={e => (e.target.style.color = C.muted)}>{l}</a>
              ))}
              <motion.button whileHover={{ scale: 1.03, boxShadow: '0 14px 34px rgba(30,99,214,0.3)' }} whileTap={{ scale: 0.97 }} onClick={onGetStarted}
                style={{ padding: '0.6rem 1.35rem', background: GRAD, color: 'white', border: 'none', borderRadius: '11px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: SANS, boxShadow: '0 8px 22px rgba(30,99,214,0.22)' }}>Get Started →</motion.button>
            </div>
          )}
        </div>

        {/* Mobile slide-down menu */}
        <AnimatePresence>
          {isMobile && menuOpen && (
            <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.22 }}
              style={{ background: 'rgba(245,248,255,0.98)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(10,31,77,0.08)', padding: '0.6rem 1.15rem 1.1rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {navLinks.map(l => (
                <a key={l} href={`#${l.toLowerCase().replace(/ /g, '-')}`} onClick={() => setMenuOpen(false)}
                  style={{ fontSize: '1rem', color: C.ink, fontWeight: 600, textDecoration: 'none', padding: '0.85rem 0.5rem', borderRadius: 10, borderBottom: '1px solid rgba(10,31,77,0.05)' }}>{l}</a>
              ))}
              <button onClick={() => { setMenuOpen(false); onGetStarted(); }}
                style={{ marginTop: '0.7rem', padding: '0.95rem', background: GRAD, color: 'white', border: 'none', borderRadius: 13, fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', fontFamily: SANS, boxShadow: '0 10px 26px rgba(30,99,214,0.28)' }}>Get Started →</button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ── 1 · Hero ─────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <div style={{ position: 'absolute', top: '-14%', right: '-8%', width: 640, height: 640, borderRadius: '50%', background: 'radial-gradient(circle, rgba(30,99,214,0.16), transparent 66%)' }} />
          <div style={{ position: 'absolute', bottom: '-20%', left: '-10%', width: 620, height: 620, borderRadius: '50%', background: 'radial-gradient(circle, rgba(18,40,107,0.10), transparent 68%)' }} />
          <DotBurst style={{ top: 130, left: 60 }} />
        </div>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', padding: isMobile ? '92px 1.15rem 56px' : '130px 2.5rem 80px', maxWidth: '1220px', margin: '0 auto', gap: isMobile ? '2.6rem' : '4rem', width: '100%', textAlign: isMobile ? 'center' : 'left' }}>
          <div style={{ flex: 1 }}>
            <motion.div variants={fadeIn(0.1)} initial="hidden" animate="show"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(8px)', border: '1px solid rgba(10,31,77,0.08)', borderRadius: '100px', padding: '6px 15px', fontSize: '0.75rem', fontWeight: 600, color: C.navy, marginBottom: '1.9rem', boxShadow: '0 4px 16px rgba(10,31,77,0.05)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: PRIMARY }} />
              Powered by ChatGPT · Claude · Gemini
            </motion.div>
            <motion.h1 variants={fadeUp(0.15)} initial="hidden" animate="show" style={{ ...heading('clamp(2.9rem, 5.4vw, 4.6rem)'), marginBottom: '1.5rem' }}>
              Three AI minds.<br />
              <span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontStyle: 'italic' }}>One perfect answer.</span>
            </motion.h1>
            <motion.p variants={fadeUp(0.25)} initial="hidden" animate="show" style={{ fontSize: isMobile ? '1rem' : '1.1rem', color: C.muted, lineHeight: 1.75, maxWidth: '500px', margin: isMobile ? '0 auto 2.1rem' : '0 0 2.3rem' }}>
              Ask once. ChatGPT, Claude, and Gemini respond simultaneously — then Claude reads every answer and synthesises the single best response, so you don't have to.
            </motion.p>
            <motion.div variants={fadeUp(0.35)} initial="hidden" animate="show" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start' }}>
              <motion.button whileHover={{ scale: 1.03, boxShadow: '0 16px 40px rgba(30,99,214,0.32)' }} whileTap={{ scale: 0.97 }} onClick={onGetStarted} style={primaryBtn}>Get Started →</motion.button>
              <motion.a href="#how-it-works" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                style={{ padding: '0.9rem 1.8rem', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)', color: C.navy, border: '1.5px solid rgba(10,31,77,0.1)', borderRadius: '13px', fontWeight: 600, fontSize: '0.96rem', cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>▶ See how it works</motion.a>
            </motion.div>
            <motion.div variants={fadeIn(0.5)} initial="hidden" animate="show" style={{ marginTop: '2.3rem', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.78rem', color: C.muted, justifyContent: isMobile ? 'center' : 'flex-start' }}>
              <div style={{ display: 'flex' }}>
                {[C.navy, C.accent, C.navy, C.accent].map((c, i) => (
                  <div key={i} style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: '2px solid white', marginLeft: i ? -9 : 0, display: 'grid', placeItems: 'center', fontSize: '0.55rem', color: 'white', fontWeight: 800 }}>K</div>
                ))}
              </div>
              <span>Trusted by teams using Excelliq for research &amp; decisions</span>
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }} style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <HeroMockup />
          </motion.div>
        </div>
      </section>

      {/* ── 2 · Stats band (DARK) ────────────────────────────────────── */}
      <section style={{ padding: '0 2.5rem 88px', position: 'relative', zIndex: 2, marginTop: '-2.5rem' }}>
        <Section style={{ maxWidth: '1140px', margin: '0 auto' }}>
          <motion.div variants={stagger(0.1)}
            style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', background: `linear-gradient(135deg, ${SECONDARY}, #12286b)`, borderRadius: '26px', overflow: 'hidden', boxShadow: '0 30px 80px rgba(10,31,77,0.28)', position: 'relative' }}>
            <div style={{ position: 'absolute', top: -80, right: -40, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(30,99,214,0.45), transparent 70%)' }} />
            {[
              { val: '3', label: 'AI models in parallel' },
              { val: '1', label: 'Synthesised answer' },
              { val: '~12s', label: 'Typical response time' },
              { val: '100%', label: 'Private — your keys' },
            ].map((s, i) => (
              <motion.div key={i} variants={fadeUp(i * 0.08)}
                style={{ padding: isMobile ? '1.9rem 1rem' : '2.6rem 1.6rem', textAlign: 'center', position: 'relative', zIndex: 1,
                  borderRight: isMobile ? (i % 2 === 0 ? '1px solid rgba(255,255,255,0.1)' : 'none') : (i < 3 ? '1px solid rgba(255,255,255,0.1)' : 'none'),
                  borderBottom: isMobile && i < 2 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
                <div style={{ ...heading(isMobile ? '2.1rem' : '2.8rem'), color: '#fff' }}><CountUp value={s.val} /></div>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.62)', marginTop: '10px', fontWeight: 500, lineHeight: 1.5 }}>{s.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </Section>
      </section>

      {/* ── 2b · Choose your model (DARK) ────────────────────────────── */}
      <section style={{ background: `linear-gradient(180deg, ${SECONDARY}, #07153a)`, padding: '120px 2.5rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(30,99,214,0.22), transparent 70%)', pointerEvents: 'none' }} />
        <Section style={{ maxWidth: '1080px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <motion.div variants={fadeUp(0)} style={{ textAlign: 'center', marginBottom: '3.2rem' }}>
            <h2 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 'clamp(2rem, 4vw, 3rem)', color: '#fff', lineHeight: 1.12, letterSpacing: '-0.01em' }}>
              Choose your model.<br /><span style={{ fontStyle: 'italic', background: 'linear-gradient(135deg, #6ea4f5, #bcd6ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Or use all three.</span>
            </h2>
            <p style={{ fontSize: '1.02rem', color: 'rgba(255,255,255,0.6)', maxWidth: 540, margin: '1.1rem auto 0', lineHeight: 1.7 }}>
              Send your prompt to one model — or fire all three at once. No extra tabs. No extra subscriptions.
            </p>
          </motion.div>
          <motion.div variants={stagger(0.1)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.1rem' }}>
            {MODEL_PICK.map((m, i) => (
              <motion.div key={m.name} variants={fadeUp(i * 0.06)}
                whileHover={{ y: -7, borderColor: 'rgba(110,164,245,0.55)', boxShadow: '0 30px 70px rgba(0,0,0,0.45)' }}
                style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(159,193,245,0.16)', borderRadius: 20, padding: '2rem 1.8rem', transition: 'border-color 0.2s, box-shadow 0.2s' }}>
                <div style={{ width: 56, height: 56, borderRadius: 15, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(159,193,245,0.14)', display: 'grid', placeItems: 'center', marginBottom: '1.4rem' }}>
                  <m.Logo size={30} color="#fff" />
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginBottom: 4 }}>{m.model}</div>
                <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', marginBottom: '1rem' }}>{m.trait}</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', fontWeight: 700, color: '#9fc1f5', background: 'rgba(110,164,245,0.1)', borderRadius: 100, padding: '4px 11px' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6ea4f5' }} /> {m.name} · ready
                </div>
              </motion.div>
            ))}
          </motion.div>
        </Section>
      </section>

      {/* ── 2c · Live demo (typing → answers → synthesis) ────────────── */}
      <section style={{ padding: '120px 2.5rem 100px' }}>
        <Section style={{ maxWidth: '1080px', margin: '0 auto' }}>
          <motion.div variants={fadeUp(0)} style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}><Eyebrow center>Live demo</Eyebrow></div>
            <h2 style={heading('clamp(2rem, 3.6vw, 2.9rem)')}>Watch three minds<br />answer in real time</h2>
            <p style={{ fontSize: '1.02rem', color: C.muted, maxWidth: 520, margin: '1.1rem auto 0', lineHeight: 1.7 }}>
              You type once. ChatGPT, Claude, and Gemini respond together — then Claude synthesises the final answer in front of you.
            </p>
          </motion.div>
          <motion.div variants={fadeUp(0.1)}>
            <LiveChatDemo />
          </motion.div>
        </Section>
      </section>

      {/* ── 3 · How it works (PREMIUM CARDS) ─────────────────────────── */}
      <section id="how-it-works" style={{ padding: '20px 2.5rem 100px' }}>
        <div style={{ maxWidth: '1140px', margin: '0 auto' }}>
          <Section>
            <motion.div variants={fadeUp(0)} style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}><Eyebrow center>How it works</Eyebrow></div>
              <h2 style={heading('clamp(2rem, 3.6vw, 2.9rem)')}>From question to<br />accountable answer</h2>
            </motion.div>
            <motion.div variants={stagger(0.12)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.2rem', alignItems: 'stretch' }}>
              {STEPS.map((step, i) => (
                <motion.div key={i} variants={fadeUp(i * 0.06)} whileHover={{ y: -5, boxShadow: '0 26px 60px rgba(10,31,77,0.13)' }}
                  style={{ position: 'relative', background: 'white', border: '1px solid rgba(10,31,77,0.07)', borderRadius: 22, padding: '2rem 1.8rem', boxShadow: '0 2px 10px rgba(10,31,77,0.04)', transition: 'box-shadow 0.2s, transform 0.2s', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: GRAD, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '1.05rem', marginBottom: '1.3rem', boxShadow: '0 10px 24px rgba(30,99,214,0.3)' }}>{step.n}</div>
                  <h3 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: '1.3rem', color: C.ink, marginBottom: '0.6rem' }}>{step.title}</h3>
                  <p style={{ fontSize: '0.92rem', color: C.muted, lineHeight: 1.7, marginBottom: '1.4rem', flex: 1 }}>{step.desc}</p>
                  <pre style={{ margin: 0, background: '#f3f7ff', border: '1px solid rgba(10,31,77,0.06)', borderRadius: 12, padding: '0.9rem 1rem', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.74rem', color: '#46608c', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{step.code}</pre>
                </motion.div>
              ))}
            </motion.div>
          </Section>
        </div>
      </section>

      {/* ── 3b · Glass Brain / Synthesis Engine (DARK) ───────────────── */}
      <section style={{ background: `linear-gradient(180deg, #07153a, ${SECONDARY})`, padding: '120px 2.5rem', position: 'relative', overflow: 'hidden' }}>
        <DotBurst style={{ top: 70, right: 90, opacity: 0.5 }} />
        <Section style={{ maxWidth: '820px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <motion.div variants={fadeUp(0)} style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              style={{ width: 96, height: 96, margin: '0 auto 1.8rem', borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'radial-gradient(circle, rgba(30,99,214,0.4), rgba(30,99,214,0.05) 70%)', border: '1px solid rgba(110,164,245,0.3)' }}>
              <Ico name="sparkle" size={36} color="#9fc1f5" strokeWidth={1.4} />
            </motion.div>
            <h2 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 'clamp(2rem, 4vw, 3rem)', color: '#fff', lineHeight: 1.12 }}>The Synthesis Engine</h2>
            <p style={{ fontSize: '1.04rem', color: 'rgba(255,255,255,0.6)', maxWidth: 480, margin: '1rem auto 0', lineHeight: 1.7 }}>
              You ask once. Claude reads every model's answer — and makes the final one sharper.
            </p>
          </motion.div>
          <motion.div variants={fadeUp(0.1)}>
            <ArchitectCard />
          </motion.div>
        </Section>
      </section>

      {/* ── 5 · Features (BENTO) ─────────────────────────────────────── */}
      <section id="features" style={{ padding: '110px 2.5rem' }}>
        <div style={{ maxWidth: '1140px', margin: '0 auto' }}>
          <Section>
            <motion.div variants={fadeUp(0)} style={{ marginBottom: '3.5rem', maxWidth: 620 }}>
              <Eyebrow>Why Excelliq</Eyebrow>
              <h2 style={heading('clamp(2rem, 3.6vw, 2.9rem)')}>Everything you need,<br />nothing you don't</h2>
            </motion.div>
            <motion.div variants={stagger(0.07)} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(6, 1fr)', gridAutoRows: isMobile ? 'auto' : '1fr', gap: '1rem' }}>
              {FEATURES.map((f, i) => {
                const span = isMobile ? {} : f.big ? { gridColumn: 'span 3', gridRow: 'span 2' } : i < 3 ? { gridColumn: 'span 3' } : { gridColumn: 'span 2' };
                return (
                  <motion.div key={i} variants={fadeUp((i % 3) * 0.05)} whileHover={{ y: -5, boxShadow: '0 26px 60px rgba(10,31,77,0.13)' }}
                    style={{ ...span, padding: f.big ? '2.4rem' : '1.8rem', background: f.big ? GRAD : 'white', color: f.big ? '#fff' : C.ink, borderRadius: '20px', border: f.big ? 'none' : '1px solid rgba(10,31,77,0.07)', transition: 'box-shadow 0.2s, transform 0.2s', display: 'flex', flexDirection: 'column', justifyContent: f.big ? 'space-between' : 'flex-start', boxShadow: f.big ? '0 24px 60px rgba(30,99,214,0.32)' : '0 2px 10px rgba(10,31,77,0.04)' }}>
                    <div style={{ width: 50, height: 50, borderRadius: '14px', background: f.big ? 'rgba(255,255,255,0.16)' : 'linear-gradient(135deg,#eaf3ff,#dcebff)', display: 'grid', placeItems: 'center', marginBottom: f.big ? '2rem' : '1.1rem' }}><Ico name={f.icon} size={26} color={f.big ? '#fff' : PRIMARY} /></div>
                    <div>
                      <h3 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: f.big ? '1.5rem' : '1.02rem', marginBottom: '0.55rem', color: f.big ? '#fff' : C.ink }}>{f.title}</h3>
                      <p style={{ fontSize: f.big ? '0.96rem' : '0.83rem', color: f.big ? 'rgba(255,255,255,0.8)' : C.muted, lineHeight: 1.7 }}>{f.desc}</p>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </Section>
        </div>
      </section>

      {/* ── 6 · Models (ALTERNATING ROWS) ────────────────────────────── */}
      <section id="models" style={{ background: 'linear-gradient(180deg, #f5f8ff, #eef4ff)', padding: '110px 2.5rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <Section>
            <motion.div variants={fadeUp(0)} style={{ textAlign: 'center', marginBottom: '4.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}><Eyebrow center>The Models</Eyebrow></div>
              <h2 style={heading('clamp(2rem, 3.6vw, 2.9rem)')}>The world's best AI,<br />working together</h2>
            </motion.div>
          </Section>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5rem' }}>
            {MODELS.map((m, i) => (
              <Section key={m.key}>
                <motion.div variants={stagger(0.12)} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '1.8rem' : '4rem', flexDirection: isMobile ? 'column' : (i % 2 ? 'row-reverse' : 'row') }}>
                  <motion.div variants={fadeUp(0)} style={{ flex: 1 }}>
                    <div style={{ fontFamily: SERIF, fontSize: '4rem', fontWeight: 600, lineHeight: 1, color: m.color, opacity: 0.18, marginBottom: '0.5rem' }}>0{i + 1}</div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: m.color, marginBottom: '0.5rem' }}>{m.sub} · {m.role}</div>
                    <h3 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: '2rem', color: C.ink, marginBottom: '0.9rem' }}>{m.name}</h3>
                    <p style={{ fontSize: '0.98rem', color: C.muted, lineHeight: 1.8, maxWidth: 440 }}>{m.desc}</p>
                  </motion.div>
                  <motion.div variants={fadeUp(0.12)} style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                    <div style={{ width: '100%', maxWidth: 420, background: 'white', border: `1px solid ${m.color}22`, borderRadius: '20px', boxShadow: '0 24px 60px rgba(10,31,77,0.12)', overflow: 'hidden' }}>
                      <div style={{ padding: '13px 18px', borderBottom: `1px solid ${m.color}18`, background: `${m.color}07`, display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: m.color }} />
                        <strong style={{ color: m.color, fontSize: '0.88rem' }}>{m.name}</strong>
                        <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: C.faint, fontWeight: 700 }}>● Always active</span>
                      </div>
                      <div style={{ padding: '18px 20px', fontSize: '0.92rem', color: '#3a4a6b', lineHeight: 1.75 }}>{m.sample}</div>
                    </div>
                  </motion.div>
                </motion.div>
              </Section>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7 · Use cases ────────────────────────────────────────────── */}
      <section id="use-cases" style={{ padding: '110px 2.5rem' }}>
        <div style={{ maxWidth: '1140px', margin: '0 auto' }}>
          <Section>
            <motion.div variants={fadeUp(0)} style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}><Eyebrow center>Use cases</Eyebrow></div>
              <h2 style={heading('clamp(2rem, 3.6vw, 2.9rem)')}>Built for<br />high-stakes thinking</h2>
            </motion.div>
            <motion.div variants={stagger(0.08)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              {USE_CASES.map((u, i) => (
                <motion.div key={i} variants={fadeUp((i % 4) * 0.05)} whileHover={{ y: -6, boxShadow: '0 26px 60px rgba(10,31,77,0.13)' }}
                  style={{ padding: '2rem 1.7rem', background: 'white', borderRadius: '20px', border: '1px solid rgba(10,31,77,0.07)', boxShadow: '0 2px 10px rgba(10,31,77,0.04)', transition: 'box-shadow 0.2s, transform 0.2s' }}>
                  <div style={{ width: 50, height: 50, borderRadius: '14px', background: 'linear-gradient(135deg,#eaf3ff,#dcebff)', display: 'grid', placeItems: 'center', marginBottom: '1.1rem' }}><Ico name={u.icon} size={24} color={PRIMARY} /></div>
                  <h3 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: '1.2rem', color: C.ink, marginBottom: '0.5rem' }}>{u.title}</h3>
                  <p style={{ fontSize: '0.86rem', color: C.muted, lineHeight: 1.7, marginBottom: '1.1rem' }}>{u.desc}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {u.tags.map(t => (
                      <span key={t} style={{ fontSize: '0.68rem', fontWeight: 700, color: PRIMARY, background: 'rgba(30,99,214,0.08)', borderRadius: '100px', padding: '4px 10px' }}>{t}</span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </Section>
        </div>
      </section>

      {/* ── 8 · Cognitive Council (interactive) ──────────────────────── */}
      <CognitiveCouncil />

      {/* ── 9 · Comparison table ─────────────────────────────────────── */}
      <section style={{ padding: '110px 2.5rem' }}>
        <Section style={{ maxWidth: '960px', margin: '0 auto' }}>
          <motion.div variants={fadeUp(0)} style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}><Eyebrow center>The difference</Eyebrow></div>
            <h2 style={heading('clamp(2rem, 3.6vw, 2.9rem)')}>Why not just open<br />three tabs?</h2>
          </motion.div>
          <motion.div variants={fadeUp(0.1)} style={{ background: 'white', borderRadius: '22px', border: '1px solid rgba(10,31,77,0.07)', overflowX: isMobile ? 'auto' : 'hidden', overflowY: 'hidden', boxShadow: '0 20px 56px rgba(10,31,77,0.09)', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', minWidth: isMobile ? 480 : 'auto', alignItems: 'center', padding: '1.1rem 1.4rem', background: `linear-gradient(135deg, ${SECONDARY}, #12286b)` }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>Capability</div>
              {['One model', 'Three tabs', 'Excelliq'].map((h, i) => (
                <div key={h} style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 800, color: i === 2 ? '#bcd6ff' : 'rgba(255,255,255,0.78)' }}>{h}</div>
              ))}
            </div>
            <motion.div variants={stagger(0.07)}>
              {COMPARE_ROWS.map((row, i) => (
                <motion.div key={i} variants={fadeUp(0)}
                  style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', minWidth: isMobile ? 480 : 'auto', alignItems: 'center', padding: '1rem 1.4rem', borderTop: '1px solid rgba(10,31,77,0.05)', background: i % 2 ? 'rgba(245,248,255,0.6)' : 'white' }}>
                  <div style={{ fontSize: '0.88rem', color: C.ink, fontWeight: 500 }}>{row.label}</div>
                  {['single', 'tabs', 'excelliq'].map((col) => (
                    <div key={col} style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 800, color: row[col] ? (col === 'excelliq' ? PRIMARY : '#7aa7ee') : 'rgba(10,31,77,0.22)' }}>
                      {row[col] ? '✓' : '—'}
                    </div>
                  ))}
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </Section>
      </section>

      {/* ── 9b · Testimonials (social proof) ─────────────────────────── */}
      <section style={{ padding: '110px 2.5rem' }}>
        <div style={{ maxWidth: '1140px', margin: '0 auto' }}>
          <Section>
            <motion.div variants={fadeUp(0)} style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}><Eyebrow center>Why people switch</Eyebrow></div>
              <h2 style={heading('clamp(2rem, 3.6vw, 2.9rem)')}>Built for people who<br />can't afford to be wrong</h2>
            </motion.div>
            <motion.div variants={stagger(0.1)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.2rem' }}>
              {TESTIMONIALS.map((t, i) => (
                <motion.div key={i} variants={fadeUp(i * 0.06)} whileHover={{ y: -5, boxShadow: '0 26px 60px rgba(10,31,77,0.13)' }}
                  style={{ background: 'white', border: '1px solid rgba(10,31,77,0.07)', borderRadius: 20, padding: '2rem 1.9rem', boxShadow: '0 2px 10px rgba(10,31,77,0.04)', transition: 'box-shadow 0.2s, transform 0.2s', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '2.4rem', lineHeight: 1, color: PRIMARY, opacity: 0.25, fontFamily: SERIF, marginBottom: '0.4rem' }}>“</div>
                  <p style={{ fontSize: '0.98rem', color: C.ink, lineHeight: 1.75, marginBottom: '1.6rem', flex: 1 }}>{t.quote}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: GRAD, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.95rem', flexShrink: 0 }}>{t.initials}</div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.ink }}>{t.name}</div>
                      <div style={{ fontSize: '0.8rem', color: C.muted }}>{t.role}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </Section>
        </div>
      </section>

      {/* ── 9c · Security & privacy ──────────────────────────────────── */}
      <section id="security" style={{ background: 'linear-gradient(135deg, #eef4ff, #f5f8ff)', padding: '110px 2.5rem' }}>
        <Section style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <motion.div variants={fadeUp(0)} style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}><Eyebrow center>Security &amp; privacy</Eyebrow></div>
            <h2 style={heading('clamp(2rem, 3.6vw, 2.9rem)')}>Your data stays yours</h2>
            <p style={{ fontSize: '1.02rem', color: C.muted, maxWidth: 540, margin: '1.1rem auto 0', lineHeight: 1.7 }}>
              Excelliq is built so your keys, prompts, and answers never leave your control.
            </p>
          </motion.div>
          <motion.div variants={stagger(0.08)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {TRUST.map((t, i) => (
              <motion.div key={i} variants={fadeUp((i % 4) * 0.05)} whileHover={{ y: -5, boxShadow: '0 22px 50px rgba(10,31,77,0.12)' }}
                style={{ background: 'white', border: '1px solid rgba(10,31,77,0.07)', borderRadius: 18, padding: '1.8rem 1.6rem', boxShadow: '0 2px 10px rgba(10,31,77,0.04)', transition: 'box-shadow 0.2s, transform 0.2s' }}>
                <div style={{ width: 48, height: 48, borderRadius: 13, background: 'linear-gradient(135deg,#eaf3ff,#dcebff)', display: 'grid', placeItems: 'center', marginBottom: '1.1rem' }}><Ico name={t.icon} size={23} color={PRIMARY} /></div>
                <h3 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: '1.08rem', color: C.ink, marginBottom: '0.5rem' }}>{t.title}</h3>
                <p style={{ fontSize: '0.85rem', color: C.muted, lineHeight: 1.7 }}>{t.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </Section>
      </section>

      {/* ── 10 · FAQ ─────────────────────────────────────────────────── */}
      <section id="faq" style={{ background: 'linear-gradient(180deg, #f5f8ff, #eef4ff)', padding: '110px 2.5rem' }}>
        <Section style={{ maxWidth: '760px', margin: '0 auto' }}>
          <motion.div variants={fadeUp(0)} style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}><Eyebrow center>FAQ</Eyebrow></div>
            <h2 style={heading('clamp(2rem, 3.6vw, 2.9rem)')}>Frequently asked<br />questions</h2>
          </motion.div>
          <motion.div variants={stagger(0.06)} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {FAQS.map((f, i) => (
              <FaqItem key={i} q={f.q} a={f.a} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? -1 : i)} />
            ))}
          </motion.div>
        </Section>
      </section>

      {/* ── 11 · CTA (DARK) ──────────────────────────────────────────── */}
      <section style={{ padding: '0 2.5rem 100px' }}>
        <Section style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <motion.div variants={fadeUp(0)} style={{ background: `linear-gradient(135deg, ${SECONDARY}, #12286b)`, borderRadius: isMobile ? '24px' : '30px', padding: isMobile ? '3.4rem 1.4rem' : '6rem 3rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -80, left: -60, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(30,99,214,0.45), transparent 70%)' }} />
            <div style={{ position: 'absolute', bottom: -80, right: -60, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(30,99,214,0.32), transparent 70%)' }} />
            <DotBurst style={{ top: 40, right: 60 }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <motion.h2 variants={fadeUp(0.05)} style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 'clamp(2rem, 4.2vw, 3.3rem)', color: '#fff', lineHeight: 1.12, marginBottom: '1.1rem' }}>
                Ready to think with<br /><span style={{ fontStyle: 'italic', background: 'linear-gradient(135deg, #6ea4f5, #bcd6ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>three minds at once?</span>
              </motion.h2>
              <motion.p variants={fadeUp(0.1)} style={{ fontSize: '1.04rem', color: 'rgba(255,255,255,0.66)', maxWidth: '500px', margin: '0 auto 2.6rem', lineHeight: 1.7 }}>
                No subscription. No setup fee. Bring your API keys and start getting better answers in under two minutes.
              </motion.p>
              <motion.button variants={fadeUp(0.15)} whileHover={{ scale: 1.04, boxShadow: '0 18px 50px rgba(30,99,214,0.55)' }} whileTap={{ scale: 0.97 }} onClick={onGetStarted}
                style={{ padding: '1.05rem 2.6rem', background: 'white', color: SECONDARY, border: 'none', borderRadius: '15px', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', fontFamily: SANS, boxShadow: '0 14px 44px rgba(30,99,214,0.4)' }}>Get Started →</motion.button>
            </div>
          </motion.div>
        </Section>
      </section>

      {/* ── 8 · Footer ───────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid rgba(10,31,77,0.07)', background: 'white' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '3.5rem 2.5rem 2rem', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.6fr 1fr 1fr', gap: isMobile ? '1.8rem' : '2rem' }}>
          <div>
            <img src="/logo.png" alt="Excelliq" style={{ height: 68, objectFit: 'contain', marginBottom: '1rem' }} />
            <p style={{ fontSize: '0.85rem', color: C.muted, lineHeight: 1.7, maxWidth: 320 }}>
              Three AI minds, one perfect answer. ChatGPT, Claude, and Gemini — synthesised by Claude into one final response.
            </p>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.navy, marginBottom: '1rem' }}>Product</div>
            {['Features', 'How it works', 'Models'].map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(/ /g, '-')}`} style={{ display: 'block', fontSize: '0.85rem', color: C.muted, textDecoration: 'none', marginBottom: '0.6rem' }}
                onMouseEnter={e => (e.target.style.color = PRIMARY)} onMouseLeave={e => (e.target.style.color = C.muted)}>{l}</a>
            ))}
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.navy, marginBottom: '1rem' }}>Company</div>
            {['Privacy', 'Terms', 'Support'].map(l => (
              <a key={l} href="#" style={{ display: 'block', fontSize: '0.85rem', color: C.muted, textDecoration: 'none', marginBottom: '0.6rem' }}
                onMouseEnter={e => (e.target.style.color = PRIMARY)} onMouseLeave={e => (e.target.style.color = C.muted)}>{l}</a>
            ))}
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(10,31,77,0.06)', padding: '1.25rem 2.5rem', maxWidth: '1100px', margin: '0 auto', fontSize: '0.75rem', color: C.faint }}>
          © 2026 Kleza Solutions. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
