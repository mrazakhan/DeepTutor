"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiUrl } from "./api";

interface AuthUser {
  id: string;
  username: string;
  display_name: string;
  role: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName: string, email?: string) => Promise<{ pending: boolean }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => ({ pending: false }),
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const TOKEN_KEY = "deeptutor_token";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(apiUrl("/api/v1/auth/me"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else if (res.status === 401 || res.status === 403) {
        // Definitively unauthorized — clear token
        clearToken();
      }
      // Any other non-OK status (500, 502, network hiccup) → leave token
      // intact so the user isn't logged out due to a transient server error
    } catch {
      // Network error or non-JSON body — keep the token so a temporary
      // outage doesn't silently sign the user out
    } finally {
      setLoading(false);
    }
  }

  async function login(username: string, password: string) {
    const res = await fetch(apiUrl("/api/v1/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || "Login failed");
    }
    const data = await res.json();
    setToken(data.token);
    setUser(data.user);
  }

  async function register(username: string, password: string, displayName: string, email?: string): Promise<{ pending: boolean }> {
    const res = await fetch(apiUrl("/api/v1/auth/register"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, display_name: displayName, email: email || "" }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || "Registration failed");
    }
    const data = await res.json();
    // New accounts are pending approval — no token is issued
    if (data.pending) {
      return { pending: true };
    }
    // Fallback: if server issued a token (e.g. future admin-created accounts)
    if (data.token) {
      setToken(data.token);
      setUser(data.user);
    }
    return { pending: false };
  }

  async function logout() {
    const token = getToken();
    if (token) {
      try {
        await fetch(apiUrl("/api/v1/auth/logout"), {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // ignore
      }
    }
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
