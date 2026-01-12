import { useMemo, useState, useEffect , useContext, useCallback, createContext } from 'react';

import { login as loginApi } from '../api/auth-api';
import { getAccessToken, setAccessToken, clearAccessToken } from './token-storage';

import type { LoginRequest } from '../api/auth-api';

// ----------------------------------------------------------------------

export type AuthState = {
  accessToken: string | null;
  isAuthenticated: boolean;
};

export type AuthContextValue = AuthState & {
  login: (payload: LoginRequest) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function extractAccessToken(data: unknown): string | null {
  if (!data) return null;
  if (typeof data === 'string') return data;

  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const accessToken = obj.accessToken;
    const token = obj.token;

    if (typeof accessToken === 'string') return accessToken;
    if (typeof token === 'string') return token;
  }

  return null;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [accessToken, setAccessTokenState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return getAccessToken();
  });

  useEffect(() => {
    const onTokenChange = () => setAccessTokenState(getAccessToken());
    window.addEventListener('dwp-auth-token', onTokenChange);
    return () => window.removeEventListener('dwp-auth-token', onTokenChange);
  }, []);

  const login = useCallback(async (payload: LoginRequest) => {
    const res = await loginApi(payload);
    const token = extractAccessToken(res.data);
    if (!token) {
      throw new Error('Login succeeded but access token was not found in response.data');
    }
    setAccessToken(token);
    setAccessTokenState(token);
  }, []);

  const logout = useCallback(() => {
    clearAccessToken();
    setAccessTokenState(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      isAuthenticated: Boolean(accessToken),
      login,
      logout,
    }),
    [accessToken, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

