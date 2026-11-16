import "dotenv/config";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import {
  checkPassword,
  clearLoginFailures,
  createToken,
  hashPassword,
  loginBlocked,
  publicUser,
  recordLoginFailure,
  requireAuth,
} from "./auth.js";
import { AIError, gradeAnswer, hasClaudeCredentials, reviewRepo } from "./claude.js";
import { analyzeRepo } from "./analyzer.js";
import { fetchRepo, GitHubError, parseRepoUrl } from "./github.js";
import { gradeOffline } from "./grader.js";
import { db, persist, type StoredReport } from "./store.js";
import { ReportSchema, type SavedReport } from "./types.js";

const MAX_REPORTS_PER_USER = 50;
const MAX_ATTEMPTS_PER_USER = 500;

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, engine: hasClaudeCredentials() ? "ai" : "builtin" });
});

// ---------- Accounts ----------

const email = z.string().trim().toLowerCase().email("Enter a valid email address.").max(200);
const password = z.string().min(8, "Password must be at least 8 characters.").max(200);
const name = z.string().trim().min(1, "Enter your name.").max(80);

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid request.";
}

app.post("/api/auth/signup", (req, res) => {
  const parsed = z.object({ name, email, password }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: firstIssue(parsed.error) });
    return;
  }
  const { name: n, email: e, password: p } = parsed.data;
  if (db.users.some((u) => u.email === e)) {
    res.status(409).json({ error: "An account with this email already exists. Log in instead." });
    return;
  }
  const user = { id: crypto.randomUUID(), name: n, email: e, passwordHash: hashPassword(p), createdAt: new Date().toISOString() };
  db.users.push(user);
  persist();
  res.status(201).json({ token: createToken(user.id), user: publicUser(user) });
});

app.post("/api/auth/login", (req, res) => {
  const parsed = z.object({ email, password: z.string().max(200) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: firstIssue(parsed.error) });
    return;
  }
  const key = `${parsed.data.email}|${req.ip}`;
  if (loginBlocked(key)) {
    res.status(429).json({ error: "Too many failed attempts. Wait 15 minutes and try again." });
    return;
  }
  const user = db.users.find((u) => u.email === parsed.data.email);
  if (!user || !checkPassword(parsed.data.password, user.passwordHash)) {
    recordLoginFailure(key);
    res.status(401).json({ error: "Wrong email or password." });
    return;
  }
  clearLoginFailures(key);
  res.json({ token: createToken(user.id), user: publicUser(user) });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user!) });
});

app.patch("/api/auth/me", requireAuth, (req, res) => {
  const parsed = z
    .object({ name: name.optional(), currentPassword: z.string().max(200).optional(), newPassword: password.optional() })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: firstIssue(parsed.error) });
    return;
  }
  const user = req.user!;
  if (parsed.data.newPassword) {
    if (!parsed.data.currentPassword || !checkPassword(parsed.data.currentPassword, user.passwordHash)) {
      res.status(400).json({ error: "Your current password is wrong." });
      return;
    }
    user.passwordHash = hashPassword(parsed.data.newPassword);
  }
  if (parsed.data.name) user.name = parsed.data.name;
  persist();
  res.json({ user: publicUser(user) });
});

app.delete("/api/auth/me", requireAuth, (req, res) => {
  const id = req.user!.id;
  db.users = db.users.filter((u) => u.id !== id);
  db.reports = db.reports.filter((r) => r.userId !== id);
  db.practice = db.practice.filter((p) => p.userId !== id);
  persist();
  res.status(204).end();
});

// ---------- Reports ----------

/** What the browser gets: the report without the owner id. */
function toClient(r: StoredReport) {
  const { userId: _userId, ...rest } = r;
  return rest;
}

function addReport(userId: string, report: SavedReport, shared = false): StoredReport {
  const stored: StoredReport = { ...report, userId, shared };
  db.reports.unshift(stored);
  // Keep only the newest reports per user.
  const mine = db.reports.filter((r) => r.userId === userId);
  if (mine.length > MAX_REPORTS_PER_USER) {
    const drop = new Set(mine.slice(MAX_REPORTS_PER_USER).map((r) => r.id));
    db.reports = db.reports.filter((r) => !drop.has(r.id));
  }
  return stored;
}

function ownReport(req: Request, res: Response): StoredReport | null {
  const r = db.reports.find((x) => x.id === req.params.id && x.userId === req.user!.id);
  if (!r) res.status(404).json({ error: "Report not found." });
  return r ?? null;
}

// POST /api/analyze  { url }  ->  saved report
app.post("/api/analyze", requireAuth, async (req, res) => {
  const ref = typeof req.body?.url === "string" ? parseRepoUrl(req.body.url) : null;
  if (!ref) {
    res.status(400).json({
      error: "Enter a valid GitHub repository link, like https://github.com/owner/repo",
    });
    return;
  }

  const snap = await fetchRepo(ref);
  // With an API key Claude reviews the code; without one the built-in rule engine does.
  const engine = hasClaudeCredentials() ? "ai" : "builtin";
  const report = engine === "ai" ? await reviewRepo(snap) : analyzeRepo(snap);

  const saved = addReport(req.user!.id, {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    engine,
    repo: { owner: snap.repo.owner, name: snap.repo.name, url: snap.repo.url },
    filesReviewed: snap.files.map((f) => f.path),
    filesSkipped: snap.skipped,
    report,
  });
  persist();
  res.json(toClient(saved));
});

