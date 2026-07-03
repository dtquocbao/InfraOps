import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { StoredUser } from './api';
import { clearSession, getUser, login as apiLogin, setSession } from './api';

interface AuthContextValue {
  user: StoredUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(() => getUser());

  const value = useMemo(
    () => ({
      user,
      login: async (email: string, password: string) => {
        const session = await apiLogin(email, password);
        setSession(session);
        setUser(session.user);
      },
      logout: () => {
        clearSession();
        setUser(null);
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
