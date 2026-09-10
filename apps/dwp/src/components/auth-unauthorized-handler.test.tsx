// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sessionHttp, setUnauthorizedHandler } from '@dwp-frontend/shared-utils/axios-instance';

const authState = vi.hoisted(() => ({
  current: {
    invalidateSession: vi.fn(),
    isAuthenticated: false,
    user: null as {
      identityPlane: string;
      tenantId: number;
      userId: number;
    } | null,
  },
}));

vi.mock('@dwp-frontend/shared-utils/auth/auth-provider', () => ({
  useAuth: () => authState.current,
}));

import { AuthUnauthorizedHandler } from './auth-unauthorized-handler';

function unauthorizedResponse(): Response {
  return {
    ok: false,
    status: 401,
    headers: new Headers(),
    text: async () => JSON.stringify({ errorCode: 'AUTHENTICATION_REQUIRED' }),
  } as Response;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('authenticated session rejection observer', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    authState.current.invalidateSession = vi.fn();
    authState.current.isAuthenticated = false;
    authState.current.user = null;
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    setUnauthorizedHandler(null);
    vi.unstubAllGlobals();
  });

  async function renderObserver() {
    await act(async () => root.render(<AuthUnauthorizedHandler />));
  }

  it('does not install a session rejection observer for an anonymous browser', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(unauthorizedResponse()));
    await renderObserver();

    await expect(sessionHttp.get('/api/protected')).rejects.toMatchObject({ status: 401 });

    expect(authState.current.invalidateSession).not.toHaveBeenCalled();
  });

  it('invalidates the current authenticated identity after an authoritative 401', async () => {
    authState.current.isAuthenticated = true;
    authState.current.user = { identityPlane: 'TENANT', tenantId: 1, userId: 11 };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(unauthorizedResponse()));
    await renderObserver();

    await expect(sessionHttp.get('/api/protected')).rejects.toMatchObject({ status: 401 });

    expect(authState.current.invalidateSession).toHaveBeenCalledOnce();
  });

  it('ignores a late 401 captured by the previous authenticated identity', async () => {
    const response = deferred<Response>();
    const previousInvalidation = vi.fn();
    authState.current.invalidateSession = previousInvalidation;
    authState.current.isAuthenticated = true;
    authState.current.user = { identityPlane: 'TENANT', tenantId: 1, userId: 11 };
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(response.promise));
    await renderObserver();
    const pendingRequest = sessionHttp.get('/api/protected');

    const currentInvalidation = vi.fn();
    authState.current.invalidateSession = currentInvalidation;
    authState.current.user = { identityPlane: 'PROVIDER', tenantId: 1, userId: 42 };
    await renderObserver();
    response.resolve(unauthorizedResponse());

    await expect(pendingRequest).rejects.toMatchObject({ status: 401 });
    expect(previousInvalidation).not.toHaveBeenCalled();
    expect(currentInvalidation).not.toHaveBeenCalled();
  });
});
