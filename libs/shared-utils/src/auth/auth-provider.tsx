import {
  useMemo,
  useState,
  useEffect,
  useContext,
  useCallback,
  createContext,
} from 'react';

import { usePermissionsStore } from './permissions-store';
import {
  getAccessToken,
  setAccessToken,
  clearAccessToken,
  authTokenEventName,
} from './token-storage';
import {
  getMe,
  getPermissions,
  login as loginApi,
  extractAccessTokenFromLoginResponse,
} from '../api/auth-api';

import type { LoginRequest, PermissionDTO } from '../api/auth-api';

type AuthContextValue = {
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (payload: Omit<LoginRequest, 'tenantId'> & { tenantId?: string }) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
let sessionLoadPromise: Promise<void> | null = null;

async function loadSession(): Promise<void> {
  if (sessionLoadPromise) return sessionLoadPromise;

  sessionLoadPromise = Promise.allSettled([getMe(), getPermissions()])
    .then((results) => {
      const permissionsResult = results[1];
      const permissions =
        permissionsResult.status === 'fulfilled' && Array.isArray(permissionsResult.value.data)
          ? permissionsResult.value.data
          : [];
      usePermissionsStore.getState().setPermissions(permissions);
    })
    .finally(() => {
      sessionLoadPromise = null;
    });

  return sessionLoadPromise;
}

function storeToken(token: string): void {
  setAccessToken(token);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessTokenState] = useState<string | null>(() => getAccessToken());

  useEffect(() => {
    const syncToken = () => setAccessTokenState(getAccessToken());
    window.addEventListener(authTokenEventName, syncToken);
    return () => window.removeEventListener(authTokenEventName, syncToken);
  }, []);

  useEffect(() => {
    if (accessToken) void loadSession();
  }, [accessToken]);

  const loginWithToken = useCallback(async (token: string) => {
    storeToken(token);
    setAccessTokenState(token);
    await loadSession();
  }, []);

  const login = useCallback(
    async (payload: Omit<LoginRequest, 'tenantId'> & { tenantId?: string }) => {
      const response = await loginApi(payload);
      const token = extractAccessTokenFromLoginResponse(response.data);
      if (!token) throw new Error('Access token is missing from login response.');

      storeToken(token);
      setAccessTokenState(token);

      const responseData = response.data as { permissions?: PermissionDTO[] };
      if (Array.isArray(responseData.permissions)) {
        usePermissionsStore.getState().setPermissions(responseData.permissions);
      } else {
        await loadSession();
      }
    },
    []
  );

  const logout = useCallback(() => {
    clearAccessToken();
    setAccessTokenState(null);
    usePermissionsStore.getState().clearPermissions();
  }, []);

  const value = useMemo(
    () => ({
      accessToken,
      isAuthenticated: Boolean(accessToken),
      login,
      loginWithToken,
      logout,
    }),
    [accessToken, login, loginWithToken, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
