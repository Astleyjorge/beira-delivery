import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { User, AuthResponse } from "../types";

// What the auth context exposes to the rest of the app.
interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (auth: AuthResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// We persist the session in localStorage so a page refresh doesn't log the
// user out. On first load we read it back in. (localStorage is the browser's
// simple key-value storage — survives refreshes and browser restarts.)
const STORAGE_KEY = "beira_auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // useEffect runs once after the component first renders (the empty [] means
  // "only on mount"). We use it to restore a saved session from localStorage.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as AuthResponse;
        setUser(parsed.user);
        setToken(parsed.token);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  function login(auth: AuthResponse) {
    setUser(auth.user);
    setToken(auth.token);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  }

  function logout() {
    setUser(null);
    setToken(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// A custom hook so any component can grab auth state with one line:
//   const { user, token, login, logout } = useAuth();
// The error guards against using it outside the provider — a common mistake.
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return ctx;
}
