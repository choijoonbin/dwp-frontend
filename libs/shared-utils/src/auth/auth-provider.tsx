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
import { HttpError } from '../http-error';
import { IdentityPlaneContractError, resolveIdentityPlane } from './control-plane-access';

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

function securityScopeFingerprint(user: MeResponse, permissions: readonly unknown[]): string {
  const normalizedPermissions = permissions.map((permission) => JSON.stringify(permission)).sort();
  const groups = (user.groups ?? [])
    .map((group) => [group.groupRef.trim(), group.groupKey?.trim() ?? ''].join(':'))
    .sort();
  const resourceRoles = (user.resourceRoles ?? [])
    .map((role) =>
      [
        role.responsibilityCode,
        role.resourceType,
        role.resourceKey,
        role.resourceSetId,
        role.resourceSetKey,
        role.validTo ?? '',
      ].join(':')
    )
    .sort();
  return JSON.stringify({
    identity: `${user.identityPlane}:${user.tenantId}:${user.userId}:${user.personPublicId ?? ''}`,
    roles: [...user.roles].sort(),
    groups,
    resourceRoles,
    legacyRoleFallbackAllowed: user.legacyRoleFallbackAllowed === true,
    permissions: normalizedPermissions,
  });
}

export function AuthProvider({ children, prepareAuthenticatedSession }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const authenticatedIdentity = useRef<string | null>(null);
  const authenticatedScope = useRef<string | null>(null);
  const verificationInFlight = useRef<Promise<boolean> | null>(null);

  const invalidateSession = useCallback(() => {
    queryClient.clear();
    authenticatedIdentity.current = null;
    authenticatedScope.current = null;
    setUser(null);
    setIsLoading(false);
    usePermissionsStore.getState().clearPermissions();
  }, [queryClient]);

  const verifySession = useCallback(
    (showLoading: boolean) => {
      if (verificationInFlight.current) return verificationInFlight.current;
      if (showLoading) setIsLoading(true);
      const verification = (async () => {
        try {
          const meResponse = await getMe();
          const identityPlane = resolveIdentityPlane(meResponse.data);
          const nextIdentity = `${identityPlane}:${meResponse.data.tenantId}:${meResponse.data.userId}`;
          const sessionPreparation = prepareAuthenticatedSession
            ? prepareAuthenticatedSession(meResponse.data)
            : Promise.resolve();
          const [permissionsResponse] = await Promise.all([getPermissions(), sessionPreparation]);
          const nextPermissions = Array.isArray(permissionsResponse.data)
            ? permissionsResponse.data
            : [];
          const nextScope = securityScopeFingerprint(meResponse.data, nextPermissions);
          if (
            (authenticatedIdentity.current && authenticatedIdentity.current !== nextIdentity) ||
            (authenticatedScope.current && authenticatedScope.current !== nextScope)
          ) {
            queryClient.clear();
          }

          authenticatedIdentity.current = nextIdentity;
          authenticatedScope.current = nextScope;
          usePermissionsStore.getState().setPermissions(nextPermissions);
          setUser(meResponse.data);
          setIsLoading(false);
          return true;
        } catch (error) {
          // A background verification is an authority freshness check, not a
          // positive logout signal. Keep the last verified scope through a
          // transient/network/5xx failure; only an authentication rejection
          // may revoke it. Foreground verification remains fail-closed.
          if (
            showLoading ||
            error instanceof IdentityPlaneContractError ||
            (error instanceof HttpError && (error.status === 401 || error.status === 403))
          ) {
            invalidateSession();
          }
          return false;
        }
      })();
      verificationInFlight.current = verification;
      void verification.finally(() => {
        if (verificationInFlight.current === verification) verificationInFlight.current = null;
      });
      return verification;
    },
    [invalidateSession, prepareAuthenticatedSession, queryClient]
  );

  const refreshSession = useCallback(() => verifySession(true), [verifySession]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const isAuthenticated = Boolean(user);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const rotateAndRefresh = async () => {
      try {
        await rotateBrowserSession();
        await verifySession(false);
      } catch {
        // The global unauthorized handler owns redirects; transient failures retry next interval.
      }
    };
    const interval = window.setInterval(
      () => void rotateAndRefresh(),
      SESSION_ROTATION_INTERVAL_MS
    );
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void rotateAndRefresh();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isAuthenticated, verifySession]);

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

  const setPreferredLocale = useCallback(
    async (locale: string) => {
      const response = await updateMyPreferredLocale(locale);
      const nextPlane = resolveIdentityPlane(response.data);
      if (
        !user ||
        response.data.userId !== user.userId ||
        response.data.tenantId !== user.tenantId ||
        nextPlane !== resolveIdentityPlane(user)
      ) {
        invalidateSession();
        throw new IdentityPlaneContractError('locale response changed the verified identity');
      }
      setUser(response.data);
    },
    [invalidateSession, user]
  );

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated,
      login,
      logout,
      refreshSession,
      setPreferredLocale,
      invalidateSession,
    }),
    [
      user,
      isLoading,
      isAuthenticated,
      login,
      logout,
      refreshSession,
      setPreferredLocale,
      invalidateSession,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
