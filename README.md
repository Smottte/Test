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

## Features
- Pantry inventory + expiring-soon sorting.
- AI meal generation with missing ingredients separated.
- Time-based quick-access meal cards with images.
- Weekly plan mode.
- Image-based inventory from pantry/fridge or receipts.
- Persistent meal ideas and ingredient usage logs.
- Fully local services (no required cloud APIs).

## Run
```bash
docker compose up --build
docker compose exec ollama ollama pull llama3.1
docker compose exec ollama ollama pull llava
```

Open:
- UI: http://localhost:3000
- API docs: http://localhost:8000/docs

## Main APIs
- `POST /inventory/from-image` `{ image_base64, context }`
- `POST /pantry`
- `GET /pantry`
- `GET /pantry/expires-soon`
- `POST /ideas/generate` `{ weekly, meal_type, prompt }`
- `POST /ideas/mark-cooked` `{ meal_idea_id }`
- `GET /ideas`
