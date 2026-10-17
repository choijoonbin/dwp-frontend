import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import {
  PayrollRunPrepareOutcomeUnknownError,
  payrollPopulationDataSource,
} from './payroll-population-api';
import {
  PAYROLL_POPULATION_DATA_ROUTE_CONTRACT_KEY,
  PAYROLL_POPULATION_PAGE_ROUTE_CONTRACT_KEY,
  PAYROLL_RUN_PREPARE_ROUTE_CONTRACT_KEY,
  buildPayrollRunPrepareCommand,
  payrollPopulationItemIsSafeToPrepare,
  validatePayrollPopulationQuery,
} from './payroll-population-contract';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type {
  PayrollPopulationDataSource,
  PayrollRunPrepareAuthority,
} from './payroll-population-api';
import type {
  PayrollPopulationItem,
  PayrollPopulationProjection,
  PayrollPopulationQuery,
  PayrollRunPrepareCommand,
  PayrollRunPrepareDraft,
  PayrollRunPreparedReceipt,
} from './payroll-population-contract';

export type PayrollPopulationScope = Readonly<{
  ready: boolean;
  tenantId: string;
  contextScopeKey?: string;
  decisionRevision: string;
}>;

export type PayrollPopulationReviewRequest = Omit<PayrollPopulationQuery, 'correlationId'>;

export type PayrollRunPrepareCommandBinding = Readonly<{
  routeContractKey: typeof PAYROLL_RUN_PREPARE_ROUTE_CONTRACT_KEY;
  targetType: 'PAYROLL_RUN_PREPARATION';
  targetId: string;
  selectedPopulationPublicId: string;
  expectedObjectVersion: 0;
  idempotencyKey: string;
  correlationId: string;
  contextScopeKey: string;
  decisionRevision: string;
  payload: PayrollRunPrepareCommand;
}>;

export type PayrollRunPrepareCommandExecutor = <T>(
  execute: (authority: ProductSurfaceGovernedMutationAuthority) => Promise<T>,
  binding: PayrollRunPrepareCommandBinding
) => Promise<T>;

export type PayrollPopulationOwnerBinding = Readonly<{
  page: Readonly<{
    routeContractKey: typeof PAYROLL_POPULATION_PAGE_ROUTE_CONTRACT_KEY;
  }>;
  data?: Readonly<{
    contractId: 'IAQ-014';
    routeContractKey: typeof PAYROLL_POPULATION_DATA_ROUTE_CONTRACT_KEY;
    read: PayrollPopulationDataSource['population'];
  }>;
  prepare?: Readonly<{
    contractId: 'PEP-PAY-011';
    routeContractKey: typeof PAYROLL_RUN_PREPARE_ROUTE_CONTRACT_KEY;
    execute: PayrollRunPrepareCommandExecutor;
  }>;
}>;

export type PayrollPopulationRuntimeState =
  | Readonly<{ kind: 'CLOSED' | 'IDLE' | 'LOADING' | 'DENIED' | 'UNAVAILABLE' }>
  | Readonly<{
      kind: 'EMPTY' | 'PARTIAL' | 'STALE' | 'COMPLETE';
      projection: PayrollPopulationProjection;
      loadedAt: number;
    }>;

export type PayrollRunPrepareFeedback =
  | Readonly<{ kind: 'STEP_UP' }>
  | Readonly<{ kind: 'ACCEPTED'; receipt: PayrollRunPreparedReceipt }>
  | Readonly<{ kind: 'SUCCEEDED'; receipt: PayrollRunPreparedReceipt }>
  | Readonly<{ kind: 'RESULT_UNKNOWN'; receipt?: PayrollRunPreparedReceipt }>
  | Readonly<{ kind: 'PERMISSION' }>
  | Readonly<{ kind: 'CONFLICT' }>
  | Readonly<{ kind: 'REJECTED' }>
  | Readonly<{ kind: 'INVALID'; message: string }>;

type PendingPrepare = Readonly<{
  command: PayrollRunPrepareCommand;
  binding: PayrollRunPrepareCommandBinding;
  scopeIdentity: string;
  dispatched: boolean;
}>;

export type UsePayrollPopulationWorkspaceOptions = Readonly<{
  scope: PayrollPopulationScope;
  ownerBinding?: PayrollPopulationOwnerBinding;
  dataSource?: PayrollPopulationDataSource;
  idFactory?: () => string;
  now?: () => number;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function secureId() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Secure payroll preparation identity generation is unavailable.');
  }
  return globalThis.crypto.randomUUID();
}

