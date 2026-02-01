import { useMemo, useState, useEffect, useContext, useCallback, createContext } from 'react';

import { useMenuTreeStore } from './menu-tree-store';
import { usePermissionsStore } from './permissions-store';
import { getAccessToken, setAccessToken, clearAccessToken } from './token-storage';
import { setUserId, clearUserId, extractUserIdFromToken } from './user-id-storage';
import { getMe, getMenuTree, getPermissions, login as loginApi } from '../api/auth-api';

import type { LoginRequest } from '../api/auth-api';

/** Mount 시 me/permissions/tree 이중 fetch 방지 (Strict Mode 등). 모듈 단위로 유지 */
let authDataLoadInProgress = false;

// ----------------------------------------------------------------------

export type AuthState = {
  accessToken: string | null;
  isAuthenticated: boolean;
};

export type AuthContextValue = AuthState & {
  login: (payload: Omit<LoginRequest, 'tenantId'> & { tenantId?: string }) => Promise<void>;
  /** OIDC/SSO callback: set token and load user/permissions/menu (no credentials) */
  loginWithToken: (accessToken: string) => Promise<void>;
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

  // Load user info, permissions, and menu tree on mount if already authenticated (e.g., page refresh)
  useEffect(() => {
    const loadUserData = async () => {
      if (!accessToken) return;

      const { isLoaded: permissionsLoaded } = usePermissionsStore.getState();
      const { isLoaded: menuTreeLoaded } = useMenuTreeStore.getState();
      if (permissionsLoaded && menuTreeLoaded) return;

      if (authDataLoadInProgress) return;
      authDataLoadInProgress = true;

      try {
        const [, permissionsRes, menuTreeRes] = await Promise.all([
          getMe(),
          getPermissions(),
          getMenuTree(),
        ]);

        if (permissionsRes.data && Array.isArray(permissionsRes.data)) {
          usePermissionsStore.getState().actions.setPermissions(permissionsRes.data);
        }
        if (menuTreeRes.data?.menus && Array.isArray(menuTreeRes.data.menus)) {
          useMenuTreeStore.getState().actions.setMenuTree(menuTreeRes.data.menus);
        }
      } catch (error) {
        console.error('Failed to load user info, permissions, or menu tree on mount:', error);
      } finally {
        authDataLoadInProgress = false;
      }
    };

    loadUserData();
  }, [accessToken]);

  const loginWithToken = useCallback(async (token: string) => {
    setAccessToken(token);
    setAccessTokenState(token);
    const userId = extractUserIdFromToken(token);
    if (userId) setUserId(userId);
    try {
      const [, permissionsRes, menuTreeRes] = await Promise.all([
        getMe(),
        getPermissions(),
        getMenuTree(),
      ]);
      if (permissionsRes.data && Array.isArray(permissionsRes.data)) {
        usePermissionsStore.getState().actions.setPermissions(permissionsRes.data);
      }
      if (menuTreeRes.data?.menus && Array.isArray(menuTreeRes.data.menus)) {
        useMenuTreeStore.getState().actions.setMenuTree(menuTreeRes.data.menus);
      }
    } catch (error) {
      console.error('Failed to load user info, permissions, or menu tree:', error);
    }
  }, []);

  const login = useCallback(
    async (payload: Omit<LoginRequest, 'tenantId'> & { tenantId?: string }) => {
      const res = await loginApi(payload);
      const token = extractAccessToken(res.data);
      if (!token) {
        throw new Error('Login succeeded but access token was not found in response.data');
      }
      await loginWithToken(token);
    },
    [loginWithToken]
  );

  const logout = useCallback(() => {
    clearAccessToken();
    clearUserId();
    setAccessTokenState(null);
    // Clear permissions and menu tree on logout
    usePermissionsStore.getState().actions.clearPermissions();
    useMenuTreeStore.getState().actions.clearMenuTree();
  }, []);

  const value = useMemo<AuthContextValue>(
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
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
