import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  evaluateGovernedRouteAccess,
  evaluateProductSurfaceAccess,
  getProductSurfaceContexts,
} from '../api/auth-api';
import { setAuthorizationAccessFailureHandler } from '../axios-instance';
import { useAuth } from './auth-provider';
import {
  parseProductSurfaceAuthoritySnapshot,
  productSurfaceAuthoritySemanticsMatch,
  productSurfaceBackgroundRefreshDelay,
  productSurfaceExpiryDelay,
  productSurfaceLeaseAdvanced,
  productSurfaceServerNow,
  productSurfaceSnapshotRemainsValid,
  resolveProductRollout,
} from './product-surface-authority-model';

import type {
  GovernedRouteEvaluationRequest,
  ProductSurfaceEvaluationRequest,
} from '../api/auth-api';
import type {
  ProductRolloutResolution,
  ProductSurfaceAuthoritySnapshot,
} from './product-surface-authority-model';

export const productSurfaceAuthorityQueryPrefix = ['auth', 'product-surface-contexts'] as const;
const REVISION_CHANNEL = 'dwp:product-surface:revision:v1';
export const productSurfaceRevisionStorageKey = `${REVISION_CHANNEL}:event`;
const MAX_REFRESH_DELAY_MS = 60_000;
const MAX_TIMER_DELAY_MS = 2_147_000_000;
const BACKGROUND_REFRESH_RETRY_BASE_MS = 1_000;
const BACKGROUND_REFRESH_RETRY_MAX_MS = 5_000;
const MAX_BACKGROUND_REFRESH_RETRIES = 3;
const MAX_HARD_REVISION_RETRIES = 3;

type ProductSurfaceAuthorityStatus = 'signed-out' | 'loading' | 'ready' | 'authority-unavailable';

export type ProductSurfaceAuthorityContextValue = {
  status: ProductSurfaceAuthorityStatus;
  snapshot?: ProductSurfaceAuthoritySnapshot;
  serverNowMs?: number;
  rolloutForProduct: (productKey: string) => ProductRolloutResolution;
  evaluateProduct: typeof evaluateProductSurfaceAccess;
  evaluateGoverned: typeof evaluateGovernedRouteAccess;
  revalidate: () => Promise<boolean>;
};

type RevisionMessage = {
  type: 'product-surface-revision-changed';
  tenantId: string;
  actorId: string;
  accessMode: string;
  decisionRevision: string;
  senderId: string;
};

type IdentityTask<T> = {
  identityKey: string;
  promise: Promise<T>;
};

type RevalidationTask<T> = IdentityTask<T> & {
  settled: boolean;
};

const AUTHORITY_EVALUATION_QUERY_PREFIXES = new Set([
  'product-surface-direct-evaluation',
  'governed-route-direct-evaluation',
]);

const unavailableRollout = (): ProductRolloutResolution => ({
  state: 'authority-unavailable',
});

const ProductSurfaceAuthorityContext = createContext<ProductSurfaceAuthorityContextValue>({
  status: 'signed-out',
  rolloutForProduct: unavailableRollout,
  evaluateProduct: evaluateProductSurfaceAccess,
  evaluateGoverned: evaluateGovernedRouteAccess,
  revalidate: async () => false,
});

function revisionMessage(value: unknown): RevisionMessage | null {
  if (!value || typeof value !== 'object') return null;
  const message = value as Partial<RevisionMessage>;
  return message.type === 'product-surface-revision-changed' &&
    typeof message.tenantId === 'string' &&
    typeof message.actorId === 'string' &&
    typeof message.accessMode === 'string' &&
    typeof message.decisionRevision === 'string' &&
    Boolean(message.decisionRevision.trim()) &&
    typeof message.senderId === 'string'
    ? (message as RevisionMessage)
    : null;
}

