# KQL Hunter

KQL Hunter is a Duolingo-style daily KQL practice app for SOC analysts and threat hunters. The first release focuses on **Hunt mode**: a short, realistic incident scenario where the user has five minutes to query mock Microsoft security tables, request optional hints, and review a scored incident report.

## Features

- Next.js App Router with TypeScript and Tailwind CSS
- Responsive dashboard with today's hunt, streak, XP, completed hunts, and difficulty
- Five-minute daily hunt flow with a KQL editor, timer, optional hints, and step-by-step questions
- Mock Microsoft-style tables including `SigninLogs`, `CloudAppEvents`, and `DeviceNetworkEvents`
- Results page with scoring, correct/incorrect feedback, ideal KQL, affected entities, and a final incident explanation
- SQLite + Prisma schema and seed workflow backed by JSON hunt data
- Training mode placeholder for future guided lessons

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create an environment file:

   ```bash
   cp .env.example .env
   ```

3. Generate Prisma Client and create the SQLite database:

   ```bash
   npx prisma migrate dev --name init
   ```

4. Seed the database from JSON:

   ```bash
   npm run prisma:seed
   ```

5. Start the app:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000).

> The UI imports the same JSON seed data directly so it can render during development and static builds even before the local SQLite file is created. Prisma provides the database schema and seed backbone for persistence as the app grows.

## Project structure

- `app/` - Next.js App Router pages and global styles
- `components/` - Reusable dashboard, hunt, table, and results components
- `lib/` - Hunt data loading, scoring helpers, and shared TypeScript types
- `prisma/schema.prisma` - SQLite data model for hunts, steps, mock tables, attempts, and progress
- `prisma/seed/hunts.json` - Realistic daily hunt content and mock security rows
- `prisma/seed.ts` - JSON-to-SQLite seed script

## Hunt mode design

Hunt mode intentionally gives minimal guidance. The player receives the incident summary, available table schemas, sample rows, and questions. Optional hints are available but reduce the score for that step. This keeps the easy daily hunt beginner-friendly while still requiring the user to connect sign-ins, cloud events, and endpoint telemetry like a real investigation.
