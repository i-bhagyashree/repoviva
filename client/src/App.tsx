import { useEffect } from "react";
import { Layout } from "./components/Layout";
import { btnPrimary, Spinner } from "./components/ui";
import { AuthProvider, useAuth } from "./lib/auth";
import { Link, navigate, useRoute } from "./lib/router";
import { Compare } from "./pages/Compare";
import { Dashboard } from "./pages/Dashboard";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Practice } from "./pages/Practice";
import { Profile } from "./pages/Profile";
import { ReportPage } from "./pages/ReportPage";
import { SharedReport } from "./pages/SharedReport";

const PROTECTED = new Set(["dashboard", "report", "practice", "compare", "profile"]);

const TITLES: Record<string, string> = {
  "": "RepoViva · Code review & interview prep for your GitHub projects",
  login: "Log in · RepoViva",
  signup: "Sign up · RepoViva",
  dashboard: "Dashboard · RepoViva",
  report: "Report · RepoViva",
  practice: "Mock interview · RepoViva",
  compare: "Compare · RepoViva",
  profile: "Profile · RepoViva",
  share: "Shared report · RepoViva",
};

function Pages() {
  const { user, ready } = useAuth();
  const { path, parts, query } = useRoute();
  const page = parts[0] ?? "";

  useEffect(() => {
    document.title = TITLES[page] ?? "RepoViva";
  }, [page]);

  // Logged-out users on a private page go to login, then come back.
  useEffect(() => {
    if (ready && !user && PROTECTED.has(page)) {
      navigate(`/login?next=${encodeURIComponent(path + (query.toString() ? `?${query}` : ""))}`, true);
    }
    if (ready && user && (page === "login" || page === "signup")) {
      navigate(query.get("next") ?? "/dashboard", true);
    }
  }, [ready, user, page, path, query]);

  if (!ready) return <Spinner />;
  if (PROTECTED.has(page) && !user) return <Spinner />;

  switch (page) {
    case "":
      return <Home />;
    case "login":
    case "signup":
      return <Login key={page} mode={page} next={query.get("next") ?? "/dashboard"} />;
    case "dashboard":
      return <Dashboard initialUrl={query.get("url") ?? ""} />;
    case "report":
      return <ReportPage key={parts[1]} id={parts[1] ?? ""} />;
    case "practice":
      return <Practice key={query.get("report") ?? "all"} initialReport={query.get("report")} />;
    case "compare":
      return <Compare a={query.get("a")} b={query.get("b")} />;
    case "profile":
      return <Profile />;
    case "share":
      return <SharedReport id={parts[1] ?? ""} />;
    default:
      return (
        <div className="mx-auto max-w-xl px-4 py-24 text-center">
          <p className="text-6xl font-bold text-indigo-400">404</p>
          <p className="mt-4 text-slate-300">This page does not exist.</p>
          <Link to="/" className={`${btnPrimary} mt-6`}>
            Go home
          </Link>
        </div>
      );
  }
}

export default function App() {
  return (
    <AuthProvider>
      <Layout>
        <Pages />
      </Layout>
    </AuthProvider>
  );
}
