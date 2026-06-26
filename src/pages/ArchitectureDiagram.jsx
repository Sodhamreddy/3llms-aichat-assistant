const C = {
  purple:  '#7c3aed',
  blue:    '#2563eb',
  green:   '#059669',
  orange:  '#d97757',
  cyan:    '#0891b2',
  red:     '#dc2626',
  bg:      '#f8f9ff',
  border:  '#e2e8f0',
  dark:    '#1e293b',
  muted:   '#64748b',
  gpt:     '#10a37f',
  claude:  '#d97757',
  gemini:  '#4285f4',
};

const Box = ({ title, sub, color = C.dark, bg = '#fff', borderColor, icon, style = {} }) => (
  <div style={{
    background: bg, border: `1.5px solid ${borderColor || color + '40'}`,
    borderRadius: 10, padding: '10px 14px',
    display: 'flex', alignItems: 'flex-start', gap: 10, ...style,
  }}>
    {icon && <div style={{ fontSize: '1.2rem', flexShrink: 0, marginTop: 1 }}>{icon}</div>}
    <div>
      <div style={{ fontWeight: 700, fontSize: '0.82rem', color, lineHeight: 1.3 }}>{title}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: C.muted, marginTop: 2, lineHeight: 1.4 }}>{sub}</div>}
    </div>
  </div>
);

const CircleNum = ({ n, color = C.blue }) => (
  <div style={{
    width: 28, height: 28, borderRadius: '50%', background: color,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.78rem', fontWeight: 800, color: '#fff', flexShrink: 0,
  }}>{n}</div>
);

const SectionTitle = ({ n, label, color = C.blue }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
    <CircleNum n={n} color={color} />
    <span style={{ fontWeight: 800, fontSize: '0.88rem', color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
  </div>
);

const Arrow = ({ dir = 'right', color = C.red, label = 'API CALL', style = {} }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4, ...style }}>
    {dir === 'right' && <>
      <div style={{ flex: 1, height: 2, background: color }} />
      <div style={{ width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: `8px solid ${color}` }} />
      {label && <span style={{ fontSize: '0.62rem', fontWeight: 700, color, marginLeft: 2, whiteSpace: 'nowrap' }}>{label}</span>}
    </>}
    {dir === 'down' && (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 2, height: 24, background: color }} />
        <div style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `8px solid ${color}` }} />
      </div>
    )}
  </div>
);

const DashedArrow = ({ label, style = {} }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4, ...style }}>
    <div style={{ flex: 1, height: 0, borderTop: '2px dashed #2563eb' }} />
    <div style={{ width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: `8px solid #2563eb` }} />
    {label && <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#2563eb', whiteSpace: 'nowrap' }}>{label}</span>}
  </div>
);

