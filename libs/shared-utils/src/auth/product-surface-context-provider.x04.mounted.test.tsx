import { act, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import x04Config from '../../../../scripts/x04-local-revocation-slo.config.json';
import { HttpError } from '../http-error';
import {
  ProductSurfaceAuthorityProvider,
  productSurfaceAuthorityQueryPrefix,
  productSurfaceRevisionStorageKey,
  useProductSurfaceAuthority,
} from './product-surface-context-provider';
import { parseProductSurfaceAuthoritySnapshot } from './product-surface-authority-model';

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

type CapabilityMode = (typeof x04Config.capabilityModes)[number];
type TabId = 'source' | 'target';
type ScenarioEvidence = {
  mode: string;
  deliveryDelayMs: number;
  propagationLatencyMs: number;
  cachePurgeLatencyMs: number;
  uiDenialLatencyMs: number;
  assertions: Record<string, boolean>;
};
type Observation = {
  publishedAtMs: number | null;
  propagatedAtMs: number | null;
  cachePurgedAtMs: number | null;
  uiDeniedAtMs: number | null;
};

const FIXED_CLOCK_MS = Date.parse('2026-08-28T00:00:00.000Z');
const authorityQueryKey = [...productSurfaceAuthorityQueryPrefix, '1', '11'] as const;
const privateQueryKey = ['x04-private', 'target', 'salary'] as const;
const publicQueryKey = ['x04-public', 'catalog'] as const;

let activeObservation: Observation | null = null;

function authorityEnvelope(revision: string): ProductSurfaceContextListData {
  return {
    contractVersion: '1',
    decisionRevision: revision,
    sourceRevisions: { auth: `auth-${revision}` },
    activeAccessMode: 'NORMAL',
    generatedAt: new Date(Date.now() - 1_000).toISOString(),
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
        revalidateAt: new Date(Date.now() + 60_000).toISOString(),
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

class DeterministicBroadcastChannel {
  static readonly channels = new Map<string, Set<DeterministicBroadcastChannel>>();

  readonly name: string;
  readonly listeners = new Set<(event: MessageEvent<unknown>) => void>();
  closed = false;
  deliveryDelayMs: number;

  constructor(name: string) {
    this.name = name;
    this.deliveryDelayMs = currentDeliveryDelayMs;
    const peers = DeterministicBroadcastChannel.channels.get(name) ?? new Set();
    peers.add(this);
    DeterministicBroadcastChannel.channels.set(name, peers);
  }

  postMessage(message: unknown) {
    if (this.closed) throw new Error('BroadcastChannel is closed.');
    if (activeObservation?.publishedAtMs === null) activeObservation.publishedAtMs = Date.now();
    for (const peer of DeterministicBroadcastChannel.channels.get(this.name) ?? []) {
      if (peer === this || peer.closed) continue;
      window.setTimeout(() => {
        if (peer.closed) return;
        if (activeObservation?.propagatedAtMs === null) {
          activeObservation.propagatedAtMs = Date.now();
        }
        const event = { data: structuredClone(message) } as MessageEvent<unknown>;
        for (const listener of peer.listeners) listener(event);
      }, this.deliveryDelayMs);
    }
  }

  addEventListener(type: string, listener: (event: MessageEvent<unknown>) => void) {
    if (type === 'message') this.listeners.add(listener);
  }

  removeEventListener(type: string, listener: (event: MessageEvent<unknown>) => void) {
    if (type === 'message') this.listeners.delete(listener);
  }

  close() {
    this.closed = true;
    this.listeners.clear();
    DeterministicBroadcastChannel.channels.get(this.name)?.delete(this);
  }

  static reset() {
    DeterministicBroadcastChannel.channels.clear();
  }
}

let currentDeliveryDelayMs = 0;

function AuthorityProbe({
  tab,
  values,
}: {
  tab: TabId;
  values: Record<TabId, ProductSurfaceAuthorityContextValue | null>;
}) {
  const authority = useProductSurfaceAuthority();
  values[tab] = authority;
  useLayoutEffect(() => {
    if (
      tab === 'target' &&
      authority.status === 'authority-unavailable' &&
      activeObservation?.publishedAtMs !== null &&
      activeObservation?.uiDeniedAtMs === null
    ) {
      activeObservation.uiDeniedAtMs = Date.now();
    }
  }, [authority.status, tab]);
  return (
    <div data-x04-tab={tab}>
      {authority.status === 'ready' ? 'private-content' : 'access-denied'}
    </div>
  );
}

async function runScenario(mode: CapabilityMode): Promise<ScenarioEvidence> {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_CLOCK_MS);
  currentDeliveryDelayMs = mode.deliveryDelayMs;
  activeObservation = {
    publishedAtMs: null,
    propagatedAtMs: null,
    cachePurgedAtMs: null,
    uiDeniedAtMs: null,
  };
  DeterministicBroadcastChannel.reset();
  window.localStorage.clear();
  let storageSetSpy: ReturnType<typeof vi.spyOn> | null = null;
  if (mode.id === 'BROADCAST_CHANNEL') {
    vi.stubGlobal('BroadcastChannel', DeterministicBroadcastChannel);
  } else {
    vi.stubGlobal('BroadcastChannel', undefined);
    const originalSetItem = Storage.prototype.setItem;
    storageSetSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string
    ) {
      originalSetItem.call(this, key, value);
      if (key !== productSurfaceRevisionStorageKey) return;
      if (activeObservation?.publishedAtMs === null) activeObservation.publishedAtMs = Date.now();
      window.setTimeout(() => {
        if (activeObservation?.propagatedAtMs === null) {
          activeObservation.propagatedAtMs = Date.now();
        }
        window.dispatchEvent(
          new StorageEvent('storage', { key: productSurfaceRevisionStorageKey, newValue: value })
        );
      }, mode.deliveryDelayMs);
    });
  }

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  const sourceClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const targetClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const values: Record<TabId, ProductSurfaceAuthorityContextValue | null> = {
    source: null,
    target: null,
  };
  let initialLoads = 0;
  authApi.getProductSurfaceContexts.mockReset();
  authApi.getProductSurfaceContexts.mockImplementation(async () => {
    if (initialLoads < 2) {
      initialLoads += 1;
      return authorityEnvelope('decision-revision-1');
    }
    throw new HttpError('Authority resolution unavailable.', 503, {
      errorCode: 'AUTHORITY_RESOLUTION_UNAVAILABLE',
    });
  });

  const unsubscribe = targetClient.getQueryCache().subscribe((event) => {
    if (
      event.type === 'removed' &&
      event.query.queryKey[0] === privateQueryKey[0] &&
      activeObservation?.cachePurgedAtMs === null
    ) {
      activeObservation.cachePurgedAtMs = Date.now();
    }
  });

  try {
    await act(async () => {
      root.render(
        <>
          <QueryClientProvider client={sourceClient}>
            <ProductSurfaceAuthorityProvider legacySensitiveQueryPrefixes={['x04-private']}>
              <AuthorityProbe tab="source" values={values} />
            </ProductSurfaceAuthorityProvider>
          </QueryClientProvider>
          <QueryClientProvider client={targetClient}>
            <ProductSurfaceAuthorityProvider legacySensitiveQueryPrefixes={['x04-private']}>
              <AuthorityProbe tab="target" values={values} />
            </ProductSurfaceAuthorityProvider>
          </QueryClientProvider>
        </>
      );
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.waitFor(() => {
        expect(values.source?.status).toBe('ready');
        expect(values.target?.status).toBe('ready');
      });
    });
    vi.setSystemTime(FIXED_CLOCK_MS);
    sourceClient.setQueryData(['x04-private', 'source', 'salary'], { salary: 'retained' });
    targetClient.setQueryData(privateQueryKey, { salary: 'revoked' });
    targetClient.setQueryData(publicQueryKey, ['public']);

    await act(async () => {
      sourceClient.setQueryData(
        authorityQueryKey,
        parseProductSurfaceAuthoritySnapshot(authorityEnvelope('decision-revision-2'), Date.now())
      );
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(activeObservation.publishedAtMs).not.toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(mode.deliveryDelayMs);
    });
    await act(async () => {
      await vi.waitFor(() => {
        expect(values.target?.status).toBe('authority-unavailable');
        expect(targetClient.getQueryData(privateQueryKey)).toBeUndefined();
        expect(container.querySelector('[data-x04-tab="target"]')?.textContent).toBe(
          'access-denied'
        );
      });
    });

    expect(values.source?.status).toBe('ready');
    expect(sourceClient.getQueryData(['x04-private', 'source', 'salary'])).toEqual({
      salary: 'retained',
    });
    expect(targetClient.getQueryData(publicQueryKey)).toEqual(['public']);
    expect(authApi.getProductSurfaceContexts).toHaveBeenCalledTimes(3);

    const publishedAtMs = activeObservation.publishedAtMs;
    const propagatedAtMs = activeObservation.propagatedAtMs;
    const cachePurgedAtMs = activeObservation.cachePurgedAtMs;
    const uiDeniedAtMs = activeObservation.uiDeniedAtMs;
    expect(publishedAtMs).not.toBeNull();
    expect(propagatedAtMs).not.toBeNull();
    expect(cachePurgedAtMs).not.toBeNull();
    expect(uiDeniedAtMs).not.toBeNull();
    const propagationLatencyMs = propagatedAtMs! - publishedAtMs!;
    const cachePurgeLatencyMs = cachePurgedAtMs! - publishedAtMs!;
    const uiDenialLatencyMs = uiDeniedAtMs! - publishedAtMs!;
    expect(propagationLatencyMs).toBe(mode.deliveryDelayMs);
    expect(cachePurgeLatencyMs).toBeLessThanOrEqual(mode.localGuardrailMs.cachePurge);
    expect(uiDenialLatencyMs).toBeLessThanOrEqual(mode.localGuardrailMs.uiDenial);

    return {
      mode: mode.id,
      deliveryDelayMs: mode.deliveryDelayMs,
      propagationLatencyMs,
      cachePurgeLatencyMs,
      uiDenialLatencyMs,
      assertions: {
        REVISION_PROPAGATED: propagatedAtMs !== null,
        ACCESS_SENSITIVE_CACHE_PURGED: targetClient.getQueryData(privateQueryKey) === undefined,
        DENIAL_UI_COMMITTED:
          container.querySelector('[data-x04-tab="target"]')?.textContent === 'access-denied',
        PUBLIC_CACHE_RETAINED:
          JSON.stringify(targetClient.getQueryData(publicQueryKey)) === JSON.stringify(['public']),
        AUTHORITY_REFRESH_FAILURE_STAYS_DENIED: values.target?.status === 'authority-unavailable',
        SOURCE_TAB_REMAINS_READY: values.source?.status === 'ready',
      },
    };
  } finally {
    unsubscribe();
    await act(async () => root.unmount());
    sourceClient.clear();
    targetClient.clear();
    container.remove();
    storageSetSpy?.mockRestore();
    DeterministicBroadcastChannel.reset();
    activeObservation = null;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it(x04Config.testName, async () => {
  const scenarios: ScenarioEvidence[] = [];
  for (const mode of x04Config.capabilityModes) scenarios.push(await runScenario(mode));
  const evidence = {
    schemaVersion: 1,
    evidenceId: x04Config.automationId,
    claimScope: x04Config.claimScope,
    clock: x04Config.clock,
    productionSloAttestation: null,
    readinessDisposition: x04Config.readinessDisposition,
    externalBlockers: x04Config.externalBlockers,
    scenarios,
  };
  console.log(`DWP_X04_LOCAL_EVIDENCE=${JSON.stringify(evidence)}`);
  for (const scenario of scenarios) {
    expect(Object.values(scenario.assertions).every(Boolean)).toBe(true);
  }
});
