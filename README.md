# Self-Hosted Pantry AI Dinner Planner

A fully local dinner planning app using FastAPI + Postgres + React + Ollama.

## Features
- Add pantry items: name, category, quantity, unit, expiration date, notes.
- List pantry items with expiring-soon view.
- Generate 3 dinner ideas from pantry items.
- Prioritize soon-to-expire ingredients in prompts.
- Separate missing ingredients.
- Save generated meal ideas.
- Weekly meal-plan option (7 dinners).
- Local-first: no required cloud APIs.

## Run
1. Start services:
   ```bash
   docker compose up --build
   ```
2. Pull local Ollama model (first time):
   ```bash
   docker compose exec ollama ollama pull llama3.1
   ```
3. Open UI: http://localhost:3000
4. API docs: http://localhost:8000/docs

## Seed Data
Backend auto-seeds starter pantry items on first launch in `app/seed.py`.

## API Quick Use
- `POST /pantry` add an item.
- `GET /pantry` all items sorted by expiration date.
- `GET /pantry/expires-soon?days=5` soonest items.
- `POST /ideas/generate` with `{ "weekly": false }` for 3 dinners.
- `POST /ideas/generate` with `{ "weekly": true }` for a 7-day plan.
- `GET /ideas` retrieve saved ideas.