function denied(error: unknown) {
  return error instanceof HttpError && [401, 403, 404].includes(error.status);
}

function uncertain(error: unknown) {
  return (
    error instanceof PayrollRunPrepareOutcomeUnknownError ||
    error instanceof HttpTransportError ||
    (error instanceof HttpError &&
      (error.status === 408 || error.status === 429 || error.status >= 500))
  );
}

function projectionState(
  projection: PayrollPopulationProjection,
  loadedAt: number
): PayrollPopulationRuntimeState {
  if (projection.queryState.state === 'UNAVAILABLE') return { kind: 'UNAVAILABLE' };
  if (projection.queryState.state === 'EMPTY') return { kind: 'EMPTY', projection, loadedAt };
  if (projection.queryState.state === 'PARTIAL') return { kind: 'PARTIAL', projection, loadedAt };
  if (projection.queryState.freshness === 'STALE') return { kind: 'STALE', projection, loadedAt };
  return { kind: 'COMPLETE', projection, loadedAt };
}

function prepareAuthority(
  governance: ProductSurfaceGovernedMutationAuthority,
  binding: PayrollRunPrepareCommandBinding
): PayrollRunPrepareAuthority {
  if (
    governance.mode !== 'SECURE' ||
    !governance.stepUp ||
    governance.contextScopeKey !== binding.contextScopeKey ||
    governance.expectedDecisionRevision !== binding.decisionRevision ||
    governance.stepUp.decisionRevision !== binding.decisionRevision ||
    governance.idempotencyKey !== binding.idempotencyKey ||
    governance.objectVersion !== 0
  ) {
    throw new Error('Payroll preparation authority changed before dispatch.');
  }
  return Object.freeze({
    routeContractKey: binding.routeContractKey,
    governance,
    contextScopeKey: binding.contextScopeKey,
    decisionRevision: binding.decisionRevision,
    idempotencyKey: binding.idempotencyKey,
    correlationId: binding.correlationId,
    expectedObjectVersion: 0,
  });
}

function exactReader(ownerBinding?: PayrollPopulationOwnerBinding) {
  return ownerBinding?.page.routeContractKey === PAYROLL_POPULATION_PAGE_ROUTE_CONTRACT_KEY &&
    ownerBinding.data?.contractId === 'IAQ-014' &&
    ownerBinding.data.routeContractKey === PAYROLL_POPULATION_DATA_ROUTE_CONTRACT_KEY
    ? ownerBinding.data.read
    : undefined;
}

function exactPrepareExecutor(ownerBinding?: PayrollPopulationOwnerBinding) {
  return ownerBinding?.page.routeContractKey === PAYROLL_POPULATION_PAGE_ROUTE_CONTRACT_KEY &&
    ownerBinding.prepare?.contractId === 'PEP-PAY-011' &&
    ownerBinding.prepare.routeContractKey === PAYROLL_RUN_PREPARE_ROUTE_CONTRACT_KEY
    ? ownerBinding.prepare.execute
    : undefined;
}

