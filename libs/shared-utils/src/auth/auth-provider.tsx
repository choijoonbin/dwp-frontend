import { useMemo, useState, useEffect, useContext, useCallback, createContext } from 'react';

import { usePermissionsStore } from './permissions-store';
import { getMe, getPermissions, login as loginApi, logout as logoutApi } from '../api/auth-api';

import type { MeResponse, LoginRequest } from '../api/auth-api';

type AuthContextValue = {
  user: MeResponse | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: Omit<LoginRequest, 'tenantId'> & { tenantId?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  invalidateSession: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const invalidateSession = useCallback(() => {
    setUser(null);
    setIsLoading(false);
    usePermissionsStore.getState().clearPermissions();
  }, []);

  const refreshSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const meResponse = await getMe();
      const permissionsResponse = await getPermissions();
      setUser(meResponse.data);
      usePermissionsStore
        .getState()
        .setPermissions(Array.isArray(permissionsResponse.data) ? permissionsResponse.data : []);
      setIsLoading(false);
      return true;
    } catch {
      invalidateSession();
      return false;
    }
  }, [invalidateSession]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(
    async (payload: Omit<LoginRequest, 'tenantId'> & { tenantId?: string }) => {
      await loginApi(payload);
      const authenticated = await refreshSession();
      if (!authenticated) throw new Error('The authenticated session could not be verified.');
    },
    [refreshSession]
  );

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } finally {
      invalidateSession();
    }
  }, [invalidateSession]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      refreshSession,
      invalidateSession,
    }),
    [user, isLoading, login, logout, refreshSession, invalidateSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
