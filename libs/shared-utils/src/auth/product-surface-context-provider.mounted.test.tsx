import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { axiosInstance, setAuthorizationAccessFailureHandler } from '../axios-instance';
import { HttpError } from '../http-error';
import {
  ProductSurfaceAuthorityProvider,
  useProductSurfaceAuthority,
} from './product-surface-context-provider';

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

function authorityEnvelope(revision = 'decision-revision-1'): ProductSurfaceContextListData {
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
        revalidateAt: new Date(now + 60_000).toISOString(),
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

function jsonResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  } as Response;
}

let root: Root | null;
let container: HTMLDivElement | null;
let queryClient: QueryClient;
let currentAuthority: ProductSurfaceAuthorityContextValue | null;

function AuthorityProbe() {
  currentAuthority = useProductSurfaceAuthority();
  return currentAuthority.status === 'ready' ? <div>private-content</div> : null;
}

describe('mounted product surface access-failure boundary', () => {
  beforeEach(async () => {
    root = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    currentAuthority = null;
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
});
