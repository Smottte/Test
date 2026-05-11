import { PrismaClient } from "@prisma/client";
import hunts from "./seed/hunts.json";

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
        objectives: hunt.objectives,
        affected: hunt.affected,
        explanation: hunt.explanation,
        steps: {
          create: hunt.steps.map((step) => ({
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
