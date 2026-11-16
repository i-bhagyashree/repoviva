import { useState, type ReactNode } from "react";
import { useAuth } from "../lib/auth";
import { Link, navigate, useRoute } from "../lib/router";

const APP_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/practice", label: "Mock interview" },
  { to: "/compare", label: "Compare" },
];

export function Logo() {
  return (
    <Link to="/" className="text-xl font-bold tracking-tight text-white">
      Repo<span className="text-indigo-400">Viva</span>
    </Link>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { path } = useRoute();
  const [menuOpen, setMenuOpen] = useState(false);

  const linkCls = (to: string) =>
    `rounded-lg px-3 py-2 text-sm font-medium ${
      path.startsWith(to) ? "bg-white/10 text-white" : "text-slate-300 hover:text-white"
    }`;

  function doLogout() {
    logout();
    navigate("/");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b1020]/85 backdrop-blur print:hidden">
        <nav className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Logo />
          {user && (
            <div className="ml-4 hidden gap-1 md:flex">
              {APP_LINKS.map((l) => (
                <Link key={l.to} to={l.to} className={linkCls(l.to)}>
                  {l.label}
                </Link>
              ))}
            </div>
          )}
          <div className="ml-auto hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <Link to="/profile" className={linkCls("/profile")}>
                  {user.name}
                </Link>
                <button onClick={doLogout} className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-white">
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:text-white">
                  Log in
                </Link>
                <Link
                  to="/signup"
                  className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
                >
                  Sign up free
                </Link>
              </>
            )}
          </div>
          <button
            className="ml-auto rounded-lg p-2 text-slate-300 md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d={menuOpen ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} />
            </svg>
          </button>
        </nav>
        {menuOpen && (
          <div className="flex flex-col gap-1 border-t border-white/10 px-4 py-3 md:hidden" onClick={() => setMenuOpen(false)}>
            {user ? (
              <>
                {APP_LINKS.map((l) => (
                  <Link key={l.to} to={l.to} className={linkCls(l.to)}>
                    {l.label}
                  </Link>
                ))}
                <Link to="/profile" className={linkCls("/profile")}>
                  Profile
                </Link>
                <button onClick={doLogout} className="rounded-lg px-3 py-2 text-left text-sm text-slate-400">
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className={linkCls("/login")}>
                  Log in
                </Link>
                <Link to="/signup" className={linkCls("/signup")}>
                  Sign up free
                </Link>
              </>
            )}
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-white/10 py-8 text-center text-sm text-slate-500 print:hidden">
        <p>
          RepoViva · Turn your GitHub projects into interview confidence ·{" "}
          <span className="text-slate-400">Works without any API key</span>
        </p>
      </footer>
    </div>
  );
}
