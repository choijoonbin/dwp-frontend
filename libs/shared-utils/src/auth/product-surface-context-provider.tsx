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
import { useAuth } from './auth-provider';
import {
  parseProductSurfaceAuthoritySnapshot,
  productSurfaceRefreshDelay,
  productSurfaceServerNow,
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
const MAX_REFRESH_DELAY_MS = 60_000;

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
  const [authorityBlocked, setAuthorityBlocked] = useState(false);
  const query = useQuery({
    queryKey: [...productSurfaceAuthorityQueryPrefix, tenantId, actorId],
    queryFn: async () => {
      const response = await getProductSurfaceContexts();
      return parseProductSurfaceAuthoritySnapshot(response, Date.now());
    },
    enabled: auth.isAuthenticated && Boolean(tenantId && actorId),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
  });
  const snapshot = !query.isError && !authorityBlocked ? query.data : undefined;

  const purgeAccessSensitiveQueries = useCallback(
    async (accessMode?: string) => {
      const matches = (candidate: {
        meta?: Readonly<Record<string, unknown>>;
        queryKey: readonly unknown[];
      }) =>
        isProductAuthoritySensitiveQuery(
          candidate,
          { tenantId, actorId, accessMode },
          legacySensitiveQueryPrefixes
        );
      await queryClient.cancelQueries({ predicate: matches });
      queryClient.removeQueries({ predicate: matches });
      window.dispatchEvent(new Event('dwp:product-surface-authority-invalidated'));
    },
    [actorId, legacySensitiveQueryPrefixes, queryClient, tenantId]
  );

  const revalidate = useCallback(async () => {
    if (!auth.isAuthenticated) return false;
    const previous = query.data;
    setAuthorityBlocked(true);
    await purgeAccessSensitiveQueries(previous?.envelope.activeAccessMode);
    const result = await query.refetch();
    if (!result.data || result.isError) return false;
    const delay = productSurfaceRefreshDelay(result.data, Date.now(), MAX_REFRESH_DELAY_MS);
    const advancedAfterExpiry =
      !previous ||
      delay > 0 ||
      result.data.envelope.decisionRevision !== previous.envelope.decisionRevision ||
      Date.parse(result.data.envelope.generatedAt) > Date.parse(previous.envelope.generatedAt);
    if (!advancedAfterExpiry) return false;
    setAuthorityBlocked(false);
    return true;
  }, [auth.isAuthenticated, purgeAccessSensitiveQueries, query]);

  useEffect(() => {
    if (!snapshot) return undefined;
    const delay = productSurfaceRefreshDelay(snapshot, Date.now(), MAX_REFRESH_DELAY_MS);
    if (delay <= 0) {
      void revalidate();
      return undefined;
    }
    const timer = window.setTimeout(() => void revalidate(), delay);
    return () => window.clearTimeout(timer);
  }, [revalidate, snapshot]);

  useEffect(() => {
    if (!auth.isAuthenticated) return undefined;
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void revalidate();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [auth.isAuthenticated, revalidate]);

  useEffect(() => {
    if (!snapshot || typeof BroadcastChannel === 'undefined') return undefined;
    const channel = new BroadcastChannel(REVISION_CHANNEL);
    const identity = {
      tenantId,
      actorId,
      accessMode: snapshot.envelope.activeAccessMode,
    };
    const onMessage = (event: MessageEvent<unknown>) => {
      const message = revisionMessage(event.data);
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
      void revalidate();
    };
    channel.addEventListener('message', onMessage);
    const previous = previousRevision.current;
    if (previous && previous !== snapshot.envelope.decisionRevision) {
      channel.postMessage({
        type: 'product-surface-revision-changed',
        ...identity,
        decisionRevision: snapshot.envelope.decisionRevision,
        senderId: senderId.current,
      } satisfies RevisionMessage);
    }
    previousRevision.current = snapshot.envelope.decisionRevision;
    return () => {
      channel.removeEventListener('message', onMessage);
      channel.close();
    };
  }, [actorId, revalidate, snapshot, tenantId]);

  useEffect(() => {
    if (auth.isAuthenticated) return;
    previousRevision.current = null;
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
