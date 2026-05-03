# Self-Hosted Pantry AI Meal Planner

Local-only planner: FastAPI + Postgres + React + Ollama.

## Flow
1. **Setup inventory first**
   - Upload fridge/pantry photo.
   - Upload grocery receipt photo.
   - App inventories visible items and returns retake guidance (top/middle/bottom shelf etc.) if photo quality/coverage is insufficient.
2. **Get quick meal squares**
   - Time-based defaults: 12:00am-10:59am breakfast, 11:00am-1:59pm lunch, 2:00pm-6:59pm dinner, 7:00pm-11:59pm dessert.
   - Generate 3 quick ideas or weekly plan.
   - Optional free-text prompt for other meal types.
3. **Track usage memory**
   - Mark idea as cooked to log pantry usage and decrement item quantities.

## LAN-safe API connectivity fix
The frontend now uses this API base URL resolution order:
1. `REACT_APP_API_BASE_URL`
2. `REACT_APP_API_URL` (back-compat)
3. Browser-derived fallback: `http(s)://<current-hostname>:8000`

So when you open `http://192.168.1.99:3000`, the fallback becomes `http://192.168.1.99:8000` automatically.

## Run on your Ubuntu LAN server (192.168.1.99)
```bash
docker compose down
docker compose up -d --build
docker compose exec ollama ollama pull llama3.1
docker compose exec ollama ollama pull llava
```

Then test from another LAN device:
- Frontend: `http://192.168.1.99:3000`
- Backend health: `http://192.168.1.99:8000/health`
- Backend docs: `http://192.168.1.99:8000/docs`

## Why this fixes `Failed to fetch`
- Frontend no longer hardcodes `localhost` for API calls.
- Backend is already bound to `0.0.0.0` by uvicorn Docker command.
- Compose publishes backend port `8000:8000` and frontend port `3000:3000`.
- FastAPI CORS allows localhost + LAN origin patterns.

## Main APIs
- `POST /inventory/from-image` `{ image_base64, context }`
- `POST /pantry`
- `GET /pantry`
- `GET /pantry/expires-soon`
- `POST /ideas/generate` `{ weekly, meal_type, prompt }`
- `POST /ideas/mark-cooked` `{ meal_idea_id }`
- `GET /ideas`
