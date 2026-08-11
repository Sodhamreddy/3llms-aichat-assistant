import { useState, useEffect, useId, useRef } from 'react';
import { motion } from 'framer-motion';

/*
 * Excelliq landing page — editable React implementation.
 * Replaces the previous prebuilt iframe bundle (public/landing/*). All copy,
 * colors, and sections live here and can be edited directly.
 * CTA buttons call onGetStarted to hand control to the onboarding flow.
 * The previous hand-built landing is preserved in LandingPageOld.jsx.
 */

// ── Brand tokens ──────────────────────────────────────────────────────────
const INK   = '#0f1f4b';   // dark navy headings
const BLUE  = '#0d46d8';   // primary brand blue
const BLUE2 = '#1b67e8';   // lighter blue stop
const MUTED = '#5a6b8c';   // body text
const SOFT  = '#f5f7fb';   // soft section background
const LINE  = '#e6ebf3';   // hairline borders
const SERIF = "'Lora', Georgia, serif";
const SANS  = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
const BRAND_GRAD = `linear-gradient(135deg, ${BLUE} 0%, ${BLUE2} 100%)`;
const MAXW = 1160;         // shared container width — every section lines up on this
const WIDE = 1400;         // header + footer span wider than the content sections
const HERO_MAXW = 1290;    // hero sits between the two

// ── Content (edit freely) ──────────────────────────────────────────────────
const MODELS = [
  { key: 'openai', name: 'ChatGPT', vendor: 'OpenAI · GPT-4o',    color: '#000000', strength: 'Broad reasoning', desc: 'Strong at broad reasoning, code generation, and long-form drafting.' },
  { key: 'gemini', name: 'Gemini',  vendor: 'Google · 1.5 Pro',   color: '#4285F4', strength: 'Long context',    desc: 'Long-context strength, adding depth to every consolidated answer.' },
  { key: 'claude', name: 'Claude',  vendor: 'Anthropic · Sonnet', color: '#d97757', strength: 'Nuanced writing', desc: 'Contributes its own answer, then merges all the outputs into the one you read.' },
];

const FEATURES = [
  { title: 'Battle Mode',       desc: 'See the models answer side-by-side, then argue it out.' },
  { title: 'Invisible Mode',    desc: 'Clean Claude synthesis only — private prompts, never logged.' },
  { title: 'Cost Transparency', desc: 'Per-token cost tracked across every provider.' },
  { title: 'History',           desc: 'Every session saved and searchable.' },
  { title: 'Browser Privacy',   desc: 'Your API keys stay on your device.' },
  { title: 'Analytics',         desc: 'Usage across your team and models at a glance.' },
];

const AUDIENCES = [
  { role: 'Researchers',      desc: "Cross-examine your AI the way you'd cross-examine a source." },
  { role: 'Analysts',         desc: 'The sharpest reads come from comparing, not assuming.' },
  { role: 'Consultants',      desc: "The answer you'd want checked twice — already is." },
  { role: 'Business Leaders', desc: 'The decisions that shape a company deserve more than one opinion.' },
];

// true = yes, false = no, null = partial / not applicable
const COMPARE = [
  { label: 'Multiple AI answers per question',        excelliq: true, single: false, tabs: true  },
  { label: 'Automatic fan-out (one prompt, all models)', excelliq: true, single: false, tabs: false },
  { label: 'Reconciled final answer',                 excelliq: true, single: false, tabs: false },
  { label: 'Side-by-side comparison',                 excelliq: true, single: false, tabs: true  },
  { label: 'Distraction-free answer view',            excelliq: true, single: true,  tabs: false },
  { label: 'Cost tracking per run',                   excelliq: true, single: false, tabs: false },
  { label: 'Follow-ups keep context automatically',   excelliq: true, single: true,  tabs: false },
  { label: 'Unified history, one place',              excelliq: true, single: true,  tabs: false },
  { label: 'Missing model handled transparently',     excelliq: true, single: null,  tabs: false },
  { label: 'Single login, one workflow',              excelliq: true, single: true,  tabs: false },
];

const COMPARE_COLS = '1.9fr 1fr 1fr 1fr';

const PRICING = [
  { name: 'Starter',      base: 19,   credits: '500 credits',       popular: false, cta: 'Start free',    features: ['All three models', 'Synthesis engine', 'History', 'Browser privacy'] },
  { name: 'Professional', base: 49,   credits: '2,000 credits',     popular: true,  cta: 'Start free',    features: ['Everything in Starter', 'Battle & Invisible mode', 'Analytics', 'Priority support'] },
  { name: 'Enterprise',   base: null, credits: 'Unlimited credits', popular: false, cta: 'Contact sales', features: ['Everything in Pro', 'SSO & Admin portal', 'Custom retention', 'Dedicated success'] },
];

const TESTIMONIALS = [
  { initials: 'PR', name: 'Priya Rangan',   title: 'Partner, Northline Advisory',    quote: 'Excelliq replaced my three-tab research habit. The synthesized answers make client memos measurably better.' },
  { initials: 'DO', name: 'Daniel Okafor',  title: 'VP Strategy, Meridian Labs',     quote: 'I used to hedge every AI answer. Now I get one accountable synthesis I can actually cite in a board deck.' },
  { initials: 'SA', name: 'Sofia Alvarez',  title: 'Head of Research, Kestrel Capital', quote: 'Cost tracking alone paid for the seats. Battle Mode is where the real magic happens.' },
];

const PRIVACY = [
  { title: 'Browser Storage',  desc: 'Keys and history stay on your device.' },
  { title: 'Official APIs',    desc: 'Direct provider calls with your keys.' },
  { title: 'No Server Storage', desc: 'We never store your prompts by default.' },
  { title: 'Complete Privacy', desc: 'Invisible mode leaves no trace.' },
];

