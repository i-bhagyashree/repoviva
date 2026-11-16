import { useState } from "react";
import type { Report, SavedReport } from "../lib/types";
import { QuestionCard } from "./QuestionCard";
import { Chip, ScoreBar, scoreColor, Section } from "./ui";

type Severity = Report["fileReviews"][number]["severity"];
type Difficulty = Report["questions"][number]["difficulty"];

export const SEVERITY_STYLE: Record<Severity, string> = {
  high: "bg-rose-500/15 text-rose-300",
  medium: "bg-amber-500/15 text-amber-300",
  low: "bg-sky-500/15 text-sky-300",
};

// Which issues the user has ticked as fixed. Kept per browser, per report.
function useFixed(reportId: string) {
  const key = `repoviva.fixed.${reportId}`;
  const [fixed, setFixed] = useState<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "[]") as number[];
    } catch {
      return [];
    }
  });
  function toggle(i: number) {
    const next = fixed.includes(i) ? fixed.filter((x) => x !== i) : [...fixed, i];
    setFixed(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return { fixed, toggle };
}

export function ReportView({ saved, readOnly = false }: { saved: SavedReport; readOnly?: boolean }) {
  const { report, repo } = saved;
  const overall = Math.round(report.overallScore);
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");
  const { fixed, toggle } = useFixed(saved.id);

  const counts = { high: 0, medium: 0, low: 0 };
  for (const f of report.fileReviews) counts[f.severity]++;
  const reviews = report.fileReviews.map((f, i) => ({ ...f, i })).filter((f) => severity === "all" || f.severity === severity);
  const questions = report.questions.map((q, i) => ({ q, i })).filter(({ q }) => difficulty === "all" || q.difficulty === difficulty);
  const fixedCount = fixed.filter((i) => i < report.fileReviews.length).length;

  return (
    <div className="space-y-6">
      {saved.engine === "builtin" && !readOnly && (
        <p className="rounded-xl border border-sky-400/40 bg-sky-500/10 p-4 text-sm text-sky-200 print:hidden">
          <strong>Quick check.</strong> This review comes from RepoViva's built-in rules (no AI). It finds common
          problems but cannot judge your design. Add ANTHROPIC_API_KEY to server/.env for a deeper AI review.
        </p>
      )}

      <Section title="Report card">
        <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="text-center">
            <p className={`text-6xl font-bold ${scoreColor(overall)}`}>{overall}</p>
            <p className="text-sm text-slate-400">out of 100</p>
            <p className="mt-1 text-xs font-medium text-slate-300">{grade(overall)}</p>
          </div>
          <div className="space-y-3">
            <ScoreBar label="Code quality" value={report.scores.codeQuality} />
            <ScoreBar label="Structure" value={report.scores.structure} />
            <ScoreBar label="Documentation" value={report.scores.documentation} />
            <ScoreBar label="Best practices" value={report.scores.bestPractices} />
          </div>
        </div>
        <a
          href={repo.url}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-block font-mono text-sm text-indigo-300 hover:underline"
        >
          {repo.owner}/{repo.name}
        </a>
        <p className="mt-2 text-slate-300">{report.summary}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {report.techStack.map((t) => (
            <span key={t} className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-slate-200">
              {t}
            </span>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-500">
          {saved.filesReviewed.length} files reviewed
          {saved.filesSkipped > 0 && `, ${saved.filesSkipped} skipped (too large or over the limit)`} ·{" "}
          {new Date(saved.createdAt).toLocaleString()}
        </p>
      </Section>

      <Section title="What you did well">
        <ul className="list-disc space-y-2 pl-5 text-slate-300">
          {report.strengths.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </Section>

      <Section
        title="Code review"
        action={
          !readOnly && report.fileReviews.length > 0 ? (
            <span className="text-sm text-slate-400">
              <span className="font-semibold text-emerald-400">{fixedCount}</span> / {report.fileReviews.length} fixed
            </span>
          ) : undefined
        }
      >
        <div className="mb-4 flex flex-wrap gap-2 print:hidden">
          <Chip active={severity === "all"} onClick={() => setSeverity("all")}>
            All ({report.fileReviews.length})
          </Chip>
          {(["high", "medium", "low"] as const).map((s) => (
            <Chip key={s} active={severity === s} onClick={() => setSeverity(s)}>
              {s} ({counts[s]})
            </Chip>
          ))}
        </div>
        {!readOnly && report.fileReviews.length > 0 && (
          <div className="mb-4 h-1.5 rounded-full bg-white/10 print:hidden">
            <div
              className="h-1.5 rounded-full bg-emerald-400 transition-all"
              style={{ width: `${(fixedCount / report.fileReviews.length) * 100}%` }}
            />
          </div>
        )}
        {reviews.length === 0 && <p className="text-sm text-slate-500">No issues at this level.</p>}
        <ul className="space-y-3">
          {reviews.map((f) => {
            const done = fixed.includes(f.i);
            return (
              <li key={f.i} className={`rounded-xl border border-white/10 p-4 print:break-inside-avoid ${done ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLE[f.severity]}`}>
                    {f.severity}
                  </span>
                  <code className="min-w-0 flex-1 break-all font-mono text-sm text-slate-200">{f.path}</code>
                  {!readOnly && (
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400 print:hidden">
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={() => toggle(f.i)}
                        className="h-4 w-4 accent-emerald-500"
                      />
                      Fixed
                    </label>
                  )}
                </div>
                <p className={`mt-2 text-slate-300 ${done ? "line-through" : ""}`}>{f.issue}</p>
                <p className="mt-2 text-sm text-emerald-300">
                  <span className="font-semibold">Fix: </span>
                  {f.suggestion}
                </p>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Interview questions from your project">
        <div className="mb-4 flex flex-wrap gap-2 print:hidden">
          <Chip active={difficulty === "all"} onClick={() => setDifficulty("all")}>
            All
          </Chip>
          {(["easy", "medium", "hard"] as const).map((d) => (
            <Chip key={d} active={difficulty === d} onClick={() => setDifficulty(d)}>
              {d}
            </Chip>
          ))}
        </div>
        <ul className="space-y-3">
          {questions.map(({ q, i }) => (
            <QuestionCard
              key={i}
              index={i}
              question={q}
              projectSummary={report.summary}
              reportId={saved.id}
              readOnly={readOnly}
            />
          ))}
        </ul>
      </Section>
    </div>
  );
}

export function grade(score: number): string {
  if (score >= 90) return "Interview ready";
  if (score >= 75) return "Strong";
  if (score >= 60) return "Good, needs polish";
  if (score >= 40) return "Needs work";
  return "Major fixes needed";
}
