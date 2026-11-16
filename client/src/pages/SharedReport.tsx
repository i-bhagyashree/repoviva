import { useEffect, useState } from "react";
import { ReportView } from "../components/ReportView";
import { btnPrimary, ErrorBox, Spinner } from "../components/ui";
import { readShareData } from "../lib/share";
import { Link } from "../lib/router";
import type { SavedReport, SharedReport as Shared } from "../lib/types";
import { useApi } from "../lib/useApi";

/** Public, read-only page for a report its owner chose to share.
 *  `id`: server build (report looked up on the server).
 *  `encoded`: static build (the report is packed inside the link). */
export function SharedReport({ id, encoded }: { id?: string; encoded?: string }) {
  const server = useApi<Shared>(id ? `/api/share/${id}` : null);
  const [packed, setPacked] = useState<{ ownerName: string; report: SavedReport } | null>(null);
  const [packedError, setPackedError] = useState<string | null>(null);

  useEffect(() => {
    if (!encoded) return;
    readShareData(encoded)
      .then(setPacked)
      .catch(() => setPackedError("This share link is broken or incomplete. Ask for the link again."));
  }, [encoded]);

  const data = id ? server.data : packed?.report;
  const ownerName = id ? server.data?.ownerName : packed?.ownerName;
  const error = id ? server.error : packedError;

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <ErrorBox>{error}</ErrorBox>
      </div>
    );
  }
  if (!data) return <Spinner label="Loading shared report..." />;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-indigo-400/30 bg-indigo-500/10 p-4 print:hidden">
        <p className="text-sm text-indigo-100">
          <strong>{ownerName}</strong> shared this RepoViva report for{" "}
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
