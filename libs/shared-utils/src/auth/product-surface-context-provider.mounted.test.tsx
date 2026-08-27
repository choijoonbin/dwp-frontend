import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { axiosInstance, setAuthorizationAccessFailureHandler } from '../axios-instance';
import { HttpError, HttpTransportError } from '../http-error';
import {
  ProductSurfaceAuthorityProvider,
  productSurfaceAuthorityQueryPrefix,
  productSurfaceRevisionStorageKey,
  useProductSurfaceAuthority,
} from './product-surface-context-provider';
import {
  parseProductSurfaceAuthoritySnapshot,
  productSurfaceBackgroundRefreshDelay,
} from './product-surface-authority-model';

import type { ProductSurfaceContextListData } from '../api/auth-api';
import type { ProductSurfaceAuthorityContextValue } from './product-surface-context-provider';

const authApi = vi.hoisted(() => ({
  evaluateGovernedRouteAccess: vi.fn(),
  evaluateProductSurfaceAccess: vi.fn(),
  getProductSurfaceContexts: vi.fn(),
}));

vi.mock('../api/auth-api', () => ({
  evaluateGovernedRouteAccess: authApi.evaluateGovernedRouteAccess,
  evaluateProductSurfaceAccess: authApi.evaluateProductSurfaceAccess,
  getProductSurfaceContexts: authApi.getProductSurfaceContexts,
}));

vi.mock('./auth-provider', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { tenantId: 1, userId: 11 },
  }),
}));

