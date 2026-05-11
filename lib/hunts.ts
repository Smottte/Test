import hunts from "../prisma/seed/hunts.json";
import type { Hunt } from "./types";

export function getAllHunts(): Hunt[] {
  return hunts as Hunt[];
}

export function getTodayHunt(): Hunt {
  return getAllHunts()[0];
}

export function getHuntBySlug(slug: string): Hunt | undefined {
  return getAllHunts().find((hunt) => hunt.slug === slug);
}

export function evaluateStep(answer: string, acceptedTerms: string[]) {
  const normalized = answer.toLowerCase();
  const matchedTerms = acceptedTerms.filter((term) => normalized.includes(term.toLowerCase()));
  const score = Math.round((matchedTerms.length / acceptedTerms.length) * 100);

  return { score, matchedTerms };
}