export function isProductAuthoritySensitiveQuery(
  candidate: {
    meta?: Readonly<Record<string, unknown>>;
    queryKey: readonly unknown[];
  },
  identity: { tenantId: string; actorId: string; accessMode?: string },
  legacySensitiveQueryPrefixes: readonly string[] = []
): boolean {
  const meta = candidate.meta;
  const metaSensitive =
    meta?.accessSensitive === true &&
    (meta.tenantId === undefined || meta.tenantId === identity.tenantId) &&
    (meta.actorId === undefined || meta.actorId === identity.actorId) &&
    (!identity.accessMode ||
      meta.accessMode === undefined ||
      meta.accessMode === identity.accessMode);
  const prefix = candidate.queryKey[0];
  const adaptedSensitive =
    typeof prefix === 'string' &&
    legacySensitiveQueryPrefixes.some(
      (candidatePrefix) => prefix === candidatePrefix || prefix.startsWith(`${candidatePrefix}-`)
    );
  return metaSensitive || adaptedSensitive;
}

export function ProductSurfaceAuthorityProvider({
  children,
  legacySensitiveQueryPrefixes = [],
}: {
  children: ReactNode;
  legacySensitiveQueryPrefixes?: readonly string[];
}) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const tenantId = String(auth.user?.tenantId ?? '');
  const actorId = String(auth.user?.userId ?? '');
  const senderId = useRef(crypto.randomUUID());
  const previousRevision = useRef<string | null>(null);
  const backgroundRefreshInFlight = useRef<IdentityTask<boolean> | null>(null);
  const revalidationInFlight = useRef<RevalidationTask<boolean> | null>(null);
  const renewalGeneration = useRef(0);
  const sessionGeneration = useRef(0);
  const hardRejectedDecisionRevisions = useRef(new Set<string>());
  const [authorityBlocked, setAuthorityBlocked] = useState(false);
  const authorityQueryKey = useMemo(
    () => [...productSurfaceAuthorityQueryPrefix, tenantId, actorId] as const,
    [actorId, tenantId]
  );
  const loadAuthoritySnapshot = useCallback(async (signal?: AbortSignal) => {
    const response = await getProductSurfaceContexts({ signal });
    return parseProductSurfaceAuthoritySnapshot(response, Date.now());
  }, []);
  const query = useQuery({
    queryKey: authorityQueryKey,
    queryFn: ({ signal }) => loadAuthoritySnapshot(signal),
    enabled: auth.isAuthenticated && Boolean(tenantId && actorId),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
  });
  const authoritySnapshot = query.data;
  const authoritySnapshotRef = useRef(authoritySnapshot);
  authoritySnapshotRef.current = authoritySnapshot;
  const operationIdentityKey = JSON.stringify([
    tenantId,
    actorId,
    authoritySnapshot?.envelope.activeAccessMode ?? '',
  ]);
  const activeOperationIdentity = useRef(operationIdentityKey);
  activeOperationIdentity.current = operationIdentityKey;
  const authorityBlockedRef = useRef(authorityBlocked);
  authorityBlockedRef.current = authorityBlocked;
  // React Query retains successful data when a background refetch fails. Keep trusting that
  // snapshot only until its server-issued revalidation instant; the expiry timer below then
  // performs the destructive fail-closed transition.
  const snapshot =
    !authorityBlocked && authoritySnapshot && productSurfaceSnapshotRemainsValid(authoritySnapshot)
      ? authoritySnapshot
      : undefined;
  const purgeAccessSensitiveQueries = useCallback(
    async (accessMode?: string, contextScopeKey?: string) => {
      const matches = (candidate: {
        meta?: Readonly<Record<string, unknown>>;
        queryKey: readonly unknown[];
      }) => {
        const sensitive = isProductAuthoritySensitiveQuery(
          candidate,
          { tenantId, actorId, accessMode },
          legacySensitiveQueryPrefixes
        );
        if (!sensitive || !contextScopeKey) return sensitive;
        const prefix = candidate.queryKey[0];
        if (typeof prefix === 'string' && AUTHORITY_EVALUATION_QUERY_PREFIXES.has(prefix)) {
          // Retain the authoritative denial in the active evaluation query. Removing it would
          // make the same stale URL/scope immediately recreate and refetch the evaluation.
          return false;
        }
        return (
          candidate.meta?.contextScopeKey === contextScopeKey ||
          candidate.queryKey.some((part) => part === contextScopeKey)
        );
      };
      let cancellation: Promise<void>;
      try {
        cancellation = queryClient.cancelQueries({ predicate: matches });
      } catch {
        cancellation = Promise.resolve();
      }
      // Global invalidation runs after the provider is blocked. A scope-local invalidation keeps
      // the rest of the mounted application intact while ensuring that revoked scope data cannot
      // be served from cache again.
      queryClient.removeQueries({ predicate: matches });
      if (!contextScopeKey) {
        window.dispatchEvent(new Event('dwp:product-surface-authority-invalidated'));
      }
      await cancellation.catch(() => undefined);
    },
    [actorId, legacySensitiveQueryPrefixes, queryClient, tenantId]
  );

  const refreshActiveAuthorityEvaluations = useCallback(
    async (authority: ProductSurfaceAuthoritySnapshot) => {
      const matches = (candidate: {
        meta?: Readonly<Record<string, unknown>>;
        queryKey: readonly unknown[];
      }) => {
        const prefix = candidate.queryKey[0];
        const meta = candidate.meta;
        return (
          typeof prefix === 'string' &&
          AUTHORITY_EVALUATION_QUERY_PREFIXES.has(prefix) &&
          meta?.tenantId === tenantId &&
          meta.actorId === actorId &&
          meta.accessMode === authority.envelope.activeAccessMode &&
          meta.decisionRevision === authority.envelope.decisionRevision
        );
      };
      const activeQueries = queryClient
        .getQueryCache()
        .findAll({ predicate: matches })
        .filter((candidate) => candidate.getObserversCount() > 0);
      await queryClient.refetchQueries(
        { type: 'active', predicate: matches },
        { cancelRefetch: false }
      );
      return activeQueries.every((candidate) => {
        const error = candidate.state.error as { status?: unknown } | null;
        if (error && (error.status === 403 || error.status === 404)) return true;
        if (error) return false;
        return candidate.state.data !== undefined;
      });
    },
    [actorId, queryClient, tenantId]
  );

  const hardRevalidate = useCallback(
    (rejectedDecisionRevision?: string) => {
      if (!auth.isAuthenticated) return Promise.resolve(false);
      const rejectedRevision = rejectedDecisionRevision?.trim();
      if (rejectedRevision) hardRejectedDecisionRevisions.current.add(rejectedRevision);
      const identityKey = operationIdentityKey;
      const session = sessionGeneration.current;
      renewalGeneration.current += 1;
      authorityBlockedRef.current = true;
      setAuthorityBlocked(true);
      if (
        revalidationInFlight.current?.identityKey === identityKey &&
        !revalidationInFlight.current.settled
      ) {
        return revalidationInFlight.current.promise;
      }
      const task: RevalidationTask<boolean> = {
        identityKey,
        promise: Promise.resolve(false),
        settled: false,
      };
      const promise = (async () => {
        const previous = authoritySnapshotRef.current;
        try {
          await queryClient
            .cancelQueries({ queryKey: authorityQueryKey, exact: true })
            .catch(() => undefined);
          await purgeAccessSensitiveQueries(previous?.envelope.activeAccessMode);
          if (
            activeOperationIdentity.current !== identityKey ||
            sessionGeneration.current !== session
          ) {
            return false;
          }
          let result: ProductSurfaceAuthoritySnapshot;
          let revisionRetry = 0;
          while (true) {
            result = await loadAuthoritySnapshot();
            if (!productSurfaceSnapshotRemainsValid(result, Date.now())) return false;
            if (
              activeOperationIdentity.current !== identityKey ||
              sessionGeneration.current !== session
            ) {
              return false;
            }
            // Read the live fence after every await. A second conflict can arrive while the shared
            // hard refresh is in flight, and a lease-only refresh of any rejected revision is not
            // proof that the conflict has been resolved.
            const staleRevision = hardRejectedDecisionRevisions.current.has(
              result.envelope.decisionRevision
            );
            if (!staleRevision) break;
            if (revisionRetry >= MAX_HARD_REVISION_RETRIES) return false;
            const retryDelay = Math.min(
              BACKGROUND_REFRESH_RETRY_BASE_MS * 2 ** revisionRetry,
              BACKGROUND_REFRESH_RETRY_MAX_MS
            );
            revisionRetry += 1;
            await new Promise<void>((resolve) => globalThis.setTimeout(resolve, retryDelay));
            if (
              activeOperationIdentity.current !== identityKey ||
              sessionGeneration.current !== session
            ) {
              return false;
            }
          }
          authoritySnapshotRef.current = result;
          queryClient.setQueryData(authorityQueryKey, result);
          hardRejectedDecisionRevisions.current.clear();
          authorityBlockedRef.current = false;
          setAuthorityBlocked(false);
          return true;
        } catch {
          return false;
        } finally {
          task.settled = true;
          if (revalidationInFlight.current === task) revalidationInFlight.current = null;
        }
      })();
      task.promise = promise;
      if (!task.settled) revalidationInFlight.current = task;
      return promise;
    },
    [
      auth.isAuthenticated,
      authorityQueryKey,
      loadAuthoritySnapshot,
      operationIdentityKey,
      purgeAccessSensitiveQueries,
      queryClient,
    ]
  );

  const refreshAuthorityInBackground = useCallback(() => {
    if (!auth.isAuthenticated) return Promise.resolve(false);
    const identityKey = operationIdentityKey;
    const session = sessionGeneration.current;
    if (backgroundRefreshInFlight.current?.identityKey === identityKey) {
      return backgroundRefreshInFlight.current.promise;
    }
    const generation = renewalGeneration.current;
    const promise = (async () => {
      const previous = authoritySnapshotRef.current;
      if (!previous || !productSurfaceSnapshotRemainsValid(previous, Date.now())) {
        return hardRevalidate();
      }
      let next: ProductSurfaceAuthoritySnapshot;
      try {
        next = await loadAuthoritySnapshot();
      } catch {
        return false;
      }
      if (
        activeOperationIdentity.current !== identityKey ||
        sessionGeneration.current !== session ||
        renewalGeneration.current !== generation ||
        !productSurfaceSnapshotRemainsValid(next, Date.now())
      ) {
        return false;
      }
      if (!productSurfaceAuthoritySemanticsMatch(previous, next)) {
        return hardRevalidate(previous.envelope.decisionRevision);
      }
      if (
        previous.earliestRevalidateAtMs !== null &&
        next.earliestRevalidateAtMs !== null &&
        next.earliestRevalidateAtMs < previous.earliestRevalidateAtMs
      ) {
        return hardRevalidate();
      }
      if (!productSurfaceLeaseAdvanced(previous, next)) {
        return false;
      }
      const evaluationsCurrent = await refreshActiveAuthorityEvaluations(previous);
      if (
        !evaluationsCurrent ||
        activeOperationIdentity.current !== identityKey ||
        sessionGeneration.current !== session ||
        renewalGeneration.current !== generation ||
        authoritySnapshotRef.current !== previous
      ) {
        return false;
      }
      if (!productSurfaceSnapshotRemainsValid(previous, Date.now())) {
        return hardRevalidate();
      }
      authoritySnapshotRef.current = next;
      queryClient.setQueryData(authorityQueryKey, next);
      return true;
    })().catch(() => false);
    const task = { identityKey, promise };
    backgroundRefreshInFlight.current = task;
    void promise.finally(() => {
      if (backgroundRefreshInFlight.current === task) backgroundRefreshInFlight.current = null;
    });
    return promise;
  }, [
    auth.isAuthenticated,
    authorityQueryKey,
    hardRevalidate,
    loadAuthoritySnapshot,
    operationIdentityKey,
    queryClient,
    refreshActiveAuthorityEvaluations,
  ]);

  const revalidate = useCallback(() => {
    const current = authoritySnapshotRef.current;
    return current &&
      !authorityBlockedRef.current &&
      productSurfaceSnapshotRemainsValid(current, Date.now())
      ? refreshAuthorityInBackground()
      : hardRevalidate();
  }, [hardRevalidate, refreshAuthorityInBackground]);

  useEffect(() => {
    if (!auth.isAuthenticated) return undefined;
    return setAuthorizationAccessFailureHandler(async (failure) => {
      const current = authoritySnapshotRef.current;
      const scopeExpired = failure.reasonCode === 'SCOPE_CONTEXT_EXPIRED';
      const decisionConflict = failure.reasonCode === 'DECISION_REVISION_CONFLICT';
      // A downstream 503 or an expired individual scope already fails the originating request
      // closed, but neither proves every active product-surface lease is stale. Refresh the
      // shared authority in place while its lease is valid; an expired scope also loses only its
      // scope-bound cache. This avoids global block/remount loops while preserving fail-closed
      // handling for the affected request. A decision revision conflict remains destructive.
      if (
        (scopeExpired || failure.status === 503) &&
        current &&
        !authorityBlockedRef.current &&
        productSurfaceSnapshotRemainsValid(current, Date.now())
      ) {
        if (scopeExpired && failure.contextScopeKey) {
          await purgeAccessSensitiveQueries(
            current.envelope.activeAccessMode,
            failure.contextScopeKey
          );
        }
        await refreshAuthorityInBackground();
        return;
      }
      if (
        decisionConflict &&
        failure.rejectedDecisionRevision &&
        current &&
        !authorityBlockedRef.current &&
        productSurfaceSnapshotRemainsValid(current, Date.now()) &&
        failure.serverDecisionRevision === current.envelope.decisionRevision &&
        current.envelope.decisionRevision !== failure.rejectedDecisionRevision
      ) {
        // The request was issued under an older revision than the one already mounted. Refresh
        // opportunistically, but do not tear down a newer authority tree for a late response.
        await refreshAuthorityInBackground();
        return;
      }
      if (
        decisionConflict &&
        failure.rejectedDecisionRevision &&
        current &&
        failure.rejectedDecisionRevision !== current.envelope.decisionRevision
      ) {
        // When the server does not prove that the mounted newer revision is current, reject both
        // the request revision and the mounted revision. A candidate must advance beyond both.
        hardRejectedDecisionRevisions.current.add(failure.rejectedDecisionRevision);
      }
      await hardRevalidate(
        decisionConflict
          ? (current?.envelope.decisionRevision ?? failure.rejectedDecisionRevision)
          : undefined
      );
    });
  }, [
    auth.isAuthenticated,
    hardRevalidate,
    purgeAccessSensitiveQueries,
    refreshAuthorityInBackground,
  ]);

  useEffect(() => {
    if (!snapshot) return undefined;
    const nowMs = Date.now();
    const expiryDelay = productSurfaceExpiryDelay(snapshot, nowMs);
    if (expiryDelay !== null && expiryDelay <= 0) {
      void hardRevalidate();
      return undefined;
    }
    const refreshDelay = productSurfaceBackgroundRefreshDelay(
      snapshot,
      nowMs,
      MAX_REFRESH_DELAY_MS
    );
    let refreshTimer: number | undefined;
    let cancelled = false;
    const scheduleBackgroundRefresh = (delayMs: number, retryAttempt: number) => {
      refreshTimer = window.setTimeout(
        () => {
          if (
            cancelled ||
            authorityBlockedRef.current ||
            authoritySnapshotRef.current !== snapshot
          ) {
            return;
          }
          void refreshAuthorityInBackground().then((renewed) => {
            if (
              cancelled ||
              renewed ||
              authorityBlockedRef.current ||
              authoritySnapshotRef.current !== snapshot
            ) {
              return;
            }
            const remainingMs = productSurfaceExpiryDelay(snapshot, Date.now());
            if (remainingMs !== null && remainingMs <= 0) {
              void hardRevalidate();
              return;
            }
            if (retryAttempt >= MAX_BACKGROUND_REFRESH_RETRIES) {
              // A no-context snapshot has no expiry timer to wake it again. Resume the normal
              // cadence after the bounded burst instead of leaving it permanently stale.
              if (remainingMs === null) {
                scheduleBackgroundRefresh(MAX_REFRESH_DELAY_MS, 0);
              }
              return;
            }
            const retryDelay = Math.min(
              BACKGROUND_REFRESH_RETRY_BASE_MS * 2 ** retryAttempt,
              BACKGROUND_REFRESH_RETRY_MAX_MS
            );
            const delayBeforeExpiry =
              remainingMs === null
                ? retryDelay
                : Math.min(retryDelay, Math.max(0, remainingMs - 1));
            if (delayBeforeExpiry > 0) {
              scheduleBackgroundRefresh(delayBeforeExpiry, retryAttempt + 1);
            }
          });
        },
        Math.min(delayMs, MAX_TIMER_DELAY_MS)
      );
    };
    scheduleBackgroundRefresh(refreshDelay, 0);
    let expiryTimer: number | undefined;
    const scheduleExpiryCheck = (remainingMs: number) => {
      expiryTimer = window.setTimeout(
        () => {
          if (authoritySnapshotRef.current !== snapshot) return;
          const currentDelay = productSurfaceExpiryDelay(snapshot, Date.now());
          if (currentDelay === null) return;
          if (currentDelay <= 0) void hardRevalidate();
          else scheduleExpiryCheck(currentDelay);
        },
        Math.min(remainingMs, MAX_TIMER_DELAY_MS)
      );
    };
    if (expiryDelay !== null) scheduleExpiryCheck(expiryDelay);
    return () => {
      cancelled = true;
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
      if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
    };
  }, [hardRevalidate, refreshAuthorityInBackground, snapshot]);

  useEffect(() => {
    if (!auth.isAuthenticated) return undefined;
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (query.isPending) return;
      const current = authoritySnapshotRef.current;
      if (
        current &&
        !authorityBlockedRef.current &&
        productSurfaceSnapshotRemainsValid(current, Date.now())
      ) {
        void refreshAuthorityInBackground();
      } else {
        void hardRevalidate();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [auth.isAuthenticated, hardRevalidate, query.isPending, refreshAuthorityInBackground]);

  useEffect(() => {
    if (!snapshot) return undefined;
    const identity = {
      tenantId,
      actorId,
      accessMode: snapshot.envelope.activeAccessMode,
    };
    const handleMessage = (candidate: unknown) => {
      const message = revisionMessage(candidate);
      if (
        !message ||
        message.senderId === senderId.current ||
        message.tenantId !== identity.tenantId ||
        message.actorId !== identity.actorId ||
        message.accessMode !== identity.accessMode ||
        message.decisionRevision === snapshot.envelope.decisionRevision
      ) {
        return;
      }
      void hardRevalidate(snapshot.envelope.decisionRevision);
    };
    let channel: BroadcastChannel | undefined;
    const onChannelMessage = (event: MessageEvent<unknown>) => handleMessage(event.data);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== productSurfaceRevisionStorageKey || !event.newValue) return;
      try {
        handleMessage(JSON.parse(event.newValue));
      } catch {
        // Ignore malformed same-origin storage events. Exact message validation remains fail-closed.
      }
    };
    window.addEventListener('storage', onStorage);
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(REVISION_CHANNEL);
      channel.addEventListener('message', onChannelMessage);
    }
    const previous = previousRevision.current;
    if (previous && previous !== snapshot.envelope.decisionRevision) {
      const message = {
        type: 'product-surface-revision-changed',
        ...identity,
        decisionRevision: snapshot.envelope.decisionRevision,
        senderId: senderId.current,
      } satisfies RevisionMessage;
      if (channel) {
        channel.postMessage(message);
      } else {
        try {
          window.localStorage.setItem(productSurfaceRevisionStorageKey, JSON.stringify(message));
          window.localStorage.removeItem(productSurfaceRevisionStorageKey);
        } catch {
          // Storage may be unavailable in hardened browser profiles; the bounded refresh remains.
        }
      }
    }
    previousRevision.current = snapshot.envelope.decisionRevision;
    return () => {
      window.removeEventListener('storage', onStorage);
      if (channel) {
        channel.removeEventListener('message', onChannelMessage);
        channel.close();
      }
    };
  }, [actorId, hardRevalidate, snapshot, tenantId]);

  useEffect(() => {
    sessionGeneration.current += 1;
    renewalGeneration.current += 1;
    previousRevision.current = null;
    hardRejectedDecisionRevisions.current.clear();
    authorityBlockedRef.current = false;
    setAuthorityBlocked(false);
  }, [actorId, auth.isAuthenticated, tenantId]);

  useEffect(() => {
    if (auth.isAuthenticated) return;
    previousRevision.current = null;
    hardRejectedDecisionRevisions.current.clear();
    authorityBlockedRef.current = false;
    setAuthorityBlocked(false);
  }, [auth.isAuthenticated]);

  const value = useMemo<ProductSurfaceAuthorityContextValue>(() => {
    const status: ProductSurfaceAuthorityStatus = !auth.isAuthenticated
      ? 'signed-out'
      : query.isPending
        ? 'loading'
        : snapshot
          ? 'ready'
          : 'authority-unavailable';
    return {
      status,
      snapshot,
      serverNowMs: snapshot ? productSurfaceServerNow(snapshot) : undefined,
      rolloutForProduct: snapshot
        ? (productKey) => resolveProductRollout(snapshot, productKey)
        : unavailableRollout,
      evaluateProduct: evaluateProductSurfaceAccess,
      evaluateGoverned: evaluateGovernedRouteAccess,
      revalidate,
    };
  }, [auth.isAuthenticated, query.isPending, revalidate, snapshot]);

  return (
    <ProductSurfaceAuthorityContext.Provider value={value}>
      {children}
    </ProductSurfaceAuthorityContext.Provider>
  );
}