const FAQ = [
  { q: "What's the difference between Battle Mode and Invisible Mode?", a: 'Battle Mode shows every raw model answer plus the synthesis, for comparing sources. Invisible Mode shows only the clean final answer. ' },
  { q: 'What happens if I refresh the page?', a: 'Nothing is lost — your last 100 runs, including prompts, answers, follow-ups and usage, are saved automatically. ' },
  { q: 'How does the synthesis engine work?', a: 'On every run, Claude reads all the raw answers and writes one reconciled, polished conclusion. You can view the raw answers too, or just the synthesis — your choice. ' },
  { q: 'Which models does Excelliq use?', a: 'ChatGPT (OpenAI), Gemini (Google) and Claude (Anthropic) — all through their official APIs. Claude is always active since it also writes the final synthesis; ChatGPT and Gemini are optional toggles.' },
  { q: 'Can Excelliq be used for any type of question? ', a: 'Excelliq works well for research, analysis, writing, and decision support questions where a well-rounded answer matters. ' },
];

// Header nav. Marketplace lives outside this page — point it at the real URL.
const NAV = [
  { label: 'Home',        href: 'https://ivna.ai', external: true },
  { label: 'Features',    href: '#features' },
  { label: 'Marketplace', href: '#' },
  { label: 'Pricing',     href: '#pricing' },
  { label: 'FAQ',         href: '#faq' },
];

// Footer nav. Replace the '#' hrefs with real URLs when the links are live.
const FOOTER_NAV = [
  { heading: 'Kleza', links: [
    { label: 'Enterprise Services', href: '#' },
    { label: 'AI Services',         href: '#' },
    { label: 'Marketplace',         href: '#' },
    { label: 'Resources',           href: '#' },
  ] },
  { heading: 'Ivna', links: [
    { label: 'Voica',     href: '#' },
    { label: 'AssessFlo', href: '#' },
    { label: 'HireOrbit', href: '#' },
    { label: 'Nexxio',    href: '#' },
    { label: 'Docunyx',   href: '#' },
    { label: 'Excelliq',  href: '#' },
  ] },
  { heading: 'Comes360', links: [
    { label: 'HR Companion',        href: '#' },
    { label: 'Admin Companion',     href: '#' },
    { label: 'Scheduler Companion', href: '#' },
    { label: 'Recruiter Companion', href: '#' },
    { label: 'Caregiver Companion', href: '#' },
    { label: 'Client Companion',    href: '#' },
  ] },
  { heading: 'Company', links: [
    { label: 'About',           href: '#' },
    { label: 'Marketplace',     href: '#' },
    { label: 'Resources',       href: '#' },
    { label: 'Contact',         href: '#' },
    { label: 'Privacy / Terms', href: '#' },
  ] },
];

// ── Small helpers ───────────────────────────────────────────────────────────
const useIsMobile = (bp = 820) => {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth <= bp);
  useEffect(() => {
    const fn = () => setM(window.innerWidth <= bp);
    fn();
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, [bp]);
  return m;
};

const Check = ({ color = BLUE, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const Dash = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#c2ccdb" strokeWidth="3" strokeLinecap="round" style={{ flexShrink: 0 }}>
    <line x1="6" y1="12" x2="18" y2="12" />
  </svg>
);

const Cross = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#c2ccdb" strokeWidth="3" strokeLinecap="round" style={{ flexShrink: 0 }}>
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </svg>
);

// Brand icon set in /public/Excelliq Icon 2026 — each file is named exactly after
// the item it illustrates, so a title resolves straight to its artwork. Anything
// without a matching file quietly falls back to the generic check mark.
const ICON_DIR = '/Excelliq Icon 2026';
const iconSrc = (name) => encodeURI(`${ICON_DIR}/${name}.png`);

const ItemIcon = ({ name, size = 24 }) => {
  const [missing, setMissing] = useState(false);
  if (missing) return <Check color={BLUE} size={Math.round(size * 0.72)} />;
  return (
    <img
      src={iconSrc(name)} alt="" width={size} height={size}
      loading="lazy" decoding="async"
      onError={() => setMissing(true)}
      style={{ objectFit: 'contain', display: 'block' }}
    />
  );
};

// Social marks for the footer
const SocialMark = ({ name, size = 18 }) => {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true };
  if (name === 'linkedin') {
    return (
      <svg {...common}>
        <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05a4.17 4.17 0 0 1 3.75-2.06c4 0 4.75 2.64 4.75 6.07V21h-4v-5.5c0-1.31-.02-3-1.83-3s-2.12 1.43-2.12 2.9V21H9z" />
      </svg>
    );
  }
  if (name === 'x') {
    return (
      <svg {...common}>
        <path d="M17.53 3h3.04l-6.64 7.59L21.75 21h-6.11l-4.79-6.26L5.37 21H2.33l7.1-8.12L2.25 3h6.27l4.33 5.72zm-1.07 16.15h1.68L7.62 4.74H5.82z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M21.58 7.19a2.5 2.5 0 0 0-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42a2.5 2.5 0 0 0-1.77 1.77A26.1 26.1 0 0 0 2 12a26.1 26.1 0 0 0 .42 4.81 2.5 2.5 0 0 0 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42a2.5 2.5 0 0 0 1.77-1.77A26.1 26.1 0 0 0 22 12a26.1 26.1 0 0 0-.42-4.81zM10 15.02V8.98L15.2 12z" />
    </svg>
  );
};

// Comparison-table cell: true → check, false → cross, null → dash
const CompareCell = ({ value, color = '#94a3b8' }) => {
  if (value === true) return <Check color={color} />;
  if (value === false) return <Cross />;
  return <Dash />;
};