const ArchitectureDiagram = () => (
  <div style={{ fontFamily: 'Inter, system-ui, sans-serif', background: C.bg, minHeight: '100vh', padding: '2rem 2rem 3rem' }}>

    {/* Title */}
    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
      <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: C.dark, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
        Excelliq AI – Architecture &amp; API Flow <span style={{ color: C.muted, fontWeight: 400 }}>(Detailed)</span>
      </h1>
    </div>

    {/* ── Main diagram grid ── */}
    <div style={{ display: 'grid', gridTemplateColumns: '160px 260px 260px 1fr', gap: '1rem', alignItems: 'start', maxWidth: 1280, margin: '0 auto' }}>

      {/* ① INPUT */}
      <div>
        <SectionTitle n="1" label="Input" color={C.purple} />
        <div style={{ background: '#fff', border: `2px solid ${C.purple}`, borderRadius: 12, padding: '16px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>💬</div>
          <div style={{ fontWeight: 700, fontSize: '0.82rem', color: C.dark }}>Chat Message</div>
          <div style={{ fontSize: '0.72rem', color: C.muted, marginTop: 6, fontStyle: 'italic', background: '#f1f0ff', borderRadius: 6, padding: '4px 8px' }}>
            "What are the best SEO strategies for 2025?"
          </div>
        </div>
        {/* Arrow right → n8n */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <div style={{ fontSize: '1.2rem', color: C.dark }}>→</div>
        </div>
      </div>

      {/* ② n8n WORKFLOW */}
      <div>
        <SectionTitle n="2" label="n8n Workflow Engine" color={C.blue} />
        <div style={{ background: '#eff6ff', border: `2px solid ${C.blue}`, borderRadius: 12, padding: '14px' }}>
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.blue, color: '#fff', borderRadius: 20, padding: '3px 12px', fontSize: '0.7rem', fontWeight: 700 }}>
              🔄 WEBHOOK TRIGGER
            </div>
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.78rem', color: C.dark, marginBottom: 6 }}>n8n Responsibilities</div>
          {['Receive prompt from Excelliq UI', 'Route to all 3 LLM APIs in parallel', 'Manage API keys & auth headers', 'Collect all responses', 'Pass results to Claude for synthesis', 'Return final JSON to frontend'].map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
              <span style={{ color: C.blue, fontWeight: 700, fontSize: '0.7rem', flexShrink: 0 }}>•</span>
              <span style={{ fontSize: '0.72rem', color: C.dark }}>{t}</span>
            </div>
          ))}
          <div style={{ marginTop: 12, borderTop: `1px dashed ${C.blue}30`, paddingTop: 10 }}>
            <div style={{ fontWeight: 700, fontSize: '0.78rem', color: C.dark, marginBottom: 6 }}>Synthesize Results</div>
            <div style={{ fontSize: '0.72rem', color: C.muted, lineHeight: 1.5 }}>
              Claude reads all 3 responses and generates one final synthesized answer with the strongest insights.
            </div>
          </div>
        </div>
      </div>

      {/* ③ LLM TOOLS / ACTIONS */}
      <div>
        <SectionTitle n="3" label="Parallel LLM API Calls" color={C.green} />
        <div style={{ background: '#f0fdf4', border: `2px solid ${C.green}`, borderRadius: 12, padding: '10px', display: 'flex', flexDirection: 'column', gap: 8 }}>

          {[
            { n: 1, icon: '🤖', name: 'ChatGPT',  sub: 'GPT-5.2 — Structured answers, code & breakdowns', color: C.gpt },
            { n: 2, icon: '🟠', name: 'Claude',   sub: 'Claude Opus 4.6 — Deep reasoning & final synthesis', color: C.claude },
            { n: 3, icon: '🔵', name: 'Gemini',   sub: 'Gemini 3.1 Pro — Real-time knowledge & creativity', color: C.gemini },
          ].map(m => (
            <div key={m.n} style={{ background: '#fff', border: `1.5px solid ${m.color}40`, borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: '#fff', flexShrink: 0 }}>{m.n}</div>
              <div style={{ fontSize: '1rem', flexShrink: 0 }}>{m.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: m.color }}>{m.name}</div>
                <div style={{ fontSize: '0.68rem', color: C.muted, lineHeight: 1.35 }}>{m.sub}</div>
              </div>
            </div>
          ))}

          <div style={{ borderTop: `1px dashed ${C.green}40`, paddingTop: 8, marginTop: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: `1.5px solid ${C.purple}40`, borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: '1rem' }}>✨</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: C.purple }}>Claude · Final Synthesis</div>
                <div style={{ fontSize: '0.68rem', color: C.muted }}>Reads all 3 → best combined answer</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* EXTERNAL SOURCES */}
      <div>
        <div style={{ fontWeight: 800, fontSize: '0.85rem', color: C.blue, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, textAlign: 'center' }}>External Sources / API Calls</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

          {[
            { icon: '🤖', name: 'OpenAI API', sub: 'GPT-5.2', method: 'POST', url: 'https://api.openai.com/v1/chat/completions', purpose: 'ChatGPT structured response', color: C.gpt },
            { icon: '🟠', name: 'Anthropic API', sub: 'Claude Opus 4.6', method: 'POST', url: 'https://api.anthropic.com/v1/messages', purpose: 'Reasoning + final synthesis', color: C.claude },
            { icon: '🔵', name: 'Google Gemini API', sub: 'Gemini 3.1 Pro', method: 'POST', url: 'https://generativelanguage.googleapis.com/v1beta/...', purpose: 'Real-time knowledge response', color: C.gemini },
            { icon: '✨', name: 'Anthropic API', sub: 'Claude Synthesis', method: 'POST', url: 'https://api.anthropic.com/v1/messages', purpose: 'Synthesize all 3 responses', color: C.purple },
          ].map((api, i) => (
            <div key={i} style={{ background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ fontSize: '1.3rem', flexShrink: 0 }}>{api.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: api.color }}>{api.name}</div>
                <div style={{ fontSize: '0.68rem', color: C.muted }}>{api.sub}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <span style={{ background: api.method === 'POST' ? C.blue + '15' : C.green + '15', color: api.method === 'POST' ? C.blue : C.green, fontSize: '0.6rem', fontWeight: 800, padding: '1px 5px', borderRadius: 3 }}>{api.method}</span>
                  <span style={{ fontSize: '0.62rem', color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{api.url}</span>
                </div>
                <div style={{ fontSize: '0.68rem', color: C.dark, marginTop: 3 }}><strong>Purpose:</strong> {api.purpose}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* ── Results Aggregation ── */}
    <div style={{ maxWidth: 1280, margin: '1.5rem auto 0' }}>
      <Arrow dir="down" color={C.dark} style={{ justifyContent: 'center', marginBottom: 8 }} />
      <div style={{ background: '#fff', border: `2px solid ${C.dark}20`, borderRadius: 14, padding: '16px 20px' }}>
        <div style={{ fontWeight: 800, fontSize: '0.85rem', color: C.dark, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Results Aggregation</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {[
            { icon: '🤖', label: 'ChatGPT Response',   sub: 'from OpenAI API',    color: C.gpt },
            { icon: '🟠', label: 'Claude Response',    sub: 'from Anthropic API', color: C.claude },
            { icon: '🔵', label: 'Gemini Response',    sub: 'from Google API',    color: C.gemini },
            { icon: '✨', label: 'Claude Synthesis',   sub: 'Final combined answer', color: C.purple },
          ].map((r, i) => (
            <div key={i} style={{ textAlign: 'center', background: r.color + '0d', border: `1.5px solid ${r.color}30`, borderRadius: 10, padding: '12px 8px' }}>
              <div style={{ fontSize: '1.6rem', marginBottom: 6 }}>{r.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '0.78rem', color: r.color }}>{r.label}</div>
              <div style={{ fontSize: '0.68rem', color: C.muted, marginTop: 3 }}>{r.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* ── Output Modes ── */}
    <div style={{ maxWidth: 1280, margin: '1.25rem auto 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
      <Arrow dir="down" color={C.dark} style={{ justifyContent: 'center', gridColumn: '1 / -1', marginBottom: 0 }} />

      {/* Battle Mode */}
      <div style={{ background: '#fffbeb', border: `2px solid #f59e0b`, borderRadius: 14, padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: '1.1rem' }}>⚡</span>
          <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.04em' }}>A. Battle Mode</span>
          <span style={{ fontSize: '0.68rem', color: '#92400e', marginLeft: 4 }}>(Shows all model responses + synthesis)</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[
            { icon: '🤖', label: 'ChatGPT Card',   color: C.gpt },
            { icon: '🟠', label: 'Claude Card',    color: C.claude },
            { icon: '🔵', label: 'Gemini Card',    color: C.gemini },
            { icon: '✨', label: 'Synthesis Card', color: C.purple },
          ].map((c, i) => (
            <div key={i} style={{ background: '#fff', border: `1.5px solid ${c.color}40`, borderRadius: 8, padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.1rem' }}>{c.icon}</div>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: c.color, marginTop: 3, lineHeight: 1.3 }}>{c.label}</div>
              <div style={{ height: 2, background: c.color + '20', borderRadius: 1, margin: '4px 0' }} />
              <div style={{ height: 2, background: c.color + '10', borderRadius: 1 }} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, background: '#fff', border: `1px solid #f59e0b40`, borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.8rem' }}>💬</span>
          <span style={{ fontSize: '0.72rem', color: '#92400e', fontWeight: 600 }}>All 3 responses + Final Synthesis streamed to chat</span>
        </div>
      </div>

      {/* Invisible Mode */}
      <div style={{ background: '#f0fdf4', border: `2px solid ${C.green}`, borderRadius: 14, padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: '1.1rem' }}>👁</span>
          <span style={{ fontWeight: 800, fontSize: '0.88rem', color: C.green, textTransform: 'uppercase', letterSpacing: '0.04em' }}>B. Invisible Mode</span>
          <span style={{ fontSize: '0.68rem', color: '#065f46', marginLeft: 4 }}>(Clean synthesis only)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, background: '#fff', border: `1.5px solid ${C.purple}40`, borderRadius: 8, padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem' }}>✨</div>
            <div style={{ fontWeight: 700, fontSize: '0.75rem', color: C.purple, marginTop: 4 }}>Claude Final Synthesis</div>
            <div style={{ fontSize: '0.68rem', color: C.muted, marginTop: 2 }}>Best of all 3 — clean output</div>
          </div>
          <div style={{ fontSize: '1.2rem', color: C.green }}>→</div>
          <div style={{ flex: 1, background: '#fff', border: `1.5px solid ${C.green}40`, borderRadius: 8, padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem' }}>💬</div>
            <div style={{ fontWeight: 700, fontSize: '0.75rem', color: C.green, marginTop: 4 }}>Streamed to Chat</div>
            <div style={{ fontSize: '0.68rem', color: C.muted, marginTop: 2 }}>No individual model cards shown</div>
          </div>
        </div>
        <div style={{ marginTop: 10, background: '#fff', border: `1px solid ${C.green}40`, borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.8rem' }}>🔒</span>
          <span style={{ fontSize: '0.72rem', color: '#065f46', fontWeight: 600 }}>API keys stored in browser only — never sent to Excelliq servers</span>
        </div>
      </div>
    </div>

    {/* ── API Summary + Legend ── */}
    <div style={{ maxWidth: 1280, margin: '1.5rem auto 0', display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'start' }}>

      {/* API Summary */}
      <div style={{ background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 14, padding: '14px 16px' }}>
        <div style={{ fontWeight: 800, fontSize: '0.78rem', color: C.red, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>API Summary</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
          {[
            { icon: '🤖', name: 'OpenAI API',    desc: 'ChatGPT response generation', note: '(Used in parallel call)' },
            { icon: '🟠', name: 'Anthropic API', desc: 'Claude response + synthesis',  note: '(Used twice — response & synthesis)' },
            { icon: '🔵', name: 'Google API',    desc: 'Gemini response generation',   note: '(Used in parallel call)' },
            { icon: '🔄', name: 'n8n Webhook',   desc: 'Orchestrates all API calls',   note: '(Central workflow engine)' },
          ].map((a, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 4 }}>
              <div style={{ fontSize: '1.5rem' }}>{a.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '0.74rem', color: C.dark }}>{a.name}</div>
              <div style={{ fontSize: '0.68rem', color: C.muted, lineHeight: 1.4 }}>{a.desc}</div>
              <div style={{ fontSize: '0.62rem', color: C.muted, fontStyle: 'italic' }}>{a.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend + Notes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', minWidth: 220 }}>
          <div style={{ fontWeight: 800, fontSize: '0.78rem', color: C.dark, marginBottom: 8 }}>LEGEND</div>
          {[
            { line: 'solid', color: C.dark, label: 'Data Flow' },
            { line: 'solid', color: C.red,  label: 'API Call' },
            { line: 'dashed',color: C.blue, label: 'Tool Call (From n8n)' },
            { line: 'dashed',color: C.green,label: 'Results Flow (Back)' },
          ].map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <div style={{ width: 28, height: 0, borderTop: `2px ${l.line} ${l.color}` }} />
              <span style={{ fontSize: '0.7rem', color: C.dark }}>{l.label}</span>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 6, paddingTop: 6 }}>
            {[['POST', C.blue], ['GET', C.green]].map(([m, c]) => (
              <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ background: c + '15', color: c, fontSize: '0.62rem', fontWeight: 800, padding: '1px 6px', borderRadius: 3 }}>{m}</span>
                <span style={{ fontSize: '0.7rem', color: C.dark }}>HTTP {m} Request</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fffbeb', border: `1.5px solid #f59e0b40`, borderRadius: 12, padding: '12px 14px', minWidth: 220 }}>
          <div style={{ fontWeight: 800, fontSize: '0.78rem', color: '#92400e', marginBottom: 8 }}>NOTES</div>
          {[
            'n8n webhook orchestrates all 3 LLM API calls',
            'All 3 models respond in ~12s via parallel calls',
            'Claude reads all responses and synthesizes the best answer',
            'Final answer is streamed back to the Excelliq chat UI',
            'API keys are stored only in the user\'s browser',
          ].map((n, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              <span style={{ color: '#b45309', fontSize: '0.68rem', flexShrink: 0 }}>•</span>
              <span style={{ fontSize: '0.68rem', color: '#78350f', lineHeight: 1.4 }}>{n}</span>
            </div>
          ))}
        </div>
      </div>
    </div>

  </div>
);

export default ArchitectureDiagram;
