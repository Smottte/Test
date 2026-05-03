from datetime import date
import json
import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import httpx
from .database import Base, engine, get_db
from .models import PantryItem, MealIdea
from .schemas import PantryItemCreate, PantryItemOut, MealIdeaOut, GenerateRequest
from .seed import seed_data

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1")

app = FastAPI(title="Pantry AI Planner")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)
seed_data()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/pantry", response_model=PantryItemOut)
def add_item(item: PantryItemCreate, db: Session = Depends(get_db)):
    db_item = PantryItem(**item.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.get("/pantry", response_model=list[PantryItemOut])
def list_items(db: Session = Depends(get_db)):
    return db.query(PantryItem).order_by(PantryItem.expiration_date.asc()).all()

@app.get("/pantry/expires-soon", response_model=list[PantryItemOut])
def expires_soon(days: int = 5, db: Session = Depends(get_db)):
    cutoff = date.fromordinal(date.today().toordinal() + days)
    return db.query(PantryItem).filter(PantryItem.expiration_date <= cutoff).order_by(PantryItem.expiration_date.asc()).all()


def build_prompt(items: list[PantryItem], weekly: bool) -> str:
    pantry_lines = [f"- {i.name} ({i.quantity} {i.unit}), expiring {i.expiration_date}" for i in items]
    mode = "7 dinners for a weekly meal plan" if weekly else "3 dinner ideas"
    return f"""
You are a local meal planner AI.
Create {mode} using mostly pantry ingredients.
Prioritize ingredients expiring soon.
Return strict JSON array, each object has:
- title
- description
- ingredients_used (array)
- missing_ingredients (array)
- plan_day (Mon..Sun or null)

Pantry:
{chr(10).join(pantry_lines)}
"""


@app.post("/ideas/generate", response_model=list[MealIdeaOut])
def generate_ideas(req: GenerateRequest, db: Session = Depends(get_db)):
    items = db.query(PantryItem).order_by(PantryItem.expiration_date.asc()).all()
    if not items:
        raise HTTPException(status_code=400, detail="Add pantry items first")

    prompt = build_prompt(items, req.weekly)
    payload = {"model": OLLAMA_MODEL, "prompt": prompt, "stream": False}

    try:
        response = httpx.post(f"{OLLAMA_URL}/api/generate", json=payload, timeout=120)
        response.raise_for_status()
        raw_text = response.json().get("response", "[]")
        ideas = json.loads(raw_text)
    except Exception:
        # fallback if model output is malformed or ollama unavailable
        base = [
            {
                "title": "Chicken Broccoli Rice Bowl",
                "description": "Stir-fry chicken and broccoli, serve over rice.",
                "ingredients_used": ["chicken breast", "broccoli", "rice", "garlic", "onion"],
                "missing_ingredients": ["soy sauce"],
                "plan_day": "Mon" if req.weekly else None,
            },
            {
                "title": "Black Bean Tomato Pasta",
                "description": "Cook pasta and toss with tomato sauce and black beans.",
                "ingredients_used": ["pasta", "tomato sauce", "black beans", "onion"],
                "missing_ingredients": ["parmesan"],
                "plan_day": "Wed" if req.weekly else None,
            },
            {
                "title": "Garlic Fried Rice",
                "description": "Use day-old rice with onions and garlic for quick dinner.",
                "ingredients_used": ["rice", "garlic", "onion"],
                "missing_ingredients": ["egg", "green onion"],
                "plan_day": "Fri" if req.weekly else None,
            },
        ]
        if req.weekly:
            base.extend([
                {"title":"Bean Rice Skillet","description":"Rice and beans skillet.","ingredients_used":["rice","black beans","onion"],"missing_ingredients":["bell pepper"],"plan_day":"Tue"},
                {"title":"Tomato Chicken Pasta","description":"Chicken pasta bake.","ingredients_used":["chicken breast","pasta","tomato sauce"],"missing_ingredients":["mozzarella"],"plan_day":"Thu"},
                {"title":"Broccoli Garlic Pasta","description":"Simple veggie pasta.","ingredients_used":["broccoli","pasta","garlic"],"missing_ingredients":["olive oil"],"plan_day":"Sat"},
                {"title":"Pantry Soup","description":"Use remaining items in a soup.","ingredients_used":["onion","garlic","tomato sauce"],"missing_ingredients":["stock"],"plan_day":"Sun"},
            ])
        ideas = base[:7 if req.weekly else 3]

    saved = []
    for idea in ideas[:7 if req.weekly else 3]:
        row = MealIdea(
            title=idea["title"],
            description=idea["description"],
            ingredients_used=json.dumps(idea["ingredients_used"]),
            missing_ingredients=json.dumps(idea["missing_ingredients"]),
            plan_day=idea.get("plan_day"),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        saved.append(row)
    return saved

@app.get("/ideas", response_model=list[MealIdeaOut])
def list_ideas(db: Session = Depends(get_db)):
    return db.query(MealIdea).order_by(MealIdea.created_at.desc()).all()
