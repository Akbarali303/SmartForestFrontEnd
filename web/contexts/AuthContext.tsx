'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AUTH_KEY = 'smart_forest_auth';

type AuthState = {
  isAuthenticated: boolean;
  user: string | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
};

const defaultAuth: AuthState = {
  isAuthenticated: false,
  user: null,
  login: () => false,
  logout: () => {},
};

const AuthContext = createContext<AuthState>(defaultAuth);

const DEMO_LOGIN = 'admin';
const DEMO_PASSWORD = 'admin123';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem(AUTH_KEY) : null;
      if (stored) {
        const { user: u } = JSON.parse(stored);
        setUser(u);
        setAuthenticated(true);
      }
    } catch {
      setAuthenticated(false);
      setUser(null);
    }
    setMounted(true);
  }, []);

  const login = useCallback((username: string, password: string): boolean => {
    if (username === DEMO_LOGIN && password === DEMO_PASSWORD) {
      setUser(username);
      setAuthenticated(true);
      try {
        localStorage.setItem(AUTH_KEY, JSON.stringify({ user: username }));
      } catch {}
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setAuthenticated(false);
    setUser(null);
    try {
      localStorage.removeItem(AUTH_KEY);
    } catch {}
  }, []);

  const value: AuthState = {
    isAuthenticated,
    user,
    login,
    logout,
  };

  if (!mounted) {
    return (
      <AuthContext.Provider value={value}>
        <div className="min-h-screen flex items-center justify-center bg-slate-100">
          <div className="animate-pulse text-slate-500">Yuklanmoqda...</div>
        </div>
      </AuthContext.Provider>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  return ctx ?? defaultAuth;
}
