# Pantry AI Chat (Local)

Minimal chat-first pantry assistant using FastAPI + Postgres + Ollama + React.

## Run
```bash
docker compose down
docker compose up -d --build
docker compose exec ollama ollama pull llama3.2:3b
docker compose exec ollama ollama pull llava
```

Configure model/base URL via env if needed:
- `OLLAMA_MODEL` (default `llama3.2:3b`)
- `OLLAMA_BASE_URL` (default `http://ollama:11434`)

## Correct Ollama API used
Backend now uses:
- `POST /api/chat` (not `/api/generate`)
- Request includes `system` + `user` messages and `stream: false`
- Response parsing reads: `response.message.content`

If Ollama fails (404/500/timeout), backend returns real errors and frontend shows them directly in chat.
No canned/fake meal fallback is used.

## Verify real local model usage
1. In app header, confirm status label like: `Model: llama3.2:3b via Ollama`
2. Call backend status endpoint:
   - `GET http://192.168.1.99:8000/ai/status`
3. In backend logs, verify lines like:
   - `[ollama] endpoint=http://ollama:11434/api/chat model=llama3.2:3b`

## LAN URLs
- Frontend: `http://192.168.1.99:3000`
- Backend: `http://192.168.1.99:8000`

## Chat usage
- Click a suggested prompt or type your own request.
- Press Enter to send, Shift+Enter for newline.
- `Thinking...` appears while waiting.
- Assistant response is actual `message.content` from Ollama chat response.
