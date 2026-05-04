from datetime import date, datetime, timedelta
import json
import os
import re
import time
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import httpx
from .database import Base, engine, get_db
from .models import PantryItem, MealIdea
from .schemas import PantryItemOut, GenerateRequest
from .seed import seed_data

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", os.getenv("OLLAMA_URL", "http://ollama:11434"))
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
OLLAMA_VISION_MODEL = os.getenv("OLLAMA_VISION_MODEL", "llava")
OLLAMA_CHAT_ENDPOINT = f"{OLLAMA_BASE_URL}/api/chat"

app = FastAPI(title="Pantry AI Planner")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
Base.metadata.create_all(bind=engine)
seed_data()


def call_chat(payload: dict, timeout=180):
    return httpx.post(OLLAMA_CHAT_ENDPOINT, json=payload, timeout=timeout)


def parse_maybe_json(raw: str):
    try:
        return json.loads(raw)
    except Exception:
        pass

    # strip markdown fenced blocks
    m = re.search(r"```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```", raw, re.S)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass

    # find first JSON object substring
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(raw[start:end + 1])
        except Exception:
            pass

    return None


@app.post('/ideas/stream')
def stream_ideas(req: GenerateRequest, db: Session = Depends(get_db)):
    items = db.query(PantryItem).order_by(PantryItem.expiration_date.asc()).limit(12).all()
    if len(items) == 0:
        def empty():
            yield "Your pantry is empty right now. Add items manually, upload a pantry photo, or upload a receipt so I can suggest meals accurately."
        return StreamingResponse(empty(), media_type="text/plain")
    pantry_names = [i.name for i in items]
    print(f"[ideas] pantry_item_count={len(items)} pantry_items={pantry_names}")
    pantry = "\n".join([f"- {i.name}: {i.quantity} {i.unit}" for i in items])
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": "You are a pantry-aware meal assistant. Use ONLY pantry items as available. Clearly mark missing ingredients as: You do not currently have ___. Offer pantry-first substitutes. If no substitute, ask whether user wants to switch recipe, add missing ingredient to grocery list, or continue anyway. For requests asking what the user can make, give 3-5 short options only (name, why it fits pantry, missing items, substitutes) then ask which one to expand into full recipe. Do NOT provide full detailed recipe unless user asks for one option explicitly. Keep responses short and honest."},
            {"role": "user", "content": f"{req.prompt}\nPantry count: {len(items)}\nPantry:\n{pantry}"},
        ],
        "stream": True,
        "keep_alive": "10m",
        "options": {"num_ctx": 2048, "num_predict": 500, "temperature": 0.5},
    }

    def gen():
        try:
            with httpx.stream("POST", OLLAMA_CHAT_ENDPOINT, json=payload, timeout=180) as r:
                r.raise_for_status()
                for line in r.iter_lines():
                    if not line:
                        continue
                    tok = json.loads(line).get("message", {}).get("content", "")
                    if tok: yield tok
        except Exception as e:
            yield f"\n[ERROR] {e}"

    return StreamingResponse(gen(), media_type="text/plain")


@app.post('/inventory/from-image')
def inventory_from_image(payload: dict):
    image_b64 = payload.get("image_base64")
    mime = payload.get("mime_type", "unknown")
    if not image_b64:
        raise HTTPException(status_code=400, detail="image_base64 required")

    print(f"[vision] start bytes={len(image_b64)} mime={mime} model={OLLAMA_VISION_MODEL} endpoint={OLLAMA_CHAT_ENDPOINT}")
    body = {
        "model": OLLAMA_VISION_MODEL,
        "messages": [
            {"role": "system", "content": "You are a pantry image extraction assistant. Identify visible grocery or pantry items from the image. Return only valid JSON. Do not include markdown, explanations, or extra text."},
            {"role": "user", "content": "Return JSON format: {\"items\":[{\"name\":\"string\",\"quantity\":null,\"unit\":null,\"category\":\"string\",\"confidence\":0.0,\"notes\":\"string\"}],\"warnings\":[\"string\"]}. If none: {\"items\":[],\"warnings\":[\"No clear pantry items detected.\"]}", "images": [image_b64]},
        ],
        "stream": False,
        "keep_alive": "10m",
    }

    try:
        r = call_chat(body, timeout=180)
        print(f"[vision] response_status={r.status_code}")
        r.raise_for_status()
        content = r.json().get("message", {}).get("content", "")
        data = parse_maybe_json(content)
        if data is None:
            print("[vision] parse_failed")
            raise HTTPException(status_code=422, detail="Vision model returned non-JSON output. Please retake a clearer photo with better lighting.")
        print("[vision] parse_success")
        if "items" not in data:
            data = {"items": [], "warnings": ["Model response parsed but no items field found."]}
        data["method"] = "ollama-vision"
        data["import_type"] = "pantry_photo"
        return data
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e)
        if "404" in msg or "model" in msg.lower():
            msg = f"Vision model unavailable. Run: docker compose exec ollama ollama pull llava ({msg})"
        raise HTTPException(status_code=502, detail=msg)


