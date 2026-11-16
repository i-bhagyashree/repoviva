// Small fetch wrapper: adds the login token and turns error responses into exceptions.

import { STATIC } from "./config";

const TOKEN_KEY = "repoviva.token";

let token: string | null = null;
try {
  token = localStorage.getItem(TOKEN_KEY);
} catch {
  // storage blocked: the user simply has to log in each visit
}

let onUnauthorized: () => void = () => {};

export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export function getToken() {
  return token;
}

export function setToken(value: string | null) {
  token = value;
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  if (STATIC) {
    // GitHub Pages build: no server, the browser does the work.
    const { localApi, LocalError } = await import("./localApi");
    const method = options.method ?? (options.body === undefined ? "GET" : "POST");
    try {
      return (await localApi(path, method, options.body as Record<string, unknown> | undefined, token)) as T;
    } catch (err) {
      if (err instanceof LocalError) {
        if (err.status === 401 && token) onUnauthorized();
        throw new ApiError(err.message, err.status);
      }
      if (err instanceof Error && err.name === "GitHubError") throw new ApiError(err.message, 502);
      throw err instanceof Error ? err : new ApiError("Something went wrong.", 500);
    }
  }

  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(path, {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError("Cannot reach the RepoViva server. Is it running?", 0);
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized();
    throw new ApiError((data as { error?: string }).error ?? "Something went wrong.", res.status);
  }
  return data as T;
}