app.get("/api/reports", requireAuth, (req, res) => {
  res.json(db.reports.filter((r) => r.userId === req.user!.id).map(toClient));
});

app.get("/api/reports/:id", requireAuth, (req, res) => {
  const r = ownReport(req, res);
  if (r) res.json(toClient(r));
});

// PATCH /api/reports/:id  { shared }  -> turn the public share link on or off
app.patch("/api/reports/:id", requireAuth, (req, res) => {
  const r = ownReport(req, res);
  if (!r) return;
  const parsed = z.object({ shared: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request." });
    return;
  }
  r.shared = parsed.data.shared;
  persist();
  res.json(toClient(r));
});

app.delete("/api/reports/:id", requireAuth, (req, res) => {
  const r = ownReport(req, res);
  if (!r) return;
  db.reports = db.reports.filter((x) => x.id !== r.id);
  db.practice = db.practice.filter((p) => p.reportId !== r.id);
  persist();
  res.status(204).end();
});

// Moves reports that older versions kept only in the browser into the account.
const ImportedReport = z.object({
  id: z.string().max(100),
  createdAt: z.string().max(50),
  engine: z.enum(["ai", "builtin"]).optional(),
  demo: z.boolean().optional(),
  repo: z.object({ owner: z.string().max(100), name: z.string().max(200), url: z.string().max(400) }),
  filesReviewed: z.array(z.string().max(500)).max(200),
  filesSkipped: z.number(),
  report: ReportSchema,
});

app.post("/api/reports/import", requireAuth, (req, res) => {
  const parsed = z.object({ reports: z.array(ImportedReport).max(20) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "These saved reports could not be read." });
    return;
  }
  let imported = 0;
  for (const r of parsed.data.reports.reverse()) {
    if (r.demo) continue; // fake sample reports from old versions
    addReport(req.user!.id, { ...r, id: crypto.randomUUID(), engine: r.engine ?? "ai" });
    imported++;
  }
  persist();
  res.json({ imported });
});

// Public, read-only view of a report the owner chose to share.
app.get("/api/share/:id", (req, res) => {
  const r = db.reports.find((x) => x.id === req.params.id && x.shared);
  if (!r) {
    res.status(404).json({ error: "This report is private or no longer exists." });
    return;
  }
  const owner = db.users.find((u) => u.id === r.userId);
  res.json({ ...toClient(r), ownerName: owner?.name ?? "A RepoViva user" });
});

// ---------- Interview practice ----------

const FeedbackBody = z.object({
  question: z.string().min(1).max(1000),
  goodAnswerCovers: z.array(z.string().max(500)).max(10),
  projectSummary: z.string().max(2000),
  answer: z.string().trim().min(10, "Write at least a sentence.").max(4000),
  reportId: z.string().max(100).optional(),
  topic: z.string().max(100).optional(),
});

// POST /api/feedback  { question, goodAnswerCovers, projectSummary, answer, reportId?, topic? }  ->  Feedback
app.post("/api/feedback", requireAuth, async (req, res) => {
  const parsed = FeedbackBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: firstIssue(parsed.error) });
    return;
  }
  const feedback = hasClaudeCredentials() ? await gradeAnswer(parsed.data) : gradeOffline(parsed.data);

  const userId = req.user!.id;
  const reportId =
    parsed.data.reportId && db.reports.some((r) => r.id === parsed.data.reportId && r.userId === userId)
      ? parsed.data.reportId
      : null;
  db.practice.push({
    id: crypto.randomUUID(),
    userId,
    reportId,
    question: parsed.data.question,
    topic: parsed.data.topic ?? "General",
    score: Math.max(0, Math.min(10, Math.round(feedback.score))),
    createdAt: new Date().toISOString(),
  });
  const mine = db.practice.filter((p) => p.userId === userId);
  if (mine.length > MAX_ATTEMPTS_PER_USER) {
    const drop = new Set(mine.slice(0, mine.length - MAX_ATTEMPTS_PER_USER).map((p) => p.id));
    db.practice = db.practice.filter((p) => !drop.has(p.id));
  }
  persist();
  res.json(feedback);
});

app.get("/api/practice", requireAuth, (req, res) => {
  res.json(
    db.practice
      .filter((p) => p.userId === req.user!.id)
      .map(({ userId: _userId, ...rest }) => rest),
  );
});

// In production the server also serves the built website (client/dist), so the
// whole app runs as one service. In development Vite serves it instead.
const clientDist = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "client", "dist");
if (existsSync(clientDist)) app.use(express.static(clientDist));

// Central error handler: Express 5 sends errors thrown in async routes here.
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof GitHubError || error instanceof AIError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof SyntaxError) {
    res.status(400).json({ error: "Invalid JSON." });
    return;
  }
  console.error(error);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`RepoViva API running on http://localhost:${port}`);
  if (!hasClaudeCredentials()) {
    console.log("No ANTHROPIC_API_KEY found: using the built-in review engine (no AI).");
  }
});
