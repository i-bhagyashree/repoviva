import { useState } from "react";
import { btnGhost, btnPrimary, ScoreBar } from "../components/ui";
import { useAuth } from "../lib/auth";
import { STATIC } from "../lib/config";
import { Link } from "../lib/router";

const FEATURES = [
  {
    icon: "M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    title: "Senior-style code review",
    text: "Scores for code quality, structure, docs and best practices, with file-by-file issues and a concrete fix for each.",
  },
  {
    icon: "M8 10h8M8 14h5M21 12a9 9 0 01-13.5 7.8L3 21l1.2-4.5A9 9 0 1121 12z",
    title: "Questions about YOUR code",
    text: "The interview questions a recruiter would actually ask about this project, tagged by topic and difficulty.",
  },
  {
    icon: "M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    title: "Timed mock interviews",
    text: "Answer against the clock, get each answer graded out of 10, and see what you missed plus a model answer.",
  },
  {
    icon: "M4 19V5M4 19h16M8 15l3-4 3 2 5-6",
    title: "Track your progress",
    text: "A dashboard with your score trend, practice stats and weakest topics, so you know what to study next.",
  },
  {
    icon: "M5 13l4 4L19 7",
    title: "Fix-it checklist",
    text: "Tick off issues as you fix them and re-run the review to watch your score climb.",
  },
  {
    icon: "M8.7 13.3l6.6 3.4M15.3 7.3l-6.6 3.4M18 8a3 3 0 100-6 3 3 0 000 6zM6 15a3 3 0 100-6 3 3 0 000 6zM18 22a3 3 0 100-6 3 3 0 000 6z",
    title: "Share, export, compare",
    text: "Share a read-only report link, export to Markdown or PDF, and compare two repos side by side.",
  },
];

const STEPS = [
  { n: "1", title: "Paste a GitHub link", text: "Any public repository. RepoViva reads the most important files." },
  { n: "2", title: "Get your report", text: "A score card, strengths, issues to fix and interview questions." },
  { n: "3", title: "Practice and improve", text: "Answer questions, get graded, fix issues, review again." },
];

const FAQ = [
  {
    q: "Do I need an API key?",
    a: "No. RepoViva has a built-in review engine that works offline from any AI service. If you add a Claude API key on the server, reviews get deeper.",
  },
  {
    q: "Is my code stored?",
    a: STATIC
      ? "No. Your code is read from GitHub inside your browser, and reports are saved only in your browser."
      : "Only the finished report is saved to your account. Your source code is read from GitHub for the review and not kept.",
  },
  {
    q: "Which repos work?",
    a: "Any public GitHub repository: JavaScript, TypeScript, Python, Java, Go and more.",
  },
  {
    q: "Who can see my reports?",
    a: "Only you. A report becomes visible to others only if you switch on its share link.",
  },
];

export function Home() {
  const { user } = useAuth();
  const ctaTo = user ? "/dashboard" : "/signup";

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-96 max-w-3xl rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:py-24 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="inline-block rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-200">
              Free · No API key needed
            </p>
            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
              Walk into your interview <span className="text-indigo-400">knowing your own code.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-400">
              Paste your GitHub project. Get a senior-developer code review, the exact questions a recruiter will
              ask about it, and graded mock interviews to practice your answers.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={ctaTo} className={`${btnPrimary} px-6 py-3 text-base`}>
                {user ? "Go to dashboard" : "Review my repo, free"}
              </Link>
              {!user && (
                <Link to="/login" className={`${btnGhost} px-6 py-3 text-base`}>
                  I have an account
                </Link>
              )}
            </div>
          </div>

          {/* Preview card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-indigo-950/50">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-indigo-300">you/portfolio-app</span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">Strong</span>
            </div>
            <div className="mt-5 grid grid-cols-[auto_1fr] items-center gap-6">
              <div className="text-center">
                <p className="text-5xl font-bold text-emerald-400">82</p>
                <p className="text-xs text-slate-400">out of 100</p>
              </div>
              <div className="space-y-2.5">
                <ScoreBar label="Code quality" value={84} />
                <ScoreBar label="Structure" value={88} />
                <ScoreBar label="Documentation" value={65} />
                <ScoreBar label="Best practices" value={79} />
              </div>
            </div>
            <div className="mt-5 rounded-xl border border-white/10 p-3 text-sm">
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">medium</span>
              <code className="ml-2 font-mono text-xs text-slate-300">src/api/users.ts</code>
              <p className="mt-2 text-slate-300">User input reaches the database query without validation.</p>
            </div>
            <div className="mt-3 rounded-xl border border-white/10 p-3 text-sm">
              <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs text-rose-300">hard</span>
              <p className="mt-2 text-slate-100">Why did you choose context over a state library here?</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold text-white">How it works</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500 font-bold text-white">
                {s.n}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-white">{s.title}</h3>
              <p className="mt-2 text-slate-400">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold text-white">Everything you need to prepare</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-400">
          Built for students and junior developers who want their projects to do the talking.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <svg
                className="h-8 w-8 text-indigo-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={f.icon} />
              </svg>
              <h3 className="mt-4 font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-400">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold text-white">Questions</h2>
        <div className="mt-8 space-y-3">
          {FAQ.map((f) => (
            <FaqItem key={f.q} {...f} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 px-6 py-12 text-center">
          <h2 className="text-3xl font-bold text-white">Your next interview starts with your repo.</h2>
          <p className="mx-auto mt-3 max-w-xl text-indigo-100">It takes less than a minute to get your first report.</p>
          <Link
            to={ctaTo}
            className="mt-6 inline-block rounded-xl bg-white px-6 py-3 font-semibold text-indigo-700 hover:bg-indigo-50"
          >
            {user ? "Open dashboard" : "Create free account"}
          </Link>
        </div>
      </section>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03]">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium text-slate-100"
      >
        {q}
        <span className="text-xl text-slate-400">{open ? "−" : "+"}</span>
      </button>
      {open && <p className="px-5 pb-4 text-slate-400">{a}</p>}
    </div>
  );
}
