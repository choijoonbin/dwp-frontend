import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import {
  PAY004_QUERY_CONTRACT,
  Pay004ContractError,
  createPay004QueryRequest,
  selectPay004Projection,
} from './retirement-contract';

import type { Pay004QueryAdapter } from './retirement-api';
import type {
  Pay004Projection,
  Pay004QueryOptions,
  Pay004Sort,
  Pay004TrustedScope,
} from './retirement-contract';

export type Pay004WorkbenchCriteria = Readonly<{
  minimumAmount: string;
  policyKeys: readonly string[];
  caseStatuses: readonly string[];
  effectiveOn: string;
  sort: Pay004Sort;
}>;

export const PAY004_DEFAULT_CRITERIA: Pay004WorkbenchCriteria = Object.freeze({
  minimumAmount: '',
  policyKeys: Object.freeze([] as string[]),
  caseStatuses: Object.freeze([] as string[]),
  effectiveOn: '',
  sort: PAY004_QUERY_CONTRACT.defaultSort,
});

const PAY004_CRITERIA_SESSION_PREFIX = 'dwp.hris.pay004.criteria.v1';

function criteriaOptions(criteria: Pay004WorkbenchCriteria): Pay004QueryOptions {
  return Object.freeze({
    filter: Object.freeze({
      ...(criteria.minimumAmount
        ? {
            retirementResult: Object.freeze({ minimumAmount: criteria.minimumAmount }),
          }
        : {}),
      ...(criteria.policyKeys.length
        ? {
            policyVersion: Object.freeze({ policyKeys: criteria.policyKeys }),
          }
        : {}),
      ...(criteria.caseStatuses.length
        ? {
            caseStatus: Object.freeze({ codes: criteria.caseStatuses }),
          }
        : {}),
      ...(criteria.effectiveOn ? { effectiveOn: criteria.effectiveOn } : {}),
    }),
    sort: Object.freeze([criteria.sort]),
  });
}

function assertWorkbenchCriteria(
  value: unknown,
  scope: Pay004TrustedScope
): Pay004WorkbenchCriteria {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Pay004ContractError('workbench.criteria');
  }
  const source = value as Readonly<Record<string, unknown>>;
  const keys = Object.keys(source);
  const expected = ['minimumAmount', 'policyKeys', 'caseStatuses', 'effectiveOn', 'sort'];
  if (
    keys.length !== expected.length ||
    keys.some((key) => !expected.includes(key)) ||
    typeof source.minimumAmount !== 'string' ||
    typeof source.effectiveOn !== 'string' ||
    typeof source.sort !== 'string' ||
    !Array.isArray(source.policyKeys) ||
    !Array.isArray(source.caseStatuses) ||
    source.policyKeys.some((entry) => typeof entry !== 'string') ||
    source.caseStatuses.some((entry) => typeof entry !== 'string') ||
    !(PAY004_QUERY_CONTRACT.sorts as readonly string[]).includes(source.sort)
  ) {
    throw new Pay004ContractError('workbench.criteria');
  }
  const criteria: Pay004WorkbenchCriteria = Object.freeze({
    minimumAmount: source.minimumAmount.trim(),
    policyKeys: Object.freeze(source.policyKeys.map((entry) => String(entry).trim())),
    caseStatuses: Object.freeze(source.caseStatuses.map((entry) => String(entry).trim())),
    effectiveOn: source.effectiveOn.trim(),
    sort: source.sort as Pay004Sort,
  });
  createPay004QueryRequest(scope, criteriaOptions(criteria));
  return criteria;
}

function criteriaSessionKey(scope: Pay004TrustedScope, tenantId: string): string {
  return `${PAY004_CRITERIA_SESSION_PREFIX}:${encodeURIComponent(tenantId)}:${encodeURIComponent(
    scope.contextScopeKey
  )}:${encodeURIComponent(scope.decisionRevision)}`;
}

function readSessionCriteria(scope: Pay004TrustedScope, tenantId: string): Pay004WorkbenchCriteria {
  if (typeof window === 'undefined') return PAY004_DEFAULT_CRITERIA;
  const key = criteriaSessionKey(scope, tenantId);
  try {
    const saved = window.sessionStorage.getItem(key);
    return saved ? assertWorkbenchCriteria(JSON.parse(saved), scope) : PAY004_DEFAULT_CRITERIA;
  } catch {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Ignore unavailable session storage and retain the closed default criteria.
    }
    return PAY004_DEFAULT_CRITERIA;
  }
}