export function usePayrollPopulationWorkspace({
  scope,
  ownerBinding,
  dataSource = payrollPopulationDataSource,
  idFactory = secureId,
  now = Date.now,
}: UsePayrollPopulationWorkspaceOptions) {
  const reader = exactReader(ownerBinding);
  const prepareExecutor = exactPrepareExecutor(ownerBinding);
  const scopeIdentity = JSON.stringify([
    scope.ready,
    scope.tenantId,
    scope.contextScopeKey ?? '',
    scope.decisionRevision,
    ownerBinding?.page.routeContractKey ?? '',
    ownerBinding?.data?.contractId ?? '',
    ownerBinding?.data?.routeContractKey ?? '',
    ownerBinding?.prepare?.contractId ?? '',
    ownerBinding?.prepare?.routeContractKey ?? '',
  ]);
  const currentScopeRef = useRef(scopeIdentity);
  currentScopeRef.current = scopeIdentity;
  const mountedRef = useRef(true);
  const activeReadRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const pendingRef = useRef<PendingPrepare | null>(null);
  const lastQueryRef = useRef<PayrollPopulationReviewRequest | null>(null);
  const [state, setState] = useState<PayrollPopulationRuntimeState>(() =>
    scope.ready && reader ? { kind: 'IDLE' } : { kind: 'CLOSED' }
  );
  const [stateScopeIdentity, setStateScopeIdentity] = useState(scopeIdentity);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<PayrollRunPrepareFeedback | null>(null);

  useEffect(() => {
    activeReadRef.current?.abort();
    activeReadRef.current = null;
    pendingRef.current = null;
    lastQueryRef.current = null;
    busyRef.current = false;
    setSelectedId(null);
    setBusy(false);
    setFeedback(null);
    setState(scope.ready && reader ? { kind: 'IDLE' } : { kind: 'CLOSED' });
    setStateScopeIdentity(scopeIdentity);
  }, [reader, scope.ready, scopeIdentity]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeReadRef.current?.abort();
    };
  }, []);

  const exposedState = useMemo<PayrollPopulationRuntimeState>(
    () =>
      stateScopeIdentity === scopeIdentity
        ? state
        : scope.ready && reader
          ? { kind: 'IDLE' }
          : { kind: 'CLOSED' },
    [reader, scope.ready, scopeIdentity, state, stateScopeIdentity]
  );

  const review = useCallback(
    async (request: PayrollPopulationReviewRequest) => {
      if (!scope.ready || !scope.contextScopeKey || !scope.decisionRevision || !reader) return;
      let query: PayrollPopulationQuery;
      try {
        const correlationId = idFactory();
        if (!UUID.test(correlationId)) throw new Error('identity');
        query = validatePayrollPopulationQuery({ ...request, correlationId });
      } catch {
        setFeedback({ kind: 'INVALID', message: 'Enter valid payroll population filters.' });
        return;
      }
      activeReadRef.current?.abort();
      const abort = new AbortController();
      activeReadRef.current = abort;
      lastQueryRef.current = query;
      setFeedback(null);
      setState({ kind: 'LOADING' });
      try {
        const projection = await reader(query, {
          routeContractKey: PAYROLL_POPULATION_DATA_ROUTE_CONTRACT_KEY,
          contextScopeKey: scope.contextScopeKey,
          decisionRevision: scope.decisionRevision,
          signal: abort.signal,
        });
        if (
          !mountedRef.current ||
          abort.signal.aborted ||
          currentScopeRef.current !== scopeIdentity
        ) {
          return;
        }
        setState(projectionState(projection, now()));
        setSelectedId((current) =>
          projection.items.some((item) => item.itemPublicId === current)
            ? current
            : (projection.items[0]?.itemPublicId ?? null)
        );
      } catch (error) {
        if (
          !mountedRef.current ||
          abort.signal.aborted ||
          currentScopeRef.current !== scopeIdentity
        ) {
          return;
        }
        setSelectedId(null);
        setState({ kind: denied(error) ? 'DENIED' : 'UNAVAILABLE' });
      } finally {
        if (activeReadRef.current === abort) activeReadRef.current = null;
      }
    },
    [
      idFactory,
      now,
      reader,
      scope.contextScopeKey,
      scope.decisionRevision,
      scope.ready,
      scopeIdentity,
    ]
  );

  const executePrepare = useCallback(
    async (pending: PendingPrepare) => {
      if (
        busyRef.current ||
        !prepareExecutor ||
        currentScopeRef.current !== pending.scopeIdentity
      ) {
        return;
      }
      busyRef.current = true;
      setBusy(true);
      setFeedback({ kind: 'STEP_UP' });
      let dispatched = pending.dispatched;
      try {
        const receipt = await prepareExecutor((governance) => {
          if (currentScopeRef.current !== pending.scopeIdentity) {
            throw new Error('Payroll preparation scope changed before dispatch.');
          }
          dispatched = true;
          pendingRef.current = Object.freeze({ ...pending, dispatched: true });
          return dataSource.prepare(pending.command, prepareAuthority(governance, pending.binding));
        }, pending.binding);
        if (!mountedRef.current || currentScopeRef.current !== pending.scopeIdentity) return;
        if (receipt.status === 'SUCCEEDED') {
          pendingRef.current = null;
          setFeedback({ kind: 'SUCCEEDED', receipt });
        } else if (receipt.status === 'ACCEPTED' || receipt.status === 'RUNNING') {
          pendingRef.current = null;
          setFeedback({ kind: 'ACCEPTED', receipt });
        } else if (receipt.status === 'RESULT_UNKNOWN') {
          pendingRef.current = Object.freeze({ ...pending, dispatched: true });
          setFeedback({ kind: 'RESULT_UNKNOWN', receipt });
        } else {
          pendingRef.current = null;
          setFeedback({ kind: 'REJECTED' });
        }
      } catch (error) {
        if (!mountedRef.current || currentScopeRef.current !== pending.scopeIdentity) return;
        if (dispatched && uncertain(error)) {
          pendingRef.current = Object.freeze({ ...pending, dispatched: true });
          setFeedback({ kind: 'RESULT_UNKNOWN' });
        } else if (denied(error)) {
          pendingRef.current = null;
          setFeedback({ kind: 'PERMISSION' });
        } else if (error instanceof HttpError && [409, 412].includes(error.status)) {
          pendingRef.current = null;
          setFeedback({ kind: 'CONFLICT' });
        } else {
          pendingRef.current = null;
          setFeedback({ kind: 'REJECTED' });
        }
      } finally {
        if (mountedRef.current && currentScopeRef.current === pending.scopeIdentity) {
          busyRef.current = false;
          setBusy(false);
        }
      }
    },
    [dataSource, prepareExecutor]
  );

  const projection =
    exposedState.kind === 'EMPTY' ||
    exposedState.kind === 'PARTIAL' ||
    exposedState.kind === 'STALE' ||
    exposedState.kind === 'COMPLETE'
      ? exposedState.projection
      : null;
  const selected = projection?.items.find((item) => item.itemPublicId === selectedId) ?? null;

  const prepare = useCallback(
    (draft: PayrollRunPrepareDraft) => {
      if (
        !projection ||
        !selected ||
        !payrollPopulationItemIsSafeToPrepare(projection, selected) ||
        !scope.contextScopeKey ||
        !scope.decisionRevision ||
        !prepareExecutor ||
        busyRef.current ||
        pendingRef.current ||
        feedback?.kind === 'ACCEPTED' ||
        feedback?.kind === 'SUCCEEDED'
      ) {
        return;
      }
      try {
        const preparationId = idFactory();
        const idempotencyKey = idFactory();
        const correlationId = idFactory();
        if (![preparationId, idempotencyKey, correlationId].every((id) => UUID.test(id))) {
          throw new Error('identity');
        }
        const command = buildPayrollRunPrepareCommand(projection, selected, draft, preparationId);
        const binding: PayrollRunPrepareCommandBinding = Object.freeze({
          routeContractKey: PAYROLL_RUN_PREPARE_ROUTE_CONTRACT_KEY,
          targetType: 'PAYROLL_RUN_PREPARATION',
          targetId: preparationId,
          selectedPopulationPublicId: selected.itemPublicId,
          expectedObjectVersion: 0,
          idempotencyKey,
          correlationId,
          contextScopeKey: scope.contextScopeKey,
          decisionRevision: scope.decisionRevision,
          payload: command,
        });
        const pending: PendingPrepare = Object.freeze({
          command,
          binding,
          scopeIdentity,
          dispatched: false,
        });
        pendingRef.current = pending;
        void executePrepare(pending);
      } catch {
        setFeedback({
          kind: 'INVALID',
          message: 'Enter valid run identifiers before preparing this population.',
        });
      }
    },
    [
      executePrepare,
      feedback?.kind,
      idFactory,
      prepareExecutor,
      projection,
      scope.contextScopeKey,
      scope.decisionRevision,
      scopeIdentity,
      selected,
    ]
  );

  const retryExact = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending || busyRef.current || currentScopeRef.current !== pending.scopeIdentity) return;
    void executePrepare(pending);
  }, [executePrepare]);

  const refresh = useCallback(() => {
    const query = lastQueryRef.current;
    if (query) void review(query);
  }, [review]);

  const select = useCallback(
    (item: PayrollPopulationItem) => {
      if (projection?.items.some((candidate) => candidate.itemPublicId === item.itemPublicId)) {
        setSelectedId(item.itemPublicId);
        setFeedback(null);
      }
    },
    [projection]
  );

  return Object.freeze({
    state: exposedState,
    projection,
    selected,
    busy,
    feedback,
    canPrepare:
      payrollPopulationItemIsSafeToPrepare(projection, selected) &&
      Boolean(prepareExecutor) &&
      !busy &&
      feedback?.kind !== 'ACCEPTED' &&
      feedback?.kind !== 'SUCCEEDED' &&
      pendingRef.current === null,
    prepareAvailable: Boolean(prepareExecutor),
    hasPendingExactRetry: feedback?.kind === 'RESULT_UNKNOWN' && pendingRef.current !== null,
    review,
    refresh,
    select,
    prepare,
    retryExact,
  });
}

export type PayrollPopulationWorkspaceController = ReturnType<typeof usePayrollPopulationWorkspace>;
