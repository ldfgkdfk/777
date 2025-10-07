import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { API } from "@/lib/api";
import { AuthResponse, User } from "@shared/api";

interface AuthState {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const STORAGE_KEY = "auth";
const AuthContext = createContext<AuthState | undefined>(undefined);

function readAuth(): AuthResponse | null {
  if (typeof window === "undefined") return null;
  const fromSession = window.sessionStorage.getItem(STORAGE_KEY);
  if (fromSession) {
    try { return JSON.parse(fromSession) as AuthResponse; } catch { return null; }
  }
  const fromLocal = window.localStorage.getItem(STORAGE_KEY);
  if (fromLocal) {
    try { return JSON.parse(fromLocal) as AuthResponse; } catch { return null; }
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const stored = readAuth();
    if (stored) {
      setUser(stored.user);
      setToken(stored.token);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const persist = useCallback((auth: AuthResponse) => {
    setUser(auth.user);
    setToken(auth.token);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const auth = await API.login({ email, password });
    persist(auth);
  }, [persist]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const auth = await API.register({ name, email, password });
    persist(auth);
  }, [persist]);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const value = useMemo(() => ({ user, token, login, register, logout }), [user, token, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
