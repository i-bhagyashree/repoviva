import type { SavedReport } from "./types";

// Older versions kept reports only in this browser's localStorage. Reports now
// live in the user's account; these helpers let the dashboard import the old ones.

const KEY = "repoviva.reports.v1";

export function readLegacyReports(): SavedReport[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as SavedReport[]) : [];
    return Array.isArray(list) ? list.filter((r) => !r.demo) : [];
  } catch {
    return [];
  }
}

export function clearLegacyReports() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
