from datetime import date, datetime, timedelta
import base64
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
VISION_MODEL = os.getenv("OLLAMA_VISION_MODEL", "llava")
OLLAMA_CHAT_ENDPOINT = f"{OLLAMA_BASE_URL}/api/chat"

app = FastAPI(title="Pantry AI Planner")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
Base.metadata.create_all(bind=engine)
seed_data()


def call_chat(model: str, system: str, user: str, stream=False, images=None, timeout=180):
    user_msg = {"role": "user", "content": user}
    if images:
        user_msg["images"] = images
    payload = {
        "model": model,
        "messages": [{"role": "system", "content": system}, user_msg],
        "stream": stream,
        "keep_alive": "10m",
        "options": {"num_ctx": 2048, "num_predict": 500, "temperature": 0.5},
    }
    print(f"[ollama] endpoint={OLLAMA_CHAT_ENDPOINT} model={model}")
    return payload


def current_meal_type():
    h = datetime.now().hour
    if 5 <= h < 11: return "breakfast"
    if 11 <= h < 15: return "lunch"
    return "dinner"


@app.get('/ai/status')
def ai_status():
    try:
        r = httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=10)
        r.raise_for_status()
        tags = [m.get("name", "") for m in r.json().get("models", [])]
        return {"mode":"ollama","model":OLLAMA_MODEL,"vision_model":VISION_MODEL,"endpoint":OLLAMA_CHAT_ENDPOINT,"ollama_reachable":True,"llava_installed":any("llava" in t for t in tags)}
    except Exception as e:
        return {"mode":"error","model":OLLAMA_MODEL,"endpoint":OLLAMA_CHAT_ENDPOINT,"ollama_reachable":False,"detail":str(e)}


@app.post('/ideas/stream')
def stream_ideas(req: GenerateRequest, db: Session = Depends(get_db)):
    items = db.query(PantryItem).order_by(PantryItem.expiration_date.asc()).limit(12).all()
    meal_type = req.meal_type or current_meal_type()
    pantry = "\n".join([f"- {i.name}: {i.quantity} {i.unit} exp {i.expiration_date}" for i in items])
    payload = call_chat(OLLAMA_MODEL, "You are a concise pantry assistant.", f"Meal type: {meal_type}\nUser: {req.prompt}\nPantry:\n{pantry}", stream=True)
    started = time.time()

    def gen():
        first = None
        full = []
        try:
            with httpx.stream("POST", OLLAMA_CHAT_ENDPOINT, json=payload, timeout=180) as r:
                r.raise_for_status()
                for line in r.iter_lines():
                    if not line:
                        continue
                    data = json.loads(line)
                    tok = data.get("message", {}).get("content", "")
                    if tok:
                        if first is None:
                            first = time.time(); print(f"[ollama] first_token_ms={int((first-started)*1000)}")
                        full.append(tok)
                        yield tok
            txt = "".join(full)
            db.add(MealIdea(title="Chat response", description=txt, ingredients_used="[]", missing_ingredients="[]", meal_type=meal_type, image_hint=meal_type))
            db.commit()
            print(f"[ollama] done duration_ms={int((time.time()-started)*1000)}")
        except Exception as e:
            yield f"\n[ERROR] {e}"

    return StreamingResponse(gen(), media_type="text/plain")


@app.post('/inventory/from-image')
def inventory_from_image(payload: dict):
    image_b64 = payload.get("image_base64")
    if not image_b64:
        raise HTTPException(status_code=400, detail="image_base64 required")
    system = "Extract pantry items from image. Return strict JSON {items:[{name,quantity,unit,category,confidence}],needs_review:boolean,notes}."
    body = call_chat(VISION_MODEL, system, "Analyze pantry/fridge image", images=[image_b64])
    try:
        r = httpx.post(OLLAMA_CHAT_ENDPOINT, json=body, timeout=180)
        r.raise_for_status()
        content = r.json().get("message", {}).get("content", "")
        data = json.loads(content)
        data["method"] = "ollama-vision"
        data["import_type"] = "pantry_photo"
        return data
    except Exception as e:
        msg = str(e)
        if "404" in msg or "model" in msg.lower():
            msg += " | Vision model may be missing. Run: docker compose exec ollama ollama pull llava"
        raise HTTPException(status_code=502, detail=msg)


@app.post('/inventory/from-receipt')
def inventory_from_receipt(payload: dict):
    file_type = payload.get("file_type", "image")
    if file_type == "pdf":
        raise HTTPException(status_code=400, detail="PDF extraction not enabled in this build. Please upload receipt as image (jpg/png/webp).")
    image_b64 = payload.get("image_base64")
    if not image_b64:
        raise HTTPException(status_code=400, detail="image_base64 required")
    system = "Extract grocery receipt lines. Ignore totals/tax/non-food. Return strict JSON {store,date,items:[{name,quantity,unit,price,confidence}],needs_review:true}."
    body = call_chat(VISION_MODEL, system, "Parse this grocery receipt", images=[image_b64])
    try:
        r = httpx.post(OLLAMA_CHAT_ENDPOINT, json=body, timeout=180)
        r.raise_for_status()
        content = r.json().get("message", {}).get("content", "")
        data = json.loads(content)
        data["method"] = "ollama-vision"
        data["import_type"] = "receipt"
        return data
    except Exception as e:
        msg = str(e)
        if "404" in msg or "model" in msg.lower():
            msg += " | Vision model may be missing. Run: docker compose exec ollama ollama pull llava"
        raise HTTPException(status_code=502, detail=msg)


@app.post('/inventory/confirm-import')
def confirm_import(payload: dict, db: Session = Depends(get_db)):
    items = payload.get("items", [])
    added = 0
    for it in items:
        if not it.get("name"):
            continue
        exp = it.get("expiration_date")
        if not exp:
            exp_date = date.today() + timedelta(days=7)
        else:
            exp_date = date.fromisoformat(exp)
        db.add(PantryItem(name=it["name"], category=it.get("category", "imported"), quantity=int(it.get("quantity", 1)), unit=it.get("unit", "count"), expiration_date=exp_date, notes=f"imported ({payload.get('import_type','unknown')})"))
        added += 1
    db.commit()
    return {"added": added}


@app.get('/pantry', response_model=list[PantryItemOut])
def pantry(db: Session = Depends(get_db)):
    return db.query(PantryItem).order_by(PantryItem.expiration_date.asc()).all()
