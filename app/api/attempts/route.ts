import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const payload = await request.json();

  const hunt = await prisma.hunt.findUnique({ where: { slug: payload.huntSlug } });
  if (!hunt) {
    return NextResponse.json({ error: "Unknown hunt" }, { status: 404 });
  }

  const attempt = await prisma.huntAttempt.create({
    data: {
      huntId: hunt.id,
      score: payload.score,
      maxScore: payload.maxScore,
      answers: payload.stepResults
    }
  });

  return NextResponse.json({ id: attempt.id });
}
