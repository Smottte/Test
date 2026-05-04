import React, { useEffect, useRef, useState } from 'react';

const defaultApiBase = `${window.location.protocol}//${window.location.hostname}:8000`;
const API = process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL || defaultApiBase;

const bubble = {
  user: { alignSelf: 'flex-end', background: '#111827', color: '#fff' },
  assistant: { alignSelf: 'flex-start', background: '#f3f4f6', color: '#111827' },
  error: { alignSelf: 'flex-start', background: '#fee2e2', color: '#991b1b' }
};

function formatIdeas(ideas) {
  if (!Array.isArray(ideas) || ideas.length === 0) return 'No ideas returned.';
  return ideas.map((idea, idx) => {
    const used = idea.ingredients_used || '[]';
    const missing = idea.missing_ingredients || '[]';
    return `${idx + 1}. ${idea.title}\n${idea.description}\nUse: ${used}\nMissing: ${missing}`;
  }).join('\n\n');
}

export default function App() {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! I am your local pantry dinner assistant. Ask me for a meal idea.' }
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [mealType, setMealType] = useState('dinner');
  const [weekly, setWeekly] = useState(false);
  const [pantry, setPantry] = useState([]);
  const [showPantry, setShowPantry] = useState(false);
  const [uploadNote, setUploadNote] = useState('');
  const inputRef = useRef(null);
  const endRef = useRef(null);

  const loadPantry = async () => {
    const res = await fetch(`${API}/pantry`);
    if (!res.ok) throw new Error('Failed to load pantry');
    setPantry(await res.json());
  };

  useEffect(() => {
    loadPantry().catch((e) => setMessages((m) => [...m, { role: 'error', text: e.message }]));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const autoResize = () => {
    if (!inputRef.current) return;
    inputRef.current.style.height = 'auto';
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 220)}px`;
  };

  const sendMessage = async () => {
    const prompt = input.trim();
    if (!prompt || isThinking) return;

    setMessages((m) => [...m, { role: 'user', text: prompt }]);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = '44px';
    setIsThinking(true);

    try {
      const payload = { weekly, meal_type: mealType, prompt };
      const res = await fetch(`${API}/ideas/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `Generate failed (${res.status})`);

      const ideasRes = await fetch(`${API}/ideas`);
      const ideas = ideasRes.ok ? await ideasRes.json() : data;
      const latest = Array.isArray(ideas) ? ideas.slice(0, weekly ? 7 : 3) : data;

      setMessages((m) => [...m, { role: 'assistant', text: formatIdeas(latest) }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'error', text: e.message || 'Failed to generate ideas.' }]);
    } finally {
      setIsThinking(false);
    }
  };

  const onInputKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const onUploadPlaceholder = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadNote(`Selected ${file.name}. Image upload pipeline is ready to wire to /inventory/from-image.`);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', color: '#111827', display: 'flex', flexDirection: 'column' }}>
      <header style={{ borderBottom: '1px solid #e5e7eb', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <strong>Pantry AI Chat</strong>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setShowPantry((v) => !v)} style={{ borderRadius: 999, border: '1px solid #d1d5db', padding: '6px 12px', background: '#fff' }}>View Pantry ({pantry.length})</button>
          <label style={{ borderRadius: 999, border: '1px solid #d1d5db', padding: '6px 12px', background: '#fff', cursor: 'pointer' }}>
            Upload Pantry Photo
            <input type='file' accept='image/*' onChange={onUploadPlaceholder} style={{ display: 'none' }} />
          </label>
        </div>
      </header>

      {showPantry && <aside style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {pantry.map((i) => <li key={i.id}>{i.name} — {i.quantity} {i.unit} (exp {i.expiration_date})</li>)}
        </ul>
      </aside>}
      {uploadNote && <div style={{ padding: '8px 16px', fontSize: 13, color: '#4b5563' }}>{uploadNote}</div>}

      <main style={{ flex: 1, width: '100%', maxWidth: 900, margin: '0 auto', padding: '20px 14px 110px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{ maxWidth: '85%', borderRadius: 16, padding: '12px 14px', whiteSpace: 'pre-wrap', lineHeight: 1.45, ...bubble[msg.role] }}>
              {msg.text}
            </div>
          ))}
          {isThinking && <div style={{ ...bubble.assistant, maxWidth: '85%', borderRadius: 16, padding: '12px 14px' }}>Thinking...</div>}
          <div ref={endRef} />
        </div>
      </main>

      <footer style={{ position: 'fixed', left: 0, right: 0, bottom: 0, borderTop: '1px solid #e5e7eb', background: '#fff' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: 12 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <select value={mealType} onChange={(e) => setMealType(e.target.value)}>
              <option value='breakfast'>breakfast</option><option value='lunch'>lunch</option><option value='dinner'>dinner</option><option value='dessert'>dessert</option>
            </select>
            <label><input type='checkbox' checked={weekly} onChange={(e) => setWeekly(e.target.checked)} /> Weekly plan</label>
            <span style={{ fontSize: 12, color: '#6b7280' }}>API: {API}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResize(); }}
              onKeyDown={onInputKeyDown}
              placeholder='I want a high protein dinner with chicken and rice.'
              style={{ flex: 1, minHeight: 44, maxHeight: 220, resize: 'none', borderRadius: 14, border: '1px solid #d1d5db', padding: '10px 12px', font: 'inherit' }}
            />
            <button onClick={sendMessage} disabled={isThinking} style={{ height: 44, borderRadius: 12, border: 'none', padding: '0 16px', background: '#111827', color: '#fff', opacity: isThinking ? 0.6 : 1 }}>
              {isThinking ? '...' : 'Send'}
            </button>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>Enter = send, Shift+Enter = new line.</div>
        </div>
      </footer>
    </div>
  );
}
