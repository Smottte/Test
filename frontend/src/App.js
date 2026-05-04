import React, { useEffect, useRef, useState } from 'react';

const defaultApiBase = `${window.location.protocol}//${window.location.hostname}:8000`;
const API = process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL || defaultApiBase;

const bubble = {
  user: { alignSelf: 'flex-end', background: '#111827', color: '#fff' },
  assistant: { alignSelf: 'flex-start', background: '#f5f7fb', color: '#111827' },
  error: { alignSelf: 'flex-start', background: '#fee2e2', color: '#991b1b' }
};

const byMeal = {
  breakfast: ['Quick high-protein eggs breakfast', 'Oatmeal + pantry fruit breakfast', 'Savory breakfast with rice and eggs'],
  lunch: ['Light pantry lunch with protein', 'Fast lunch bowl with what expires soon', 'Healthy lunch wrap ideas'],
  dinner: ['High protein dinner with chicken and rice', 'Use expiring veggies for dinner tonight', 'One-pan pantry dinner ideas']
};

const getTimeMeal = () => {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return 'breakfast';
  if (h >= 11 && h < 15) return 'lunch';
  return 'dinner';
};

export default function App() {
  const [messages, setMessages] = useState([{ role: 'assistant', text: 'Hi — I am your local pantry AI assistant. What would you like to cook?' }]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [pantry, setPantry] = useState([]);
  const [showPantry, setShowPantry] = useState(false);
  const [aiStatus, setAiStatus] = useState('Checking local model...');
  const [firstMessageSent, setFirstMessageSent] = useState(false);
  const [uploadNote, setUploadNote] = useState('');
  const [debugSource, setDebugSource] = useState('source: pending');

  const mealByTime = getTimeMeal();
  const inputRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/pantry`).then(r => r.json()).then(setPantry).catch(() => {});
    fetch(`${API}/ai/status`).then(r => r.json()).then((s) => {
      if (s.mode === 'ollama' && s.ollama_reachable) setAiStatus(`Model: ${s.model} via Ollama`);
      else setAiStatus(`Model error: ${s.model} unavailable`);
    }).catch(() => setAiStatus('Model status unavailable'));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const autoResize = () => {
    if (!inputRef.current) return;
    inputRef.current.style.height = 'auto';
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 220)}px`;
  };

  const send = async (overrideText) => {
    const prompt = (overrideText ?? input).trim();
    if (!prompt || isThinking) return;
    if (!firstMessageSent) setFirstMessageSent(true);

    setMessages((m) => [...m, { role: 'user', text: prompt }, { role: 'assistant', text: 'Thinking...' }]);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = '44px';
    setIsThinking(true);
    setDebugSource('source: streaming from Ollama chat endpoint');

    try {
      const res = await fetch(`${API}/ideas/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekly: false, meal_type: mealByTime, prompt })
      });
      if (!res.ok || !res.body) {
        const err = await res.text();
        throw new Error(err || `Stream failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk;
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: 'assistant', text: full };
          return copy;
        });
      }
      setDebugSource(`source: ollama-stream model label in header`);
    } catch (e) {
      setMessages((m) => {
        const copy = [...m];
        if (copy[copy.length - 1]?.text === 'Thinking...') copy.pop();
        return [...copy, { role: 'error', text: e.message || 'Generation failed.' }];
      });
      setDebugSource('source: stream error (no demo fallback used)');
    } finally {
      setIsThinking(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return <div style={{ minHeight: '100vh', background: '#fbfbfc', color: '#101828', display: 'flex', flexDirection: 'column' }}>
    <header style={{ padding: '14px 18px', borderBottom: '1px solid #eaecf0', display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontWeight: 700 }}>Pantry AI Assistant</div>
        <div style={{ fontSize: 12, color: '#667085' }}>{aiStatus}</div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setShowPantry((v) => !v)} style={{ borderRadius: 999, border: '1px solid #d0d5dd', background: '#fff', padding: '6px 12px' }}>View Pantry</button>
        <label style={{ borderRadius: 999, border: '1px solid #d0d5dd', background: '#fff', padding: '6px 12px', cursor: 'pointer' }}>Upload Photo<input type='file' accept='image/*' style={{ display: 'none' }} onChange={(e)=>setUploadNote(e.target.files?.[0] ? 'Photo selected. Image inventory upload hook can be connected next.' : '')} /></label>
      </div>
    </header>

    {showPantry && <div style={{ padding: '10px 18px', background: '#fff', borderBottom: '1px solid #eaecf0' }}><ul style={{ margin: 0, paddingLeft: 20 }}>{pantry.map((p) => <li key={p.id}>{p.name} — {p.quantity} {p.unit}</li>)}</ul></div>}
    {uploadNote && <div style={{ padding: '8px 18px', fontSize: 12, color: '#475467' }}>{uploadNote}</div>}

    <main style={{ flex: 1, maxWidth: 860, width: '100%', margin: '0 auto', padding: '20px 14px 120px' }}>
      {!firstMessageSent && <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: '#667085', marginBottom: 10 }}>Suggested {mealByTime} prompts</div>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
          {byMeal[mealByTime].map((s) => <button key={s} onClick={() => send(s)} style={{ textAlign: 'left', borderRadius: 14, border: '1px solid #e4e7ec', background: '#fff', padding: '12px 14px', cursor: 'pointer' }}>{s}</button>)}
        </div>
      </div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((m, i) => <div key={i} style={{ maxWidth: '86%', borderRadius: 16, padding: '12px 14px', whiteSpace: 'pre-wrap', lineHeight: 1.45, ...bubble[m.role] }}>{m.text}</div>)}
        <div ref={endRef} />
      </div>
    </main>

    <footer style={{ position: 'fixed', left: 0, right: 0, bottom: 0, borderTop: '1px solid #eaecf0', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(4px)' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: 12 }}>
        <textarea ref={inputRef} value={input} onChange={(e) => { setInput(e.target.value); autoResize(); }} onKeyDown={onKeyDown} placeholder='Ask for a meal idea...' style={{ width: '100%', minHeight: 46, maxHeight: 220, resize: 'none', borderRadius: 14, border: '1px solid #d0d5dd', padding: '11px 12px', font: 'inherit' }} />
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#667085' }}>{debugSource}</span>
          <button onClick={() => send()} disabled={isThinking} style={{ borderRadius: 10, border: 'none', background: '#111827', color: '#fff', padding: '8px 16px', opacity: isThinking ? 0.6 : 1 }}>{isThinking ? 'Thinking…' : 'Send'}</button>
        </div>
      </div>
    </footer>
  </div>;
}
