from datetime import date, datetime
import json
import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import httpx
from .database import Base, engine, get_db
from .models import PantryItem, MealIdea, UsageLog
from .schemas import (
    PantryItemCreate,
    PantryItemOut,
    MealIdeaOut,
    GenerateRequest,
    InventoryImageIn,
    MarkCookedRequest,
)
from .seed import seed_data

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1")
VISION_MODEL = os.getenv("OLLAMA_VISION_MODEL", "llava")

app = FastAPI(title="Pantry AI Planner")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.1.99:3000",
    ],
    allow_origin_regex=r"http://192\.168\.1\.\d+:3000",
    allow_methods=["*"],
    allow_headers=["*"],
)
Base.metadata.create_all(bind=engine)
seed_data()


def current_meal_type() -> str:
    hour = datetime.now().hour
    if 11 <= hour < 14:
        return "lunch"
    if 14 <= hour < 19:
        return "dinner"
    if 19 <= hour < 24:
        return "dessert"
    return "breakfast"


def call_ollama(prompt: str, model: str, images=None):
    payload = {"model": model, "prompt": prompt, "stream": False}
    if images:
        payload["images"] = images
    r = httpx.post(f"{OLLAMA_URL}/api/generate", json=payload, timeout=120)
    r.raise_for_status()
    return r.json().get("response", "")


@app.get("/health")
def health():
    return {"status": "ok", "default_meal_type": current_meal_type()}


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


@app.post("/inventory/from-image")
def inventory_from_image(payload: InventoryImageIn, db: Session = Depends(get_db)):
    prompt = (
        "Read this pantry/fridge image. Return strict JSON with keys: "
        "items (array of {name,category,quantity,unit,notes}), "
        "needs_better_photo (bool), missing_view (string), guidance (string)."
    )
    try:
        result = call_ollama(prompt, VISION_MODEL, [payload.image_base64])
        parsed = json.loads(result)
    except Exception:
        parsed = {
            "items": [],
            "needs_better_photo": True,
            "missing_view": "top/middle/bottom shelf unclear",
            "guidance": "Please retake with brighter light and full shelf coverage.",
        }

    added = 0
    for item in parsed.get("items", []):
        db.add(PantryItem(
            name=item.get("name", "unknown"),
            category=item.get("category", payload.context),
            quantity=int(item.get("quantity", 1)),
            unit=item.get("unit", "count"),
            expiration_date=date.today(),
            notes=item.get("notes", f"added from {payload.context} image"),
        ))
        added += 1
    db.commit()
    return {"added_items": added, **parsed}


@app.post("/ideas/generate", response_model=list[MealIdeaOut])
def generate_ideas(req: GenerateRequest, db: Session = Depends(get_db)):
    items = db.query(PantryItem).order_by(PantryItem.expiration_date.asc()).all()
    if not items:
        raise HTTPException(status_code=400, detail="Run inventory setup first")

    meal_type = req.meal_type or current_meal_type()
    pantry_lines = [f"- {i.name} ({i.quantity} {i.unit}), expiring {i.expiration_date}" for i in items]
    mode = "7 meals" if req.weekly else "3 meals"
    prompt = req.prompt or (
        f"Create {mode} for {meal_type}. Use mostly pantry items, prioritize expiring soon. "
        "Return strict JSON array with: title,description,ingredients_used(array),missing_ingredients(array),image_hint,plan_day.\n"
        + "\n".join(pantry_lines)
    )

    try:
        ideas = json.loads(call_ollama(prompt, OLLAMA_MODEL))
    except Exception:
        ideas = [{"title": f"Quick {meal_type.title()} Bowl", "description": "Pantry-based quick meal.", "ingredients_used": [items[0].name], "missing_ingredients": ["salt"], "image_hint": meal_type, "plan_day": None}] * (7 if req.weekly else 3)

    saved = []
    for idea in ideas[: 7 if req.weekly else 3]:
        row = MealIdea(
            title=idea["title"],
            description=idea["description"],
            ingredients_used=json.dumps(idea.get("ingredients_used", [])),
            missing_ingredients=json.dumps(idea.get("missing_ingredients", [])),
            meal_type=meal_type,
            image_hint=idea.get("image_hint", meal_type),
            plan_day=idea.get("plan_day"),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        saved.append(row)
    return saved


@app.post("/ideas/mark-cooked")
def mark_cooked(req: MarkCookedRequest, db: Session = Depends(get_db)):
    idea = db.query(MealIdea).filter(MealIdea.id == req.meal_idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="meal not found")
    used = json.loads(idea.ingredients_used)
    for name in used:
        db.add(UsageLog(meal_idea_id=idea.id, pantry_item_name=name, quantity_used=1))
        item = db.query(PantryItem).filter(PantryItem.name.ilike(name)).first()
        if item and item.quantity > 0:
            item.quantity -= 1
    db.commit()
    return {"logged": len(used)}


@app.get("/ideas", response_model=list[MealIdeaOut])
def list_ideas(db: Session = Depends(get_db)):
    return db.query(MealIdea).order_by(MealIdea.created_at.desc()).all()
