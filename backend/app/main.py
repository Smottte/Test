from datetime import date, timedelta
import json
import os
import re
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import httpx
from openai import OpenAI
from .database import Base, engine, get_db
from .models import PantryItem
from .schemas import PantryItemOut, GenerateRequest
from .seed import seed_data

AI_PROVIDER = os.getenv("AI_PROVIDER", "openai").lower()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5.4")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3:8b")
OLLAMA_VISION_MODEL = os.getenv("OLLAMA_VISION_MODEL", "llava")
OLLAMA_CHAT_ENDPOINT = f"{OLLAMA_BASE_URL}/api/chat"

app = FastAPI(title="Cheffie API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
Base.metadata.create_all(bind=engine)
seed_data()


def parse_maybe_json(raw: str):
    for candidate in [raw, re.sub(r"```(?:json)?|```", "", raw).strip()]:
        try:
            return json.loads(candidate)
        except Exception:
            pass
    return None


def openai_client():
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API key missing. Set OPENAI_API_KEY in backend env.")
    return OpenAI(api_key=OPENAI_API_KEY)


def call_openai_text(system: str, user: str):
    try:
        client = openai_client()
        rsp = client.responses.create(model=OPENAI_MODEL, input=[{"role": "system", "content": system}, {"role": "user", "content": user}])
        return rsp.output_text
    except Exception as e:
        msg = str(e)
        if "401" in msg or "invalid" in msg.lower():
            raise HTTPException(status_code=401, detail="OpenAI authentication failed. Check OPENAI_API_KEY.")
        if "429" in msg:
            raise HTTPException(status_code=429, detail="OpenAI rate limit reached. Try again shortly.")
        if "billing" in msg.lower() or "quota" in msg.lower():
            raise HTTPException(status_code=402, detail="OpenAI billing/quota issue. Check API credits.")
        raise HTTPException(status_code=502, detail=f"OpenAI request failed: {msg}")


def call_openai_vision_json(system: str, user: str, image_b64: str, mime: str):
    client = openai_client()
    try:
        rsp = client.responses.create(
            model=OPENAI_MODEL,
            input=[
                {"role": "system", "content": system},
                {"role": "user", "content": [
                    {"type": "input_text", "text": user},
                    {"type": "input_image", "image_url": f"data:{mime};base64,{image_b64}"}
                ]}
            ]
        )
        return rsp.output_text
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OpenAI vision request failed: {e}")


@app.get('/ai/status')
def ai_status():
    return {
        "provider": AI_PROVIDER,
        "openai_model": OPENAI_MODEL,
        "ollama_model": OLLAMA_MODEL,
        "ollama_vision_model": OLLAMA_VISION_MODEL,
    }


@app.post('/ideas/stream')
def stream_ideas(req: GenerateRequest, db: Session = Depends(get_db)):
    items = db.query(PantryItem).order_by(PantryItem.expiration_date.asc()).limit(20).all()
    if not items:
        def empty():
            yield "Your pantry is empty. Add pantry items, upload a pantry photo, or upload a receipt so I can plan accurately."
        return StreamingResponse(empty(), media_type='text/plain')

    pantry = "\n".join([f"- {i.name}: {i.quantity} {i.unit}" for i in items])
    print(f"[ideas] provider={AI_PROVIDER} pantry_items={[i.name for i in items]}")
    system = "You are Cheffie, a pantry-aware meal assistant. Use only pantry items as available. If missing, clearly say: You do not currently have ___. Offer substitutes and ask if user wants full recipe details. Keep concise."
    user = f"User: {req.prompt}\nPantry:\n{pantry}"

    if AI_PROVIDER == "ollama":
        payload = {"model": OLLAMA_MODEL, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}], "stream": True}
        def gen_ollama():
            with httpx.stream("POST", OLLAMA_CHAT_ENDPOINT, json=payload, timeout=180) as r:
                r.raise_for_status()
                for line in r.iter_lines():
                    if line:
                        tok = json.loads(line).get("message", {}).get("content", "")
                        if tok: yield tok
        return StreamingResponse(gen_ollama(), media_type='text/plain')

    text = call_openai_text(system, user)
    def gen_openai():
        yield text
    return StreamingResponse(gen_openai(), media_type='text/plain')