@app.post('/inventory/from-receipt')
def inventory_from_receipt(payload: dict):
    file_type = payload.get("file_type", "image")
    image_b64 = payload.get("image_base64")
    mime = payload.get("mime_type", "unknown")
    print(f"[receipt] start file_type={file_type} mime={mime} bytes={len(image_b64 or '')}")

    if file_type == "pdf":
        print("[receipt] ocr_attempted=false ollama_vision_attempted=false")
        raise HTTPException(status_code=400, detail="PDF receipt parsing is not enabled in this build yet. Please upload a clear image (jpg/png/webp).")
    if not image_b64:
        raise HTTPException(status_code=400, detail="image_base64 required for receipt parsing")

    system = "You are a grocery receipt extraction assistant. Return only strict JSON. Ignore subtotal/tax/total/store-address/cashier/card lines. Return {\"store\":\"string|null\",\"date\":\"string|null\",\"items\":[{\"name\":\"string\",\"quantity\":null,\"unit\":null,\"price\":null,\"category\":\"string\",\"confidence\":0.0,\"notes\":\"string\"}],\"warnings\":[\"string\"]}."
    body = {
        "model": OLLAMA_VISION_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": "Parse this grocery receipt image and extract grocery items only.", "images": [image_b64]},
        ],
        "stream": False,
        "keep_alive": "10m",
    }

    try:
        print("[receipt] ocr_attempted=false ollama_vision_attempted=true")
        r = call_chat(body, timeout=180)
        print(f"[receipt] response_status={r.status_code}")
        r.raise_for_status()
        content = r.json().get("message", {}).get("content", "")
        data = parse_maybe_json(content)
        if data is None:
            print("[receipt] parse_failed")
            raise HTTPException(status_code=422, detail="I could not confidently detect grocery items from this receipt.")
        items = data.get("items", []) if isinstance(data, dict) else []
        print(f"[receipt] candidate_items_found={len(items)} items_returned_for_review={len(items)}")
        if len(items) == 0:
            data = data if isinstance(data, dict) else {}
            data.setdefault("warnings", [])
            data["warnings"].append("I could not confidently detect grocery items from this receipt.")
        data["method"] = "ollama-vision"
        data["import_type"] = "receipt"
        return data
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e)
        if "404" in msg or "model" in msg.lower():
            msg = f"Vision model unavailable. Run: docker compose exec ollama ollama pull llava ({msg})"
        raise HTTPException(status_code=502, detail=msg)


@app.post('/inventory/confirm-import')
def confirm_import(payload: dict, db: Session = Depends(get_db)):
    added = 0
    for it in payload.get("items", []):
        if not it.get("name"):
            continue
        db.add(PantryItem(name=it["name"], category=it.get("category", "imported"), quantity=int(it.get("quantity") or 1), unit=it.get("unit") or "count", expiration_date=date.today()+timedelta(days=7), notes="imported"))
        added += 1
    db.commit()
    return {"added": added}


@app.get('/pantry', response_model=list[PantryItemOut])
def pantry(db: Session = Depends(get_db)):
    return db.query(PantryItem).order_by(PantryItem.expiration_date.asc()).all()


@app.delete("/pantry")
def clear_pantry(db: Session = Depends(get_db)):
    deleted = db.query(PantryItem).delete()
    db.commit()
    return {"deleted": deleted}
