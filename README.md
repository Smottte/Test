# Cheffie

Cheffie is a chat-first pantry assistant.

## AI Provider setup
Create a local `.env` file (do NOT commit it):
```env
AI_PROVIDER=openai
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-5.4
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=qwen3:8b
OLLAMA_VISION_MODEL=llava
SEED_DEMO_DATA=false
```

`ChatGPT Plus/Pro` subscription is separate from OpenAI API billing.
You need API credits for backend API calls.

## Run
```bash
docker compose down -v
docker compose up -d --build
```

## Switch provider
- OpenAI (default): `AI_PROVIDER=openai`
- Local Ollama fallback: `AI_PROVIDER=ollama`

## Notes on model quality/cost
- `gpt-5.4` is higher quality.
- `gpt-5.4-mini` is typically cheaper/faster for lower-cost runs.

## Security
- API key is backend-only and never sent to frontend.
- `.env` is gitignored.
- `.env.example` is committed with blank placeholders only.

## Upload behavior
- Pantry photo and receipt uploads are parsed in backend using selected AI provider.
- Items are shown for review before confirm import.
- Nothing is added until `Confirm add`.
