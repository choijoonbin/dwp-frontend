import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from './auth-provider';
import { usePermissionsStore } from './permissions-store';
import { HttpError } from '../http-error';

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

async function renderAuthProvider(
  prepareAuthenticatedSession?: (user: MeResponse) => Promise<void>
) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider prepareAuthenticatedSession={prepareAuthenticatedSession}>
          <AuthProbe />
        </AuthProvider>
      </QueryClientProvider>
    );
  });
}

async function mountAuthProvider() {
  await renderAuthProvider();
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

  it('waits for application session preparation before exposing an authenticated user', async () => {
    let releasePreparation: () => void = () => undefined;
    const preparationGate = new Promise<void>((resolve) => {
      releasePreparation = resolve;
    });
    const prepareAuthenticatedSession = vi.fn(() => preparationGate);

    await renderAuthProvider(prepareAuthenticatedSession);
    await vi.waitFor(() => expect(prepareAuthenticatedSession).toHaveBeenCalledWith(member));

    expect(currentAuth?.isLoading).toBe(true);
    expect(currentAuth?.isAuthenticated).toBe(false);
    expect(usePermissionsStore.getState().isLoaded).toBe(false);

    await act(async () => releasePreparation());
    await vi.waitFor(() => expect(currentAuth?.isAuthenticated).toBe(true));

    expect(currentAuth?.isLoading).toBe(false);
    expect(usePermissionsStore.getState().isLoaded).toBe(true);
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

  it('clears user-scoped queries when the verified authority scope changes for the same user', async () => {
    await mountAuthProvider();
    queryClient.setQueryData(['home-contributions', 'private'], { value: 'cached' });
    authApi.getPermissions.mockResolvedValueOnce({ data: [] });

    await act(async () => {
      await currentAuth?.refreshSession();
    });

    expect(queryClient.getQueryData(['home-contributions', 'private'])).toBeUndefined();
    expect(usePermissionsStore.getState().permissions).toEqual([]);
  });

  it('clears cached scope when only a verified group key changes', async () => {
    const initial = {
      ...member,
      groups: [{ groupRef: 'group-finance', groupKey: 'finance-v1', displayName: 'Finance' }],
    };
    authApi.getMe.mockResolvedValue({ data: initial });
    await mountAuthProvider();
    queryClient.setQueryData(['home-contributions', 'group-scoped'], { value: 'cached' });
    authApi.getMe.mockResolvedValueOnce({
      data: {
        ...initial,
        groups: [{ groupRef: 'group-finance', groupKey: 'finance-v2', displayName: 'Finance' }],
      },
    });

    await act(async () => {
      await currentAuth?.refreshSession();
    });

    expect(queryClient.getQueryData(['home-contributions', 'group-scoped'])).toBeUndefined();
  });

  it('refreshes verified identity and permissions after a visible session rotation', async () => {
    await mountAuthProvider();
    const initialMeCalls = authApi.getMe.mock.calls.length;
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await vi.waitFor(() => expect(authApi.rotateBrowserSession).toHaveBeenCalled());
    await vi.waitFor(() => expect(authApi.getMe.mock.calls.length).toBeGreaterThan(initialMeCalls));
  });

  it('preserves the last verified session and cache on a transient background refresh failure', async () => {
    await mountAuthProvider();
    queryClient.setQueryData(['home-contributions', 'private'], { value: 'cached' });
    authApi.getMe.mockRejectedValueOnce(new HttpError('Temporary upstream failure.', 503));
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await vi.waitFor(() => expect(authApi.getMe).toHaveBeenCalledTimes(2));

    expect(currentAuth?.isAuthenticated).toBe(true);
    expect(currentAuth?.user?.userId).toBe(member.userId);
    expect(queryClient.getQueryData(['home-contributions', 'private'])).toEqual({ value: 'cached' });
    expect(usePermissionsStore.getState().isLoaded).toBe(true);
  });

  it('invalidates the session and cache on a background 401 verification response', async () => {
    await mountAuthProvider();
    queryClient.setQueryData(['home-contributions', 'private'], { value: 'cached' });
    authApi.getMe.mockRejectedValueOnce(new HttpError('Authentication required.', 401));
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await vi.waitFor(() => expect(currentAuth?.isAuthenticated).toBe(false));

    expect(queryClient.getQueryData(['home-contributions', 'private'])).toBeUndefined();
    expect(usePermissionsStore.getState().isLoaded).toBe(false);
  });

  it('invalidates the session and cache on a background 403 authority response', async () => {
    await mountAuthProvider();
    queryClient.setQueryData(['home-contributions', 'private'], { value: 'cached' });
    authApi.getPermissions.mockRejectedValueOnce(new HttpError('Forbidden.', 403));
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await vi.waitFor(() => expect(currentAuth?.isAuthenticated).toBe(false));

    expect(queryClient.getQueryData(['home-contributions', 'private'])).toBeUndefined();
    expect(usePermissionsStore.getState().isLoaded).toBe(false);
  });
});
