import { useEffect, useRef, useState } from "react";
import { DIFFICULTY_STYLE, FeedbackPanel, requestFeedback, type Question } from "../components/QuestionCard";
import { btnGhost, btnPrimary, ErrorBox, scoreColor, Section, Spinner, StatCard } from "../components/ui";
import { Link } from "../lib/router";
import type { Feedback, PracticeAttempt, StoredReport } from "../lib/types";
import { useApi } from "../lib/useApi";

interface Item {
  question: Question;
  reportId: string;
  repoName: string;
  summary: string;
}

interface Result {
  item: Item;
  answer: string;
  feedback: Feedback | null; // null = skipped
}

type Difficulty = Question["difficulty"] | "any";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function Practice({ initialReport }: { initialReport: string | null }) {
  const reports = useApi<StoredReport[]>("/api/reports");
  const history = useApi<PracticeAttempt[]>("/api/practice");

  const [source, setSource] = useState<string>(initialReport ?? "all");
  const [count, setCount] = useState(5);
  const [minutes, setMinutes] = useState(2);
  const [difficulty, setDifficulty] = useState<Difficulty>("any");

  const [items, setItems] = useState<Item[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answerRef = useRef(answer);
  answerRef.current = answer;

  const list = reports.data ?? [];
  const current = items?.[index];
  const finished = items !== null && index >= items.length;
  const waiting = current && !feedback && !grading;

  // Countdown while the user is answering.
  useEffect(() => {
    if (!waiting || minutes === 0) return;
    if (timeLeft <= 0) {
      // Time is up: grade what was written. If grading failed, let the user retry by hand.
      if (!error) void submit(true);
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting, timeLeft, minutes, error]);

  function start() {
    const chosen = source === "all" ? list : list.filter((r) => r.id === source);
    let pool: Item[] = chosen.flatMap((r) =>
      r.report.questions.map((q) => ({ question: q, reportId: r.id, repoName: r.repo.name, summary: r.report.summary })),
    );
    if (difficulty !== "any") pool = pool.filter((p) => p.question.difficulty === difficulty);
    if (pool.length === 0) {
      setError("No questions match these settings. Try another difficulty or repo.");
      return;
    }
    setError(null);
    setItems(shuffle(pool).slice(0, count));
    setIndex(0);
    setResults([]);
    resetQuestion();
  }

  function resetQuestion() {
    setAnswer("");
    setFeedback(null);
    setTimeLeft(minutes * 60);
  }

  async function submit(timedOut = false) {
    if (!current) return;
    const text = answerRef.current.trim();
    if (text.length < 10) {
      if (timedOut) skip();
      return;
    }
    setGrading(true);
    setError(null);
    try {
      const fb = await requestFeedback({
        question: current.question,
        projectSummary: current.summary,
        answer: text,
        reportId: current.reportId,
      });
      setFeedback(fb);
      setResults((r) => [...r, { item: current, answer: text, feedback: fb }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not grade the answer.");
    } finally {
      setGrading(false);
    }
  }

  function skip() {
    if (!current) return;
    setResults((r) => [...r, { item: current, answer: answerRef.current, feedback: null }]);
    next();
  }

  function next() {
    setIndex((i) => i + 1);
    resetQuestion();
  }

  function quit() {
    setItems(null);
    history.reload();
  }

  if (reports.loading && !reports.data) return <Spinner />;
  if (reports.error) return <div className="mx-auto max-w-3xl px-4 py-16"><ErrorBox>{reports.error}</ErrorBox></div>;

  if (list.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-white">Mock interview</h1>
        <p className="mt-3 text-slate-400">Review a repo first. Its interview questions become your practice set.</p>
        <Link to="/dashboard" className={`${btnPrimary} mt-6`}>
          Review a repo
        </Link>
      </div>
    );
  }

  // ----- Running a session -----
  if (current) {
    const urgent = minutes > 0 && timeLeft <= 15;
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-slate-400">
            Question {index + 1} of {items!.length} · <span className="font-mono">{current.repoName}</span>
          </p>
          {minutes > 0 && !feedback && (
            <p className={`font-mono text-2xl font-bold ${urgent ? "animate-pulse text-rose-400" : "text-white"}`} aria-live="polite">
              {fmt(Math.max(0, timeLeft))}
            </p>
          )}
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-white/10">
          <div className="h-1.5 rounded-full bg-indigo-400 transition-all" style={{ width: `${(index / items!.length) * 100}%` }} />
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className={`rounded-full px-2 py-0.5 font-medium ${DIFFICULTY_STYLE[current.question.difficulty]}`}>
              {current.question.difficulty}
            </span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-slate-300">{current.question.topic}</span>
          </div>
          <p className="mt-3 text-xl font-semibold text-white">{current.question.question}</p>

          {!feedback ? (
            <>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={7}
                maxLength={4000}
                autoFocus
                aria-label="Your answer"
                placeholder="Answer out loud in your head, then type it here..."
                className="mt-5 w-full rounded-xl border border-white/10 bg-black/30 p-4 text-slate-100 outline-none focus:border-indigo-400"
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button onClick={() => submit()} disabled={grading || answer.trim().length < 10} className={btnPrimary}>
                  {grading ? "Grading..." : "Submit answer"}
                </button>
                <button onClick={skip} disabled={grading} className={btnGhost}>
                  Skip
                </button>
                <span className="ml-auto text-xs text-slate-500">
                  {answer.trim() ? answer.trim().split(/\s+/).length : 0} words
                </span>
              </div>
            </>
          ) : (
            <>
              <FeedbackPanel feedback={feedback} />
              <button onClick={next} className={`${btnPrimary} mt-4`}>
                {index + 1 < items!.length ? "Next question →" : "See results"}
              </button>
            </>
          )}
          {error && (
            <div className="mt-4">
              <ErrorBox>{error}</ErrorBox>
            </div>
          )}
        </div>
        <button onClick={quit} className="mt-6 text-sm text-slate-500 hover:text-slate-300">
          End session
        </button>
      </div>
    );
  }

  // ----- Session summary -----
  if (finished) {
    const graded = results.filter((r) => r.feedback);
    const avg = graded.length ? graded.reduce((a, r) => a + r.feedback!.score, 0) / graded.length : 0;
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Session complete</h1>
          <p className={`mt-4 text-6xl font-bold ${scoreColor(avg * 10)}`}>{avg.toFixed(1)}</p>
          <p className="text-slate-400">average out of 10 · {graded.length} answered, {results.length - graded.length} skipped</p>
        </div>
        <Section title="Your answers">
          <ul className="space-y-3">
            {results.map((r, i) => (
              <li key={i} className="flex items-start gap-4 rounded-xl border border-white/10 p-4">
                <span className={`w-10 shrink-0 text-center text-xl font-bold ${r.feedback ? scoreColor(r.feedback.score * 10) : "text-slate-500"}`}>
                  {r.feedback ? r.feedback.score : "—"}
                </span>
                <div className="min-w-0">
                  <p className="text-slate-100">{r.item.question.question}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {r.item.question.topic} · {r.feedback ? r.feedback.verdict : "Skipped"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
        <div className="flex justify-center gap-3">
          <button onClick={start} className={btnPrimary}>
            New session
          </button>
          <button onClick={quit} className={btnGhost}>
            Back to setup
          </button>
        </div>
      </div>
    );
  }

  // ----- Setup -----
  const attempts = history.data ?? [];
  const recent = [...attempts].reverse().slice(0, 8);
  const avgAll = attempts.length ? attempts.reduce((a, b) => a + b.score, 0) / attempts.length : null;
  const strong = attempts.filter((a) => a.score >= 8).length;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold text-white">Mock interview</h1>
        <p className="mt-1 text-slate-400">Timed questions from your own repos, graded one by one, like the real thing.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Section title="Set up your session">
          <div className="space-y-5">
            <Field label="Questions from">
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#141a2e] px-3 py-2.5 text-sm text-slate-200"
              >
                <option value="all">All my repos (mixed)</option>
                {list.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.repo.owner}/{r.repo.name} · {new Date(r.createdAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Number of questions">
              <Options value={count} options={[3, 5, 8, 10]} onChange={setCount} render={(n) => String(n)} />
            </Field>
            <Field label="Time per question">
              <Options value={minutes} options={[1, 2, 3, 5, 0]} onChange={setMinutes} render={(m) => (m ? `${m} min` : "No timer")} />
            </Field>
            <Field label="Difficulty">
              <Options
                value={difficulty}
                options={["any", "easy", "medium", "hard"] as Difficulty[]}
                onChange={setDifficulty}
                render={(d) => d}
              />
            </Field>
            {error && <ErrorBox>{error}</ErrorBox>}
            <button onClick={start} className={`${btnPrimary} w-full py-3`}>
              Start interview
            </button>
          </div>
        </Section>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Answers" value={attempts.length} />
            <StatCard label="Average" value={avgAll === null ? "—" : avgAll.toFixed(1)} hint="out of 10" />
          </div>
          <StatCard label="Strong answers (8+)" value={strong} />
          <Section title="Recent answers">
            {recent.length === 0 ? (
              <p className="text-sm text-slate-500">Your graded answers will appear here.</p>
            ) : (
              <ul className="space-y-2.5">
                {recent.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 text-sm">
                    <span className={`w-6 shrink-0 font-bold ${scoreColor(a.score * 10)}`}>{a.score}</span>
                    <span className="line-clamp-2 text-slate-300">{a.question}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-slate-300">{label}</p>
      {children}
    </div>
  );
}

function Options<T extends string | number>({
  value,
  options,
  onChange,
  render,
}: {
  value: T;
  options: T[];
  onChange: (v: T) => void;
  render: (v: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          onClick={() => onChange(o)}
          aria-pressed={value === o}
          className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
            value === o ? "bg-indigo-500 text-white" : "bg-white/10 text-slate-300 hover:bg-white/15"
          }`}
        >
          {render(o)}
        </button>
      ))}
    </div>
  );
}
