import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import {
  governedRouteEvaluationQueryKey,
  useProductSurfaceAuthority,
} from '@dwp-frontend/shared-utils/auth/product-surface-context-provider';
import {
  createDirectDecisionClockAnchor,
  directDecisionServerNow,
  readMonotonicNowMs,
  scheduleDirectDecisionLease,
} from '../components/direct-decision-lease';

import type {
  GovernedRouteEvaluationData,
  GovernedRouteEvaluationRequest,
} from '@dwp-frontend/shared-utils/api/auth-api';

export type GovernedRouteAccessDecision =
  | { state: 'loading' }
  | { state: 'allowed'; decisionRevision: string; effectiveReadOnly: boolean }
  | {
      state:
        'route-denied' | 'expired' | 'step-up-required' | 'sod-conflict' | 'authority-unavailable';
    };

const DENIED_STATES = {
  ROUTE_DENIED: 'route-denied',
  EXPIRED: 'expired',
  STEP_UP_REQUIRED: 'step-up-required',
  SOD_CONFLICT: 'sod-conflict',
  AUTHORITY_UNAVAILABLE: 'authority-unavailable',
} as const;

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function mapGovernedRouteEvaluation(
  data: GovernedRouteEvaluationData,
  request: GovernedRouteEvaluationRequest,
  expectedAccessMode: string | undefined,
  serverNowMs?: number
): GovernedRouteAccessDecision {
  if (!data || typeof data !== 'object') return { state: 'authority-unavailable' };
  const evaluation = data as unknown as Record<string, unknown>;
  if (evaluation.decision !== 'ALLOWED') {
    const state =
      typeof evaluation.decision === 'string'
        ? DENIED_STATES[evaluation.decision as keyof typeof DENIED_STATES]
        : undefined;
    return { state: state ?? 'authority-unavailable' };
  }
  const context =
    evaluation.context &&
    typeof evaluation.context === 'object' &&
    !Array.isArray(evaluation.context)
      ? (evaluation.context as Record<string, unknown>)
      : undefined;
  if (
    !context ||
    !nonBlank(evaluation.decisionRevision) ||
    !nonBlank(context.decisionRevision) ||
    evaluation.decisionRevision !== context.decisionRevision ||
    !nonBlank(context.contextKey) ||
    context.navigationContextId !== request.navigationContextId ||
    context.accessSource !== 'RELATIONSHIP' ||
    (expectedAccessMode && context.accessMode !== expectedAccessMode) ||
    !nonBlank(context.routeGrantRef) ||
    typeof context.effectiveReadOnly !== 'boolean' ||
    typeof serverNowMs !== 'number' ||
    !Number.isFinite(serverNowMs) ||
    !nonBlank(context.revalidateAt) ||
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

function invalidatesRetainedGovernedDecision(error: unknown): boolean {
  return (
    error instanceof HttpError &&
    (error.status === 403 || error.status === 404 || error.status === 409 || error.status === 503)
  );
}

export function useGovernedRouteAccessDecision(
  request: GovernedRouteEvaluationRequest | null
): GovernedRouteAccessDecision {
  const auth = useAuth();
  const authority = useProductSurfaceAuthority();
  const queryClient = useQueryClient();
  const [directDecisionMonotonicFloorMs, setDirectDecisionMonotonicFloorMs] = useState(() =>
    readMonotonicNowMs()
  );
  const snapshot = authority.status === 'ready' ? authority.snapshot : undefined;
  const directDecisionClockAnchorRef = useRef<
    | {
        snapshot: NonNullable<typeof snapshot>;
        anchor: ReturnType<typeof createDirectDecisionClockAnchor>;
      }
    | undefined
  >(undefined);
  if (snapshot && directDecisionClockAnchorRef.current?.snapshot !== snapshot) {
    directDecisionClockAnchorRef.current = {
      snapshot,
      anchor: createDirectDecisionClockAnchor(snapshot.clockOffsetMs),
    };
  } else if (!snapshot) {
    directDecisionClockAnchorRef.current = undefined;
  }
  const directDecisionClockAnchor = directDecisionClockAnchorRef.current?.anchor;
  const identity = {
    tenantId: String(auth.user?.tenantId ?? ''),
    actorId: String(auth.user?.userId ?? ''),
    accessMode: snapshot?.envelope.activeAccessMode ?? '',
    decisionRevision: snapshot?.envelope.decisionRevision ?? '',
  };
  const evaluationQueryKey = request
    ? governedRouteEvaluationQueryKey(request, identity)
    : (['governed-route-direct-evaluation', 'disabled'] as const);
  const evaluationEnabled = Boolean(request && auth.isAuthenticated && snapshot);
  const query = useQuery({
    queryKey: evaluationQueryKey,
    queryFn: () => authority.evaluateGoverned(request!),
    enabled: evaluationEnabled,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
    meta: {
      accessSensitive: true,
      ...identity,
    },
  });
  const directDecisionRevalidateAt =
    query.data?.decision === 'ALLOWED' ? query.data.context?.revalidateAt : undefined;
  const evaluationQueryKeySignature = JSON.stringify(evaluationQueryKey);
  useEffect(() => {
    if (!directDecisionClockAnchor || !evaluationEnabled || !directDecisionRevalidateAt) {
      return undefined;
    }
    const serverDeadlineMs = Date.parse(directDecisionRevalidateAt);
    if (!Number.isFinite(serverDeadlineMs)) return undefined;
    const exactQueryKey = JSON.parse(evaluationQueryKeySignature) as readonly unknown[];
    const refetchExact = () => {
      void queryClient.refetchQueries(
        { queryKey: exactQueryKey, exact: true, type: 'active' },
        { cancelRefetch: false }
      );
    };
    return scheduleDirectDecisionLease({
      anchor: directDecisionClockAnchor,
      serverDeadlineMs,
      onRenew: refetchExact,
      onExpire: () => {
        setDirectDecisionMonotonicFloorMs(readMonotonicNowMs());
        refetchExact();
      },
    });
  }, [
    directDecisionClockAnchor,
    directDecisionRevalidateAt,
    evaluationEnabled,
    evaluationQueryKeySignature,
    queryClient,
  ]);
  if (!request || authority.status === 'loading' || (snapshot && query.isPending)) {
    return { state: 'loading' };
  }
  if (!snapshot) return { state: 'authority-unavailable' };
  if (query.error && invalidatesRetainedGovernedDecision(query.error)) {
    return mapGovernedRouteError(query.error);
  }
  if (!query.data) {
    return query.error ? mapGovernedRouteError(query.error) : { state: 'authority-unavailable' };
  }
  return mapGovernedRouteEvaluation(
    query.data,
    request,
    snapshot.envelope.activeAccessMode,
    directDecisionClockAnchor
      ? directDecisionServerNow(directDecisionClockAnchor, directDecisionMonotonicFloorMs)
      : undefined
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
