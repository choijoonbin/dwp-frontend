import { useQuery } from '@tanstack/react-query';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import {
  governedRouteEvaluationQueryKey,
  useProductSurfaceAuthority,
} from '@dwp-frontend/shared-utils/auth/product-surface-context-provider';

import type { ReactNode } from 'react';
import type {
  GovernedRouteEvaluationData,
  GovernedRouteEvaluationRequest,
} from '@dwp-frontend/shared-utils/api/auth-api';

export type GovernedRouteAccessDecision =
  | { state: 'loading' }
  | { state: 'allowed'; decisionRevision: string; effectiveReadOnly: boolean }
  | {
      state:
        | 'route-denied'
        | 'expired'
        | 'step-up-required'
        | 'sod-conflict'
        | 'authority-unavailable';
    };

const DENIED_STATES = {
  ROUTE_DENIED: 'route-denied',
  EXPIRED: 'expired',
  STEP_UP_REQUIRED: 'step-up-required',
  SOD_CONFLICT: 'sod-conflict',
  AUTHORITY_UNAVAILABLE: 'authority-unavailable',
} as const;

export function mapGovernedRouteEvaluation(
  data: GovernedRouteEvaluationData,
  request: GovernedRouteEvaluationRequest,
  expectedAccessMode: string | undefined,
  serverNowMs?: number
): GovernedRouteAccessDecision {
  if (data.decision !== 'ALLOWED') {
    return { state: DENIED_STATES[data.decision] ?? 'authority-unavailable' };
  }
  const context = data.context;
  if (
    !context ||
    !data.decisionRevision?.trim() ||
    data.decisionRevision !== context.decisionRevision ||
    context.navigationContextId !== request.navigationContextId ||
    context.accessSource !== 'RELATIONSHIP' ||
    (expectedAccessMode && context.accessMode !== expectedAccessMode) ||
    !context.routeGrantRef.trim() ||
    typeof serverNowMs !== 'number' ||
    !Number.isFinite(serverNowMs) ||
    !Number.isFinite(Date.parse(context.revalidateAt)) ||
    Date.parse(context.revalidateAt) <= serverNowMs
  ) {
    return { state: 'authority-unavailable' };
  }
  return {
    state: 'allowed',
    decisionRevision: context.decisionRevision,
    effectiveReadOnly: context.effectiveReadOnly,
  };
}

function mapGovernedRouteError(error: unknown): GovernedRouteAccessDecision {
  if (!(error instanceof HttpError)) return { state: 'authority-unavailable' };
  if (error.status === 403 || error.status === 404) return { state: 'route-denied' };
  return { state: 'authority-unavailable' };
}

export function useGovernedRouteAccessDecision(
  request: GovernedRouteEvaluationRequest | null
): GovernedRouteAccessDecision {
  const auth = useAuth();
  const authority = useProductSurfaceAuthority();
  const snapshot = authority.status === 'ready' ? authority.snapshot : undefined;
  const identity = {
    tenantId: String(auth.user?.tenantId ?? ''),
    actorId: String(auth.user?.userId ?? ''),
    accessMode: snapshot?.envelope.activeAccessMode ?? '',
    decisionRevision: snapshot?.envelope.decisionRevision ?? '',
  };
  const query = useQuery({
    queryKey: request
      ? governedRouteEvaluationQueryKey(request, identity)
      : ['governed-route-direct-evaluation', 'disabled'],
    queryFn: () => authority.evaluateGoverned(request!),
    enabled: Boolean(request && auth.isAuthenticated && snapshot),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    meta: {
      accessSensitive: true,
      ...identity,
    },
  });
  if (!request || authority.status === 'loading' || (snapshot && query.isPending)) {
    return { state: 'loading' };
  }
  if (!snapshot) return { state: 'authority-unavailable' };
  if (query.error) return mapGovernedRouteError(query.error);
  if (!query.data) return { state: 'authority-unavailable' };
  return mapGovernedRouteEvaluation(
    query.data,
    request,
    snapshot.envelope.activeAccessMode,
    Date.now() + snapshot.clockOffsetMs
  );
}

export function GovernedRouteAccessGuard({
  request,
  fallback,
  children,
}: {
  request: GovernedRouteEvaluationRequest;
  fallback: (decision: Exclude<GovernedRouteAccessDecision, { state: 'allowed' }>) => ReactNode;
  children: ReactNode;
}) {
  const decision = useGovernedRouteAccessDecision(request);
  return decision.state === 'allowed' ? children : fallback(decision);
}
