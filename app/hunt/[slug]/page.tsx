import Link from "next/link";
import { notFound } from "next/navigation";
import { HuntExperience } from "@/components/HuntExperience";
import { getHuntBySlug } from "@/lib/hunts";

export default function HuntPage({ params }: { params: { slug: string } }) {
  const hunt = getHuntBySlug(params.slug);

  if (!hunt) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link href="/" className="inline-flex text-sm font-bold text-cyber hover:text-teal-200">← Back to dashboard</Link>
      <HuntExperience hunt={hunt} />
    </div>
  );
}
