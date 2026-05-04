# Pantry AI Chat (Local)

Minimal chat-first pantry assistant using FastAPI + Postgres + Ollama + React.

## Run
```bash
docker compose down
docker compose up -d --build
docker compose exec ollama ollama pull llama3.2:3b
docker compose exec ollama ollama pull llava
```

Configurable env vars:
- `OLLAMA_MODEL` (default `llama3.2:3b`)
- `OLLAMA_BASE_URL` (default `http://ollama:11434`)

## Faster Ollama chat flow
- Uses `POST /api/chat`.
- Adds `keep_alive: "10m"` to keep model warm.
- Uses speed-focused options:
  - `num_ctx: 2048`
  - `num_predict: 500`
  - `temperature: 0.5`
- Limits pantry context to top 12 most relevant (earliest expiring) items.
- Avoids sending old chat history each request.

## Streaming behavior
- Frontend calls `POST /ideas/stream`.
- Backend streams model text as it is generated.
- User sees message immediately + live token updates.
- No canned fallback response is used.
- Real errors are shown in chat.

## Timing logs
Backend logs include:
- request start (`[ollama] start ...`)
- first token time in ms (`[ollama] first_token_ms=...`) for streaming
- final duration in ms (`[ollama] done duration_ms=...`)

## Verify model + endpoint
- Header shows model status from `/ai/status`.
- Backend logs should show endpoint and model, e.g.:
  - `[ollama] endpoint=http://ollama:11434/api/chat model=llama3.2:3b`

## LAN URLs
- Frontend: `http://192.168.1.99:3000`
- Backend: `http://192.168.1.99:8000`
