import React, { useEffect, useRef, useState } from 'react';
import './App.css';

const API = process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;
const ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf';
const suggestions = [
  'What can I make with what I have?',
  'Give me 3 quick dinner options.',
  'Suggest something high-protein.',
  'What can I cook in 20 minutes?'
];

export default function App() {
  const [messages, setMessages] = useState([{ role: 'assistant', text: 'Welcome to Cheffie 👋 I can help you plan meals from your real pantry.' }]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [pantry, setPantry] = useState([]);
  const [analysisType, setAnalysisType] = useState('pantry_photo');
  const [preview, setPreview] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingStep, setAnalyzingStep] = useState('');
  const [started, setStarted] = useState(false);
  const chatRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  const loadPantry = async () => { try { const r = await fetch(`${API}/pantry`); if (r.ok) setPantry(await r.json()); } catch {} };
  useEffect(() => { loadPantry(); }, []);
  const nearBottom = () => { const el = chatRef.current; return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120; };
  const scrollToBottom = () => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }); setShowJump(false); };
  useEffect(() => { if (nearBottom()) scrollToBottom(); else setShowJump(true); }, [messages]);

  const send = async (preset) => {
    const prompt = (preset ?? input).trim();
    if (!prompt || isThinking) return;
    setStarted(true);
    setMessages((m) => [...m, { role: 'user', text: prompt }, { role: 'assistant', text: 'Thinking...' }]);
    setInput(''); setIsThinking(true);
    try {
      const res = await fetch(`${API}/ideas/stream`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader(); const dec = new TextDecoder(); let full = '';
      while (true) { const { value, done } = await reader.read(); if (done) break; full += dec.decode(value, { stream: true }); setMessages((m) => { const c=[...m]; c[c.length-1]={ role:'assistant', text: full }; return c; }); }
    } catch (e) {
      setMessages((m) => { const c=[...m]; if (c[c.length-1]?.text==='Thinking...') c.pop(); return [...c,{role:'error',text:String(e.message||e)}]; });
    } finally { setIsThinking(false); }
  };

  const onPickFile = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : '');
    setAnalyzing(true); setAnalyzingStep('Uploading receipt...');
    setMessages((m)=>[...m,{role:'assistant',text:`Analyzing ${analysisType === 'receipt' ? 'receipt' : 'pantry photo'}...`}]);
    try {
      if (analysisType === 'receipt') setAnalyzingStep('Reading receipt...');
      const endpoint = analysisType === 'receipt' ? '/inventory/from-receipt' : '/inventory/from-image';
      if (analysisType === 'receipt') setAnalyzingStep('Finding grocery items...');
      const b64 = f.type === 'application/pdf' ? null : await new Promise((resolve) => { const r = new FileReader(); r.onload=()=>resolve(String(r.result).split(',')[1]); r.readAsDataURL(f); });
      const res = await fetch(`${API}${endpoint}`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ image_base64:b64, file_type:f.type==='application/pdf'?'pdf':'image', mime_type:f.type })});
      const data = await res.json(); if (!res.ok) throw new Error(data.detail || 'Parse failed');
      setAnalysis(data); setAnalyzingStep('Review detected items');
    } catch (err) {
      setMessages((m)=>[...m,{role:'error',text:`Upload failed: ${String(err.message || err)}`}]);
    } finally { setAnalyzing(false); e.target.value=''; }
  };

  return <div className='app'>
    <header className='header'>
      <div className='brand'><div className='logo'>🍽️</div><div><h1>Cheffie</h1><div className='sub'>Your pantry-first cooking assistant</div></div></div>
      <div className='sub'>Pantry items: {pantry.length}</div>
    </header>

    <main className='chat' ref={chatRef} onScroll={() => setShowJump(!nearBottom())}>
      {!started && <section className='welcome'><h3 style={{margin:'0 0 4px'}}>What should we cook today?</h3><div className='sub'>Start with one of these quick prompts.</div><div className='suggest'>{suggestions.map(s=><button key={s} onClick={()=>send(s)}>{s}</button>)}</div></section>}
      {pantry.length===0 && <div className='msg assistant'>Your pantry is empty. Add items manually, upload a pantry photo, or upload a receipt.</div>}
      {messages.map((m,i)=><div key={i} className={`msg ${m.role==='user'?'user':m.role==='error'?'error':'assistant'}`}>{m.text}</div>)}
      {showJump && <button className='jump' onClick={scrollToBottom}>Jump to latest</button>}
    </main>

    {analysis && <section className='panel'>
      <b>Review detected items</b>{preview && <img src={preview} alt='preview' style={{width:'100%',borderRadius:10,margin:'8px 0'}}/>}
      {(analysis.items||[]).map((it,idx)=><div key={idx} style={{display:'grid',gridTemplateColumns:'1fr 60px 70px 100px 120px',gap:6,margin:'8px 0'}}>
        <input value={it.name||''} onChange={(e)=>setAnalysis(a=>{const c={...a}; c.items[idx].name=e.target.value; return {...c};})}/><input value={it.quantity||1} onChange={(e)=>setAnalysis(a=>{const c={...a}; c.items[idx].quantity=e.target.value; return {...c};})}/><input value={it.unit||'count'} onChange={(e)=>setAnalysis(a=>{const c={...a}; c.items[idx].unit=e.target.value; return {...c};})}/><input value={it.category||''} onChange={(e)=>setAnalysis(a=>{const c={...a}; c.items[idx].category=e.target.value; return {...c};})}/><input value={it.expiration_date||''} onChange={(e)=>setAnalysis(a=>{const c={...a}; c.items[idx].expiration_date=e.target.value; return {...c};})}/>
      </div>)}
      <div style={{display:'flex',gap:8}}><button className='pill' onClick={async()=>{const r=await fetch(`${API}/inventory/confirm-import`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({import_type:analysis.import_type,items:analysis.items||[]})});const d=await r.json();setMessages(m=>[...m,{role:'assistant',text:`I added ${d.added||0} items to pantry.`}]);setAnalysis(null);loadPantry();}}>Confirm add</button><button className='pill' onClick={()=>setAnalysis(null)}>Cancel</button></div>
    </section>}

    <div className='composerWrap'><div className='composer'>
      <div className='actions'>
        <button className='pill' onClick={()=>{setAnalysisType('pantry_photo');fileRef.current?.click();}}>📷 Pantry Photo</button>
        <button className='pill' onClick={()=>{setAnalysisType('receipt');fileRef.current?.click();}}>🧾 Receipt</button>
        <button className='pill' onClick={async()=>{const r=await fetch(`${API}/pantry`,{method:'DELETE'});const d=await r.json();setMessages(m=>[...m,{role:'assistant',text:`Cleared pantry (${d.deleted||0}).`}]);loadPantry();}}>Clear pantry</button>
        {analyzing && <span className='sub'>{analyzingStep || 'Analyzing...'}</span>}
      </div>
      <input ref={fileRef} type='file' accept={ACCEPT} onChange={onPickFile} style={{display:'none'}}/>
      <textarea ref={inputRef} value={input} onChange={(e)=>{setInput(e.target.value);e.target.style.height='auto';e.target.style.height=`${Math.min(e.target.scrollHeight,220)}px`;}} onKeyDown={(e)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}} placeholder='Ask Cheffie what you can make...' />
      <div className='row'><span className='sub'>Enter to send • Shift+Enter for newline</span><button className='send' disabled={isThinking} onClick={()=>send()}>{isThinking?'Thinking…':'Send'}</button></div>
    </div></div>
  </div>;
}
