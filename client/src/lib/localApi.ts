// Browser-only "backend" used by the static build (GitHub Pages), where no
// Node server exists. It answers the same /api/... routes as server/src/index.ts,
// runs the same built-in review engine, and keeps data in localStorage.
// Accounts therefore live only in this browser.

import { analyzeRepo } from "../../../server/src/analyzer";
import { fetchRepo, parseRepoUrl } from "../../../server/src/github";
import { gradeOffline } from "../../../server/src/grader";
import type { PracticeAttempt, SavedReport, StoredReport, User } from "./types";

interface LocalUser extends User {
  passwordHash: string; // "salt:hash" (PBKDF2-SHA256, hex)
}
interface DB {
  users: LocalUser[];
  reports: (StoredReport & { userId: string })[];
  practice: (PracticeAttempt & { userId: string })[];
}

const KEY = "repoviva.local.v1";
const MAX_REPORTS = 50;
const MAX_ATTEMPTS = 500;

function load(): DB {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? "null") as DB | null;
    if (d) return d;
  } catch {
    // fall through
  }
  return { users: [], reports: [], practice: [] };
}

function save(db: DB) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    throw new LocalError("Browser storage is full or blocked. Delete some reports and try again.", 507);
  }
}

export class LocalError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function pbkdf2(password: string, saltHex: string): Promise<string> {
  const salt = new Uint8Array(saltHex.match(/../g)!.map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 200_000, hash: "SHA-256" }, key, 256));
}

async function hashPassword(password: string): Promise<string> {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  return `${salt}:${await pbkdf2(password, salt)}`;
}

async function checkPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  return Boolean(salt && hash) && (await pbkdf2(password, salt)) === hash;
}

const publicUser = ({ id, name, email, createdAt }: LocalUser): User => ({ id, name, email, createdAt });
const strip = <T extends { userId: string }>({ userId: _u, ...rest }: T) => rest;

function validEmail(e: unknown): string {
  const v = typeof e === "string" ? e.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new LocalError("Enter a valid email address.", 400);
  return v;
}

function validPassword(p: unknown): string {
  if (typeof p !== "string" || p.length < 8) throw new LocalError("Password must be at least 8 characters.", 400);
  return p;
}

function validName(n: unknown): string {
  const v = typeof n === "string" ? n.trim().slice(0, 80) : "";
  if (!v) throw new LocalError("Enter your name.", 400);
  return v;
}

type Body = Record<string, unknown>;

