import { useState } from "react";
import { api } from "../lib/api";
import type { Feedback, Report } from "../lib/types";

export type Question = Report["questions"][number];

export const DIFFICULTY_STYLE: Record<Question["difficulty"], string> = {
  easy: "bg-emerald-500/15 text-emerald-300",
  medium: "bg-amber-500/15 text-amber-300",
  hard: "bg-rose-500/15 text-rose-300",
};

export async function requestFeedback(input: {
  question: Question;
  projectSummary: string;
  answer: string;
  reportId?: string;
}): Promise<Feedback> {
  return api<Feedback>("/api/feedback", {
    body: {
      question: input.question.question,
      goodAnswerCovers: input.question.goodAnswerCovers,
      topic: input.question.topic,
      projectSummary: input.projectSummary,
      answer: input.answer,
      reportId: input.reportId,
    },
  });
}

export function QuestionCard({
  index,
  question,
  projectSummary,
  reportId,
  readOnly = false,
}: {
  index: number;
  question: Question;
  projectSummary: string;
  reportId?: string;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setFeedback(await requestFeedback({ question, projectSummary, answer, reportId }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not grade the answer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.03] p-4 print:break-inside-avoid">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400">Q{index + 1}</span>
        <span className={`rounded-full px-2 py-0.5 font-medium ${DIFFICULTY_STYLE[question.difficulty]}`}>
          {question.difficulty}
        </span>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-slate-300">{question.topic}</span>
      </div>
      <p className="mt-2 font-medium text-slate-100">{question.question}</p>

      <div className="mt-3 flex flex-wrap gap-4 print:hidden">
        <button
          onClick={() => setShowHints((v) => !v)}
          className="text-sm font-medium text-slate-400 hover:text-slate-200"
        >
          {showHints ? "Hide hints" : "Show what to cover"}
        </button>
        {!readOnly && !open && (
          <button onClick={() => setOpen(true)} className="text-sm font-medium text-indigo-300 hover:text-indigo-200">
            Practice this answer
          </button>
        )}
      </div>
      {showHints && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-400">
          {question.goodAnswerCovers.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}

      {open && (
        <form onSubmit={submit} className="mt-3 space-y-3">
          <label className="block text-sm text-slate-400" htmlFor={`answer-${index}`}>
            Your answer
          </label>
          <textarea
            id={`answer-${index}`}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="Answer as you would in an interview..."
            className="w-full rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-slate-100 outline-none focus:border-indigo-400"
          />
          <div className="flex items-center justify-between gap-3">
            <button
              type="submit"
              disabled={loading || answer.trim().length < 10}
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Grading..." : feedback ? "Grade again" : "Get feedback"}
            </button>
            <span className="text-xs text-slate-500">{answer.trim() ? answer.trim().split(/\s+/).length : 0} words</span>
          </div>
          {error && <p className="text-sm text-rose-300">{error}</p>}
        </form>
      )}

      {feedback && <FeedbackPanel feedback={feedback} />}
    </li>
  );
}

export function FeedbackPanel({ feedback }: { feedback: Feedback }) {
  return (
    <div className="mt-4 space-y-3 rounded-lg border border-indigo-400/30 bg-indigo-500/10 p-4 text-sm">
      <p className="text-slate-100">
        <span className="text-2xl font-bold">{feedback.score}</span>
        <span className="text-slate-400"> / 10</span>
        <span className="ml-3">{feedback.verdict}</span>
      </p>
      <FeedbackList title="What was good" items={feedback.whatWasGood} />
      <FeedbackList title="What was missing" items={feedback.whatWasMissing} />
      <div>
        <p className="font-semibold text-slate-200">Model answer</p>
        <p className="mt-1 text-slate-300">{feedback.modelAnswer}</p>
      </div>
    </div>
  );
}

function FeedbackList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="font-semibold text-slate-200">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-300">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
