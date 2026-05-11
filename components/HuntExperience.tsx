"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TablePreview } from "@/components/TablePreview";
import type { Hunt, HuntAttemptResult, StepResult } from "@/lib/types";
import { evaluateStep } from "@/lib/hunts";

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function HuntExperience({ hunt }: { hunt: Hunt }) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => hunt.steps.map(() => ""));
  const [shownHints, setShownHints] = useState<number[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(hunt.durationSeconds);

  useEffect(() => {
    if (timeRemaining <= 0) {
      finishHunt();
      return;
    }

    const timer = window.setInterval(() => setTimeRemaining((value) => value - 1), 1000);
    return () => window.clearInterval(timer);
  }, [timeRemaining]);

  const step = hunt.steps[currentStep];
  const progress = useMemo(() => ((currentStep + 1) / hunt.steps.length) * 100, [currentStep, hunt.steps.length]);

  function updateAnswer(value: string) {
    setAnswers((existing) => existing.map((answer, index) => (index === currentStep ? value : answer)));
  }

  function showHint() {
    setShownHints((existing) => (existing.includes(currentStep) ? existing : [...existing, currentStep]));
  }

  function submitStep() {
    if (currentStep < hunt.steps.length - 1) {
      setCurrentStep((value) => value + 1);
      return;
    }

    finishHunt();
  }

  function finishHunt() {
    const stepResults: StepResult[] = hunt.steps.map((huntStep, index) => {
      const evaluation = evaluateStep(answers[index] ?? "", huntStep.acceptedTerms);
      const hintPenalty = shownHints.includes(index) ? 10 : 0;
      return {
        order: huntStep.order,
        answer: answers[index] ?? "",
        score: Math.max(0, evaluation.score - hintPenalty),
        maxScore: 100,
        matchedTerms: evaluation.matchedTerms
      };
    });

    const score = Math.round(stepResults.reduce((sum, result) => sum + result.score, 0) / stepResults.length);
    const result: HuntAttemptResult = {
      huntSlug: hunt.slug,
      score,
      maxScore: 100,
      timeRemaining: Math.max(0, timeRemaining),
      completedAt: new Date().toISOString(),
      stepResults
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
            <div className="rounded-2xl border border-danger/40 bg-danger/10 px-5 py-3 text-center">
              <p className="text-xs font-bold uppercase text-danger">Timer</p>
              <p className="text-3xl font-black text-white">{formatTime(timeRemaining)}</p>
            </div>
          </div>
          <p className="mt-5 text-slate-300">{hunt.summary}</p>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-cyber transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="space-y-3">
          {hunt.tables.map((table) => (
            <TablePreview key={table.name} table={table} />
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-5 shadow-glow lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-slate-300">
            Question {step.order} of {hunt.steps.length}
          </span>
          <span className="text-sm text-slate-400">Optional hints cost 10 points on that step.</span>
        </div>

        <h2 className="mt-5 text-2xl font-black text-white">{step.question}</h2>
        {shownHints.includes(currentStep) ? (
          <div className="mt-4 rounded-2xl border border-cyber/30 bg-cyber/10 p-4 text-sm text-teal-100">
            <strong>Hint:</strong> {step.hint}
          </div>
        ) : null}

        <label htmlFor="query" className="mt-6 block text-sm font-bold uppercase tracking-wide text-slate-400">
          KQL query editor
        </label>
        <textarea
          id="query"
          value={answers[currentStep]}
          onChange={(event) => updateAnswer(event.target.value)}
          className="kql-editor mt-2 min-h-72 w-full rounded-2xl border-slate-700 bg-slate-900/95 text-sm text-cyber shadow-inner focus:border-cyber focus:ring-cyber"
          placeholder="SigninLogs&#10;| where ...&#10;| project ..."
        />

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button onClick={submitStep} className="flex-1 rounded-2xl bg-cyber px-5 py-4 font-black text-ink transition hover:bg-teal-300">
            {currentStep === hunt.steps.length - 1 ? "Finish hunt" : "Submit answer"}
          </button>
          <button onClick={showHint} className="rounded-2xl border border-slate-700 px-5 py-4 font-bold text-slate-200 transition hover:border-cyber hover:text-cyber">
            Hint
          </button>
        </div>
      </section>
    </div>
  );
}
