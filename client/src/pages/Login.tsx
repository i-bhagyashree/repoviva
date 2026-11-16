import { useState } from "react";
import { btnPrimary, ErrorBox, inputCls } from "../components/ui";
import { useAuth } from "../lib/auth";
import { STATIC } from "../lib/config";
import { Link, navigate } from "../lib/router";

export function Login({ mode, next }: { mode: "login" | "signup"; next: string }) {
  const { login, signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSignup = mode === "signup";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (isSignup && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      if (isSignup) await signup(name, email, password);
      else await login(email, password);
      navigate(next.startsWith("/") ? next : "/dashboard", true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const strength = passwordStrength(password);
  const nextQuery = next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <div className="mx-auto grid min-h-[calc(100vh-140px)] max-w-5xl items-center gap-10 px-4 py-12 lg:grid-cols-2">
      <div className="hidden lg:block">
        <h1 className="text-4xl font-bold leading-tight text-white">
          {isSignup ? "Start preparing smarter." : "Welcome back."}
        </h1>
        <p className="mt-4 text-lg text-slate-400">
          {isSignup
            ? "Create a free account to save your reports, track your scores and run mock interviews."
            : "Log in to see your reports, practice history and progress."}
        </p>
        <ul className="mt-8 space-y-3 text-slate-300">
          {["Unlimited repo reviews", "Interview questions about your own code", "Graded answers with model answers", "Progress dashboard"].map(
            (t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-sm text-emerald-300">✓</span>
                {t}
              </li>
            ),
          )}
        </ul>
      </div>

      <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
        <div className="grid grid-cols-2 rounded-xl bg-black/30 p-1 text-sm font-medium">
          <Link
            to={`/login${nextQuery}`}
            className={`rounded-lg py-2 text-center ${!isSignup ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white"}`}
          >
            Log in
          </Link>
          <Link
            to={`/signup${nextQuery}`}
            className={`rounded-lg py-2 text-center ${isSignup ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white"}`}
          >
            Sign up
          </Link>
        </div>

        <h2 className="mt-6 text-2xl font-bold text-white">{isSignup ? "Create your account" : "Log in to RepoViva"}</h2>

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          {isSignup && (
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm text-slate-300">
                Name
              </label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required className={inputCls} />
            </div>
          )}
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm text-slate-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm text-slate-300">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignup ? "new-password" : "current-password"}
                required
                className={`${inputCls} pr-16`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute inset-y-0 right-3 text-xs font-medium text-slate-400 hover:text-white"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {isSignup && password && (
              <div className="mt-2">
                <div className="grid grid-cols-4 gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={`h-1 rounded-full ${i < strength.level ? strength.color : "bg-white/10"}`} />
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-400">{strength.label}</p>
              </div>
            )}
          </div>

          {error && <ErrorBox>{error}</ErrorBox>}

          <button type="submit" disabled={loading || !email || !password || (isSignup && !name)} className={`${btnPrimary} w-full py-3`}>
            {loading ? "Please wait..." : isSignup ? "Create account" : "Log in"}
          </button>
        </form>

        {STATIC && (
          <p className="mt-4 rounded-lg bg-white/5 p-3 text-xs text-slate-400">
            Your account and reports are saved privately in <strong>this browser</strong>. Use the same browser to
            log in again.
          </p>
        )}

        <p className="mt-6 text-center text-sm text-slate-400">
          {isSignup ? "Already have an account? " : "New to RepoViva? "}
          <Link to={`${isSignup ? "/login" : "/signup"}${nextQuery}`} className="font-medium text-indigo-300 hover:underline">
            {isSignup ? "Log in" : "Create an account"}
          </Link>
        </p>
      </div>
    </div>
  );
}

function passwordStrength(p: string) {
  let level = 0;
  if (p.length >= 8) level++;
  if (p.length >= 12) level++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) level++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) level++;
  if (p.length < 8) level = Math.min(level, 1);
  const labels = ["Too short", "Weak", "Okay", "Good", "Strong"];
  const colors = ["bg-rose-500", "bg-rose-500", "bg-amber-500", "bg-emerald-500", "bg-emerald-500"];
  return { level: Math.max(level, 1), label: p.length < 8 ? "Too short (min 8 characters)" : labels[level], color: colors[level] };
}
