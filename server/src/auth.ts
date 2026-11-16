// Email + password login. Passwords are hashed with scrypt; logins get a
// signed token (userId.expiry.signature) that the browser sends back in the
// Authorization header. No external auth service needed.

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { authSecret, db, type User } from "./store.js";

const TOKEN_DAYS = 30;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function checkPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(expected, actual);
}

function sign(payload: string): string {
  return createHmac("sha256", authSecret()).update(payload).digest("base64url");
}

export function createToken(userId: string): string {
  const payload = `${userId}.${Date.now() + TOKEN_DAYS * 86_400_000}`;
  return `${payload}.${sign(payload)}`;
}

function userFromToken(token: string): User | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiry, sig] = parts;
  const expected = Buffer.from(sign(`${userId}.${expiry}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(expiry) < Date.now()) return null;
  return db.users.find((u) => u.id === userId) ?? null;
}

export function publicUser(u: User) {
  return { id: u.id, name: u.name, email: u.email, createdAt: u.createdAt };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/** Route guard: rejects the request with 401 unless it carries a valid token. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const user = header.startsWith("Bearer ") ? userFromToken(header.slice(7)) : null;
  if (!user) {
    res.status(401).json({ error: "Please log in again." });
    return;
  }
  req.user = user;
  next();
}

// Slow down password guessing: max 10 failed logins per email+IP per 15 minutes.
const failures = new Map<string, { count: number; until: number }>();

export function loginBlocked(key: string): boolean {
  const f = failures.get(key);
  return Boolean(f && f.count >= 10 && f.until > Date.now());
}

export function recordLoginFailure(key: string) {
  const f = failures.get(key);
  if (!f || f.until < Date.now()) failures.set(key, { count: 1, until: Date.now() + 15 * 60_000 });
  else f.count++;
}

export function clearLoginFailures(key: string) {
  failures.delete(key);
}
