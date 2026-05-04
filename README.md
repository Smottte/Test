# Pantry AI Chat (Local)

## Start fresh (empty pantry by default)
- Demo seed is OFF by default (`SEED_DEMO_DATA=false`).
- To completely reset DB volume:
```bash
docker compose down -v
docker compose up -d --build
```

Optional demo seeding (only if you explicitly want it):
```bash
SEED_DEMO_DATA=true docker compose up -d --build
```

## Models
```bash
docker compose exec ollama ollama pull llama3.2:3b
docker compose exec ollama ollama pull llava
```

## Pantry behavior
- Pantry starts empty unless `SEED_DEMO_DATA=true`.
- Use **Clear pantry** button to remove all pantry items.
- If pantry is empty, app shows a friendly empty-state message.

## Meal assistant behavior
- Assistant uses only items actually in pantry.
- Missing ingredients are called out clearly.
- For "What can I make?" it returns 3–5 short options first, then asks which to expand.
- Full detailed recipes are only given after you pick/ask.

## Upload flow
- Pantry photo: `POST /inventory/from-image`
- Receipt image: `POST /inventory/from-receipt`
- Confirm before write: `POST /inventory/confirm-import`
- No automatic inventory write from uncertain detections.

## Receipt parsing notes
- Receipt images are sent to `POST /inventory/from-receipt` with base64 image data.
- Backend attempts Ollama vision parsing with `OLLAMA_VISION_MODEL` (default `llava`).
- App shows progress states: Uploading receipt → Reading receipt → Finding grocery items → Review detected items.
- If parsing fails, a clear error is shown; it will not silently add 0 items.

## UI branding
- App name: **Cheffie**
- Chat-first polished interface with rounded composer and modern typography.
- Suggested prompts show before first message and disappear after chat starts.