function authorityEnvelope(
  revision = 'decision-revision-1',
  revalidateAfterMs = 60_000
): ProductSurfaceContextListData {
  const now = Date.now();
  return {
    contractVersion: '1',
    decisionRevision: revision,
    sourceRevisions: { auth: `auth-${revision}` },
    activeAccessMode: 'NORMAL',
    generatedAt: new Date(now - 1_000).toISOString(),
    contexts: [
      {
        contextKey: 'hcm-personal-context',
        productKey: 'hcm',
        surfaceKey: 'hcm.personal',
        plane: 'work',
        accessMode: 'NORMAL',
        accessSource: 'ENTITLEMENT',
        appResourceKey: 'APP.HCM',
        effectiveGrants: [
          {
            grantKind: 'POLICY',
            accessPolicyKey: 'hcm.personal-access.v1',
            policyDecisionRef: 'hcm-personal-decision',
            authorityMode: 'ENTITLEMENT',
            scopeKeys: ['self'],
            requiresProductEntitlement: true,
            readOnly: false,
          },
        ],
        scopes: [
          {
            key: 'self',
            kind: 'SELF',
            displayName: 'My data',
            isDefault: true,
            readOnly: false,
          },
        ],
        revalidateAt: new Date(now + revalidateAfterMs).toISOString(),
      },
    ],
    rollouts: [
      {
        productKey: 'hcm',
        state: '111',
        flags: { contextShadow: true, capabilityEnforcement: true, surfaceUi: true },
        cohort: 'pilot',
        opaqueRevision: `rollout-${revision}`,
        authorityStatus: 'AVAILABLE',
      },
    ],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function jsonResponse(
  status: number,
  payload: unknown,
  headers: Record<string, string> = {}
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    text: async () => JSON.stringify(payload),
  } as Response;
}

let root: Root | null;
let container: HTMLDivElement | null;
let queryClient: QueryClient;
let currentAuthority: ProductSurfaceAuthorityContextValue | null;
let privateContentMounts: number;
let privateContentUnmounts: number;

function PrivateContent() {
  useEffect(() => {
    privateContentMounts += 1;
    return () => {
      privateContentUnmounts += 1;
    };
  }, []);
  return <div>private-content</div>;
}

function AuthorityProbe() {
  currentAuthority = useProductSurfaceAuthority();
  return currentAuthority.status === 'ready' ? <PrivateContent /> : null;
}

describe('mounted product surface access-failure boundary', () => {
  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    root = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    currentAuthority = null;
    privateContentMounts = 0;
    privateContentUnmounts = 0;
    authApi.getProductSurfaceContexts.mockResolvedValue(authorityEnvelope());
    root = createRoot(container);
    await act(async () => {
      root?.render(
        <QueryClientProvider client={queryClient}>
          <ProductSurfaceAuthorityProvider
            legacySensitiveQueryPrefixes={['hcm', 'workforce', 'system-code-set']}
          >
            <AuthorityProbe />
          </ProductSurfaceAuthorityProvider>
        </QueryClientProvider>
      );
    });
    await vi.waitFor(() => expect(currentAuthority?.status).toBe('ready'));
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    vi.useRealTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
    container?.remove();
    queryClient.clear();
    setAuthorizationAccessFailureHandler(null);
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('drops rendered and cached sensitive data and stays fail-closed when refetch fails', async () => {
    queryClient.setQueryData(['workforce', 'employee', 'private'], { salary: 'private' });
    queryClient.setQueryData(['system-code-set', 'PEOPLE.PAY_GRADE'], ['private-grade']);
    queryClient.setQueryData(['public-catalog', 'apps'], ['hcm']);
    authApi.getProductSurfaceContexts.mockRejectedValueOnce(
      new HttpError('Authority resolution unavailable.', 503, {
        errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE',
      })
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(409, {
          errorCode: 'DECISION_REVISION_CONFLICT',
          message: 'Authority revision changed.',
        })
      )
    );

    await act(async () => {
      await axiosInstance.get('/api/hcm/v1/private').catch(() => undefined);
    });
    await vi.waitFor(() => expect(currentAuthority?.status).toBe('authority-unavailable'));

    expect(container?.textContent).not.toContain('private-content');
    expect(queryClient.getQueryData(['workforce', 'employee', 'private'])).toBeUndefined();
    expect(queryClient.getQueryData(['system-code-set', 'PEOPLE.PAY_GRADE'])).toBeUndefined();
    expect(queryClient.getQueryData(['public-catalog', 'apps'])).toEqual(['hcm']);
    expect(authApi.getProductSurfaceContexts).toHaveBeenCalledTimes(2);
  });

  it('renews an unchanged authority lease in the background without unmounting or purging data', async () => {
    let invalidationEvents = 0;
    const onInvalidation = () => {
      invalidationEvents += 1;
    };
    window.addEventListener('dwp:product-surface-authority-invalidated', onInvalidation);
    vi.useFakeTimers();
    const shortSnapshot = parseProductSurfaceAuthoritySnapshot(
      authorityEnvelope('decision-revision-1', 20_000),
      Date.now()
    );
    await act(async () => {
      queryClient.setQueryData([...productSurfaceAuthorityQueryPrefix, '1', '11'], shortSnapshot);
      await vi.advanceTimersByTimeAsync(0);
    });
    const candidate = deferred<ProductSurfaceContextListData>();
    authApi.getProductSurfaceContexts.mockReturnValueOnce(candidate.promise);
    queryClient.setQueryData(['workforce', 'employee', 'private'], { salary: 'private' });
    const activeSnapshot = currentAuthority?.snapshot;
    expect(activeSnapshot).toBeDefined();
    const refreshDelay = productSurfaceBackgroundRefreshDelay(activeSnapshot!, Date.now());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(refreshDelay + 1);
    });

    expect(authApi.getProductSurfaceContexts).toHaveBeenCalledTimes(2);
    expect(currentAuthority?.status).toBe('ready');
    expect(container?.textContent).toContain('private-content');
    expect(queryClient.getQueryData(['workforce', 'employee', 'private'])).toEqual({
      salary: 'private',
    });

    await act(async () => {
      candidate.resolve(authorityEnvelope('decision-revision-1'));
      await candidate.promise;
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(currentAuthority?.status).toBe('ready');
    expect(container?.textContent).toContain('private-content');
    expect(queryClient.getQueryData(['workforce', 'employee', 'private'])).toEqual({
      salary: 'private',
    });
    expect(privateContentMounts).toBe(1);
    expect(privateContentUnmounts).toBe(0);
    expect(invalidationEvents).toBe(0);
    window.removeEventListener('dwp:product-surface-authority-invalidated', onInvalidation);
  });

  it.each(['transient network failure', 'unchanged lease'] as const)(
    'retries a %s before expiry without unmounting or purging data',
    async (firstAttempt) => {
      let invalidationEvents = 0;
      const onInvalidation = () => {
        invalidationEvents += 1;
      };
      window.addEventListener('dwp:product-surface-authority-invalidated', onInvalidation);
      vi.useFakeTimers();
      const shortSnapshot = parseProductSurfaceAuthoritySnapshot(
        authorityEnvelope('decision-revision-1', 20_000),
        Date.now()
      );
      await act(async () => {
        queryClient.setQueryData([...productSurfaceAuthorityQueryPrefix, '1', '11'], shortSnapshot);
        await vi.advanceTimersByTimeAsync(0);
      });
      if (firstAttempt === 'transient network failure') {
        authApi.getProductSurfaceContexts.mockRejectedValueOnce(new HttpTransportError('NETWORK'));
      } else {
        authApi.getProductSurfaceContexts.mockResolvedValueOnce(shortSnapshot.envelope);
      }
      authApi.getProductSurfaceContexts.mockImplementationOnce(async () =>
        authorityEnvelope('decision-revision-1', 60_000)
      );
      queryClient.setQueryData(['workforce', 'employee', 'private'], { salary: 'private' });
      const activeSnapshot = currentAuthority?.snapshot;
      expect(activeSnapshot).toBeDefined();
      const refreshDelay = productSurfaceBackgroundRefreshDelay(activeSnapshot!, Date.now());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(refreshDelay + 1);
      });
      expect(authApi.getProductSurfaceContexts).toHaveBeenCalledTimes(2);
      expect(currentAuthority?.status).toBe('ready');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_001);
      });

      expect(authApi.getProductSurfaceContexts).toHaveBeenCalledTimes(3);
      expect(currentAuthority?.status).toBe('ready');
      expect(container?.textContent).toContain('private-content');
      expect(queryClient.getQueryData(['workforce', 'employee', 'private'])).toEqual({
        salary: 'private',
      });
      expect(privateContentMounts).toBe(1);
      expect(privateContentUnmounts).toBe(0);
      expect(invalidationEvents).toBe(0);
      window.removeEventListener('dwp:product-surface-authority-invalidated', onInvalidation);
    }
  );

  it('keeps a valid authority mounted across repeated downstream authority 503 responses', async () => {
    let invalidationEvents = 0;
    const onInvalidation = () => {
      invalidationEvents += 1;
    };
    window.addEventListener('dwp:product-surface-authority-invalidated', onInvalidation);
    vi.useFakeTimers();
    authApi.getProductSurfaceContexts.mockImplementation(async () =>
      authorityEnvelope('decision-revision-1', 60_000)
    );
    queryClient.setQueryData(['workforce', 'employee', 'private'], { salary: 'private' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(503, {
          errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE',
          message: 'The downstream authority adapter is unavailable.',
        })
      )
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
      await axiosInstance.get('/api/hcm/v1/private').catch(() => undefined);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(authApi.getProductSurfaceContexts).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
      await axiosInstance.get('/api/hcm/v1/private').catch(() => undefined);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(authApi.getProductSurfaceContexts).toHaveBeenCalledTimes(3);
    expect(currentAuthority?.status).toBe('ready');
    expect(container?.textContent).toContain('private-content');
    expect(queryClient.getQueryData(['workforce', 'employee', 'private'])).toEqual({
      salary: 'private',
    });
    expect(privateContentMounts).toBe(1);
    expect(privateContentUnmounts).toBe(0);
    expect(invalidationEvents).toBe(0);
    window.removeEventListener('dwp:product-surface-authority-invalidated', onInvalidation);
  });

  it('keeps a revision conflict fail-closed when the authority endpoint only renews the rejected revision', async () => {
    vi.useFakeTimers();
    authApi.getProductSurfaceContexts.mockResolvedValue(
      authorityEnvelope('decision-revision-1', 60_000)
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(409, {
          errorCode: 'DECISION_REVISION_CONFLICT',
          message: 'Authority revision changed.',
        })
      )
    );

    await act(async () => {
      await axiosInstance
        .get('/api/hcm/v1/private', {
          headers: {
            'X-DWP-Expected-Decision-Revision': 'decision-revision-1',
          },
        })
        .catch(() => undefined);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(currentAuthority?.status).toBe('authority-unavailable');
    expect(privateContentMounts).toBe(1);
    expect(privateContentUnmounts).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(7_001);
    });

    expect(authApi.getProductSurfaceContexts).toHaveBeenCalledTimes(5);
    expect(currentAuthority?.status).toBe('authority-unavailable');
    expect(container?.textContent).not.toContain('private-content');
    expect(privateContentMounts).toBe(1);
    expect(privateContentUnmounts).toBe(1);
  });

  it('unblocks exactly once after a revision conflict is resolved by a new revision', async () => {
    vi.useFakeTimers();
    authApi.getProductSurfaceContexts
      .mockResolvedValueOnce(authorityEnvelope('decision-revision-1', 60_000))
      .mockResolvedValueOnce(authorityEnvelope('decision-revision-2', 60_000));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(409, {
          errorCode: 'DECISION_REVISION_CONFLICT',
          message: 'Authority revision changed.',
        })
      )
    );

    await act(async () => {
      await axiosInstance
        .get('/api/hcm/v1/private', {
          headers: {
            'X-DWP-Expected-Decision-Revision': 'decision-revision-1',
          },
        })
        .catch(() => undefined);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(currentAuthority?.status).toBe('authority-unavailable');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_001);
    });

    expect(authApi.getProductSurfaceContexts).toHaveBeenCalledTimes(3);
    expect(currentAuthority?.status).toBe('ready');
    expect(currentAuthority?.snapshot?.envelope.decisionRevision).toBe('decision-revision-2');
    expect(privateContentMounts).toBe(2);
    expect(privateContentUnmounts).toBe(1);
  });

  it('revalidates from the storage-event fallback when BroadcastChannel is unavailable', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    authApi.getProductSurfaceContexts.mockResolvedValueOnce(
      authorityEnvelope('decision-revision-2', 60_000)
    );

    await act(async () => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: productSurfaceRevisionStorageKey,
          newValue: JSON.stringify({
            type: 'product-surface-revision-changed',
            tenantId: '1',
            actorId: '11',
            accessMode: 'NORMAL',
            decisionRevision: 'decision-revision-2',
            senderId: 'other-tab',
          }),
        })
      );
      await vi.waitFor(() =>
        expect(currentAuthority?.snapshot?.envelope.decisionRevision).toBe('decision-revision-2')
      );
    });
    expect(authApi.getProductSurfaceContexts).toHaveBeenCalledTimes(2);
  });

  it('does not tear down a newer authority tree for a late conflict from an older request', async () => {
    vi.useFakeTimers();
    const revisionTwo = parseProductSurfaceAuthoritySnapshot(
      authorityEnvelope('decision-revision-2', 60_000),
      Date.now()
    );
    await act(async () => {
      queryClient.setQueryData([...productSurfaceAuthorityQueryPrefix, '1', '11'], revisionTwo);
      await vi.advanceTimersByTimeAsync(0);
    });
    authApi.getProductSurfaceContexts.mockResolvedValue(
      authorityEnvelope('decision-revision-2', 60_000)
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          409,
          {
            errorCode: 'DECISION_REVISION_CONFLICT',
            message: 'Authority revision changed.',
          },
          { 'X-DWP-Decision-Revision': 'decision-revision-2' }
        )
      )
    );

    await act(async () => {
      await axiosInstance
        .get('/api/hcm/v1/private', {
          headers: {
            'X-DWP-Expected-Decision-Revision': 'decision-revision-1',
          },
        })
        .catch(() => undefined);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(authApi.getProductSurfaceContexts).toHaveBeenCalledTimes(2);
    expect(currentAuthority?.status).toBe('ready');
    expect(currentAuthority?.snapshot?.envelope.decisionRevision).toBe('decision-revision-2');
    expect(privateContentMounts).toBe(1);
    expect(privateContentUnmounts).toBe(0);
  });

  it('rejects both the request and mounted revisions when the server reports a third revision', async () => {
    vi.useFakeTimers();
    const revisionTwo = parseProductSurfaceAuthoritySnapshot(
      authorityEnvelope('decision-revision-2', 60_000),
      Date.now()
    );
    await act(async () => {
      queryClient.setQueryData([...productSurfaceAuthorityQueryPrefix, '1', '11'], revisionTwo);
      await vi.advanceTimersByTimeAsync(0);
    });
    const revisionThree = deferred<ProductSurfaceContextListData>();
    authApi.getProductSurfaceContexts.mockReturnValueOnce(revisionThree.promise);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          409,
          {
            errorCode: 'DECISION_REVISION_CONFLICT',
            message: 'Authority revision changed.',
          },
          { 'X-DWP-Decision-Revision': 'decision-revision-3' }
        )
      )
    );

    await act(async () => {
      await axiosInstance
        .get('/api/hcm/v1/private', {
          headers: {
            'X-DWP-Expected-Decision-Revision': 'decision-revision-1',
          },
        })
        .catch(() => undefined);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(currentAuthority?.status).toBe('authority-unavailable');

    await act(async () => {
      revisionThree.resolve(authorityEnvelope('decision-revision-3', 60_000));
      await revisionThree.promise;
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(authApi.getProductSurfaceContexts).toHaveBeenCalledTimes(2);
    expect(currentAuthority?.status).toBe('ready');
    expect(currentAuthority?.snapshot?.envelope.decisionRevision).toBe('decision-revision-3');
    expect(privateContentMounts).toBe(2);
    expect(privateContentUnmounts).toBe(1);
  });

  it('purges only the expired scope cache without unmounting the rest of the application', async () => {
    let invalidationEvents = 0;
    const onInvalidation = () => {
      invalidationEvents += 1;
    };
    window.addEventListener('dwp:product-surface-authority-invalidated', onInvalidation);
    queryClient.setQueryData(['workforce', 'employee', 'scope-expired'], { salary: 'revoked' });
    queryClient.setQueryData(['workforce', 'employee', 'scope-current'], { salary: 'retained' });
    await queryClient.prefetchQuery({
      queryKey: ['product-surface-direct-evaluation', 'scope-expired'],
      queryFn: async () => ({ decision: 'ALLOWED' }),
      meta: {
        accessSensitive: true,
        tenantId: '1',
        actorId: '11',
        accessMode: 'NORMAL',
        contextScopeKey: 'scope-expired',
      },
    });
    authApi.getProductSurfaceContexts.mockResolvedValue(
      authorityEnvelope('decision-revision-1', 60_000)
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(403, {
          errorCode: 'SCOPE_CONTEXT_EXPIRED',
          message: 'The issued scope is no longer valid.',
        })
      )
    );

    await act(async () => {
      await axiosInstance
        .get('/api/hcm/v1/private', { contextScopeKey: 'scope-expired' })
        .catch(() => undefined);
    });
    await vi.waitFor(() => expect(authApi.getProductSurfaceContexts).toHaveBeenCalledTimes(2));

    expect(queryClient.getQueryData(['workforce', 'employee', 'scope-expired'])).toBeUndefined();
    expect(queryClient.getQueryData(['workforce', 'employee', 'scope-current'])).toEqual({
      salary: 'retained',
    });
    expect(
      queryClient.getQueryData(['product-surface-direct-evaluation', 'scope-expired'])
    ).toEqual({ decision: 'ALLOWED' });
    expect(currentAuthority?.status).toBe('ready');
    expect(privateContentMounts).toBe(1);
    expect(privateContentUnmounts).toBe(0);
    expect(invalidationEvents).toBe(0);
    window.removeEventListener('dwp:product-surface-authority-invalidated', onInvalidation);
  });
});
