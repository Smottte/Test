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

  const defaultType = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 11 && h < 14) return 'lunch';
    if (h >= 14 && h < 19) return 'dinner';
    if (h >= 19) return 'dessert';
    return 'breakfast';
  }, []);

  const load = async () => {
    const [pantryRes, ideasRes] = await Promise.all([
      fetch(`${API}/pantry`),
      fetch(`${API}/ideas`)
    ]);
    if (!pantryRes.ok || !ideasRes.ok) throw new Error('Unable to load pantry or ideas.');
    setItems(await pantryRes.json());
    setIdeas(await ideasRes.json());
  };

  useEffect(() => {
    setMealType(defaultType);
    load().catch((e) => setError(e.message));
  }, [defaultType]);

  const fileToB64 = (f) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(f);
  });

  const uploadInventory = async (e, context) => {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    const b64 = await fileToB64(file);
    const res = await fetch(`${API}/inventory/from-image`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ image_base64: b64, context })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.detail || 'Image inventory failed.');
      return;
    }
    setFeedback(`${data.added_items} items added. ${data.guidance || ''} ${data.needs_better_photo ? `Retake suggested: ${data.missing_view}` : ''}`);
    await load();
  };

  const handleGenerateSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsGenerating(true);
    try {
      const res = await fetch(`${API}/ideas/generate`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          weekly,
          meal_type: mealType,
          prompt: customPrompt.trim() ? customPrompt : null
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || 'Failed to generate ideas.');
      }
      setIdeas(data);
      setFeedback(`Generated ${data.length} ${mealType} idea(s).`);
    } catch (err) {
      setError(err.message || 'Backend/Ollama error while generating ideas.');
    } finally {
      setIsGenerating(false);
    }
  };

  const markCooked = async (id) => {
    setError('');
    try {
      const res = await fetch(`${API}/ideas/mark-cooked`, {
        method: 'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ meal_idea_id: id })
      });
      if (!res.ok) throw new Error('Failed to log cooked meal.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return <div style={{fontFamily:'Inter, sans-serif', background:'#f7f7fb', minHeight:'100vh', padding:20}}>
    <h1>🍽️ Pantry AI Planner</h1>
    <p>API: <code>{API}</code></p>

    <div style={{display:'flex', gap:10, flexWrap:'wrap', marginBottom:16}}>
      <label style={{background:'#fff', padding:10, borderRadius:10}}>📷 Pantry/Fridge Setup <input type='file' accept='image/*' onChange={(e)=>uploadInventory(e,'fridge')} /></label>
      <label style={{background:'#fff', padding:10, borderRadius:10}}>🧾 Receipt Upload <input type='file' accept='image/*' onChange={(e)=>uploadInventory(e,'receipt')} /></label>
    </div>

    <form onSubmit={handleGenerateSubmit} style={{background:'#fff', padding:12, borderRadius:12, marginBottom:16}}>
      <h3 style={{marginTop:0}}>Custom Meal Request</h3>
      <textarea
        value={customPrompt}
        onChange={(e)=>setCustomPrompt(e.target.value)}
        placeholder='I want something high protein with chicken and rice.'
        style={{width:'100%',height:90,borderRadius:8,padding:8,display:'block',marginBottom:10}}
      />
      <div style={{display:'flex', gap:10, alignItems:'center', flexWrap:'wrap'}}>
        <label>Meal Type:</label>
        <select value={mealType} onChange={(e)=>setMealType(e.target.value)}>
          <option value='breakfast'>breakfast</option>
          <option value='lunch'>lunch</option>
          <option value='dinner'>dinner</option>
          <option value='dessert'>dessert</option>
        </select>
        <label>
          <input type='checkbox' checked={weekly} onChange={(e)=>setWeekly(e.target.checked)} /> Weekly plan
        </label>
        <button type='submit' disabled={isGenerating}>{isGenerating ? 'Generating…' : 'Generate Dinner Ideas'}</button>
      </div>
    </form>

    {feedback && <p style={{background:'#eef7ff', padding:10, borderRadius:8}}>{feedback}</p>}
    {error && <p style={{background:'#ffecec', color:'#a30000', padding:10, borderRadius:8}}>{error}</p>}

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
          <button onClick={()=>markCooked(idea.id)}>Cooked this ✅</button>
        </div>
      </div>)}
    </div>

    <h2>Inventory ({items.length})</h2>
    <ul>{items.map(i => <li key={i.id}>{i.name} - {i.quantity} {i.unit} (exp {i.expiration_date})</li>)}</ul>
  </div>;
}