// Brand model marks
const ModelMark = ({ modelKey, size = 20 }) => {
  const gid = useId();
  const common = { width: size, height: size, viewBox: '0 0 24 24', style: { flexShrink: 0 } };
  if (modelKey === 'openai') {
    return (
      <svg {...common} fill="currentColor" aria-hidden="true">
        <path d="M22.28 9.82a5.98 5.98 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9A6.07 6.07 0 0 0 4.98 4.18a5.98 5.98 0 0 0-3.99 2.9 6.05 6.05 0 0 0 .74 7.1 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.52 2.9A5.98 5.98 0 0 0 13.26 24a6.06 6.06 0 0 0 5.77-4.21 5.99 5.99 0 0 0 4-2.9 6.06 6.06 0 0 0-.75-7.07zm-9.02 12.6a4.48 4.48 0 0 1-2.88-1.04l.14-.08 4.78-2.76a.79.79 0 0 0 .39-.68v-6.74l2.02 1.17a.07.07 0 0 1 .04.06v5.58a4.5 4.5 0 0 1-4.49 4.49zM3.6 18.3a4.47 4.47 0 0 1-.54-3.01l.14.09 4.78 2.76a.77.77 0 0 0 .78 0l5.84-3.37v2.33a.08.08 0 0 1-.03.07l-4.83 2.79a4.5 4.5 0 0 1-6.14-1.65zM2.34 7.9a4.48 4.48 0 0 1 2.34-1.97V11.6a.77.77 0 0 0 .39.68l5.8 3.35-2.02 1.17a.08.08 0 0 1-.07 0l-4.83-2.79A4.5 4.5 0 0 1 2.34 7.9zm16.6 3.86-5.84-3.4L15.12 7.2a.08.08 0 0 1 .07 0l4.83 2.78a4.49 4.49 0 0 1-.68 8.1v-5.68a.79.79 0 0 0-.39-.67zm2.01-3.03-.14-.09-4.77-2.78a.78.78 0 0 0-.79 0L9.42 9.23V6.9a.07.07 0 0 1 .03-.07l4.83-2.78a4.5 4.5 0 0 1 6.68 4.66zM8.32 12.87 6.3 11.7a.07.07 0 0 1-.04-.06V6.07a4.5 4.5 0 0 1 7.38-3.45l-.14.08L8.72 5.46a.79.79 0 0 0-.39.68zM9.42 10.5 12 9l2.6 1.5v3L12 15l-2.6-1.5z" />
      </svg>
    );
  }
  if (modelKey === 'gemini') {
    return (
      <svg {...common} aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="2" y1="4" x2="22" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#4285F4" />
            <stop offset="0.5" stopColor="#9B72CB" />
            <stop offset="1" stopColor="#D96570" />
          </linearGradient>
        </defs>
        <path fill={`url(#${gid})`} d="M12 0c.4 6.4 5.6 11.6 12 12-6.4.4-11.6 5.6-12 12-.4-6.4-5.6-11.6-12-12C6.4 11.6 11.6 6.4 12 0z" />
      </svg>
    );
  }
  return (
    <svg {...common} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" aria-hidden="true">
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="5.64" y1="5.64" x2="18.36" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="5.64" y2="18.36" />
    </svg>
  );
};

const PrimaryButton = ({ children, onClick, style }) => (
  <button
    onClick={onClick}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 16px 34px -12px rgba(13,70,216,0.6)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 10px 26px -12px rgba(13,70,216,0.55)'; }}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 9, border: 'none', borderRadius: 999,
      background: BRAND_GRAD, color: '#fff', padding: '0.9rem 1.6rem', fontSize: '1rem',
      fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', transition: 'transform 0.15s, box-shadow 0.15s',
      boxShadow: '0 10px 26px -12px rgba(13,70,216,0.55)', ...style,
    }}
  >
    {children}
  </button>
);

// Headings sit on a wide track and scale with the viewport so each one holds a
// single line on desktop; below the mobile breakpoint they wrap as normal.
const SectionHeading = ({ title, accent, subtitle, isMobile }) => (
  <div style={{ textAlign: 'center', maxWidth: isMobile ? 640 : 1100, margin: '0 auto 2.75rem' }}>
    <h2 style={{ fontFamily: SERIF, fontWeight: 500, color: INK, fontSize: isMobile ? '1.9rem' : 'clamp(1.7rem, 3.1vw, 2.5rem)', lineHeight: 1.12, letterSpacing: '-0.02em', margin: 0 }}>
      {title}{accent && <span style={{ color: BLUE, fontStyle: 'italic' }}> {accent}</span>}
    </h2>
    {subtitle && <p style={{ color: MUTED, fontSize: '1.05rem', lineHeight: 1.65, margin: '1rem auto 0', maxWidth: 640 }}>{subtitle}</p>}
  </div>
);

// ── Product demo video ───────────────────────────────────────────────────────
// 210MB 4K file, so nothing is fetched until the viewer actually clicks play.
const VIDEO_SRC = encodeURI('/Final - Excelliq Video Demo new.mp4');
// 1920x1080, same aspect as the video, so it fills the frame with no letterboxing.
const VIDEO_POSTER = encodeURI('/Excelliq YT Thumbnnail 03 Aug 2026.jpg');

