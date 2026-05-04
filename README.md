# Pantry AI Chat (Local)

Self-hosted pantry meal assistant with FastAPI + Postgres + Ollama + React.

## Run with Docker Compose
```bash
docker compose down
docker compose up -d --build
docker compose exec ollama ollama pull llama3.1
docker compose exec ollama ollama pull llava
```

LAN URLs:
- Frontend: `http://192.168.1.99:3000`
- Backend: `http://192.168.1.99:8000`
- API docs: `http://192.168.1.99:8000/docs`

## New Chat UI
- Main experience is chat-first (ChatGPT-style).
- Enter sends message.
- Shift+Enter adds newline.
- Input auto-expands as you type.
- Loading state shows `Thinking...` while generating.
- Errors are shown inline in chat.
- Pantry can be toggled via **View Pantry** button.
- Simple upload button is present for pantry/fridge photo workflow.

## Generate flow test
1. Open `http://192.168.1.99:3000`.
2. Type: `I want a high protein dinner with chicken and rice.`
3. Keep meal type as `dinner`, weekly unchecked.
4. Press **Enter** or click **Send**.
5. Confirm UI shows `Thinking...`.
6. Confirm backend call hits `POST /ideas/generate` with:
   ```json
   {
     "weekly": false,
     "meal_type": "dinner",
     "prompt": "I want a high protein dinner with chicken and rice."
   }
   ```
7. After response, chat should show generated ideas and refresh from `GET /ideas`.
8. If backend/Ollama fails, error appears directly in chat.

## API base URL behavior
Frontend resolves API in this order:
1. `REACT_APP_API_BASE_URL`
2. `REACT_APP_API_URL`
3. fallback: `http(s)://<current-hostname>:8000`

This avoids hardcoded localhost for LAN use.