function writeSessionCriteria(
  scope: Pay004TrustedScope,
  tenantId: string,
  criteria: Pay004WorkbenchCriteria
): void {
  if (typeof window === 'undefined') return;
  try {
    const key = criteriaSessionKey(scope, tenantId);
    if (JSON.stringify(criteria) === JSON.stringify(PAY004_DEFAULT_CRITERIA)) {
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, JSON.stringify(criteria));
    }
  } catch {
    // Session persistence is progressive enhancement; the validated in-memory state remains active.
  }
}

export type Pay004WorkbenchQueryState = Readonly<{
  projection: Pay004Projection | null;
  error: unknown;
  loading: boolean;
  fetching: boolean;
  stale: boolean;
  canPrevious: boolean;
  canNext: boolean;
  criteria: Pay004WorkbenchCriteria;
  applyCriteria: (criteria: Pay004WorkbenchCriteria) => void;
  resetCriteria: () => void;
  refresh: () => void;
  previous: () => void;
  next: () => void;
}>;

export function pay004ErrorIsConcealed(error: unknown): boolean {
  return (
    error instanceof Pay004ContractError ||
    (error instanceof HttpError && [400, 401, 403, 404, 409].includes(error.status))
  );
}

export function pay004ErrorMayRetainStaleProjection(error: unknown): boolean {
  return (
    (error instanceof HttpError && [429, 503].includes(error.status)) ||
    (error instanceof HttpTransportError && error.reason === 'NETWORK')
  );
}

function abortError(): Error {
  const error = new Error('PAY-004 owner query was aborted before dispatch.');
  error.name = 'AbortError';
  return error;
}