@app.post('/inventory/from-image')
def inventory_from_image(payload: dict):
    image_b64 = payload.get('image_base64')
    mime = payload.get('mime_type', 'image/jpeg')
    if not image_b64:
        raise HTTPException(status_code=400, detail='image_base64 required')

    system = 'You are a pantry image extraction assistant. Return only valid JSON.'
    user = 'Return JSON: {"items":[{"name":"string","quantity":1,"unit":"count","category":"Other","confidence":0.0,"notes":"string"}],"warnings":["string"]}'

    if AI_PROVIDER == 'ollama':
        body = {"model": OLLAMA_VISION_MODEL, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user, "images": [image_b64]}], "stream": False}
        r = httpx.post(OLLAMA_CHAT_ENDPOINT, json=body, timeout=180)
        r.raise_for_status()
        raw = r.json().get('message', {}).get('content', '')
    else:
        raw = call_openai_vision_json(system, user, image_b64, mime)

    parsed = parse_maybe_json(raw)
    if not parsed:
        raise HTTPException(status_code=422, detail='Could not parse pantry photo into valid JSON. Please retake a clearer image.')
    parsed['import_type'] = 'pantry_photo'
    return parsed


@app.post('/inventory/from-receipt')
def inventory_from_receipt(payload: dict):
    file_type = payload.get('file_type', 'image')
    image_b64 = payload.get('image_base64')
    mime = payload.get('mime_type', 'image/jpeg')
    print(f"[receipt] provider={AI_PROVIDER} file_type={file_type} bytes={len(image_b64 or '')}")
    if file_type == 'pdf':
        raise HTTPException(status_code=400, detail='PDF receipt parsing is not enabled yet. Upload a clear image.')
    if not image_b64:
        raise HTTPException(status_code=400, detail='image_base64 required')

    system = 'You are a grocery receipt normalization assistant. Convert messy OCR-like receipt lines into clean pantry inventory items. Infer category, quantity, unit, confidence, sold_by (weight/count), estimated_amount. Remove store-brand prefixes when appropriate. Return only valid JSON.'
    user = 'Return strict JSON: {"items":[{"original_text":"string","name":"string","category":"Produce|Meat & Seafood|Dairy|Frozen|Canned Goods|Dry Goods|Spices & Condiments|Snacks|Beverages|Household/Non-food|Other","quantity":1,"unit":"count","estimated_amount":"string|null","sold_by":"weight|count","confidence":0.0,"reasoning":"string"}],"ignored_lines":[{"text":"string","reason":"string"}],"warnings":["string"]}'

    if AI_PROVIDER == 'ollama':
        body = {"model": OLLAMA_VISION_MODEL, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user, "images": [image_b64]}], "stream": False}
        r = httpx.post(OLLAMA_CHAT_ENDPOINT, json=body, timeout=180)
        r.raise_for_status()
        raw = r.json().get('message', {}).get('content', '')
    else:
        raw = call_openai_vision_json(system, user, image_b64, mime)

    parsed = parse_maybe_json(raw)
    if not parsed:
        raise HTTPException(status_code=422, detail='I could not confidently detect grocery items from this receipt.')
    items = parsed.get('items', [])
    low_conf = len([i for i in items if float(i.get('confidence', 0)) < 0.6])
    print(f"[receipt] cleaned_items={len(items)} low_confidence_items={low_conf}")
    parsed['import_type'] = 'receipt'
    return parsed


@app.post('/inventory/confirm-import')
def confirm_import(payload: dict, db: Session = Depends(get_db)):
    added = 0
    for it in payload.get('items', []):
        name = it.get('name')
        if not name:
            continue
        db.add(PantryItem(name=name, category=it.get('category', 'Other'), quantity=int(it.get('quantity') or 1), unit=it.get('unit') or 'count', expiration_date=date.today()+timedelta(days=7), notes=f"imported:{payload.get('import_type','unknown')}"))
        added += 1
    db.commit()
    return {'added': added}


@app.get('/pantry', response_model=list[PantryItemOut])
def pantry(db: Session = Depends(get_db)):
    return db.query(PantryItem).order_by(PantryItem.expiration_date.asc()).all()


@app.delete('/pantry')
def clear_pantry(db: Session = Depends(get_db)):
    deleted = db.query(PantryItem).delete(); db.commit(); return {'deleted': deleted}
