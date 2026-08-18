import {
  useMemo,
  useRef,
  useState,
  useEffect,
  useContext,
  useCallback,
  createContext,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { usePermissionsStore } from './permissions-store';
import {
  getMe,
  getPermissions,
  rotateBrowserSession,
  updateMyPreferredLocale,
  login as loginApi,
  logout as logoutApi,
} from '../api/auth-api';

import type { MeResponse, LoginRequest } from '../api/auth-api';

type AuthContextValue = {
  user: MeResponse | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: Omit<LoginRequest, 'tenantId'> & { tenantId?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  setPreferredLocale: (locale: string) => Promise<void>;
  invalidateSession: () => void;
};

type AuthProviderProps = {
  children: React.ReactNode;
  prepareAuthenticatedSession?: (user: MeResponse) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const SESSION_ROTATION_INTERVAL_MS = 10 * 60 * 1000;

export function AuthProvider({ children, prepareAuthenticatedSession }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const authenticatedIdentity = useRef<string | null>(null);

  const invalidateSession = useCallback(() => {
    queryClient.clear();
    authenticatedIdentity.current = null;
    setUser(null);
    setIsLoading(false);
    usePermissionsStore.getState().clearPermissions();
  }, [queryClient]);

  const refreshSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const meResponse = await getMe();
      const nextIdentity = `${meResponse.data.tenantId}:${meResponse.data.userId}`;
      if (authenticatedIdentity.current && authenticatedIdentity.current !== nextIdentity) {
        queryClient.clear();
      }

      const sessionPreparation = prepareAuthenticatedSession
        ? prepareAuthenticatedSession(meResponse.data)
        : Promise.resolve();
      const [permissionsResponse] = await Promise.all([getPermissions(), sessionPreparation]);

      authenticatedIdentity.current = nextIdentity;
      usePermissionsStore
        .getState()
        .setPermissions(Array.isArray(permissionsResponse.data) ? permissionsResponse.data : []);
      setUser(meResponse.data);
      setIsLoading(false);
      return true;
    } catch {
      invalidateSession();
      return false;
    }
  }, [invalidateSession, prepareAuthenticatedSession, queryClient]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (!user) return undefined;

    const rotate = async () => {
      try {
        await rotateBrowserSession();
      } catch {
        // The global unauthorized handler owns redirects; transient failures retry next interval.
      }
    };
    const interval = window.setInterval(() => void rotate(), SESSION_ROTATION_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void rotate();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user]);

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

  const setPreferredLocale = useCallback(async (locale: string) => {
    const response = await updateMyPreferredLocale(locale);
    setUser(response.data);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      refreshSession,
      setPreferredLocale,
      invalidateSession,
    }),
    [user, isLoading, login, logout, refreshSession, setPreferredLocale, invalidateSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
