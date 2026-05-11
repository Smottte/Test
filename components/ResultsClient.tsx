"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Hunt, HuntAttemptResult } from "@/lib/types";

export function ResultsClient({ hunt }: { hunt: Hunt }) {
  const [result, setResult] = useState<HuntAttemptResult | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(`kql-hunter-result-${hunt.slug}`);
    if (stored) {
      setResult(JSON.parse(stored) as HuntAttemptResult);
    }
  }, [hunt.slug]);

  if (!result) {
    return (
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-white/10 bg-slate-950/80 p-8 text-center">
        <h1 className="text-3xl font-black text-white">No attempt found yet.</h1>
        <p className="mt-3 text-slate-400">Complete the daily hunt to unlock scoring, ideal KQL, and the incident explanation.</p>
        <Link href={`/hunt/${hunt.slug}`} className="mt-6 inline-flex rounded-2xl bg-cyber px-6 py-3 font-black text-ink">Start hunt</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-glow backdrop-blur">
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-cyber">Incident report</p>
        <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-black text-white">Score: {result.score}/{result.maxScore}</h1>
            <p className="mt-2 text-slate-300">You completed {hunt.title} with {result.timeRemaining} seconds remaining.</p>
          </div>
          <Link href="/" className="rounded-2xl border border-slate-700 px-5 py-3 font-bold text-slate-200 hover:border-cyber hover:text-cyber">
            Back to dashboard
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {Object.entries(hunt.affected).map(([key, value]) => (
          <div key={key} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Affected {key}</p>
            <p className="mt-2 break-words text-sm font-bold text-white">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-6">
        <h2 className="text-2xl font-black text-white">What happened?</h2>
        <p className="mt-3 text-slate-300">{hunt.explanation}</p>
      </section>

      <section className="space-y-4">
        {hunt.steps.map((step, index) => {
          const stepResult = result.stepResults[index];
          const passed = stepResult.score >= 70;

          return (
            <article key={step.order} className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xl font-black text-white">Step {step.order}: {passed ? "Correct" : "Needs practice"}</h3>
                <span className={passed ? "rounded-full bg-cyber/10 px-3 py-1 text-sm font-bold text-cyber" : "rounded-full bg-danger/10 px-3 py-1 text-sm font-bold text-danger"}>
                  {stepResult.score}/100
                </span>
              </div>
              <p className="mt-3 text-slate-300">{step.explanation}</p>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-bold uppercase text-slate-500">Your query</p>
                  <pre className="min-h-32 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300"><code>{stepResult.answer || "No answer submitted."}</code></pre>
                </div>
                <div>
                  <p className="mb-2 text-sm font-bold uppercase text-slate-500">Ideal KQL</p>
                  <pre className="overflow-x-auto rounded-2xl border border-cyber/20 bg-cyber/5 p-4 text-sm text-cyber"><code>{step.expectedKql}</code></pre>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
