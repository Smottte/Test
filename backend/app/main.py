from datetime import date, datetime
import json
import os
import time
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import httpx
from .database import Base, engine, get_db
from .models import PantryItem, MealIdea
from .schemas import PantryItemOut, GenerateRequest, GenerateResponse
from .seed import seed_data

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", os.getenv("OLLAMA_URL", "http://ollama:11434"))
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
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
    t = (text or "").lower()
    for m in ["breakfast", "lunch", "dinner", "dessert"]:
        if m in t:
            return m
    return default_type


def build_payload(prompt: str, meal_type: str, pantry_items: list[PantryItem], stream: bool):
    pantry_lines = [f"- {i.name}: {i.quantity} {i.unit}, exp {i.expiration_date}" for i in pantry_items]
    user_prompt = (
        f"Meal type: {meal_type}. User request: {prompt}\n"
        f"Pantry (use only if present):\n" + "\n".join(pantry_lines)
    )
    return {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": "You are a local pantry meal assistant. Be concise, practical, and honest about missing ingredients."},
            {"role": "user", "content": user_prompt},
        ],
        "stream": stream,
        "keep_alive": "10m",
        "options": {
            "num_ctx": 2048,
            "num_predict": 500,
            "temperature": 0.5,
        },
    }


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
    started = time.time()
    items = db.query(PantryItem).order_by(PantryItem.expiration_date.asc()).limit(12).all()
    if not items:
        raise HTTPException(status_code=400, detail="Run inventory setup first")

    meal_type = infer_meal_type_from_text(req.prompt or "", req.meal_type or current_meal_type())
    payload = build_payload(req.prompt or f"Suggest a {meal_type} meal", meal_type, items, stream=False)
    print(f"[ollama] start endpoint={OLLAMA_CHAT_ENDPOINT} model={OLLAMA_MODEL}")
    try:
        r = httpx.post(OLLAMA_CHAT_ENDPOINT, json=payload, timeout=180)
        r.raise_for_status()
        content = r.json().get("message", {}).get("content", "")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Ollama chat failed ({OLLAMA_CHAT_ENDPOINT}, model={OLLAMA_MODEL}): {e}")
    print(f"[ollama] done duration_ms={int((time.time()-started)*1000)}")

    db.add(MealIdea(title=f"{meal_type.title()} chat response", description=content, ingredients_used="[]", missing_ingredients="[]", meal_type=meal_type, image_hint=meal_type, plan_day=None))
    db.commit()

    return {"reply": content, "model": OLLAMA_MODEL, "endpoint": OLLAMA_CHAT_ENDPOINT, "source": "ollama-chat"}


@app.post('/ideas/stream')
def stream_ideas(req: GenerateRequest, db: Session = Depends(get_db)):
    started = time.time()
    items = db.query(PantryItem).order_by(PantryItem.expiration_date.asc()).limit(12).all()
    if not items:
        raise HTTPException(status_code=400, detail='Run inventory setup first')
    meal_type = infer_meal_type_from_text(req.prompt or "", req.meal_type or current_meal_type())
    payload = build_payload(req.prompt or f"Suggest a {meal_type} meal", meal_type, items, stream=True)

    def event_stream():
        first_token_at = None
        full = []
        print(f"[ollama] start endpoint={OLLAMA_CHAT_ENDPOINT} model={OLLAMA_MODEL}")
        try:
            with httpx.stream("POST", OLLAMA_CHAT_ENDPOINT, json=payload, timeout=180) as r:
                r.raise_for_status()
                for line in r.iter_lines():
                    if not line:
                        continue
                    data = json.loads(line)
                    token = data.get("message", {}).get("content", "")
                    if token:
                        if first_token_at is None:
                            first_token_at = time.time()
                            print(f"[ollama] first_token_ms={int((first_token_at-started)*1000)}")
                        full.append(token)
                        yield token
            text = "".join(full)
            db.add(MealIdea(title=f"{meal_type.title()} chat response", description=text, ingredients_used="[]", missing_ingredients="[]", meal_type=meal_type, image_hint=meal_type, plan_day=None))
            db.commit()
            print(f"[ollama] done duration_ms={int((time.time()-started)*1000)}")
        except Exception as e:
            yield f"\n[ERROR] Ollama stream failed: {e}"

    return StreamingResponse(event_stream(), media_type='text/plain')


@app.get('/pantry', response_model=list[PantryItemOut])
def list_items(db: Session = Depends(get_db)):
    return db.query(PantryItem).order_by(PantryItem.expiration_date.asc()).all()
