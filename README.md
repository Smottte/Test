# KQL Hunter

KQL Hunter is a Duolingo-style daily KQL practice app for SOC analysts and threat hunters. The first release focuses on **Hunt mode**: a short, realistic incident scenario designed to take about five minutes while letting the user investigate freely without an enforced countdown.

## Features

- Next.js App Router with TypeScript and Tailwind CSS
- Responsive dashboard with today's hunt, streak, XP, completed hunts, and difficulty
- Free-form daily hunt flow with a smart KQL editor, count-up timer, one main objective, and final answer submission
- Mock Microsoft-style tables including `SigninLogs`, `CloudAppEvents`, and `DeviceNetworkEvents`
- Results page with correct/incorrect feedback, the correct answer, investigation path, example KQL, affected entities, and a final incident explanation
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
- `prisma/schema.prisma` - SQLite data model for hunts, mock tables, attempts, and progress
- `prisma/seed/hunts.json` - Realistic daily hunt content and mock security rows
- `prisma/seed.ts` - JSON-to-SQLite seed script

## Hunt mode design

Hunt mode intentionally gives minimal guidance. The player receives a small SOC case story, one main objective, and the available table schemas. They use the KQL editor to investigate freely, then submit one final answer. Results reveal whether the answer was correct, the correct answer, a short investigation path, and example KQL that could have solved the case.
