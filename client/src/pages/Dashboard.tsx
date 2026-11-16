import { useMemo, useState } from "react";
import { ScoreChart } from "../components/ScoreChart";
import { btnPrimary, ErrorBox, inputCls, scoreColor, Section, Spinner, StatCard } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { clearLegacyReports, readLegacyReports } from "../lib/history";
import { Link, navigate } from "../lib/router";
import type { PracticeAttempt, StoredReport } from "../lib/types";
import { useApi } from "../lib/useApi";

type Sort = "newest" | "oldest" | "best" | "worst";

const NO_REPORTS: StoredReport[] = [];
const NO_ATTEMPTS: PracticeAttempt[] = [];

const LOADING_STEPS = ["Fetching files from GitHub...", "Reading your code...", "Checking for issues...", "Writing interview questions..."];

export function Dashboard({ initialUrl }: { initialUrl: string }) {
  const { user } = useAuth();
  const reports = useApi<StoredReport[]>("/api/reports");
  const practice = useApi<PracticeAttempt[]>("/api/practice");
  const [url, setUrl] = useState(initialUrl);
  const [analyzing, setAnalyzing] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [legacy, setLegacy] = useState(readLegacyReports);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    setAnalyzing(true);
    setError(null);
    setStep(0);
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 2500);
    try {
      const saved = await api<StoredReport>("/api/analyze", { body: { url } });
      navigate(`/report/${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      clearInterval(timer);
      setAnalyzing(false);
    }
  }

  async function importLegacy() {
    try {
      await api("/api/reports/import", { body: { reports: legacy } });
      clearLegacyReports();
      setLegacy([]);
      reports.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    }
  }

  async function remove(r: StoredReport) {
    if (!confirm(`Delete the report for ${r.repo.owner}/${r.repo.name}?`)) return;
    try {
      await api(`/api/reports/${r.id}`, { method: "DELETE" });
      reports.setData((list) => list?.filter((x) => x.id !== r.id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  const list = reports.data ?? NO_REPORTS;
  const attempts = practice.data ?? NO_ATTEMPTS;

  const stats = useMemo(() => {
    const scores = list.map((r) => Math.round(r.report.overallScore));
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const best = scores.length ? Math.max(...scores) : null;
    const practiceAvg = attempts.length
      ? (attempts.reduce((a, b) => a + b.score, 0) / attempts.length).toFixed(1)
      : null;
    // Weakest topics: lowest average answer score (topics with 1+ attempts).
    const byTopic = new Map<string, { sum: number; n: number }>();
    for (const a of attempts) {
      const t = byTopic.get(a.topic) ?? { sum: 0, n: 0 };
      t.sum += a.score;
      t.n++;
      byTopic.set(a.topic, t);
    }
    const weakTopics = [...byTopic.entries()]
      .map(([topic, t]) => ({ topic, avg: t.sum / t.n, n: t.n }))
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 4);
    const openHigh = list.reduce((n, r) => n + r.report.fileReviews.filter((f) => f.severity === "high").length, 0);
    return { avg, best, practiceAvg, weakTopics, openHigh };
  }, [list, attempts]);

  const trend = useMemo(
    () =>
      [...list]
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((r) => ({
          label: `${r.repo.name} (${new Date(r.createdAt).toLocaleDateString()})`,
          value: Math.round(r.report.overallScore),
        })),
    [list],
  );

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = list.filter(
      (r) =>
        !q ||
        `${r.repo.owner}/${r.repo.name}`.toLowerCase().includes(q) ||
        r.report.techStack.some((t) => t.toLowerCase().includes(q)),
    );
    const cmp: Record<Sort, (a: StoredReport, b: StoredReport) => number> = {
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
      best: (a, b) => b.report.overallScore - a.report.overallScore,
      worst: (a, b) => a.report.overallScore - b.report.overallScore,
    };
    return filtered.sort(cmp[sort]);
  }, [list, search, sort]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold text-white">Hi, {user?.name.split(" ")[0]} 👋</h1>
        <p className="mt-1 text-slate-400">Review a repo, practice its questions, and watch your scores improve.</p>
      </div>

      <section className="rounded-2xl border border-indigo-400/30 bg-indigo-500/10 p-5 sm:p-6">
        <h2 className="font-semibold text-white">Review a GitHub repository</h2>
        <form onSubmit={analyze} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="repo-url" className="sr-only">
            GitHub repository link
          </label>
          <input
            id="repo-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            autoComplete="off"
            className={`${inputCls} flex-1 py-3`}
          />
          <button type="submit" disabled={analyzing || url.trim() === ""} className={`${btnPrimary} px-6 py-3`}>
            {analyzing ? "Reviewing..." : "Review my repo"}
          </button>
        </form>
        {analyzing && (
          <p role="status" className="mt-4 flex items-center gap-3 text-sm text-indigo-200">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-transparent" />
            {LOADING_STEPS[step]}
          </p>
        )}
        {error && (
          <div className="mt-4">
            <ErrorBox>{error}</ErrorBox>
          </div>
        )}
      </section>

      {legacy.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          <span>
            Found {legacy.length} report{legacy.length > 1 ? "s" : ""} saved in this browser by an older version.
          </span>
          <div className="flex gap-2">
            <button onClick={importLegacy} className="rounded-lg bg-amber-500 px-3 py-1.5 font-semibold text-black hover:bg-amber-400">
              Import to my account
            </button>
            <button
              onClick={() => {
                clearLegacyReports();
                setLegacy([]);
              }}
              className="rounded-lg px-3 py-1.5 text-amber-200 hover:bg-white/10"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {reports.loading && !reports.data ? (
        <Spinner />
      ) : reports.error ? (
        <ErrorBox>{reports.error}</ErrorBox>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard label="Repos reviewed" value={list.length} />
            <StatCard label="Average score" value={stats.avg ?? "—"} hint="out of 100" />
            <StatCard label="Best score" value={stats.best ?? "—"} />
            <StatCard label="Answers practiced" value={attempts.length} />
            <StatCard label="Avg answer score" value={stats.practiceAvg ?? "—"} hint="out of 10" />
          </div>

          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <Section title="Score trend">
              <ScoreChart points={trend} />
            </Section>
            <Section title="Focus next">
              {stats.weakTopics.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Practice a few interview answers and your weakest topics will show up here.
                </p>
              ) : (
                <ul className="space-y-3">
                  {stats.weakTopics.map((t) => (
                    <li key={t.topic} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-200">{t.topic}</span>
                      <span className={`font-semibold ${scoreColor(t.avg * 10)}`}>
                        {t.avg.toFixed(1)}/10 <span className="font-normal text-slate-500">({t.n})</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {stats.openHigh > 0 && (
                <p className="mt-4 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-200">
                  {stats.openHigh} high-priority issue{stats.openHigh > 1 ? "s" : ""} across your repos.
                </p>
              )}
              <Link to="/practice" className="mt-4 inline-block text-sm font-medium text-indigo-300 hover:underline">
                Start a mock interview →
              </Link>
            </Section>
          </div>

          <Section
            title="Your reports"
            action={
              list.length > 1 ? (
                <Link to="/compare" className="text-sm font-medium text-indigo-300 hover:underline">
                  Compare repos
                </Link>
              ) : undefined
            }
          >
            {list.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-slate-300">No reports yet.</p>
                <p className="mt-1 text-sm text-slate-500">
                  Paste a GitHub link above. Not sure? Try{" "}
                  <button className="text-indigo-300 hover:underline" onClick={() => setUrl("https://github.com/expressjs/cors")}>
                    expressjs/cors
                  </button>
                  .
                </p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by repo or tech (e.g. React)"
                    aria-label="Search reports"
                    className={`${inputCls} flex-1`}
                  />
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as Sort)}
                    aria-label="Sort reports"
                    className="rounded-xl border border-white/10 bg-[#141a2e] px-3 py-2.5 text-sm text-slate-200"
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="best">Highest score</option>
                    <option value="worst">Lowest score</option>
                  </select>
                </div>
                {shown.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No reports match.</p>}
                <ul className="grid gap-3 md:grid-cols-2">
                  {shown.map((r) => {
                    const score = Math.round(r.report.overallScore);
                    const high = r.report.fileReviews.filter((f) => f.severity === "high").length;
                    return (
                      <li
                        key={r.id}
                        className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:border-indigo-400/50"
                      >
                        <span className={`w-12 text-center text-2xl font-bold ${scoreColor(score)}`}>{score}</span>
                        <Link to={`/report/${r.id}`} className="min-w-0 flex-1">
                          <span className="block truncate font-mono text-sm text-slate-100">
                            {r.repo.owner}/{r.repo.name}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {new Date(r.createdAt).toLocaleDateString()} ·{" "}
                            {r.engine === "builtin" ? "quick check" : "AI review"}
                            {high > 0 && <span className="text-rose-300"> · {high} high</span>}
                            {r.shared && <span className="text-emerald-300"> · shared</span>}
                          </span>
                          <span className="mt-1.5 flex flex-wrap gap-1">
                            {r.report.techStack.slice(0, 4).map((t) => (
                              <span key={t} className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-slate-300">
                                {t}
                              </span>
                            ))}
                          </span>
                        </Link>
                        <button
                          onClick={() => remove(r)}
                          aria-label={`Delete report for ${r.repo.owner}/${r.repo.name}`}
                          className="text-sm text-slate-500 hover:text-rose-300"
                        >
                          Delete
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
