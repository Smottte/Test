"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KqlEditor } from "@/components/KqlEditor";
import { TablePreview } from "@/components/TablePreview";
import type { Hunt, HuntAttemptResult } from "@/lib/types";
import { evaluateFinalAnswer } from "@/lib/hunts";

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function HuntExperience({ hunt }: { hunt: Hunt }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [finalAnswer, setFinalAnswer] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setElapsedSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function finishHunt() {
    const evaluation = evaluateFinalAnswer(finalAnswer, hunt.acceptedAnswers);
    const result: HuntAttemptResult = {
      huntSlug: hunt.slug,
      score: evaluation.score,
      maxScore: 100,
      timeSpentSeconds: elapsedSeconds,
      completedAt: new Date().toISOString(),
      query,
      finalAnswer,
      isCorrect: evaluation.isCorrect,
      correctAnswer: hunt.finalAnswer
    };

    window.localStorage.setItem(`kql-hunter-result-${hunt.slug}`, JSON.stringify(result));
    void fetch("/api/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result)
    });
    router.push(`/results/${hunt.slug}`);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="space-y-5">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-glow backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-cyber">Easy daily hunt</p>
              <h1 className="mt-2 text-3xl font-black text-white">{hunt.title}</h1>
            </div>
            <div className="rounded-2xl border border-cyber/40 bg-cyber/10 px-5 py-3 text-center">
              <p className="text-xs font-bold uppercase text-cyber">Time spent</p>
              <p className="text-3xl font-black text-white">{formatTime(elapsedSeconds)}</p>
            </div>
          </div>
          <p className="mt-5 text-slate-300">{hunt.summary}</p>
          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Case story</p>
            <p className="mt-2 text-slate-200">{hunt.story}</p>
          </div>
          <div className="mt-4 rounded-2xl border border-violet/30 bg-violet/10 p-4">
            <p className="text-sm font-bold uppercase tracking-wide text-violet">Main objective</p>
            <p className="mt-2 text-lg font-black text-white">{hunt.objective}</p>
          </div>
          <p className="mt-4 text-sm text-slate-400">Designed to take about 5 minutes, but there is no time limit.</p>
        </div>

        <div className="space-y-3">
          {hunt.tables.map((table) => (
            <TablePreview key={table.name} table={table} />
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-5 shadow-glow lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-slate-300">Free hunt mode</span>
          <span className="text-sm text-slate-400">Investigate freely, then submit one final answer.</span>
        </div>

        <h2 className="mt-5 text-2xl font-black text-white">Build your KQL investigation</h2>
        <p className="mt-2 text-slate-400">
          Use the available schemas to query, pivot, and narrow the incident down. Autocomplete only helps with KQL syntax and available fields.
        </p>

        <label htmlFor="query" className="mt-6 block text-sm font-bold uppercase tracking-wide text-slate-400">
          KQL query editor
        </label>
        <KqlEditor value={query} onChange={setQuery} tables={hunt.tables} />

        <label htmlFor="final-answer" className="mt-6 block text-sm font-bold uppercase tracking-wide text-slate-400">
          Final answer
        </label>
        <input
          id="final-answer"
          value={finalAnswer}
          onChange={(event) => setFinalAnswer(event.target.value)}
          className="mt-2 w-full rounded-2xl border-slate-700 bg-slate-900/95 text-sm text-white shadow-inner placeholder:text-slate-600 focus:border-cyber focus:ring-cyber"
          placeholder="Enter the single answer to the main objective"
        />

        <button
          onClick={finishHunt}
          className="mt-5 w-full rounded-2xl bg-cyber px-5 py-4 font-black text-ink transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!finalAnswer.trim()}
        >
          Submit final answer
        </button>
      </section>
    </div>
  );
}
