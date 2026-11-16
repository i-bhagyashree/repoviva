import { useState } from "react";
import { btnGhost, btnPrimary, ErrorBox, inputCls, Section } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { downloadFile } from "../lib/export";
import { navigate } from "../lib/router";
import type { PracticeAttempt, StoredReport, User } from "../lib/types";

export function Profile() {
  const { user, setUser, logout } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  async function save(body: Record<string, string>, done: string) {
    setBusy(true);
    setMsg(null);
    try {
      const d = await api<{ user: User }>("/api/auth/me", { method: "PATCH", body });
      setUser(d.user);
      setMsg({ ok: true, text: done });
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Could not save." });
    } finally {
      setBusy(false);
    }
  }

  async function exportData() {
    const [reports, practice] = await Promise.all([
      api<StoredReport[]>("/api/reports"),
      api<PracticeAttempt[]>("/api/practice"),
    ]);
    downloadFile(
      "repoviva-data.json",
      JSON.stringify({ exportedAt: new Date().toISOString(), user, reports, practice }, null, 2),
      "application/json",
    );
  }

  async function deleteAccount() {
    setBusy(true);
    try {
      await api("/api/auth/me", { method: "DELETE" });
      logout();
      navigate("/");
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Could not delete account." });
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500 text-2xl font-bold text-white">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <div>
          <h1 className="text-2xl font-bold text-white">{user.name}</h1>
          <p className="text-sm text-slate-400">
            {user.email} · member since {new Date(user.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {msg &&
        (msg.ok ? (
          <p role="status" className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            {msg.text}
          </p>
        ) : (
          <ErrorBox>{msg.text}</ErrorBox>
        ))}

      <Section title="Profile">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save({ name }, "Name updated.");
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <label htmlFor="pname" className="sr-only">
            Name
          </label>
          <input id="pname" value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} flex-1`} />
          <button disabled={busy || !name.trim() || name === user.name} className={btnPrimary}>
            Save
          </button>
        </form>
      </Section>

      <Section title="Change password">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save({ currentPassword, newPassword }, "Password changed.");
          }}
          className="space-y-3"
        >
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            autoComplete="current-password"
            aria-label="Current password"
            className={inputCls}
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 8 characters)"
            autoComplete="new-password"
            aria-label="New password"
            className={inputCls}
          />
          <button disabled={busy || !currentPassword || newPassword.length < 8} className={btnPrimary}>
            Change password
          </button>
        </form>
      </Section>

      <Section title="Your data">
        <p className="text-sm text-slate-400">Download all your reports and practice answers as a JSON file.</p>
        <button onClick={() => void exportData()} className={`${btnGhost} mt-3`}>
          Download my data
        </button>
      </Section>

      <section className="rounded-2xl border border-rose-400/30 bg-rose-500/5 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-rose-200">Delete account</h2>
        <p className="mt-2 text-sm text-slate-400">
          This permanently deletes your account, all reports and practice history. Type <strong>DELETE</strong> to confirm.
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            aria-label="Type DELETE to confirm"
            className={`${inputCls} flex-1`}
          />
          <button
            onClick={deleteAccount}
            disabled={busy || confirmText !== "DELETE"}
            className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete forever
          </button>
        </div>
      </section>
    </div>
  );
}
