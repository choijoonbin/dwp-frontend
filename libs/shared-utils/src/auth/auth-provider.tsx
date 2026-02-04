import { useMemo, useState, useEffect, useContext, useCallback, createContext } from 'react';

import { useMenuTreeStore } from './menu-tree-store';
import { usePermissionsStore } from './permissions-store';
import { normalizeRoutePath } from '../router/normalize-route-path';
import { getAccessToken, setAccessToken, clearAccessToken } from './token-storage';
import { setUserId, clearUserId, extractUserIdFromToken } from './user-id-storage';
import {
  getMe,
  getMenuTree,
  getPermissions,
  login as loginApi,
  extractAccessTokenFromLoginResponse,
} from '../api/auth-api';

import type { MenuNode } from './types';
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

/** Extract token from login response. Handles ApiResponse { data: { accessToken } }, { data: { data: { accessToken } } }, etc. */
function extractTokenFromLoginRes(res: unknown): string | null {
  if (!res || typeof res !== 'object') return null;
  const obj = res as Record<string, unknown>;
  const candidates: unknown[] = [obj, obj.data];
  const inner = obj.data && typeof obj.data === 'object' ? (obj.data as Record<string, unknown>).data : undefined;
  if (inner != null) candidates.push(inner);
  for (const c of candidates) {
    if (c != null && typeof c === 'object') {
      const token = extractAccessTokenFromLoginResponse(
        c as Parameters<typeof extractAccessTokenFromLoginResponse>[0]
      );
      if (token) return token;
    }
  }
  return null;
}

const normalizeMenuTreePaths = (nodes: MenuNode[]): MenuNode[] =>
  nodes.map((node) => ({
    ...node,
    path: normalizeRoutePath(node.path) ?? node.path,
    children: node.children ? normalizeMenuTreePaths(node.children) : undefined,
  }));

