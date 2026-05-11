import Link from "next/link";
import { StatCard } from "@/components/StatCard";
import { getTodayHunt } from "@/lib/hunts";

export default function DashboardPage() {
  const hunt = getTodayHunt();

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-glow backdrop-blur md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyber/30 bg-cyber/10 px-4 py-2 text-sm font-bold text-cyber">
            <span className="h-2 w-2 rounded-full bg-cyber" /> KQL Hunter Daily
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl">Hunt like a SOC analyst.</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-300">
            Five-minute, realistic Microsoft-style security investigations that teach you to pivot through logs, form hypotheses, and write better KQL.
          </p>
        </div>
        <Link href={`/hunt/${hunt.slug}`} className="rounded-2xl bg-cyber px-6 py-4 text-center text-lg font-black text-ink shadow-glow transition hover:-translate-y-0.5 hover:bg-teal-300">
          Start today&apos;s hunt
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Current streak" value="3 days" caption="Keep your daily hunt chain alive." />
        <StatCard label="Total XP" value="420" caption={`+${hunt.xpReward} XP available today.`} />
        <StatCard label="Completed hunts" value="8" caption="Easy hunts mastered so far." />
        <StatCard label="Today's difficulty" value={hunt.difficulty} caption="Short hunt, beginner-friendly data." />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-violet/20 px-3 py-1 text-sm font-bold text-violet">Hunt mode</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-slate-300">5 minutes</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-slate-300">{hunt.tables.length} mock tables</span>
          </div>
          <h2 className="mt-5 text-3xl font-black text-white">{hunt.title}</h2>
          <p className="mt-3 text-slate-300">{hunt.summary}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {hunt.objectives.map((objective) => (
              <div key={objective} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
                <span className="mr-2 text-cyber">◆</span>{objective}
              </div>
            ))}
          </div>
        </article>

        <aside className="rounded-[2rem] border border-dashed border-slate-700 bg-slate-950/40 p-6">
          <span className="rounded-full bg-slate-800 px-3 py-1 text-sm font-bold text-slate-300">Training mode</span>
          <h2 className="mt-5 text-2xl font-black text-white">Guided lessons are coming next.</h2>
          <p className="mt-3 text-slate-400">
            Training mode will break KQL into drills with walkthroughs. For now, KQL Hunter focuses on the easy daily hunt backbone: realistic data, optional hints, scoring, and incident results.
          </p>
        </aside>
      </section>
    </div>
  );
}
