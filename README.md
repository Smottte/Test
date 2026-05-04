# Pantry AI Chat (Local)

Minimal chat-first pantry meal assistant running fully local with FastAPI + Postgres + Ollama + React.

## Run
```bash
docker compose down
docker compose up -d --build
docker compose exec ollama ollama pull llama3.2:3b
docker compose exec ollama ollama pull llava
```

LAN URLs:
- Frontend: `http://192.168.1.99:3000`
- Backend: `http://192.168.1.99:8000`

## Chat UX behavior
- Before first message: clickable suggestion boxes appear based on current time.
  - morning => breakfast suggestions
  - midday => lunch suggestions
  - evening/night => dinner suggestions
- After first message: suggestions disappear and normal chat continues.
- Enter sends, Shift+Enter adds newline.
- Input is fixed at bottom and auto-expands.
- Loading state shows `Thinking...`.

## AI flow (real model vs fallback)
- Frontend sends `POST /ideas/generate` with:
  ```json
  {
    "weekly": false,
    "meal_type": "<inferred by time>",
    "prompt": "<user message>"
  }
  ```
- Backend calls Ollama model from `OLLAMA_MODEL` (default `llama3.2:3b`) and parses strict JSON.
- **No canned demo meal fallback is used for generation.**
- If Ollama fails, backend returns an error and frontend shows it clearly in chat.
- Frontend then refreshes ideas from `GET /ideas` and shows newest results as assistant messages.

## Verify you are using local AI
1. Open app header status label; it shows e.g. `Model: llama3.2:3b via Ollama`.
2. API check:
   - `GET /ai/status`
3. Footer debug source should show:
   - `source: calling Ollama generate endpoint`
   - then `source: Ollama response saved + loaded from DB`

## Test generate flow
1. Open `http://192.168.1.99:3000`
2. Click a suggestion or type: `I want a high protein dinner with chicken and rice.`
3. Click Send.
4. Confirm `Thinking...` appears immediately.
5. Confirm assistant returns generated ideas from pantry context.
6. If Ollama/model fails, error appears in chat (not fake content).
