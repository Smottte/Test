# Pantry AI Chat (Local)

## Run
```bash
docker compose down
docker compose up -d --build
docker compose exec ollama ollama pull llama3.2:3b
docker compose exec ollama ollama pull llava
```

## Pantry photo upload fix
- Backend uses Ollama chat endpoint: `POST /api/chat`
- Vision model is configurable via `OLLAMA_VISION_MODEL` (default `llava`)
- Image is sent as base64 in the user message `images` field
- `stream` is set to `false` for image analysis
- Backend logs:
  - analysis start
  - image size/mime
  - model + endpoint
  - Ollama response status
  - parse success/failure

## Robust JSON parsing
When LLaVA output is not strict JSON, backend now:
1. tries strict JSON parse
2. strips markdown code fences and retries
3. extracts JSON object substring and retries
4. returns friendly error if still invalid (no raw JSON parser traceback in UI)

## Confirmation flow
- Detected pantry items are shown for review/edit first
- Nothing is added automatically
- Add to inventory only after confirm (`POST /inventory/confirm-import`)

## If vision model missing
Run:
```bash
docker compose exec ollama ollama pull llava
```
