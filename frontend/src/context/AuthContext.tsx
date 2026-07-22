import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { setAccessToken, registerRefreshHandler } from "../api/client";
import { fetchMe, login as apiLogin, logout as apiLogout, refresh as apiRefresh, type AuthUser } from "../api/auth";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const silentRefresh = useCallback(async (): Promise<string | null> => {
    try {
      const { accessToken } = await apiRefresh();
      setAccessToken(accessToken);
      return accessToken;
    } catch {
      setAccessToken(null);
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    registerRefreshHandler(silentRefresh);
  }, [silentRefresh]);

  useEffect(() => {
    (async () => {
      const token = await silentRefresh();
      if (token) {
        try {
          const { user } = await fetchMe();
          setUser(user);
        } catch {
          setAccessToken(null);
        }
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const { accessToken, user } = await apiLogin(identifier, password);
    setAccessToken(accessToken);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setAccessToken(null);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
