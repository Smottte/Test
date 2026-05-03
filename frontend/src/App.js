import React, { useEffect, useState } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function App() {
  const [items, setItems] = useState([]);
  const [soon, setSoon] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [form, setForm] = useState({ name:'', category:'', quantity:1, unit:'count', expiration_date:'', notes:'' });

  const load = async () => {
    setItems(await (await fetch(`${API}/pantry`)).json());
    setSoon(await (await fetch(`${API}/pantry/expires-soon?days=5`)).json());
    setIdeas(await (await fetch(`${API}/ideas`)).json());
  };

  useEffect(() => { load(); }, []);

  const addItem = async (e) => {
    e.preventDefault();
    await fetch(`${API}/pantry`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...form, quantity:Number(form.quantity)})});
    setForm({ name:'', category:'', quantity:1, unit:'count', expiration_date:'', notes:'' });
    load();
  };

  const genIdeas = async (weekly=false) => {
    await fetch(`${API}/ideas/generate`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({weekly})});
    load();
  };

  return <div style={{fontFamily:'sans-serif', maxWidth:1000, margin:'20px auto'}}>
    <h1>Pantry AI Dinner Planner (Local)</h1>
    <button onClick={()=>genIdeas(false)}>Generate 3 Dinner Ideas</button>
    <button onClick={()=>genIdeas(true)} style={{marginLeft:8}}>Generate Weekly Plan</button>

    <h2>Add Pantry Item</h2>
    <form onSubmit={addItem} style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8}}>
      {Object.keys(form).map(k => <input key={k} placeholder={k} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} required={k!=='notes'} />)}
      <button type='submit'>Add</button>
    </form>

    <h2>Expiring Soon (5 days)</h2>
    <ul>{soon.map(i => <li key={i.id}>{i.name} - {i.expiration_date}</li>)}</ul>

    <h2>All Pantry Items</h2>
    <ul>{items.map(i => <li key={i.id}>{i.name} ({i.quantity} {i.unit}) - expires {i.expiration_date}</li>)}</ul>

    <h2>Saved Meal Ideas</h2>
    <ul>{ideas.map(i => <li key={i.id}><b>{i.title}</b> [{i.plan_day || 'Dinner'}]<br/>Use: {i.ingredients_used}<br/>Missing: {i.missing_ingredients}</li>)}</ul>
  </div>;
}