// ── Hero demo video ──────────────────────────────────────────────────────────
// Before playback: poster only, no native controls, with a play button on top.
// The overlay must be a real button — clicking a <video> surface does not start
// playback in any browser, only its own control buttons do.
// After the first play, hand over to the native controls.
const HeroVisual = () => {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef(null);

  const start = () => {
    const v = videoRef.current;
    if (!v) return;
    setPlaying(true);
    // play() rejects if the browser blocks it; roll the overlay back if so.
    Promise.resolve(v.play()).catch(() => setPlaying(false));
  };

  return (
    <div style={{ width: '100%', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ position: 'relative', width: '100%' }}>
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          poster={VIDEO_POSTER}
          controls={playing}
          playsInline
          preload="none"
          onPlay={() => setPlaying(true)}
          style={{
            width: '100%', display: 'block', aspectRatio: '16 / 9', objectFit: 'cover',
            borderRadius: 18, background: '#000',
            border: `1px solid ${LINE}`, boxShadow: '0 30px 70px -30px rgba(15,31,75,0.45)',
          }}
        />
        {!playing && (
          <button
            type="button"
            onClick={start}
            aria-label="Play the Excelliq product demo"
            style={{
              position: 'absolute', inset: 0, borderRadius: 18, border: 'none', padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.28)', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <span style={{
              width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.94)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill={BLUE2} style={{ marginLeft: 4 }}>
                <polygon points="6 4 20 12 6 20" />
              </svg>
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

// ── Live-prompt widget (three minds answering in real time) ──────────────────
// A looping, scripted demo: the question types itself, all three models stream
// their answers in parallel, then Excelliq reconciles them into one answer.
const DEMO_Q = 'Is it better to specialise deeply or stay a generalist?';
const DEMO_A = {
  openai: 'Specialise first. Depth earns credibility, and broadening later beats backfilling expertise.',
  gemini: 'It depends on the field — fast-moving work rewards range, technical work still pays for depth.',
  claude: 'Aim for a T: one thing you are genuinely known for, plus enough breadth to work across teams.',
};
const DEMO_SYNTH = 'Go deep first, then broaden. Become known for one thing — depth earns credibility that breadth alone never does — then widen deliberately: sooner in fast-moving fields, later where technical depth still pays.';

// Whole timeline resolved once, in ms from the top of each loop.
const TL = (() => {
  const qStart = 500, qMs = 42, thinkGap = 750, stagger = 260, aMs = 19, sGap = 800, sMs = 15, hold = 2800;
  const qEnd = qStart + DEMO_Q.length * qMs;
  const starts = MODELS.map((_, i) => qEnd + thinkGap + i * stagger);
  const ends = MODELS.map((m, i) => starts[i] + DEMO_A[m.key].length * aMs);
  const sStart = Math.max(...ends) + sGap;
  const sEnd = sStart + DEMO_SYNTH.length * sMs;
  return { qStart, qMs, starts, ends, aMs, sStart, sEnd, sMs, total: sEnd + hold };
})();

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return reduced;
};

const Caret = ({ color = BLUE }) => (
  <span style={{ display: 'inline-block', width: 2, height: '1em', background: color, marginLeft: 2, verticalAlign: '-0.12em', animation: 'blink 1s step-end infinite' }} />
);

const LivePrompt = () => {
  const isMobile = useIsMobile();
  const reduced = usePrefersReducedMotion();
  const ref = useRef(null);
  const [t, setT] = useState(0);
  const [live, setLive] = useState(false);

  // Only burn frames while the widget is actually on screen.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setLive(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!live || reduced) return;
    let raf, t0, last = -Infinity;
    const step = (ts) => {
      if (t0 === undefined) t0 = ts;
      if (ts - last >= 40) { last = ts; setT((ts - t0) % TL.total); }   // ~25fps is plenty for typing
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [live, reduced]);

  const now = reduced ? TL.sEnd : t;                       // reduced motion → show the finished state
  const typed = (text, start, ms) =>
    text.slice(0, Math.max(0, Math.min(text.length, Math.floor((now - start) / ms))));

  const q = typed(DEMO_Q, TL.qStart, TL.qMs);
  const qDone = q.length === DEMO_Q.length;
  const synth = typed(DEMO_SYNTH, TL.sStart, TL.sMs);
  const synthDone = synth.length === DEMO_SYNTH.length;

  return (
    <div ref={ref} style={{ maxWidth: 900, margin: '0 auto', border: `1px solid ${LINE}`, borderRadius: 18, background: '#fff', boxShadow: '0 10px 40px -24px rgba(15,31,75,0.4)', overflow: 'hidden' }}>
      <div style={{ padding: '1rem 1.3rem', borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c840', animation: live && !reduced ? 'eqPulse 1.6s ease-in-out infinite' : 'none' }} />
        <strong style={{ fontSize: '0.95rem', color: INK }}>Watch It Run</strong>
        {!isMobile && <span style={{ color: MUTED, fontSize: '0.85rem' }}>— One Prompt, Leading Models, Moving in Parallel. </span>}
      </div>

      {/* the prompt, typing itself */}
      <div style={{ padding: '0.95rem 1.3rem', borderBottom: `1px solid ${LINE}`, background: '#fbfcfe', display: 'flex', alignItems: 'baseline', gap: 10, minHeight: 22 }}>
        <span style={{ fontSize: '0.68rem', fontWeight: 900, color: MUTED, letterSpacing: '0.1em', flexShrink: 0 }}>YOU</span>
        <span style={{ fontSize: isMobile ? '0.84rem' : '0.92rem', color: INK, fontWeight: 600, lineHeight: 1.5 }}>
          {q}{!qDone && <Caret />}
        </span>
      </div>

      {/* three models answering in parallel */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)' }}>
        {MODELS.map((m, i) => {
          const full = DEMO_A[m.key];
          const text = typed(full, TL.starts[i], TL.aMs);
          const done = text.length === full.length;
          const waiting = text.length === 0;
          return (
            <div
              key={m.key}
              style={{
                padding: '1.1rem 1.2rem',
                borderRight: !isMobile && i < MODELS.length - 1 ? `1px solid ${LINE}` : 'none',
                borderBottom: isMobile && i < MODELS.length - 1 ? `1px solid ${LINE}` : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ color: m.color, display: 'inline-flex' }}><ModelMark modelKey={m.key} size={16} /></span>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: INK }}>{m.name}</span>
                {done && <span style={{ marginLeft: 'auto', display: 'inline-flex' }}><Check color="#28c840" size={13} /></span>}
              </div>

              <div style={{ minHeight: isMobile ? 44 : 68 }}>
                {waiting ? (
                  <>
                    <div style={{ color: MUTED, fontSize: '0.76rem', fontWeight: 700, marginBottom: 9 }}>
                      {qDone ? 'thinking…' : 'waiting…'}
                    </div>
                    {[100, 82, 90].map((w, k) => (
                      <div
                        key={k}
                        style={{
                          height: 6, borderRadius: 4, background: '#eef1f6', width: `${w}%`, marginBottom: 7,
                          animation: qDone && !reduced ? `eqPulse 1.3s ease-in-out ${k * 0.16}s infinite` : 'none',
                          opacity: qDone ? 1 : 0.55,
                        }}
                      />
                    ))}
                  </>
                ) : (
                  <div style={{ color: '#334155', fontSize: '0.8rem', lineHeight: 1.6 }}>
                    {text}{!done && <Caret color={m.color} />}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Excelliq reconciles the three into one answer */}
      <div style={{ borderTop: `1px solid ${LINE}`, background: 'linear-gradient(180deg, #f7f9ff 0%, #ffffff 100%)', padding: '1.15rem 1.3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
          <img src="/favicon%20new.svg" alt="" width={20} height={20} style={{ objectFit: 'contain', flexShrink: 0 }} />
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: BLUE }}>Excelliq synthesis</span>
          {synthDone && (
            <span style={{ marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 800, color: '#28c840', letterSpacing: '0.06em' }}>RECONCILED</span>
          )}
        </div>
        <div style={{ minHeight: isMobile ? 76 : 54, fontSize: isMobile ? '0.83rem' : '0.88rem', lineHeight: 1.65, color: INK }}>
          {synth.length === 0 ? (
            <span style={{ color: MUTED, fontWeight: 600, animation: !reduced ? 'eqPulse 1.3s ease-in-out infinite' : 'none' }}>
              reconciling three answers…
            </span>
          ) : (
            <>{synth}{!synthDone && <Caret />}</>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Landing page ─────────────────────────────────────────────────────────────
// onLogin falls back to onGetStarted — the app currently has a single entry
// point; pass a real handler once there is a separate sign-in route.
const LandingPage = ({ onGetStarted, onLogin = onGetStarted }) => {
  const isMobile = useIsMobile();
  // The full nav (5 links + 2 buttons) needs ~780px of its own; collapse it well
  // before the 820 content breakpoint or it overflows the bar on small tablets.
  const navTight = useIsMobile(980);
  const pad = isMobile ? '0 1.25rem' : '0 2rem';
  const sectionPad = isMobile ? '3.5rem 0' : '5.5rem 0';
  const headerH = 68;                    // sticky header height; also the anchor scroll offset

  const [billing, setBilling] = useState('monthly');      // monthly | yearly
  const [calcPrompts, setCalcPrompts] = useState(600);
  const [calcFollowups, setCalcFollowups] = useState(400);
  const [faqOpen, setFaqOpen] = useState(0);

  const estCredits = Math.round(calcPrompts * 1 + calcFollowups * 0.5);
  const recommended = estCredits <= 500 ? 'Starter' : estCredits <= 2000 ? 'Professional' : 'Enterprise';

  const priceLabel = (base) => {
    if (base == null) return 'Custom';
    const val = billing === 'yearly' ? Math.round(base * 0.8) : base;
    return `$${val}`;
  };

  return (
    <div style={{ fontFamily: SANS, color: INK, background: '#fff', minHeight: '100vh', overflowX: 'clip' }}>
      {/* ── Header ── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(10px)', borderBottom: `1px solid ${LINE}` }}>
        <div style={{ maxWidth: WIDE, margin: '0 auto', padding: pad, height: headerH, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* height caps the logo on roomy screens, maxWidth rescues it on narrow
              phones — height:auto keeps the 3.68:1 ratio intact either way */}
          <img
            src="/Excelliq%20logo%20neww.png" alt="Excelliq"
            style={{ height: 'auto', maxHeight: navTight ? 42 : 54, maxWidth: '32%', objectFit: 'contain', display: 'block', minWidth: 0 }}
          />
          <nav style={{ display: 'flex', alignItems: 'center', gap: navTight ? 8 : 20, flexShrink: 0 }}>
            {!navTight && NAV.map(link => (
              <a
                key={link.label} href={link.href}
                {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                style={{ color: MUTED, textDecoration: 'none', fontWeight: 600, fontSize: '0.92rem', whiteSpace: 'nowrap' }}
              >
                {link.label}
              </a>
            ))}
            <button
              onClick={onLogin}
              style={{ border: navTight ? 'none' : `1px solid ${LINE}`, borderRadius: 999, background: 'transparent', color: INK, padding: navTight ? '0.5rem 0.5rem' : '0.55rem 1.1rem', fontWeight: 800, fontSize: navTight ? '0.84rem' : '0.9rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
            >
              Login
            </button>
            <button
              onClick={onGetStarted}
              style={{ border: 'none', borderRadius: 999, background: BRAND_GRAD, color: '#fff', padding: navTight ? '0.5rem 0.85rem' : '0.6rem 1.2rem', fontWeight: 800, fontSize: navTight ? '0.84rem' : '0.9rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
            >
              Start Free
            </button>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{ position: 'relative', padding: isMobile ? '3rem 0' : '5rem 0', background: 'radial-gradient(1200px 500px at 50% -10%, #eef3ff 0%, #ffffff 60%)' }}>
        <div style={{ maxWidth: HERO_MAXW, margin: '0 auto', padding: pad, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '0.85fr 1.15fr', gap: isMobile ? 40 : 46, alignItems: 'center' }}>
          <div style={{ textAlign: isMobile ? 'center' : 'left' }}>
            <motion.h1
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              style={{ fontFamily: SERIF, fontWeight: 500, color: INK, fontSize: isMobile ? '2.4rem' : '3.6rem', lineHeight: 1.08, letterSpacing: '-0.025em', margin: 0 }}
            >
              One prompt.<br />
              <span style={{ color: BLUE, fontStyle: 'italic' }}>Multiple perspectives. One Conclusion.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
              style={{ color: MUTED, fontSize: isMobile ? '1.05rem' : '1.18rem', lineHeight: 1.65, maxWidth: 520, margin: isMobile ? '1.5rem auto 0' : '1.5rem 0 0' }}
            >
              No more tab-juggling between LLMs. Excelliq asks all of them at once and gives you one answer worth trusting.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
              style={{ marginTop: '2.1rem', display: 'flex', justifyContent: isMobile ? 'center' : 'flex-start' }}
            >
              <PrimaryButton onClick={onGetStarted}>
                Start Free
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              </PrimaryButton>
            </motion.div>
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: isMobile ? 'center' : 'flex-start', flexWrap: 'wrap', gap: 10 }}>
              {MODELS.map(m => (
                <span key={m.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 999, padding: '6px 13px', fontWeight: 800, fontSize: '0.82rem', color: m.color === '#4285F4' ? INK : m.color, boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}>
                  <span style={{ color: m.color, display: 'inline-flex' }}><ModelMark modelKey={m.key} size={15} /></span>
                  {m.name}
                </span>
              ))}
            </div>
          </div>
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.15 }}>
            <HeroVisual />
          </motion.div>
        </div>
      </section>

      {/* ── Models + live prompt ── */}
      <section id="models" style={{ padding: sectionPad, background: '#fff', scrollMarginTop: headerH }}>
        <div style={{ maxWidth: MAXW, margin: '0 auto', padding: pad }}>
          <SectionHeading title="Ask One Model." accent="Or Ask All of Them at Once." isMobile={isMobile}
            subtitle="Run just the model you trust for quick, everyday questions, or enable all of them for questions that matter, and get one consolidated answer built from every response." />
          <LivePrompt />
        </div>
      </section>

      {/* ── Everything you need ── */}
      <section id="features" style={{ padding: sectionPad, background: SOFT, scrollMarginTop: headerH }}>
        <div style={{ maxWidth: MAXW, margin: '0 auto', padding: pad }}>
          <SectionHeading  title="Powerful Where It Matters." accent="Simple Everywhere Else." isMobile={isMobile}
            subtitle="The rest of the content across is fine " />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 18 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, padding: '1.5rem' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eef3ff', display: 'grid', placeItems: 'center', marginBottom: '0.9rem' }}>
                  <ItemIcon name={f.title} size={24} />
                </div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: INK, marginBottom: '0.3rem' }}>{f.title}</div>
                <div style={{ color: MUTED, fontSize: '0.9rem', lineHeight: 1.55 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ── Built for high-stakes thinking ── */}
      <section style={{ padding: sectionPad, background: SOFT }}>
        <div style={{ maxWidth: MAXW, margin: '0 auto', padding: pad }}>
          <SectionHeading title="Built for" accent="Minds That Don't Settle for One Answer." isMobile={isMobile} />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 18 }}>
            {AUDIENCES.map(a => (
              <div key={a.role} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, padding: '1.4rem' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eef3ff', display: 'grid', placeItems: 'center', marginBottom: '0.9rem' }}>
                  <ItemIcon name={a.role} size={24} />
                </div>
                <div style={{ fontWeight: 900, color: INK, fontSize: '1.02rem', marginBottom: '0.4rem' }}>{a.role}</div>
                <div style={{ color: MUTED, fontSize: '0.92rem', lineHeight: 1.55 }}>{a.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why not three tabs ── */}
      <section style={{ padding: sectionPad, background: '#fff' }}>
        <div style={{ maxWidth: MAXW, margin: '0 auto', padding: pad }}>
          <SectionHeading title="Why not just open" accent="three tabs?" isMobile={isMobile} />
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 18, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: COMPARE_COLS, background: SOFT, borderBottom: `1px solid ${LINE}`, fontWeight: 800, fontSize: isMobile ? '0.68rem' : '0.86rem' }}>
              <div style={{ padding: '0.85rem 1rem', color: MUTED }}>Feature</div>
              <div style={{ padding: '0.85rem 0.4rem', textAlign: 'center', color: BLUE }}>Excelliq</div>
              <div style={{ padding: '0.85rem 0.4rem', textAlign: 'center', color: MUTED }}>Single AI chatbot</div>
              <div style={{ padding: '0.85rem 0.4rem', textAlign: 'center', color: MUTED }}>3 tabs manually</div>
            </div>
            {COMPARE.map((row, i) => (
              <div key={row.label} style={{ display: 'grid', gridTemplateColumns: COMPARE_COLS, borderBottom: i < COMPARE.length - 1 ? `1px solid ${LINE}` : 'none', alignItems: 'center' }}>
                <div style={{ padding: '0.8rem 1rem', fontWeight: 700, color: INK, fontSize: isMobile ? '0.78rem' : '0.92rem' }}>{row.label}</div>
                <div style={{ padding: '0.8rem', display: 'grid', placeItems: 'center' }}><CompareCell value={row.excelliq} color={BLUE} /></div>
                <div style={{ padding: '0.8rem', display: 'grid', placeItems: 'center' }}><CompareCell value={row.single} /></div>
                <div style={{ padding: '0.8rem', display: 'grid', placeItems: 'center' }}><CompareCell value={row.tabs} /></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" style={{ padding: sectionPad, background: SOFT, scrollMarginTop: headerH }}>
        <div style={{ maxWidth: MAXW, margin: '0 auto', padding: pad }}>
          <SectionHeading title="Pay for the Answers" accent="You Actually Need." isMobile={isMobile} />

          {/* billing toggle */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2.25rem' }}>
            <div style={{ display: 'inline-flex', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 999, padding: 4 }}>
              {['monthly', 'yearly'].map(opt => (
                <button key={opt} onClick={() => setBilling(opt)} style={{
                  border: 'none', borderRadius: 999, padding: '0.5rem 1.2rem', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit',
                  background: billing === opt ? BRAND_GRAD : 'transparent', color: billing === opt ? '#fff' : MUTED, textTransform: 'capitalize',
                }}>
                  {opt}{opt === 'yearly' ? ' · Save 20%' : ''}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 20, alignItems: 'start' }}>
            {PRICING.map(p => (
              <div key={p.name} style={{
                position: 'relative', background: '#fff', borderRadius: 20,
                border: p.popular ? `2px solid ${BLUE}` : `1px solid ${LINE}`,
                padding: '1.9rem', boxShadow: p.popular ? '0 24px 50px -24px rgba(13,70,216,0.4)' : '0 1px 4px rgba(15,23,42,0.04)',
              }}>
                {p.popular && (
                  <span style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: BRAND_GRAD, color: '#fff', fontSize: '0.72rem', fontWeight: 800, padding: '4px 12px', borderRadius: 999 }}>Most popular</span>
                )}
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: INK }}>{p.name}</div>
                <div style={{ margin: '0.6rem 0', display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontFamily: SERIF, fontSize: '2.6rem', fontWeight: 600, color: INK }}>{priceLabel(p.base)}</span>
                  {p.base != null && <span style={{ color: MUTED, fontWeight: 700 }}>/mo</span>}
                </div>
                <div style={{ color: BLUE, fontWeight: 800, fontSize: '0.88rem', marginBottom: '1.1rem' }}>{p.credits}</div>
                <button onClick={onGetStarted} style={{
                  width: '100%', borderRadius: 12, padding: '0.8rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', marginBottom: '1.3rem',
                  border: p.popular ? 'none' : `1px solid ${BLUE}`, background: p.popular ? BRAND_GRAD : '#fff', color: p.popular ? '#fff' : BLUE,
                }}>
                  {p.cta}
                </button>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                  {p.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, color: INK, fontSize: '0.92rem' }}>
                      <Check size={16} /> {f}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* credits calculator */}
          <div style={{ marginTop: '2.5rem', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr', gap: 22 }}>
            <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 18, padding: '1.7rem' }}>
              <div style={{ fontWeight: 900, color: INK, fontSize: '1.05rem', marginBottom: '0.3rem' }}>Credits calculator</div>
              <div style={{ color: MUTED, fontSize: '0.9rem', marginBottom: '1.4rem' }}>Estimate your monthly usage.</div>
              {[
                { label: 'Prompts / month', value: calcPrompts, set: setCalcPrompts, max: 3000, step: 50 },
                { label: 'Follow-ups / month', value: calcFollowups, set: setCalcFollowups, max: 3000, step: 50 },
              ].map(s => (
                <div key={s.label} style={{ marginBottom: '1.2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: INK, fontWeight: 700, fontSize: '0.9rem' }}>{s.label}</span>
                    <span style={{ color: BLUE, fontWeight: 800, fontSize: '0.9rem' }}>{s.value}</span>
                  </div>
                  <input type="range" min="0" max={s.max} step={s.step} value={s.value} onChange={e => s.set(Number(e.target.value))}
                    style={{ width: '100%', accentColor: BLUE }} />
                </div>
              ))}
            </div>
            <div style={{ background: `linear-gradient(150deg, ${INK}, ${BLUE})`, borderRadius: 18, padding: '1.7rem', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ color: '#cbd8f2', fontSize: '0.85rem', fontWeight: 700 }}>Estimated credits</div>
              <div style={{ fontFamily: SERIF, fontSize: '3rem', fontWeight: 600, lineHeight: 1.1, margin: '0.2rem 0 0.6rem' }}>{estCredits.toLocaleString()}</div>
              <div style={{ fontSize: '0.9rem' }}>Recommended: <strong>{recommended}</strong></div>
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.18)', color: '#cbd8f2', fontSize: '0.8rem', lineHeight: 1.6 }}>
                1 prompt = 1 credit · 1 follow-up = 0.5 credit
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section style={{ padding: sectionPad, background: '#fff' }}>
        <div style={{ maxWidth: MAXW, margin: '0 auto', padding: pad }}>
          <SectionHeading title="What Our Users Are" accent="Saying" isMobile={isMobile} />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 20 }}>
            {TESTIMONIALS.map(t => (
              <div key={t.name} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 18, padding: '1.6rem', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
                <p style={{ color: INK, fontSize: '1rem', lineHeight: 1.65, margin: '0 0 1.3rem', fontStyle: 'italic' }}>"{t.quote}"</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 40, height: 40, borderRadius: '50%', background: BRAND_GRAD, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.85rem' }}>{t.initials}</span>
                  <div>
                    <div style={{ fontWeight: 800, color: INK, fontSize: '0.92rem' }}>{t.name}</div>
                    <div style={{ color: MUTED, fontSize: '0.82rem' }}>{t.title}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Your data stays yours ── */}
      <section style={{ padding: sectionPad, background: SOFT }}>
        <div style={{ maxWidth: MAXW, margin: '0 auto', padding: pad }}>
          <SectionHeading title="Your Data Never" accent="Leaves Your Hands." isMobile={isMobile} />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 18 }}>
            {PRIVACY.map(p => (
              <div key={p.title} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, padding: '1.4rem' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eef3ff', display: 'grid', placeItems: 'center', marginBottom: '0.9rem' }}>
                  <ItemIcon name={p.title} size={24} />
                </div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: INK, marginBottom: '0.35rem' }}>{p.title}</div>
                <div style={{ color: MUTED, fontSize: '0.9rem', lineHeight: 1.55 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ padding: sectionPad, background: '#fff', scrollMarginTop: headerH }}>
        <div style={{ maxWidth: MAXW, margin: '0 auto', padding: pad }}>
          <SectionHeading title="Frequently" accent="asked." isMobile={isMobile} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FAQ.map((item, i) => {
              const open = faqOpen === i;
              return (
                <div key={item.q} style={{ border: `1px solid ${LINE}`, borderRadius: 14, overflow: 'hidden', background: open ? '#fff' : SOFT }}>
                  <button onClick={() => setFaqOpen(open ? -1 : i)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    padding: '1.1rem 1.3rem', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  }}>
                    <span style={{ fontWeight: 800, color: INK, fontSize: '1rem' }}>{item.q}</span>
                    <span style={{ color: BLUE, fontSize: '1.4rem', lineHeight: 1, transform: open ? 'rotate(45deg)' : 'none', transition: 'transform 0.18s', flexShrink: 0 }}>+</span>
                  </button>
                  {open && <div style={{ padding: '0 1.3rem 1.2rem', color: MUTED, fontSize: '0.94rem', lineHeight: 1.65 }}>{item.a}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={{ padding: sectionPad, background: SOFT }}>
        <div style={{ maxWidth: MAXW, margin: '0 auto', padding: pad }}>
          <div style={{ background: `linear-gradient(150deg, ${INK} 0%, ${BLUE} 130%)`, borderRadius: 28, padding: isMobile ? '2.75rem 1.5rem' : '4rem', textAlign: 'center', color: '#fff' }}>
            <h2 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: isMobile ? '2rem' : '2.8rem', lineHeight: 1.1, letterSpacing: '-0.02em', margin: 0 }}>
             Ready for an Answer <span style={{ fontStyle: 'italic', color: '#9fc1f5' }}>You Can Actually Trust?</span>
            </h2>
            <p style={{ color: '#cbd8f2', fontSize: '1.05rem', lineHeight: 1.6, maxWidth: 520, margin: '1.1rem auto 2rem' }}>
             Ready to Ask Multiple LLMs at Once?
            </p>
            <button
              onClick={onGetStarted}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
              style={{ border: 'none', borderRadius: 999, background: '#fff', color: BLUE, padding: '0.95rem 1.9rem', fontSize: '1.05rem', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit', transition: 'transform 0.15s', boxShadow: '0 14px 30px rgba(0,0,0,0.25)' }}
            >
              Start Free
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: `1px solid ${LINE}`, background: '#fff', padding: isMobile ? '3rem 0 2rem' : '4.5rem 0 2rem' }}>
        <div style={{ maxWidth: WIDE, margin: '0 auto', padding: pad }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.35fr repeat(4, 1fr)', gap: isMobile ? 36 : 26 }}>

            {/* brand column */}
            <div>
              <img src="/Excelliq%20logo%20neww.png" alt="Excelliq" style={{ height: 55, width: 'auto', maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
              <p style={{ color: MUTED, fontSize: '0.95rem', lineHeight: 1.75, margin: '1.4rem 0 0', maxWidth: 330 }}>
                One prompt, three leading AI models, and a single reconciled answer — so you stop juggling tabs and start trusting what you read.
              </p>
              <div style={{ display: 'flex', gap: 12, marginTop: '1.6rem' }}>
                {[
                  { name: 'linkedin', label: 'LinkedIn', href: '#' },
                  { name: 'x',        label: 'X',        href: '#' },
                  { name: 'youtube',  label: 'YouTube',  href: '#' },
                ].map(s => (
                  <a
                    key={s.name} href={s.href} aria-label={s.label}
                    style={{ width: 42, height: 42, borderRadius: 12, background: SOFT, color: '#334155', display: 'grid', placeItems: 'center', textDecoration: 'none' }}
                  >
                    <SocialMark name={s.name} />
                  </a>
                ))}
              </div>
            </div>

            {/* link columns */}
            {FOOTER_NAV.map(col => (
              <div key={col.heading}>
                <div style={{ fontWeight: 800, color: INK, fontSize: '1.05rem' }}>{col.heading}</div>
                <div style={{ width: 30, height: 3, borderRadius: 2, background: BLUE, margin: '0.7rem 0 1.4rem' }} />
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 14 }}>
                  {col.links.map(l => (
                    <li key={l.label}>
                      <a href={l.href} style={{ color: MUTED, textDecoration: 'none', fontSize: '0.95rem' }}>{l.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div style={{ borderTop: `1px solid ${LINE}`, marginTop: isMobile ? '2.5rem' : '3.5rem', paddingTop: '1.75rem', textAlign: 'center' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
              © {new Date().getFullYear()} Kleza Solutions. All rights reserved.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
