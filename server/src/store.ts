// Tiny JSON-file database. No external database needed: everything lives in
// server/data/db.json. Writes go to a temp file first and are then renamed,
// so a crash never leaves a half-written file.

import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SavedReport } from "./types.js";

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string; // "salt:hash" (scrypt, hex)
  createdAt: string;
}

export interface StoredReport extends SavedReport {
  userId: string;
  shared: boolean;
}

export interface PracticeAttempt {
  id: string;
  userId: string;
  reportId: string | null;
  question: string;
  topic: string;
  score: number; // 0-10
  createdAt: string;
}

interface Data {
  users: User[];
  reports: StoredReport[];
  practice: PracticeAttempt[];
}

const DATA_DIR = process.env.DATA_DIR ?? join(dirname(fileURLToPath(import.meta.url)), "..", "data");
const DB_FILE = join(DATA_DIR, "db.json");
const SECRET_FILE = join(DATA_DIR, "secret.key");

mkdirSync(DATA_DIR, { recursive: true });

function load(): Data {
  if (!existsSync(DB_FILE)) return { users: [], reports: [], practice: [] };
  const parsed = JSON.parse(readFileSync(DB_FILE, "utf8")) as Partial<Data>;
  return { users: parsed.users ?? [], reports: parsed.reports ?? [], practice: parsed.practice ?? [] };
}

export const db: Data = load();

/** Save the whole database to disk. Node runs one request handler at a time, so this is safe. */
export function persist() {
  const tmp = `${DB_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(db));
  renameSync(tmp, DB_FILE);
}

/** Secret for signing login tokens: AUTH_SECRET from .env, or one generated once and kept on disk. */
export function authSecret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (!existsSync(SECRET_FILE)) writeFileSync(SECRET_FILE, randomBytes(32).toString("hex"), { mode: 0o600 });
  return readFileSync(SECRET_FILE, "utf8").trim();
}
