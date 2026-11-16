// Reads a public GitHub repository: file list + contents of the most
// important source files, within a size budget.

const MAX_FILES = 40;
const MAX_FILE_BYTES = 20_000; // bigger files are skipped, never cut in half
const MAX_TOTAL_BYTES = 150_000;

const SKIP_DIRS =
  /(^|\/)(node_modules|dist|build|out|coverage|vendor|venv|\.venv|__pycache__|target|\.next|\.git|\.idea|\.vscode|public\/assets|assets\/images)\//;
const SKIP_FILES =
  /(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|\.min\.(js|css)|\.map|\.snap|\.svg|\.d\.ts)$/;
const CODE_EXT =
  /\.(ts|tsx|js|jsx|mjs|cjs|py|java|kt|go|rs|rb|php|cs|cpp|c|h|swift|dart|vue|svelte|html|css|scss|sql|sh|prisma)$/i;
const CONFIG_FILES =
  /(^|\/)(package\.json|requirements\.txt|pyproject\.toml|pom\.xml|build\.gradle|go\.mod|Cargo\.toml|Dockerfile|docker-compose\.ya?ml|tsconfig\.json|\.env\.example)$/i;
const README = /(^|\/)readme(\.md|\.txt)?$/i;

export class GitHubError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export interface RepoRef {
  owner: string;
  name: string;
}

export interface RepoFile {
  path: string;
  content: string;
}

export interface RepoSnapshot {
  repo: RepoRef & { url: string; description: string | null };
  tree: string[]; // source file paths, junk folders removed (for structure overview)
  allPaths: string[]; // every file path in the repo, nothing filtered (for repo-level checks)
  files: RepoFile[]; // files whose content we read
  skipped: number; // code files left out because of the budget
  tooLarge: number; // code files skipped because each one is over MAX_FILE_BYTES
}

/** Accepts "owner/repo" or any github.com URL. Returns null if invalid. */
export function parseRepoUrl(input: string): RepoRef | null {
  const cleaned = input
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/^github\.com\//i, "")
    .replace(/\.git$/i, "");
  const m = cleaned.match(/^([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})(\/.*)?$/);
  if (!m) return null;
  return { owner: m[1], name: m[2] };
}

async function api<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "repoviva",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  let res: Response;
  try {
    res = await fetch(`https://api.github.com${path}`, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new GitHubError("Could not reach GitHub. Check your internet and try again.", 502);
  }
  if (res.status === 404) {
    throw new GitHubError("Repository not found. Is it public and spelled correctly?", 404);
  }
  if (res.status === 403 || res.status === 429) {
    throw new GitHubError(
      "GitHub rate limit reached. Try again later, or add a GITHUB_TOKEN to server/.env.",
      429,
    );
  }
  if (!res.ok) throw new GitHubError(`GitHub error (${res.status}).`, 502);
  return res.json() as Promise<T>;
}

function priority(path: string): number {
  if (README.test(path)) return 0;
  if (CONFIG_FILES.test(path)) return 1;
  const depth = path.split("/").length;
  const isTest = /(test|spec)\./i.test(path) || /(^|\/)(tests?|__tests__)\//.test(path);
  return 2 + depth + (isTest ? 5 : 0);
}

export async function fetchRepo(ref: RepoRef): Promise<RepoSnapshot> {
  const slug = `${ref.owner}/${ref.name}`;
  const info = await api<{
    default_branch: string;
    description: string | null;
    html_url: string;
  }>(`/repos/${slug}`);

  const treeRes = await api<{
    tree: { path: string; type: string; size?: number }[];
  }>(`/repos/${slug}/git/trees/${encodeURIComponent(info.default_branch)}?recursive=1`);

  const allBlobs = treeRes.tree.filter((e) => e.type === "blob");
  const blobs = allBlobs.filter((e) => !SKIP_DIRS.test(e.path) && !SKIP_FILES.test(e.path));
  const candidates = blobs
    .filter((e) => README.test(e.path) || CONFIG_FILES.test(e.path) || CODE_EXT.test(e.path))
    .sort((a, b) => priority(a.path) - priority(b.path) || (a.size ?? 0) - (b.size ?? 0));

  if (candidates.length === 0) {
    throw new GitHubError("No source code files found in this repository.", 422);
  }

  const chosen: string[] = [];
  let total = 0;
  for (const f of candidates) {
    const size = f.size ?? 0;
    if (chosen.length >= MAX_FILES) break;
    if (size > MAX_FILE_BYTES || total + size > MAX_TOTAL_BYTES) continue;
    chosen.push(f.path);
    total += size;
  }

  const files = (
    await Promise.all(
      chosen.map(async (path): Promise<RepoFile | null> => {
        const url = `https://raw.githubusercontent.com/${slug}/${encodeURIComponent(
          info.default_branch,
        )}/${path.split("/").map(encodeURIComponent).join("/")}`;
        // The network can fail for a single file; retry, then skip that file
        // instead of failing the whole review.
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
            if (res.ok) return { path, content: await res.text() };
            if (res.status < 500) return null;
          } catch {
            // connection error or timeout: try again
          }
        }
        return null;
      }),
    )
  ).filter((f): f is RepoFile => f !== null);

  if (files.length === 0) {
    throw new GitHubError("Could not download the repository files. Check your internet and try again.", 502);
  }

  return {
    repo: { ...ref, url: info.html_url, description: info.description },
    tree: blobs.map((b) => b.path).slice(0, 400),
    allPaths: allBlobs.map((b) => b.path),
    files,
    skipped: candidates.length - files.length,
    tooLarge: candidates.filter((c) => (c.size ?? 0) > MAX_FILE_BYTES).length,
  };
}
