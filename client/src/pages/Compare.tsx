import { scoreColor, ErrorBox, Section, Spinner } from "../components/ui";
import { Link, navigate } from "../lib/router";
import type { StoredReport } from "../lib/types";
import { useApi } from "../lib/useApi";

const ROWS: { label: string; get: (r: StoredReport) => number }[] = [
  { label: "Overall", get: (r) => r.report.overallScore },
  { label: "Code quality", get: (r) => r.report.scores.codeQuality },
  { label: "Structure", get: (r) => r.report.scores.structure },
  { label: "Documentation", get: (r) => r.report.scores.documentation },
  { label: "Best practices", get: (r) => r.report.scores.bestPractices },
];

const label = (r: StoredReport) => `${r.repo.owner}/${r.repo.name} · ${new Date(r.createdAt).toLocaleDateString()}`;

export function Compare({ a, b }: { a: string | null; b: string | null }) {
  const { data, error, loading } = useApi<StoredReport[]>("/api/reports");
  if (loading && !data) return <Spinner />;
  if (error) return <div className="mx-auto max-w-3xl px-4 py-16"><ErrorBox>{error}</ErrorBox></div>;

  const list = data ?? [];
  if (list.length < 2) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-white">Compare repos</h1>
        <p className="mt-3 text-slate-400">You need at least two reports to compare.</p>
        <Link to="/dashboard" className="mt-4 inline-block text-indigo-300 hover:underline">
          Review another repo →
        </Link>
      </div>
    );
  }

  const left = list.find((r) => r.id === a) ?? list[1];
  const right = list.find((r) => r.id === b) ?? list[0];
  const pick = (side: "a" | "b", id: string) =>
    navigate(`/compare?a=${side === "a" ? id : left.id}&b=${side === "b" ? id : right.id}`, true);

  const sev = (r: StoredReport, s: string) => r.report.fileReviews.filter((f) => f.severity === s).length;
  const leftStack = new Set(left.report.techStack);
  const rightStack = new Set(right.report.techStack);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold text-white">Compare repos</h1>
        <p className="mt-1 text-slate-400">Pick two reports, or two reviews of the same repo to see your progress.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(["a", "b"] as const).map((side) => (
          <select
            key={side}
            value={(side === "a" ? left : right).id}
            onChange={(e) => pick(side, e.target.value)}
            aria-label={side === "a" ? "First report" : "Second report"}
            className="rounded-xl border border-white/10 bg-[#141a2e] px-3 py-3 text-sm text-slate-200"
          >
            {list.map((r) => (
              <option key={r.id} value={r.id}>
                {label(r)}
              </option>
            ))}
          </select>
        ))}
      </div>

      <Section title="Scores">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="pb-3 font-medium">Area</th>
                <th className="pb-3 text-right font-medium">A</th>
                <th className="pb-3 text-right font-medium">B</th>
                <th className="pb-3 text-right font-medium">B − A</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const va = Math.round(row.get(left));
                const vb = Math.round(row.get(right));
                const d = vb - va;
                return (
                  <tr key={row.label} className="border-t border-white/10">
                    <td className="py-3 text-slate-200">{row.label}</td>
                    <td className={`py-3 text-right font-semibold ${scoreColor(va)}`}>{va}</td>
                    <td className={`py-3 text-right font-semibold ${scoreColor(vb)}`}>{vb}</td>
                    <td className={`py-3 text-right font-semibold ${d > 0 ? "text-emerald-400" : d < 0 ? "text-rose-400" : "text-slate-400"}`}>
                      {d > 0 ? `+${d}` : d}
                    </td>
                  </tr>
                );
              })}
              {(["high", "medium", "low"] as const).map((s) => {
                const va = sev(left, s);
                const vb = sev(right, s);
                const d = vb - va;
                return (
                  <tr key={s} className="border-t border-white/10">
                    <td className="py-3 text-slate-200">{s} issues</td>
                    <td className="py-3 text-right text-slate-200">{va}</td>
                    <td className="py-3 text-right text-slate-200">{vb}</td>
                    <td className={`py-3 text-right font-semibold ${d < 0 ? "text-emerald-400" : d > 0 ? "text-rose-400" : "text-slate-400"}`}>
                      {d > 0 ? `+${d}` : d}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid gap-6 md:grid-cols-2">
        {[left, right].map((r, i) => {
          const other = i === 0 ? rightStack : leftStack;
          return (
            <Section key={i} title={i === 0 ? "A" : "B"}>
              <Link to={`/report/${r.id}`} className="font-mono text-sm text-indigo-300 hover:underline">
                {r.repo.owner}/{r.repo.name}
              </Link>
              <p className="mt-2 text-sm text-slate-300">{r.report.summary}</p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Tech stack</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.report.techStack.map((t) => (
                  <span
                    key={t}
                    className={`rounded-full px-2 py-0.5 text-xs ${other.has(t) ? "bg-white/10 text-slate-300" : "bg-indigo-500/20 text-indigo-200"}`}
                    title={other.has(t) ? "In both" : "Only here"}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Strengths</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
                {r.report.strengths.slice(0, 4).map((s, j) => (
                  <li key={j}>{s}</li>
                ))}
              </ul>
            </Section>
          );
        })}
      </div>
    </div>
  );
}
