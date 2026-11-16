import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken, setUnauthorizedHandler } from "./api";
import type { User } from "./types";

interface AuthState {
  user: User | null;
  ready: boolean; // false while checking a saved login
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (u: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(() => !getToken());

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setUser(null);
    });
    if (!getToken()) return;
    api<{ user: User }>("/api/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => {
        // token expired or server down: the user logs in again
      })
      .finally(() => setReady(true));
  }, []);

  async function finish(path: string, body: unknown) {
    const d = await api<{ token: string; user: User }>(path, { body });
    setToken(d.token);
    setUser(d.user);
  }

  const value: AuthState = {
    user,
    ready,
    login: (email, password) => finish("/api/auth/login", { email, password }),
    signup: (name, email, password) => finish("/api/auth/signup", { name, email, password }),
    logout: () => {
      setToken(null);
      setUser(null);
    },
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
