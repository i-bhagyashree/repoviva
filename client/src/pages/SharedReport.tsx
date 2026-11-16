import { ReportView } from "../components/ReportView";
import { btnPrimary, ErrorBox, Spinner } from "../components/ui";
import { Link } from "../lib/router";
import type { SharedReport as Shared } from "../lib/types";
import { useApi } from "../lib/useApi";

/** Public, read-only page for a report its owner chose to share. */
export function SharedReport({ id }: { id: string }) {
  const { data, error, loading } = useApi<Shared>(`/api/share/${id}`);

  if (loading) return <Spinner label="Loading shared report..." />;
  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <ErrorBox>{error ?? "Report not found."}</ErrorBox>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-indigo-400/30 bg-indigo-500/10 p-4 print:hidden">
        <p className="text-sm text-indigo-100">
          <strong>{data.ownerName}</strong> shared this RepoViva report for{" "}
          <span className="font-mono">
            {data.repo.owner}/{data.repo.name}
          </span>
          .
        </p>
        <Link to="/signup" className={btnPrimary}>
          Review your own repo
        </Link>
      </div>
      <ReportView saved={data} readOnly />
    </div>
  );
}
