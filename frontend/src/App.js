import React, { useEffect, useRef, useState } from 'react';

const API = process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;
const ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf';

export default function App() {
  const [messages, setMessages] = useState([{ role: 'assistant', text: 'Hi — ask me what to cook, or upload pantry/receipt images.' }]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analysisType, setAnalysisType] = useState('pantry_photo');
  const [preview, setPreview] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const chatRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  const nearBottom = () => {
    const el = chatRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const scrollToBottom = () => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }); setShowJump(false); };

  useEffect(() => {
    if (nearBottom()) scrollToBottom(); else setShowJump(true);
  }, [messages]);

  const onChatScroll = () => setShowJump(!nearBottom());

  const send = async () => {
    const prompt = input.trim();
    if (!prompt || isThinking) return;
    setMessages((m) => [...m, { role: 'user', text: prompt }, { role: 'assistant', text: 'Thinking...' }]);
    setInput('');
    setIsThinking(true);

    try {
      const res = await fetch(`${API}/ideas/stream`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader(); const dec = new TextDecoder(); let full = '';
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        full += dec.decode(value, { stream: true });
        setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: 'assistant', text: full }; return c; });
      }
    } catch (e) {
      setMessages((m) => { const c=[...m]; if (c[c.length-1]?.text==='Thinking...') c.pop(); return [...c,{role:'error',text:String(e.message||e)}]; });
    } finally { setIsThinking(false); }
  };

  const toBase64 = (file) => new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1]); r.readAsDataURL(file); });
  const openUpload = (type) => { setAnalysisType(type); fileRef.current?.click(); };

  const onPickFile = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : '');
    setAnalyzing(true);
    setMessages((m)=>[...m,{role:'assistant',text:`Analyzing ${analysisType === 'receipt' ? 'receipt' : 'pantry photo'}...`}]);
    try {
      if (f.type === 'application/pdf') {
        if (analysisType !== 'receipt') throw new Error('PDF supported only for receipt upload.');
        const res = await fetch(`${API}/inventory/from-receipt`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ file_type:'pdf' })});
        const data = await res.json(); if (!res.ok) throw new Error(data.detail || 'Receipt parse failed');
        setAnalysis(data);
      } else {
        const b64 = await toBase64(f);
        const endpoint = analysisType === 'receipt' ? '/inventory/from-receipt' : '/inventory/from-image';
        const res = await fetch(`${API}${endpoint}`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ image_base64:b64, file_type:'image' })});
        const data = await res.json(); if (!res.ok) throw new Error(data.detail || 'Image parse failed');
        setAnalysis(data);
      }
    } catch (err) {
      setMessages((m)=>[...m,{role:'error',text:String(err.message || err)}]);
    } finally { setAnalyzing(false); e.target.value=''; }
  };

  const confirmImport = async () => {
    const res = await fetch(`${API}/inventory/confirm-import`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ import_type: analysis?.import_type, items: analysis?.items || [] }) });
    const data = await res.json();
    if (!res.ok) return setMessages((m)=>[...m,{role:'error',text:data.detail || 'Import failed'}]);
    setMessages((m)=>[...m,{role:'assistant',text:`I added ${data.added} items from your ${analysis?.import_type === 'receipt' ? 'receipt' : 'photo'} to the pantry.`}]);
    setAnalysis(null); setPreview('');
  };

  return <div style={{height:'100vh',display:'flex',flexDirection:'column',background:'#fafafa'}}>
    <header style={{padding:'10px 14px',borderBottom:'1px solid #e5e7eb'}}>Pantry AI Chat</header>
    <main ref={chatRef} onScroll={onChatScroll} style={{flex:1,overflowY:'auto',padding:'16px 14px 120px',maxWidth:900,width:'100%',margin:'0 auto'}}>
      {messages.map((m,i)=><div key={i} style={{maxWidth:'86%',margin:'0 0 10px auto',whiteSpace:'pre-wrap',padding:'10px 12px',borderRadius:14,background:m.role==='user'?'#111827':m.role==='error'?'#fee2e2':'#fff',color:m.role==='user'?'#fff':'#111'}}>{m.text}</div>)}
      {showJump && <button onClick={scrollToBottom} style={{position:'sticky',bottom:10,left:'50%',transform:'translateX(-50%)',border:'1px solid #ddd',borderRadius:999,padding:'6px 12px',background:'#fff'}}>Jump to latest</button>}
    </main>

    {analysis && <section style={{position:'fixed',right:12,bottom:108,width:360,maxHeight:'60vh',overflow:'auto',background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:12}}>
      <b>Review detected items</b>
      {preview && <img src={preview} alt='preview' style={{width:'100%',borderRadius:8,margin:'8px 0'}}/>}
      {(analysis.items||[]).map((it,idx)=><div key={idx} style={{display:'grid',gridTemplateColumns:'1fr 70px 70px',gap:6,margin:'8px 0'}}>
        <input value={it.name||''} onChange={(e)=>setAnalysis(a=>{const c={...a}; c.items[idx].name=e.target.value; return {...c};})}/>
        <input value={it.quantity||1} onChange={(e)=>setAnalysis(a=>{const c={...a}; c.items[idx].quantity=e.target.value; return {...c};})}/>
        <input value={it.unit||'count'} onChange={(e)=>setAnalysis(a=>{const c={...a}; c.items[idx].unit=e.target.value; return {...c};})}/>
      </div>)}
      <div style={{display:'flex',gap:8}}><button onClick={confirmImport}>Confirm add</button><button onClick={()=>setAnalysis(null)}>Cancel</button></div>
    </section>}

    <footer style={{position:'fixed',left:0,right:0,bottom:0,background:'#fff',borderTop:'1px solid #e5e7eb'}}>
      <div style={{maxWidth:900,margin:'0 auto',padding:10}}>
        <div style={{display:'flex',gap:8,marginBottom:8}}>
          <button onClick={()=>openUpload('pantry_photo')}>📷 Pantry Photo</button>
          <button onClick={()=>openUpload('receipt')}>🧾 Receipt</button>
          {analyzing && <span style={{fontSize:12}}>Analyzing...</span>}
        </div>
        <input ref={fileRef} type='file' accept={ACCEPT} onChange={onPickFile} style={{display:'none'}}/>
        <textarea ref={inputRef} value={input} onChange={(e)=>{setInput(e.target.value);e.target.style.height='auto';e.target.style.height=`${Math.min(e.target.scrollHeight,220)}px`;}} onKeyDown={(e)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}} style={{width:'100%',minHeight:44,maxHeight:220}} placeholder='Ask for a meal idea...'/>
      </div>
    </footer>
  </div>;
}
