# Pantry AI Chat (Local)

## Run
```bash
docker compose down
docker compose up -d --build
docker compose exec ollama ollama pull llama3.2:3b
docker compose exec ollama ollama pull llava
```

## Chat + scrolling UX
- Streaming chat response from local Ollama (`/ideas/stream`).
- You can scroll up while generation continues.
- Auto-scroll only happens when already near bottom.
- If new tokens arrive while scrolled up, click **Jump to latest**.

## Photo upload (pantry/fridge)
- Click **📷 Pantry Photo** near chat input.
- Accepts: jpg/jpeg/png/webp.
- Shows preview and analyzing status.
- Backend endpoint: `POST /inventory/from-image`.
- Uses local Ollama vision model (`llava`) and returns structured JSON.
- Results are reviewed/edited before confirmation.

## Receipt upload
- Click **🧾 Receipt** near chat input.
- Accepts: jpg/jpeg/png/webp (+ pdf placeholder error if unsupported).
- Backend endpoint: `POST /inventory/from-receipt`.
- Returns structured items with confidence and metadata when available.
- Non-food lines are filtered via prompt guidance.
- User must confirm edits before inventory write.

## Confirm import
- Endpoint: `POST /inventory/confirm-import`
- Nothing is added to pantry until user confirms.

## Local-only + errors
- No cloud API required.
- If `llava` is missing, backend returns clear message:
  `docker compose exec ollama ollama pull llava`
- Errors are shown directly in chat.
