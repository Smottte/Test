import React, { useEffect, useMemo, useState } from 'react';

const defaultApiBase = `${window.location.protocol}//${window.location.hostname}:8000`;
const API = process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL || defaultApiBase;

const photoFor = (hint) => {
  const map = {
    breakfast: 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=500',
    lunch: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
    dinner: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=500',
    dessert: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=500'
  };
  return map[hint] || map.dinner;
};

export default function App() {
  const [items, setItems] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [mealType, setMealType] = useState('dinner');
  const [customPrompt, setCustomPrompt] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [weekly, setWeekly] = useState(false);
  const [error, setError] = useState('');
  const [debugMsg, setDebugMsg] = useState('idle');

  const defaultType = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 11 && h < 14) return 'lunch';
    if (h >= 14 && h < 19) return 'dinner';
    if (h >= 19) return 'dessert';
    return 'breakfast';
  }, []);

  const load = async () => {
    const [pantryRes, ideasRes] = await Promise.all([fetch(`${API}/pantry`), fetch(`${API}/ideas`)]);
    if (!pantryRes.ok || !ideasRes.ok) throw new Error('Unable to load pantry or ideas.');
    setItems(await pantryRes.json());
    setIdeas(await ideasRes.json());
  };

  useEffect(() => {
    setMealType(defaultType);
    load().catch((e) => setError(e.message));
  }, [defaultType]);

  const handleGenerateSubmit = async (e) => {
    e.preventDefault();
    if (isGenerating) return;
    setError('');
    setFeedback('Generating ideas...');
    setDebugMsg('Preparing request');
    setIsGenerating(true);

    const payload = {
      weekly,
      meal_type: mealType,
      prompt: customPrompt.trim() ? customPrompt : null
    };

    console.log('POST /ideas/generate payload', payload);
    setDebugMsg(`POST ${API}/ideas/generate :: ${JSON.stringify(payload)}`);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90000);

    try {
      const res = await fetch(`${API}/ideas/generate`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });

      let data;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        throw new Error(data?.detail || `Generate failed (${res.status})`);
      }

      await load(); // refresh via GET /ideas per requirement
      const count = Array.isArray(data) ? data.length : 0;
      setFeedback(`Generated successfully. Added ${count} idea(s).`);
      setDebugMsg(`Success (${res.status}). Ideas refreshed from GET /ideas.`);
    } catch (err) {
      const msg = err?.name === 'AbortError'
        ? 'Generate request timed out after 90s. Ollama may still be loading.'
        : (err.message || 'Backend/Ollama error while generating ideas.');
      setError(msg);
      setFeedback('');
      setDebugMsg(`Error: ${msg}`);
      console.error('Generate error', err);
    } finally {
      clearTimeout(timer);
      setIsGenerating(false);
    }
  };

  return <div style={{fontFamily:'Inter, sans-serif', background:'#f7f7fb', minHeight:'100vh', padding:20}}>
    <h1>🍽️ Pantry AI Planner</h1>
    <p>API: <code>{API}</code></p>

    <form onSubmit={handleGenerateSubmit} style={{background:'#fff', padding:12, borderRadius:12, marginBottom:16}}>
      <h3 style={{marginTop:0}}>Custom Meal Request</h3>
      <textarea value={customPrompt} onChange={(e)=>setCustomPrompt(e.target.value)} placeholder='I want a high protein dinner with chicken and rice.' style={{width:'100%',height:100,borderRadius:8,padding:8,marginBottom:10}} />
      <div style={{display:'flex', gap:10, alignItems:'center', flexWrap:'wrap'}}>
        <label>Meal Type:</label>
        <select value={mealType} onChange={(e)=>setMealType(e.target.value)}>
          <option value='breakfast'>breakfast</option><option value='lunch'>lunch</option><option value='dinner'>dinner</option><option value='dessert'>dessert</option>
        </select>
        <label><input type='checkbox' checked={weekly} onChange={(e)=>setWeekly(e.target.checked)} /> Weekly plan</label>
        <button type='submit' disabled={isGenerating}>{isGenerating ? 'Generating…' : 'Generate Dinner Ideas'}</button>
      </div>
    </form>

    {feedback && <p style={{background:'#eef7ff', padding:10, borderRadius:8}}>{feedback}</p>}
    {error && <p style={{background:'#ffecec', color:'#a30000', padding:10, borderRadius:8}}>{error}</p>}
    <p style={{fontSize:12, color:'#666'}}>Debug: {debugMsg}</p>

    <h2>Quick Access Squares</h2>
    <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:14}}>
      {ideas.slice(0,8).map(idea => <div key={idea.id} style={{background:'#fff', borderRadius:14, overflow:'hidden', boxShadow:'0 4px 14px rgba(0,0,0,0.08)'}}>
        <img src={photoFor(idea.image_hint || idea.meal_type)} alt={idea.title} style={{width:'100%', height:150, objectFit:'cover'}}/>
        <div style={{padding:12}}>
          <h3 style={{margin:'4px 0'}}>{idea.title}</h3>
          <small>{idea.meal_type} {idea.plan_day ? `• ${idea.plan_day}` : ''}</small>
          <p>{idea.description}</p>
          <p><b>Use:</b> {idea.ingredients_used}</p>
          <p><b>Missing:</b> {idea.missing_ingredients}</p>
        </div>
      </div>)}
    </div>

    <h2>Inventory ({items.length})</h2>
    <ul>{items.map(i => <li key={i.id}>{i.name} - {i.quantity} {i.unit} (exp {i.expiration_date})</li>)}</ul>
  </div>;
}