export async function localApi(path: string, method: string, body: Body | undefined, token: string | null): Promise<unknown> {
  const db = load();
  const b = body ?? {};

  if (path === "/api/health") return { ok: true, engine: "builtin" };

  if (path === "/api/auth/signup" && method === "POST") {
    const name = validName(b.name);
    const email = validEmail(b.email);
    const password = validPassword(b.password);
    if (db.users.some((u) => u.email === email)) {
      throw new LocalError("An account with this email already exists. Log in instead.", 409);
    }
    const user: LocalUser = { id: crypto.randomUUID(), name, email, createdAt: new Date().toISOString(), passwordHash: await hashPassword(password) };
    db.users.push(user);
    save(db);
    return { token: user.id, user: publicUser(user) };
  }

  if (path === "/api/auth/login" && method === "POST") {
    const email = validEmail(b.email);
    const user = db.users.find((u) => u.email === email);
    if (!user || !(await checkPassword(String(b.password ?? ""), user.passwordHash))) {
      throw new LocalError("Wrong email or password. (Accounts are saved per browser on this site.)", 401);
    }
    return { token: user.id, user: publicUser(user) };
  }

  // Public share links carry the report inside the URL, so no lookup is needed here.

  // ---- everything below needs a logged-in user ----
  const user = db.users.find((u) => u.id === token);
  if (!user) throw new LocalError("Please log in again.", 401);
  const mine = db.reports.filter((r) => r.userId === user.id);

  if (path === "/api/auth/me") {
    if (method === "GET") return { user: publicUser(user) };
    if (method === "PATCH") {
      if (b.newPassword !== undefined) {
        validPassword(b.newPassword);
        if (!(await checkPassword(String(b.currentPassword ?? ""), user.passwordHash))) {
          throw new LocalError("Your current password is wrong.", 400);
        }
        user.passwordHash = await hashPassword(String(b.newPassword));
      }
      if (b.name !== undefined) user.name = validName(b.name);
      save(db);
      return { user: publicUser(user) };
    }
    if (method === "DELETE") {
      db.users = db.users.filter((u) => u.id !== user.id);
      db.reports = db.reports.filter((r) => r.userId !== user.id);
      db.practice = db.practice.filter((p) => p.userId !== user.id);
      save(db);
      return undefined;
    }
  }

  const addReport = (r: SavedReport) => {
    db.reports.unshift({ ...r, userId: user.id, shared: false });
    const ids = db.reports.filter((x) => x.userId === user.id).slice(MAX_REPORTS).map((x) => x.id);
    db.reports = db.reports.filter((x) => !ids.includes(x.id));
  };

  if (path === "/api/analyze" && method === "POST") {
    const ref = typeof b.url === "string" ? parseRepoUrl(b.url) : null;
    if (!ref) throw new LocalError("Enter a valid GitHub repository link, like https://github.com/owner/repo", 400);
    const snap = await fetchRepo(ref);
    const saved: SavedReport = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      engine: "builtin",
      repo: { owner: snap.repo.owner, name: snap.repo.name, url: snap.repo.url },
      filesReviewed: snap.files.map((f) => f.path),
      filesSkipped: snap.skipped,
      report: analyzeRepo(snap),
    };
    addReport(saved);
    save(db);
    return { ...saved, shared: false };
  }

  if (path === "/api/reports" && method === "GET") return mine.map(strip);

  if (path === "/api/reports/import" && method === "POST") {
    const list = Array.isArray(b.reports) ? (b.reports as SavedReport[]).slice(0, 20) : [];
    let imported = 0;
    for (const r of list.reverse()) {
      if (r.demo || !r.report || !r.repo) continue;
      addReport({ ...r, id: crypto.randomUUID(), engine: r.engine ?? "ai" });
      imported++;
    }
    save(db);
    return { imported };
  }

  const reportMatch = path.match(/^\/api\/reports\/([^/]+)$/);
  if (reportMatch) {
    const r = mine.find((x) => x.id === reportMatch[1]);
    if (!r) throw new LocalError("Report not found.", 404);
    if (method === "GET") return strip(r);
    if (method === "PATCH") {
      r.shared = Boolean(b.shared);
      save(db);
      return strip(r);
    }
    if (method === "DELETE") {
      db.reports = db.reports.filter((x) => x.id !== r.id);
      db.practice = db.practice.filter((p) => p.reportId !== r.id);
      save(db);
      return undefined;
    }
  }

  if (path === "/api/feedback" && method === "POST") {
    const answer = typeof b.answer === "string" ? b.answer.trim() : "";
    if (answer.length < 10) throw new LocalError("Write at least a sentence.", 400);
    const goodAnswerCovers = Array.isArray(b.goodAnswerCovers) ? (b.goodAnswerCovers as string[]) : [];
    const feedback = gradeOffline({ question: String(b.question ?? ""), goodAnswerCovers, answer });
    const reportId = typeof b.reportId === "string" && mine.some((r) => r.id === b.reportId) ? b.reportId : null;
    db.practice.push({
      id: crypto.randomUUID(),
      userId: user.id,
      reportId,
      question: String(b.question ?? ""),
      topic: typeof b.topic === "string" ? b.topic : "General",
      score: feedback.score,
      createdAt: new Date().toISOString(),
    });
    const extra = db.practice.filter((p) => p.userId === user.id).length - MAX_ATTEMPTS;
    if (extra > 0) {
      const drop = db.practice.filter((p) => p.userId === user.id).slice(0, extra).map((p) => p.id);
      db.practice = db.practice.filter((p) => !drop.includes(p.id));
    }
    save(db);
    return feedback;
  }

  if (path === "/api/practice" && method === "GET") {
    return db.practice.filter((p) => p.userId === user.id).map(strip);
  }

  throw new LocalError("Not found.", 404);
}
