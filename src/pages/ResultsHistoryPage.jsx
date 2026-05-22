import { useState, useRef, useEffect } from 'react';

const N8N_URL = 'https://n8n.kleza.io/webhook/bf39cd7e-9f1b-4b3e-98eb-8b746cd2b510/chat';

/* ── Inline markdown ──────────────────────────────────────────────────── */
const renderInline = (text, kp = 'i') =>
  String(text).split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
    const k = `${kp}-${i}`;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={k}>{part.slice(2,-2)}</strong>;
    if (part.startsWith('*')  && part.endsWith('*'))  return <em key={k}>{part.slice(1,-1)}</em>;
    if (part.startsWith('`')  && part.endsWith('`') && part.length > 2)
      return <code key={k} style={{ background:'#f3f4f6', padding:'1px 5px', borderRadius:'4px', fontSize:'0.87em', fontFamily:'monospace' }}>{part.slice(1,-1)}</code>;
    const lm = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (lm) return <a key={k} href={lm[2]} target="_blank" rel="noopener noreferrer" style={{ color:'#2563eb', textDecoration:'underline' }}>{lm[1]}</a>;
    return part;
  });

const isTableSep = l => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(l);
const parseRow   = l => l.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(c => c.trim());

const MD = ({ text }) => {
  const lines = String(text || '').replace(/\r\n/g,'\n').split('\n');
  const blocks = []; let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t) { i++; continue; }
    if (/^---+$/.test(t)) { blocks.push(<hr key={`hr${i}`} style={{ border:0, borderTop:'1px solid #e5e7eb', margin:'10px 0' }}/>); i++; continue; }
    if (t.startsWith('```')) {
      const cl=[]; i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) { cl.push(lines[i]); i++; } i++;
      blocks.push(<pre key={`cb${i}`} style={{ background:'#1a1a1a', color:'#e5e7eb', borderRadius:'8px', padding:'12px 14px', overflowX:'auto', fontSize:'0.8rem', lineHeight:1.6, margin:'8px 0', fontFamily:'monospace' }}><code>{cl.join('\n')}</code></pre>);
      continue;
    }
    const hm = t.match(/^(#{1,4})\s+(.+)$/);
    if (hm) {
      const lvl = hm[1].length;
      blocks.push(<div key={`h${i}`} style={{ margin: lvl===1?'4px 0 8px':'14px 0 5px', fontSize: lvl===1?'1.05rem':lvl===2?'0.95rem':'0.88rem', fontWeight:700, color:'#1c1c1c', letterSpacing:'-0.01em', lineHeight:1.35 }}>{renderInline(hm[2],`h${i}`)}</div>);
      i++; continue;
    }
    if (t.includes('|') && lines[i+1] && isTableSep(lines[i+1])) {
      const headers = parseRow(t); const rows = []; i+=2;
      while (i < lines.length && lines[i].trim().includes('|')) { rows.push(parseRow(lines[i])); i++; }
      blocks.push(
        <div key={`tbl${i}`} style={{ overflowX:'auto', margin:'8px 0' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.84rem' }}>
            <thead><tr>{headers.map((c,idx)=><th key={idx} style={{ textAlign:'left', padding:'7px 9px', border:'1px solid #e5e7eb', background:'#f9fafb', fontWeight:700, color:'#111827' }}>{renderInline(c,`th${idx}`)}</th>)}</tr></thead>
            <tbody>{rows.map((r,ri)=><tr key={ri}>{headers.map((_,ci)=><td key={ci} style={{ padding:'7px 9px', border:'1px solid #e5e7eb', verticalAlign:'top' }}>{renderInline(r[ci]||'',`td${ri}-${ci}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ); continue;
    }
    if (/^([-*]|\d+\.)\s+/.test(t)) {
      const ordered = /^\d+\./.test(t); const items = [];
      while (i < lines.length && /^([-*]|\d+\.)\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^([-*]|\d+\.)\s+/,'')); i++; }
      const L = ordered ? 'ol' : 'ul';
      blocks.push(<L key={`lst${i}`} style={{ margin:'5px 0 10px', paddingLeft:'1.3rem' }}>{items.map((item,idx)=><li key={idx} style={{ margin:'3px 0', lineHeight:1.7 }}>{renderInline(item,`li${i}-${idx}`)}</li>)}</L>);
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^#{1,4}\s/.test(lines[i].trim()) && !/^---+$/.test(lines[i].trim()) && !/^([-*]|\d+\.)\s/.test(lines[i].trim()) && !(lines[i].trim().includes('|') && lines[i+1] && isTableSep(lines[i+1]))) { para.push(lines[i].trim()); i++; }
    blocks.push(<p key={`p${i}`} style={{ margin:'0 0 10px', color:'#2d2d2d', lineHeight:1.75 }}>{para.map((l,idx)=><span key={idx}>{renderInline(l,`p${i}-${idx}`)}{idx<para.length-1&&<br/>}</span>)}</p>);
  }
  return <div>{blocks}</div>;
};

/* ── Copy button ──────────────────────────────────────────────────────── */
const CopyBtn = ({ text }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text||'').then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),1600); }); }}
      style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'4px 10px', borderRadius:'7px', border:'1px solid rgba(0,0,0,0.08)', background: copied?'#f0fdf4':'#fff', color: copied?'#16a34a':'#6b7280', fontSize:'0.7rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}
    >
      {copied
        ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      }
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
};

/* ── Divider with label ───────────────────────────────────────────────── */
const StageDivider = ({ label, color = '#6b7280' }) => (
  <div style={{ display:'flex', alignItems:'center', gap:'8px', margin:'4px 0 12px' }}>
    <div style={{ height:'1px', flex:1, background:'rgba(0,0,0,0.07)' }} />
    <span style={{ fontSize:'0.68rem', fontWeight:700, color, textTransform:'uppercase', letterSpacing:'0.07em', whiteSpace:'nowrap' }}>{label}</span>
    <div style={{ height:'1px', flex:1, background:'rgba(0,0,0,0.07)' }} />
  </div>
);

/* ── Stage-1 side-by-side model cards ────────────────────────────────── */
const ModelCards = ({ openai, gemini, claude }) => {
  const cards = [
    { key:'openai', name:'ChatGPT', color:'#10a37f', text: openai },
    { key:'gemini', name:'Gemini',  color:'#4285f4', text: gemini },
    { key:'claude', name:'Claude',  color:'#d97757', text: claude },
  ].filter(c => c.text);
  if (!cards.length) return null;
  return (
    <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', alignItems:'flex-start' }}>
      {cards.map(card => (
        <div key={card.key} style={{ flex:1, minWidth:'200px', border:`1px solid ${card.color}25`, borderRadius:'14px', overflow:'hidden', background:'#fff', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ padding:'9px 14px', background:`${card.color}0a`, borderBottom:`1px solid ${card.color}18`, display:'flex', alignItems:'center', gap:'8px' }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:card.color, flexShrink:0 }} />
            <span style={{ fontWeight:600, fontSize:'0.83rem', color:'#1c1c1c', letterSpacing:'-0.01em' }}>{card.name}</span>
            <span style={{ marginLeft:'auto', fontSize:'0.65rem', padding:'2px 8px', borderRadius:'10px', fontWeight:600, background:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0' }}>Done</span>
          </div>
          <div style={{ padding:'14px 16px', fontSize:'0.88rem', lineHeight:1.72, color:'#2d2d2d', maxHeight:'300px', overflowY:'auto' }}>
            <MD text={card.text} />
            <div style={{ marginTop:'10px' }}><CopyBtn text={card.text} /></div>
          </div>
        </div>
      ))}
    </div>
  );
};

/* ── Follow-up pair ───────────────────────────────────────────────────── */
const FollowUpPair = ({ fu }) => {
  const hasStage1 = fu.openai || fu.gemini || fu.claude;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
      <div style={{ alignSelf:'flex-end', maxWidth:'72%', background:'#1c1c1c', color:'#f5f5f5', borderRadius:'14px 14px 4px 14px', padding:'10px 14px', fontSize:'0.9rem', lineHeight:1.65, whiteSpace:'pre-wrap', letterSpacing:'-0.01em' }}>
        {fu.question}
      </div>
      {hasStage1 && (
        <ModelCards openai={fu.openai} gemini={fu.gemini} claude={fu.claude} />
      )}
      <div style={{ display:'flex', gap:'10px', alignItems:'flex-start' }}>
        <div style={{ width:28, height:28, borderRadius:'50%', background:'#d97757', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.72rem', fontWeight:700, flexShrink:0 }}>C</div>
        <div style={{ flex:1, minWidth:0, background:'#fff', border:'1.5px solid rgba(217,119,87,0.2)', borderRadius:'4px 14px 14px 14px', padding:'14px 18px', boxShadow:'0 2px 12px rgba(217,119,87,0.08)', fontSize:'0.9rem', lineHeight:1.78, color:'#1c1c1c' }}>
          <MD text={fu.synthesis || fu.answer} />
          <div style={{ marginTop:'10px', display:'flex', alignItems:'center', gap:'8px' }}>
            {fu.elapsed && <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', fontSize:'0.72rem', color:'#9ca3af', background:'#f3f4f6', padding:'3px 8px', borderRadius:'6px', fontWeight:500 }}>⏱ {fu.elapsed}s</span>}
            <CopyBtn text={fu.synthesis || fu.answer} />
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Main page ────────────────────────────────────────────────────────── */
const ResultsHistoryPage = ({ history = [], selectedId, onFollowUpComplete }) => {
  const item = history.find(h => h.id === selectedId) || null;

  const [followUp,       setFollowUp]       = useState('');
  const [followUpStatus, setFollowUpStatus] = useState('idle');
  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => { setFollowUp(''); setFollowUpStatus('idle'); }, [selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [item?.followUps?.length]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    el.style.overflowY = el.scrollHeight > 160 ? 'auto' : 'hidden';
  }, [followUp]);

  const handleFollowUp = async () => {
    if (!item || !followUp.trim() || followUpStatus === 'running') return;
    const question = followUp.trim();
    setFollowUp('');
    setFollowUpStatus('running');
    const t0 = Date.now();

    const claudeText = item.responses?.claude || '';
    const contextualInput = [
      `Original question: ${item.prompt}`,
      `Previous answer: ${claudeText}`,
      `New follow-up: ${question}`,
    ].filter(Boolean).join('\n\n');

    try {
      const res = await fetch(N8N_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatInput: contextualInput, selectedModels: ['openai', 'gemini', 'claude'], deepResearch: false }),
      });
      const data = await res.json();
      const raw  = Array.isArray(data) ? data[0] : data;
      const answer  = raw.output || raw.claude || raw.anthropic || 'No response.';
      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
      if (onFollowUpComplete) onFollowUpComplete({ historyId: item.id, question, answer, elapsed });
    } catch (e) {
      if (onFollowUpComplete) onFollowUpComplete({ historyId: item.id, question, answer: `⚠️ Error: ${e.message}` });
    } finally {
      setFollowUpStatus('idle');
    }
  };

  /* Empty state */
  if (!item) return (
    <div style={{ position:'fixed', top:0, bottom:0, left:'240px', right:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#f5f4f0', gap:'12px', color:'#c4bdb6' }}>
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity:0.4 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span style={{ fontSize:'0.9rem', fontWeight:500 }}>Select a conversation from the sidebar</span>
    </div>
  );

  const { prompt, responses = {}, followUps = [], elapsed } = item;
  const gptText     = responses.openai || '';
  const geminiText  = responses.gemini || '';
  const stage1Claude = responses.stage1Claude || '';
  const claudeSynth = responses.claude || '';

  return (
    <div style={{ position:'fixed', top:0, bottom:0, left:'240px', right:0, display:'flex', flexDirection:'column', background:'#f5f4f0', fontFamily:'inherit' }}>

      {/* ── Scrollable conversation body ── */}
      <div style={{ flex:1, overflowY:'auto', padding:'28px 2.5rem 12px', display:'flex', flexDirection:'column', gap:'20px', maxWidth:'960px', width:'100%', margin:'0 auto', boxSizing:'border-box' }}>

        {/* User prompt bubble */}
        <div style={{ alignSelf:'flex-end', maxWidth:'72%', background:'#1c1c1c', color:'#f5f5f5', borderRadius:'16px 16px 4px 16px', padding:'11px 15px', fontSize:'0.92rem', lineHeight:1.65, whiteSpace:'pre-wrap', letterSpacing:'-0.01em' }}>
          {prompt}
        </div>

        {/* Individual model responses */}
        {(gptText || geminiText || stage1Claude) && (
          <ModelCards openai={gptText} gemini={geminiText} claude={stage1Claude} />
        )}

        {/* Claude synthesis */}
        {claudeSynth && (
          <>
            <div style={{ display:'flex', gap:'11px', alignItems:'flex-start' }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:'#d97757', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.72rem', fontWeight:700, flexShrink:0 }}>C</div>
              <div style={{ flex:1, minWidth:0, background:'#fff', border:'1.5px solid rgba(217,119,87,0.2)', borderRadius:'4px 16px 16px 16px', padding:'16px 20px', boxShadow:'0 2px 12px rgba(217,119,87,0.08)', fontSize:'0.92rem', lineHeight:1.78, color:'#1c1c1c', letterSpacing:'-0.01em' }}>
                <MD text={claudeSynth} />
                <div style={{ marginTop:'12px', display:'flex', alignItems:'center', gap:'8px' }}>
                  {elapsed && <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', fontSize:'0.72rem', color:'#9ca3af', background:'#f3f4f6', padding:'3px 8px', borderRadius:'6px', fontWeight:500 }}>⏱ {elapsed}s</span>}
                  <CopyBtn text={claudeSynth} />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Follow-up pairs */}
        {followUps.map((fu, idx) => <FollowUpPair key={idx} fu={fu} />)}

        {/* Follow-up loading */}
        {followUpStatus === 'running' && (
          <div style={{ display:'flex', gap:'10px', alignItems:'flex-start' }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background:'#d97757', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.72rem', fontWeight:700, flexShrink:0 }}>C</div>
            <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.07)', borderRadius:'4px 14px 14px 14px', padding:'16px 20px', boxShadow:'0 1px 4px rgba(0,0,0,0.04)', display:'flex', alignItems:'center', gap:'5px' }}>
              {[0, 0.28, 0.56].map((d, i) => <span key={i} style={{ width:8, height:8, borderRadius:'50%', background:'#d97757', display:'inline-block', animation:'blink 1.1s ease infinite', animationDelay:`${d}s` }} />)}
            </div>
          </div>
        )}

        <div ref={bottomRef} style={{ height:1 }} />
      </div>

      {/* ── Follow-up composer ── */}
      <div style={{ flexShrink:0, padding:'0 2.5rem 20px', maxWidth:'960px', width:'100%', margin:'0 auto', boxSizing:'border-box' }}>
        <div style={{ background:'#fff', border:'1.5px solid rgba(0,0,0,0.1)', borderRadius:'16px', boxShadow:'0 4px 20px rgba(0,0,0,0.07)', overflow:'hidden' }}>
          <textarea
            ref={textareaRef}
            value={followUp}
            onChange={e => setFollowUp(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleFollowUp(); } }}
            placeholder="Continue the conversation… (Shift+Enter for new line)"
            disabled={followUpStatus === 'running'}
            rows={2}
            style={{ width:'100%', display:'block', background:'transparent', border:'none', outline:'none', resize:'none', overflowY:'hidden', padding:'14px 18px 8px', color:'#1a1a1a', fontSize:'0.96rem', lineHeight:'1.55', fontFamily:'inherit' }}
          />
          <div style={{ display:'flex', alignItems:'center', padding:'8px 12px 12px', gap:'8px' }}>
            <span style={{ fontSize:'0.7rem', color:'#c4bdb6', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              Continuing: <em style={{ fontStyle:'normal', color:'#a8a29e' }}>{prompt.length > 55 ? prompt.slice(0,55)+'…' : prompt}</em>
            </span>
            {followUpStatus === 'running' ? (
              <div style={{ width:34, height:34, borderRadius:'50%', background:'#ef4444', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 0 3px rgba(239,68,68,0.2)' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="white"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
              </div>
            ) : (
              <button
                onClick={handleFollowUp}
                disabled={!followUp.trim()}
                style={{ width:34, height:34, borderRadius:'50%', border:'none', background: followUp.trim() ? '#1a1a1a' : '#e5e7eb', color: followUp.trim() ? '#fff' : '#9ca3af', display:'flex', alignItems:'center', justifyContent:'center', cursor: followUp.trim() ? 'pointer' : 'not-allowed', flexShrink:0, transition:'background 0.15s' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsHistoryPage;