function deferOwnerRead(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    let settled = false;
    const onAbort = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      reject(abortError());
    };
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      if (signal.aborted) reject(abortError());
      else resolve();
    }, 0);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export function usePay004WorkbenchQuery({
  adapter,
  scope,
  tenantId,
}: Readonly<{
  adapter: Pay004QueryAdapter;
  scope: Pay004TrustedScope;
  tenantId: string;
}>): Pay004WorkbenchQueryState {
  const stableScope = useMemo<Pay004TrustedScope>(
    () =>
      Object.freeze({
        contextScopeKey: scope.contextScopeKey,
        decisionRevision: scope.decisionRevision,
        locale: scope.locale,
        timeZone: scope.timeZone,
        correlationId: scope.correlationId,
      }),
    [
      scope.contextScopeKey,
      scope.correlationId,
      scope.decisionRevision,
      scope.locale,
      scope.timeZone,
    ]
  );
  const [cursorHistory, setCursorHistory] = useState<readonly (string | null)[]>([null]);
  const [projection, setProjection] = useState<Pay004Projection | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [stale, setStale] = useState(false);
  const [criteria, setCriteria] = useState<Pay004WorkbenchCriteria>(() =>
    readSessionCriteria(stableScope, tenantId)
  );
  const projectionRef = useRef<Pay004Projection | null>(null);
  const criteriaRef = useRef(criteria);
  const asOfRef = useRef<string | null>(null);
  const scopeDecisionRevisionRef = useRef<string | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const requestInFlight = useRef(false);
  const scopeIdentity = JSON.stringify(stableScope);
  const boundScopeIdentity = useRef(scopeIdentity);
  const navigationIsCurrent = boundScopeIdentity.current === scopeIdentity;
  const cursor = navigationIsCurrent ? (cursorHistory.at(-1) ?? null) : null;

  useEffect(() => {
    projectionRef.current = projection;
  }, [projection]);

  const applyCriteria = useCallback(
    (value: Pay004WorkbenchCriteria) => {
      const next = assertWorkbenchCriteria(value, stableScope);
      if (JSON.stringify(next) === JSON.stringify(criteriaRef.current)) return;
      activeRequest.current?.abort();
      requestInFlight.current = false;
      asOfRef.current = null;
      projectionRef.current = null;
      criteriaRef.current = next;
      setCursorHistory([null]);
      setProjection(null);
      setError(null);
      setStale(false);
      setLoading(true);
      setCriteria(next);
      writeSessionCriteria(stableScope, tenantId, next);
    },
    [stableScope, tenantId]
  );

  const load = useCallback(
    (retainVerifiedProjection: boolean) => {
      activeRequest.current?.abort();
      if (boundScopeIdentity.current !== scopeIdentity) {
        boundScopeIdentity.current = scopeIdentity;
        asOfRef.current = null;
        scopeDecisionRevisionRef.current = null;
        projectionRef.current = null;
        setProjection(null);
        setCursorHistory([null]);
        retainVerifiedProjection = false;
      }
      const controller = new AbortController();
      activeRequest.current = controller;
      requestInFlight.current = true;
      setFetching(true);
      if (!projectionRef.current || !retainVerifiedProjection) setLoading(true);
      if (!retainVerifiedProjection) {
        projectionRef.current = null;
        setProjection(null);
        setStale(false);
      }
      setError(null);
      const request = createPay004QueryRequest(stableScope, {
        ...criteriaOptions(criteria),
        cursor,
        asOf: asOfRef.current,
      });
      void deferOwnerRead(controller.signal)
        .then(() =>
          controller.signal.aborted
            ? undefined
            : adapter.query(request, stableScope.contextScopeKey, controller.signal)
        )
        .then((value) => {
          if (controller.signal.aborted || value === undefined) return;
          const next = selectPay004Projection(value);
          if (
            next.queryState.correlationId !== stableScope.correlationId ||
            next.queryState.cachePolicy.authorizationDecisionRevision !==
              stableScope.decisionRevision
          ) {
            throw new Pay004ContractError('trusted correlation or authorization revision');
          }
          if (
            scopeDecisionRevisionRef.current !== null &&
            next.queryState.scopeDecisionRevision !== scopeDecisionRevisionRef.current
          ) {
            throw new Pay004ContractError('response.scopeDecisionRevision snapshot binding');
          }
          if (asOfRef.current !== null && next.asOf !== asOfRef.current) {
            throw new Pay004ContractError('response.asOf snapshot binding');
          }
          if (scopeDecisionRevisionRef.current === null) {
            scopeDecisionRevisionRef.current = next.queryState.scopeDecisionRevision;
          }
          if (asOfRef.current === null) asOfRef.current = next.asOf;
          projectionRef.current = next;
          setProjection(next);
          setStale(next.queryState.freshness === 'STALE');
          setError(null);
        })
        .catch((failure: unknown) => {
          if (controller.signal.aborted) return;
          const retain =
            retainVerifiedProjection &&
            projectionRef.current !== null &&
            pay004ErrorMayRetainStaleProjection(failure);
          if (retain) setStale(true);
          else {
            projectionRef.current = null;
            setProjection(null);
            setStale(false);
          }
          setError(failure);
        })
        .finally(() => {
          if (controller.signal.aborted) return;
          requestInFlight.current = false;
          setLoading(false);
          setFetching(false);
        });
      return controller;
    },
    [adapter, criteria, cursor, scopeIdentity, stableScope]
  );

  useEffect(() => {
    const controller = load(false);
    return () => {
      controller.abort();
      requestInFlight.current = false;
    };
  }, [load]);

  return useMemo(
    () => ({
      projection,
      error,
      loading,
      fetching,
      stale,
      canPrevious: navigationIsCurrent && cursorHistory.length > 1,
      canNext: Boolean(projection?.queryState.nextCursor),
      criteria,
      applyCriteria,
      resetCriteria: () => applyCriteria(PAY004_DEFAULT_CRITERIA),
      refresh: () => load(true),
      previous: () => {
        if (!requestInFlight.current) {
          requestInFlight.current = true;
          setCursorHistory((history) => history.slice(0, -1));
        }
      },
      next: () => {
        const nextCursor = projectionRef.current?.queryState.nextCursor;
        if (!requestInFlight.current && nextCursor) {
          requestInFlight.current = true;
          setCursorHistory((history) => [...history, nextCursor]);
        }
      },
    }),
    [
      applyCriteria,
      criteria,
      cursorHistory.length,
      error,
      fetching,
      load,
      loading,
      navigationIsCurrent,
      projection,
      stale,
    ]
  );
}