async function loadUserDataAfterLogin() {
  console.log('[AUTH] 🔄 사용자 데이터 로딩 시작 (getMe/getPermissions/getMenuTree)');
  
  const loadPermissions = async () => {
    try {
      console.log('[AUTH] 📡 getPermissions 호출 중...');
      const res = await getPermissions();
      console.log('[AUTH] ✅ getPermissions 성공:', res);
      if (res.data && Array.isArray(res.data)) {
        usePermissionsStore.getState().actions.setPermissions(res.data);
      } else {
        usePermissionsStore.getState().actions.setPermissions([]);
      }
    } catch (err) {
      console.error('[AUTH] ❌ getPermissions 실패:', err);
      usePermissionsStore.getState().actions.setPermissions([]);
    }
  };

  const loadMenuTree = async () => {
    try {
      console.log('[AUTH] 📡 getMenuTree 호출 중...');
      const res = await getMenuTree();
      console.log('[AUTH] ✅ getMenuTree 성공:', res);
      if (res.data?.menus && Array.isArray(res.data.menus)) {
        const normalizedMenus = normalizeMenuTreePaths(res.data.menus);
        useMenuTreeStore.getState().actions.setMenuTree(normalizedMenus);
      } else {
        useMenuTreeStore.getState().actions.setMenuTree([]);
      }
    } catch (err) {
      console.error('[AUTH] ❌ getMenuTree 실패:', err);
      useMenuTreeStore.getState().actions.setMenuTree([]);
    }
  };

  const loadMe = async () => {
    try {
      console.log('[AUTH] 📡 getMe 호출 중...');
      const res = await getMe();
      console.log('[AUTH] ✅ getMe 성공:', res);
    } catch (err) {
      console.error('[AUTH] ❌ getMe 실패:', err);
    }
  };

  await Promise.all([loadMe(), loadPermissions(), loadMenuTree()]);
  console.log('[AUTH] ✅ 사용자 데이터 로딩 완료');
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
        await loadUserDataAfterLogin();
      } finally {
        authDataLoadInProgress = false;
      }
    };

    loadUserData();
  }, [accessToken]);

  const loginWithToken = useCallback(async (token: string) => {
    console.log('[AUTH] 🔑 loginWithToken 시작, 토큰 저장 중...');
    setAccessToken(token);
    setAccessTokenState(token);
    const userId = extractUserIdFromToken(token);
    if (userId) setUserId(userId);
    console.log('[AUTH] ✅ 토큰 저장 완료, userId:', userId);

    const { isLoaded: permissionsLoaded } = usePermissionsStore.getState();
    const { isLoaded: menuTreeLoaded } = useMenuTreeStore.getState();
    if (permissionsLoaded && menuTreeLoaded) {
      console.log('[AUTH] ℹ️ 권한/메뉴 이미 로드됨, API 호출 생략');
      return;
    }

    if (authDataLoadInProgress) {
      console.log('[AUTH] ℹ️ 다른 곳에서 이미 로딩 중, 중복 호출 방지');
      return;
    }

    authDataLoadInProgress = true;
    try {
      await loadUserDataAfterLogin();
    } finally {
      authDataLoadInProgress = false;
    }
  }, []);

  const login = useCallback(
    async (payload: Omit<LoginRequest, 'tenantId'> & { tenantId?: string }) => {
      console.log('[AUTH] 🚀 로그인 시작:', payload.username);
      
      const res = await loginApi(payload);
      console.log('[AUTH] ✅ 로그인 API 성공, 응답:', res);
      
      const token = extractTokenFromLoginRes(res);
      if (!token) {
        console.error('[AUTH] ❌ 토큰 추출 실패, 응답:', res);
        throw new Error('Login succeeded but access token was not found in response');
      }
      console.log('[AUTH] ✅ 토큰 추출 성공');

      // [최적화] BE가 로그인 응답에 permissions/menus 포함 시 즉시 저장 (별도 API 호출 생략)
      const payloadData = (res as { data?: Record<string, unknown> }).data;
      const dataToUse =
        payloadData && typeof payloadData.data === 'object' ? payloadData.data : payloadData;
      const dataObj = dataToUse as { permissions?: unknown; menus?: unknown } | null;
      
      let hasPermissionsFromLogin = false;
      let hasMenusFromLogin = false;
      
      if (dataObj && typeof dataObj === 'object') {
        const perms = dataObj.permissions;
        const menus = dataObj.menus;
        
        // 유효한 permissions 배열이 있으면 저장 (빈 배열은 "없음"으로 간주)
        if (Array.isArray(perms) && perms.length > 0) {
          console.log('[AUTH] ℹ️ 로그인 응답에 permissions 포함됨, 즉시 저장 (API 호출 생략)');
          usePermissionsStore.getState().actions.setPermissions(perms);
          hasPermissionsFromLogin = true;
        }
        
        // 유효한 menus 배열이 있으면 저장 (빈 배열은 "없음"으로 간주)
        if (Array.isArray(menus) && menus.length > 0) {
          console.log('[AUTH] ℹ️ 로그인 응답에 menus 포함됨, 즉시 저장 (API 호출 생략)');
          const normalizedMenus = normalizeMenuTreePaths(menus as MenuNode[]);
          useMenuTreeStore.getState().actions.setMenuTree(normalizedMenus);
          hasMenusFromLogin = true;
        }
      }

      // 토큰 저장 (API 호출 시 Authorization 헤더에 필요)
      console.log('[AUTH] 💾 토큰 저장 중...');
      setAccessToken(token);
      setAccessTokenState(token);
      const userId = extractUserIdFromToken(token);
      if (userId) setUserId(userId);
      console.log('[AUTH] ✅ 토큰 저장 완료, userId:', userId);

      // 로그인 응답에 유효한 permissions와 menus가 둘 다 있으면 API 호출 생략
      const hasFullDataFromLogin = hasPermissionsFromLogin && hasMenusFromLogin;
      
      if (hasFullDataFromLogin) {
        console.log('[AUTH] 🎉 로그인 완료 (API 호출 생략, 로그인 응답 데이터 사용)');
        return;
      }

      // 로그인 응답에 데이터가 없으면 API 호출
      console.log('[AUTH] ℹ️ 로그인 응답에 permissions/menus 없음, API 호출 필요');
      
      // 스토어 초기화 (이전 세션 데이터 제거)
      if (!hasPermissionsFromLogin) {
        console.log('[AUTH] 🗑️ permissions 스토어 초기화');
        usePermissionsStore.getState().actions.clearPermissions();
      }
      if (!hasMenusFromLogin) {
        console.log('[AUTH] 🗑️ menuTree 스토어 초기화');
        useMenuTreeStore.getState().actions.clearMenuTree();
      }

      authDataLoadInProgress = true;
      try {
        await loadUserDataAfterLogin();
      } finally {
        authDataLoadInProgress = false;
      }

      console.log('[AUTH] 🎉 로그인 완료');
    },
    []
  );

  const logout = useCallback(() => {
    console.log('[AUTH] 👋 로그아웃');
    clearAccessToken();
    clearUserId();
    setAccessTokenState(null);
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
