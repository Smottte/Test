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
    GenerateResponse,
    InventoryImageIn,
    MarkCookedRequest,
)
from .seed import seed_data

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", os.getenv("OLLAMA_URL", "http://ollama:11434"))
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
VISION_MODEL = os.getenv("OLLAMA_VISION_MODEL", "llava")
OLLAMA_CHAT_ENDPOINT = f"{OLLAMA_BASE_URL}/api/chat"

app = FastAPI(title="Pantry AI Planner")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
Base.metadata.create_all(bind=engine)
seed_data()


def current_meal_type() -> str:
    hour = datetime.now().hour
    if 5 <= hour < 11:
        return "breakfast"
    if 11 <= hour < 15:
        return "lunch"
    return "dinner"


def infer_meal_type_from_text(text: str, default_type: str) -> str:
    lower = text.lower()
    for meal in ["breakfast", "lunch", "dinner", "dessert"]:
        if meal in lower:
            return meal
    return default_type


def call_ollama_chat(system_prompt: str, user_prompt: str, model: str, images=None):
    message = {"role": "user", "content": user_prompt}
    if images:
        message["images"] = images
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            message,
        ],
        "stream": False,
    }
    print(f"[ollama] endpoint={OLLAMA_CHAT_ENDPOINT} model={model}")
    r = httpx.post(OLLAMA_CHAT_ENDPOINT, json=payload, timeout=90)
    r.raise_for_status()
    return r.json().get("message", {}).get("content", "")


@app.get("/ai/status")
def ai_status():
    try:
        r = httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=10)
        r.raise_for_status()
        return {"mode": "ollama", "model": OLLAMA_MODEL, "endpoint": OLLAMA_CHAT_ENDPOINT, "ollama_reachable": True}
    except Exception as e:
        return {"mode": "error", "model": OLLAMA_MODEL, "endpoint": OLLAMA_CHAT_ENDPOINT, "ollama_reachable": False, "detail": str(e)}


@app.post("/ideas/generate", response_model=GenerateResponse)
def generate_ideas(req: GenerateRequest, db: Session = Depends(get_db)):
    items = db.query(PantryItem).order_by(PantryItem.expiration_date.asc()).limit(25).all()
    if not items:
        raise HTTPException(status_code=400, detail="Run inventory setup first")

    meal_type = infer_meal_type_from_text(req.prompt or "", req.meal_type or current_meal_type())
    pantry_lines = [f"- {i.name}: {i.quantity} {i.unit}, expiring {i.expiration_date}" for i in items]
    user_prompt = (req.prompt or f"Suggest a {meal_type} idea") + "\n\nPantry:\n" + "\n".join(pantry_lines)
    system_prompt = (
        "You are a local pantry meal assistant. Use pantry inventory honestly. "
        "If inventory is limited, say so. Do not invent ingredients. Ask follow-up questions when needed."
    )

    try:
        content = call_ollama_chat(system_prompt, user_prompt, OLLAMA_MODEL)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Ollama chat failed ({OLLAMA_CHAT_ENDPOINT}, model={OLLAMA_MODEL}): {e}")

    db.add(MealIdea(
        title=f"{meal_type.title()} chat response",
        description=content,
        ingredients_used=json.dumps([]),
        missing_ingredients=json.dumps([]),
        meal_type=meal_type,
        image_hint=meal_type,
        plan_day=None,
    ))
    db.commit()

    return {"reply": content, "model": OLLAMA_MODEL, "endpoint": OLLAMA_CHAT_ENDPOINT, "source": "ollama-chat"}


@app.post("/inventory/from-image")
def inventory_from_image(payload: InventoryImageIn, db: Session = Depends(get_db)):
    system_prompt = "Identify pantry items and return strict JSON with keys: items, needs_better_photo, missing_view, guidance"
    try:
        content = call_ollama_chat(system_prompt, "Analyze this pantry image", VISION_MODEL, [payload.image_base64])
        parsed = json.loads(content)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Vision model failed: {e}")

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


@app.get("/pantry", response_model=list[PantryItemOut])
def list_items(db: Session = Depends(get_db)):
    return db.query(PantryItem).order_by(PantryItem.expiration_date.asc()).all()


@app.get("/ideas", response_model=list[MealIdeaOut])
def list_ideas(db: Session = Depends(get_db)):
    return db.query(MealIdea).order_by(MealIdea.created_at.desc()).all()