export function useProductSurfaceAuthority(): ProductSurfaceAuthorityContextValue {
  return useContext(ProductSurfaceAuthorityContext);
}

export function productSurfaceEvaluationQueryKey(
  snapshot: ProductSurfaceAuthoritySnapshot,
  request: ProductSurfaceEvaluationRequest,
  identity: { tenantId: string; actorId: string }
) {
  return [
    'product-surface-direct-evaluation',
    identity.tenantId,
    identity.actorId,
    snapshot.envelope.activeAccessMode,
    request.subject.productKey,
    request.subject.surfaceKey,
    request.contextKey ?? '',
    request.contextScopeKey ?? '',
    snapshot.envelope.decisionRevision,
    request.routeContractKey,
  ] as const;
}

export function governedRouteEvaluationQueryKey(
  request: GovernedRouteEvaluationRequest,
  identity: {
    tenantId: string;
    actorId: string;
    accessMode: string;
    decisionRevision: string;
  }
) {
  return [
    'governed-route-direct-evaluation',
    identity.tenantId,
    identity.actorId,
    identity.accessMode,
    identity.decisionRevision,
    request.navigationContextId,
    request.routeContractKey,
    request.target?.opaqueTargetRef ?? '',
    request.target?.expectedObjectVersion ?? '',
  ] as const;
}
