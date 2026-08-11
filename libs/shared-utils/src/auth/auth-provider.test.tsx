import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from './auth-provider';
import { usePermissionsStore } from './permissions-store';

import type { MeResponse } from '../api/auth-api';

const authApi = vi.hoisted(() => ({
  getMe: vi.fn(),
  getPermissions: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  rotateBrowserSession: vi.fn(),
  updateMyPreferredLocale: vi.fn(),
}));

vi.mock('../api/auth-api', () => ({
  getMe: authApi.getMe,
  getPermissions: authApi.getPermissions,
  login: authApi.login,
  logout: authApi.logout,
  rotateBrowserSession: authApi.rotateBrowserSession,
  updateMyPreferredLocale: authApi.updateMyPreferredLocale,
}));

const member: MeResponse = {
  userId: 11,
  displayName: 'Workspace Member',
  tenantId: 1,
  tenantCode: 'default',
  roles: ['WORKSPACE_MEMBER'],
};

const provider: MeResponse = {
  userId: 42,
  displayName: 'Provider Administrator',
  tenantId: 1,
  tenantCode: 'default',
  roles: ['PROVIDER_ADMIN'],
};

type AuthState = ReturnType<typeof useAuth>;

let root: Root | null;
let container: HTMLDivElement | null;
let queryClient: QueryClient;
let currentAuth: AuthState | null;

function AuthProbe() {
  currentAuth = useAuth();
  return null;
}

async function mountAuthProvider() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>
      </QueryClientProvider>
    );
  });
  await vi.waitFor(() => expect(currentAuth?.isAuthenticated).toBe(true));
}

describe('authenticated client lifecycle', () => {
  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    currentAuth = null;
    root = null;
    container = null;
    authApi.getMe.mockResolvedValue({ data: member });
    authApi.getPermissions.mockResolvedValue({
      data: [
        {
          resourceType: 'APP',
          resourceKey: 'APP.WORK',
          permissionCode: 'VIEW',
          effect: 'ALLOW',
        },
      ],
    });
    authApi.logout.mockResolvedValue(undefined);
    authApi.rotateBrowserSession.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
    queryClient.clear();
    usePermissionsStore.getState().clearPermissions();
    vi.clearAllMocks();
  });

  it('clears user-scoped queries and permissions on logout', async () => {
    await mountAuthProvider();
    queryClient.setQueryData(['workspace', 'work-queue'], { items: ['tenant-private'] });

    await act(async () => {
      await currentAuth?.logout();
    });

    expect(queryClient.getQueryData(['workspace', 'work-queue'])).toBeUndefined();
    expect(usePermissionsStore.getState().permissions).toEqual([]);
    expect(usePermissionsStore.getState().isLoaded).toBe(false);
    expect(currentAuth?.isAuthenticated).toBe(false);
  });

  it('clears the previous identity cache when a verified session changes user', async () => {
    await mountAuthProvider();
    queryClient.setQueryData(['workspace', 'activity'], { events: ['member-private'] });
    authApi.getMe.mockResolvedValueOnce({ data: provider });
    authApi.getPermissions.mockResolvedValueOnce({ data: [] });

    await act(async () => {
      await currentAuth?.refreshSession();
    });

    expect(queryClient.getQueryData(['workspace', 'activity'])).toBeUndefined();
    expect(currentAuth?.user?.userId).toBe(provider.userId);
  });
});
