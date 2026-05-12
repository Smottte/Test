import { PrismaClient } from "@prisma/client";
import hunts from "./seed/hunts.json";

type SeedStep = {
  order: number;
  question: string;
  expectedKql: string;
  acceptedTerms: string[];
  hint: string;
  explanation: string;
};

const prisma = new PrismaClient();

async function main() {
  await prisma.huntAttempt.deleteMany();
  await prisma.huntStep.deleteMany();
  await prisma.mockTable.deleteMany();
  await prisma.hunt.deleteMany();

  for (const hunt of hunts) {
    await prisma.hunt.create({
      data: {
        slug: hunt.slug,
        title: hunt.title,
        difficulty: hunt.difficulty,
        durationSeconds: hunt.durationSeconds,
        xpReward: hunt.xpReward,
        dayOffset: hunt.dayOffset,
        summary: hunt.summary,
        story: hunt.story,
        objective: hunt.objective,
        objectives: hunt.objectives,
        finalAnswer: hunt.finalAnswer,
        acceptedAnswers: hunt.acceptedAnswers,
        affected: hunt.affected,
        explanation: hunt.explanation,
        investigationPath: hunt.investigationPath,
        exampleKql: hunt.exampleKql,
        steps: {
          create: (hunt.steps as SeedStep[]).map((step) => ({
            order: step.order,
            question: step.question,
            expectedKql: step.expectedKql,
            acceptedTerms: step.acceptedTerms,
            hint: step.hint,
            explanation: step.explanation
          }))
        },
        tables: {
          create: hunt.tables.map((table) => ({
            name: table.name,
            description: table.description,
            schema: table.schema,
            rows: table.rows
          }))
        }
      }
    });
  }

  await prisma.userProgress.upsert({
    where: { handle: "rookie-hunter" },
    update: {},
    create: {
      handle: "rookie-hunter",
      streak: 3,
      xp: 420,
      completedHunts: 8
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
