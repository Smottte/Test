import { notFound } from "next/navigation";
import { ResultsClient } from "@/components/ResultsClient";
import { getHuntBySlug } from "@/lib/hunts";

export default function ResultsPage({ params }: { params: { slug: string } }) {
  const hunt = getHuntBySlug(params.slug);

  if (!hunt) {
    notFound();
  }

  return <ResultsClient hunt={hunt} />;
}
