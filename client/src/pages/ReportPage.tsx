import { useState } from "react";
import { ReportView } from "../components/ReportView";
import { btnGhost, btnPrimary, ErrorBox, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { STATIC } from "../lib/config";
import { makeShareUrl } from "../lib/share";
import { downloadFile, reportToMarkdown } from "../lib/export";
import { Link, navigate } from "../lib/router";
import type { StoredReport } from "../lib/types";
import { useApi } from "../lib/useApi";


export function ReportPage({ id }: { id: string }) {
  const { user } = useAuth();
  const { data: saved, error, loading, setData } = useApi<StoredReport>(`/api/reports/${id}`);
  const all = useApi<StoredReport[]>("/api/reports");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (loading && !saved) return <Spinner label="Loading report..." />;
  if (error || !saved) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <ErrorBox>{error ?? "Report not found."}</ErrorBox>
        <Link to="/dashboard" className="mt-4 inline-block text-indigo-300 hover:underline">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  // The most recent earlier review of the same repo, to show progress.
  const previous = (all.data ?? [])
    .filter(
      (r) =>
        r.id !== saved.id &&
        r.repo.owner.toLowerCase() === saved.repo.owner.toLowerCase() &&
        r.repo.name.toLowerCase() === saved.repo.name.toLowerCase() &&
        r.createdAt < saved.createdAt,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const delta = previous ? Math.round(saved.report.overallScore) - Math.round(previous.report.overallScore) : 0;

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const rerun = () =>
    run("rerun", async () => {
      const fresh = await api<StoredReport>("/api/analyze", { body: { url: saved.repo.url } });
      navigate(`/report/${fresh.id}`);
    });

  const toggleShare = () =>
    run("share", async () => {
      setData(await api<StoredReport>(`/api/reports/${saved.id}`, { method: "PATCH", body: { shared: !saved.shared } }));
    });

  const remove = () => {
    if (!confirm("Delete this report?")) return;
    run("delete", async () => {
      await api(`/api/reports/${saved.id}`, { method: "DELETE" });
      navigate("/dashboard");
    });
  };

  async function copyLink() {
    const link = await makeShareUrl(saved!, user?.name ?? "A RepoViva user");
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("Copy this link:", link);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 print:hidden">
        <Link to="/dashboard" className="text-sm text-slate-400 hover:text-white">
          ← Dashboard
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-mono text-2xl font-bold text-white">
            {saved.repo.owner}/{saved.repo.name}
          </h1>
          <div className="flex flex-wrap gap-2">
            <Link to={`/practice?report=${saved.id}`} className={btnPrimary}>
              Mock interview
            </Link>
            <button onClick={rerun} disabled={busy !== null} className={btnGhost}>
              {busy === "rerun" ? "Reviewing..." : "Review again"}
            </button>
            <button
              onClick={() => downloadFile(`repoviva-${saved.repo.name}.md`, reportToMarkdown(saved))}
              className={btnGhost}
            >
              Export .md
            </button>
            <button onClick={() => window.print()} className={btnGhost}>
              Print / PDF
            </button>
            <button onClick={remove} disabled={busy !== null} className={`${btnGhost} hover:border-rose-400/50 hover:text-rose-300`}>
              Delete
            </button>
          </div>
        </div>

        {STATIC ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
            <span className="flex-1 text-slate-400">
              Share a read-only copy: the link contains the report itself, so anyone with it can view it.
            </span>
            <button onClick={copyLink} className="font-medium text-indigo-300 hover:text-indigo-200">
              {copied ? "Copied!" : "Copy share link"}
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
            <label className="flex cursor-pointer items-center gap-2 text-slate-200">
              <input
                type="checkbox"
                checked={saved.shared}
                onChange={toggleShare}
                disabled={busy !== null}
                className="h-4 w-4 accent-indigo-500"
              />
              Public share link
            </label>
            {saved.shared ? (
              <>
                <code className="min-w-0 flex-1 truncate text-xs text-slate-400">#/share/{saved.id}</code>
                <button onClick={copyLink} className="font-medium text-indigo-300 hover:text-indigo-200">
                  {copied ? "Copied!" : "Copy link"}
                </button>
              </>
            ) : (
              <span className="text-slate-500">Off: only you can see this report.</span>
            )}
          </div>
        )}

        {previous && (
          <p
            className={`mt-3 rounded-xl p-3 text-sm ${
              delta > 0 ? "bg-emerald-500/10 text-emerald-200" : delta < 0 ? "bg-rose-500/10 text-rose-200" : "bg-white/5 text-slate-300"
            }`}
          >
            Compared with your review on {new Date(previous.createdAt).toLocaleDateString()}:{" "}
            <strong>
              {delta > 0 ? `+${delta}` : delta} points
            </strong>{" "}
            ({Math.round(previous.report.overallScore)} → {Math.round(saved.report.overallScore)}).{" "}
            <Link to={`/compare?a=${previous.id}&b=${saved.id}`} className="underline">
              See full comparison
            </Link>
          </p>
        )}
        {actionError && (
          <div className="mt-3">
            <ErrorBox>{actionError}</ErrorBox>
          </div>
        )}
      </div>

      <ReportView key={saved.id} saved={saved} />
    </div>
  );
}
