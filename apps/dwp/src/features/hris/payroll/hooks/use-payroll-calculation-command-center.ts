import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import { payrollCalculationDataSource } from '../api/payroll-calculation-api';
import {
  isPayrollReceiptPending,
  orderPayrollRunsExceptionFirst,
  payrollRunCommandAvailability,
} from '../model/payroll-calculation-contract';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type {
  PayrollCalculationCommandAuthority,
  PayrollCalculationDataSource,
} from '../api/payroll-calculation-api';
import type {
  PayrollActionCommand,
  PayrollCalculationCommandKind,
  PayrollCalculationReceipt,
  PayrollCalculationRun,
} from '../model/payroll-calculation-contract';

export type PayrollCalculationScope = Readonly<{
  ready: boolean;
  contextScopeKey?: string;
  decisionRevision: string;
}>;

export type PayrollCalculationCommandBinding = Readonly<{
  kind: PayrollCalculationCommandKind;
  runId: string;
  expectedVersion: number;
  contextScopeKey: string;
  decisionRevision: string;
  idempotencyKey: string;
  correlationId: string;
  request: PayrollActionCommand;
}>;

export type PayrollCalculationCommandExecutor = <T>(
  execute: (authority: ProductSurfaceGovernedMutationAuthority) => Promise<T>,
  binding: PayrollCalculationCommandBinding
) => Promise<T>;

export type PayrollCalculationOwnerBinding = Readonly<{
  run?: Readonly<{
    contractId: 'PEP-PAY-013';
    read: PayrollCalculationDataSource['run'];
  }>;
  calculate?: Readonly<{
    contractId: 'PEP-PAY-012';
    execute: PayrollCalculationCommandExecutor;
  }>;
  approve?: Readonly<{
    contractId: 'PEP-PAY-017';
    execute: PayrollCalculationCommandExecutor;
  }>;
  finalize?: Readonly<{
    contractId: 'PEP-PAY-018';
    execute: PayrollCalculationCommandExecutor;
  }>;
  receipt?: Readonly<{
    contractId: 'PEP-PAY-033';
    read: PayrollCalculationDataSource['receipt'];
  }>;
}>;

export type PayrollCalculationReadFailure = Readonly<{
  runId: string;
  kind: 'DENIED' | 'UNAVAILABLE';
}>;

export type PayrollCalculationRuntimeState =
  | Readonly<{
      kind: 'CLOSED' | 'LOADING' | 'EMPTY' | 'DENIED' | 'ERROR';
      scopeIdentity: string;
    }>
  | Readonly<{
      kind: 'READY';
      scopeIdentity: string;
      runs: readonly PayrollCalculationRun[];
      failures: readonly PayrollCalculationReadFailure[];
      loadedAt: number;
    }>;

export type PayrollCalculationFeedback =
  | Readonly<{ kind: 'SUCCEEDED'; receipt: PayrollCalculationReceipt }>
  | Readonly<{ kind: 'STEP_UP'; command: 'APPROVE' | 'FINALIZE' }>
  | Readonly<{
      kind: 'RESULT_UNKNOWN';
      command: PayrollCalculationCommandKind;
      receipt?: PayrollCalculationReceipt;
    }>
  | Readonly<{ kind: 'PERMISSION'; command: PayrollCalculationCommandKind }>
  | Readonly<{ kind: 'CONFLICT'; command: PayrollCalculationCommandKind }>
  | Readonly<{ kind: 'REJECTED'; command: PayrollCalculationCommandKind }>
  | Readonly<{ kind: 'INVALID'; message: string }>;

type PendingCommand = PayrollCalculationCommandBinding &
  Readonly<{
    scopeIdentity: string;
    dispatched?: true;
    observedReceipt?: PayrollCalculationReceipt;
  }>;

export type UsePayrollCalculationCommandCenterOptions = Readonly<{
  runIds: readonly string[];
  receiptIds?: readonly string[];
  scope: PayrollCalculationScope;
  ownerBinding?: PayrollCalculationOwnerBinding;
  dataSource?: PayrollCalculationDataSource;
  idFactory?: () => string;
  now?: () => number;
  staleAfterMs?: number;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const EMPTY_IDS = Object.freeze([]) as readonly string[];
const EMPTY_RUNS = Object.freeze([]) as readonly PayrollCalculationRun[];
const EMPTY_RECEIPTS = Object.freeze([]) as readonly PayrollCalculationReceipt[];
const IDENTITY = new WeakMap<object, number>();
let nextIdentity = 1;

function identityOf(value: object | undefined) {
  if (!value) return 0;
  const existing = IDENTITY.get(value);
  if (existing) return existing;
  const created = nextIdentity++;
  IDENTITY.set(value, created);
  return created;
}

function secureId() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Secure payroll command identity generation is unavailable.');
  }
  return globalThis.crypto.randomUUID();
}

function ownerExecutor(
  owner: PayrollCalculationOwnerBinding | undefined,
  kind: PayrollCalculationCommandKind
) {
  if (kind === 'CALCULATE' && owner?.calculate?.contractId === 'PEP-PAY-012') {
    return owner.calculate.execute;
  }
  if (kind === 'APPROVE' && owner?.approve?.contractId === 'PEP-PAY-017') {
    return owner.approve.execute;
  }
  if (kind === 'FINALIZE' && owner?.finalize?.contractId === 'PEP-PAY-018') {
    return owner.finalize.execute;
  }
  return undefined;
}

function commandAuthority(
  authority: ProductSurfaceGovernedMutationAuthority,
  command: PendingCommand
): PayrollCalculationCommandAuthority {
  const highRisk = command.kind !== 'CALCULATE';
  if (authority.mode === 'LEGACY_COMPATIBILITY') {
    if (highRisk) {
      throw new Error('Payroll high-risk command authority cannot use legacy compatibility.');
    }
    return {
      governance: authority,
      idempotencyKey: command.idempotencyKey,
      correlationId: command.correlationId,
      expectedObjectVersion: command.expectedVersion,
    };
  }
  if (authority.mode === 'SECURE') {
    if (
      authority.contextScopeKey !== command.contextScopeKey ||
      authority.expectedDecisionRevision !== command.decisionRevision ||
      authority.idempotencyKey !== command.idempotencyKey ||
      authority.objectVersion !== command.expectedVersion ||
      (highRisk &&
        (!authority.stepUp || authority.stepUp.decisionRevision !== command.decisionRevision))
    ) {
      throw new Error('Payroll calculation command authority changed before dispatch.');
    }
  }
  return {
    governance: authority,
    idempotencyKey: command.idempotencyKey,
    correlationId: command.correlationId,
    expectedObjectVersion: command.expectedVersion,
  };
}

function denied(error: unknown) {
  return error instanceof HttpError && [401, 403, 404].includes(error.status);
}

function uncertain(error: unknown) {
  return (
    error instanceof HttpTransportError ||
    (error instanceof HttpError &&
      (error.status === 408 || error.status === 429 || error.status >= 500))
  );
}

function sameReceipt(left: PayrollCalculationReceipt, right: PayrollCalculationReceipt) {
  return (
    left.receiptId === right.receiptId &&
    left.commandType === right.commandType &&
    left.originatingAction === right.originatingAction &&
    left.subjectPrincipalPublicId === right.subjectPrincipalPublicId &&
    left.populationScopeDigest === right.populationScopeDigest &&
    left.fieldPolicyRevision === right.fieldPolicyRevision &&
    left.purposeCode === right.purposeCode &&
    left.authorizationRevision === right.authorizationRevision &&
    left.correlationId === right.correlationId &&
    left.requestDigest === right.requestDigest &&
    left.createdAt === right.createdAt &&
    (left.aggregateVersion === undefined || left.aggregateVersion === right.aggregateVersion) &&
    (left.resultRef === undefined || left.resultRef === right.resultRef)
  );
}

function upsertReceipt(
  receipts: readonly PayrollCalculationReceipt[],
  receipt: PayrollCalculationReceipt
) {
  return Object.freeze([
    receipt,
    ...receipts.filter((candidate) => candidate.receiptId !== receipt.receiptId),
  ]);
}

export function usePayrollCalculationCommandCenter({
  runIds,
  receiptIds = EMPTY_IDS,
  scope,
  ownerBinding,
  dataSource = payrollCalculationDataSource,
  idFactory = secureId,
  now = Date.now,
  staleAfterMs = 60_000,
}: UsePayrollCalculationCommandCenterOptions) {
  const runReader =
    ownerBinding?.run?.contractId === 'PEP-PAY-013' ? ownerBinding.run.read : undefined;
  const receiptReader =
    ownerBinding?.receipt?.contractId === 'PEP-PAY-033' ? ownerBinding.receipt.read : undefined;
  const calculateExecutor = ownerExecutor(ownerBinding, 'CALCULATE');
  const approveExecutor = ownerExecutor(ownerBinding, 'APPROVE');
  const finalizeExecutor = ownerExecutor(ownerBinding, 'FINALIZE');
  const stableRunIds = JSON.stringify([...new Set(runIds)].sort());
  const stableReceiptIds = JSON.stringify([...new Set(receiptIds)].sort());
  const scopeIdentity = JSON.stringify([
    scope.ready,
    scope.contextScopeKey ?? '',
    scope.decisionRevision,
    stableRunIds,
    stableReceiptIds,
    identityOf(runReader),
    identityOf(receiptReader),
    identityOf(calculateExecutor),
    identityOf(approveExecutor),
    identityOf(finalizeExecutor),
    identityOf(dataSource.run),
    identityOf(dataSource.receipt),
    identityOf(dataSource.calculate),
    identityOf(dataSource.approve),
    identityOf(dataSource.finalize),
  ]);
  const currentScopeRef = useRef(scopeIdentity);
  currentScopeRef.current = scopeIdentity;
  const mountedRef = useRef(true);
  const busyRef = useRef(false);
  const pendingRef = useRef<PendingCommand | null>(null);
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<PayrollCalculationRuntimeState>({
    kind: 'CLOSED',
    scopeIdentity,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<PayrollCalculationFeedback | null>(null);
  const [receipts, setReceipts] = useState<readonly PayrollCalculationReceipt[]>([]);
  const [receiptFailures, setReceiptFailures] = useState(0);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptScopeIdentity, setReceiptScopeIdentity] = useState(scopeIdentity);
  const [freshnessRevision, setFreshnessRevision] = useState(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    pendingRef.current = null;
    busyRef.current = false;
    setBusy(false);
    setFeedback(null);
    setReceipts([]);
    setReceiptFailures(0);
    setReceiptLoading(false);
    setReceiptScopeIdentity(scopeIdentity);
  }, [scopeIdentity]);

  useEffect(() => {
    if (!scope.ready || !runReader) {
      setState({ kind: 'CLOSED', scopeIdentity });
      return;
    }
    const ids = JSON.parse(stableRunIds) as string[];
    if (ids.length === 0) {
      setState({ kind: 'EMPTY', scopeIdentity });
      return;
    }
    if (ids.length > 50 || ids.some((id) => !UUID.test(id))) {
      setState({ kind: 'ERROR', scopeIdentity });
      return;
    }
    const abort = new AbortController();
    const readCorrelationId = idFactory();
    if (!UUID.test(readCorrelationId)) {
      setState({ kind: 'ERROR', scopeIdentity });
      return;
    }
    setState({ kind: 'LOADING', scopeIdentity });
    void Promise.allSettled(
      ids.map((runId) =>
        runReader(runId, {
          contextScopeKey: scope.contextScopeKey,
          correlationId: readCorrelationId,
          signal: abort.signal,
        })
      )
    ).then((results) => {
      if (
        abort.signal.aborted ||
        !mountedRef.current ||
        currentScopeRef.current !== scopeIdentity
      ) {
        return;
      }
      const runs: PayrollCalculationRun[] = [];
      const failures: PayrollCalculationReadFailure[] = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') runs.push(result.value);
        else
          failures.push({
            runId: ids[index],
            kind: denied(result.reason) ? 'DENIED' : 'UNAVAILABLE',
          });
      });
      if (runs.length === 0) {
        setState({
          kind: failures.every((failure) => failure.kind === 'DENIED') ? 'DENIED' : 'ERROR',
          scopeIdentity,
        });
        return;
      }
      const ordered = Object.freeze(orderPayrollRunsExceptionFirst(runs));
      setState({
        kind: 'READY',
        scopeIdentity,
        runs: ordered,
        failures: Object.freeze(failures),
        loadedAt: now(),
      });
      setSelectedId((current) =>
        ordered.some((run) => run.runId === current) ? current : (ordered[0]?.runId ?? null)
      );
    });
    return () => abort.abort();
  }, [
    idFactory,
    now,
    reload,
    runReader,
    scope.contextScopeKey,
    scope.ready,
    scopeIdentity,
    stableRunIds,
  ]);

  useEffect(() => {
    const ids = JSON.parse(stableReceiptIds) as string[];
    if (ids.length === 0 || !scope.ready) {
      setReceiptLoading(false);
      return;
    }
    if (!receiptReader) {
      setReceiptFailures(ids.length);
      setReceiptLoading(false);
      return;
    }
    if (ids.length > 50 || ids.some((id) => !UUID.test(id))) {
      setReceiptFailures(ids.length);
      setReceiptLoading(false);
      return;
    }
    const abort = new AbortController();
    const correlationId = idFactory();
    if (!UUID.test(correlationId)) {
      setReceiptFailures(ids.length);
      setReceiptLoading(false);
      return;
    }
    setReceiptLoading(true);
    void Promise.allSettled(
      ids.map((receiptId) =>
        receiptReader(receiptId, {
          contextScopeKey: scope.contextScopeKey,
          correlationId,
          signal: abort.signal,
        })
      )
    ).then((results) => {
      if (
        abort.signal.aborted ||
        !mountedRef.current ||
        currentScopeRef.current !== scopeIdentity
      ) {
        return;
      }
      const visible = results.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : []
      );
      setReceipts((current) =>
        visible.reduce<readonly PayrollCalculationReceipt[]>(upsertReceipt, current)
      );
      setReceiptScopeIdentity(scopeIdentity);
      setReceiptFailures(results.length - visible.length);
      setReceiptLoading(false);
    });
    return () => abort.abort();
  }, [
    idFactory,
    receiptReader,
    scope.contextScopeKey,
    scope.ready,
    scopeIdentity,
    stableReceiptIds,
  ]);

  const stateMatchesScope = state.scopeIdentity === scopeIdentity;
  const exposedState = useMemo<PayrollCalculationRuntimeState>(
    () =>
      stateMatchesScope
        ? state
        : { kind: scope.ready && runReader ? 'LOADING' : 'CLOSED', scopeIdentity },
    [runReader, scope.ready, scopeIdentity, state, stateMatchesScope]
  );
  const receiptsMatchScope = receiptScopeIdentity === scopeIdentity;
  const exposedReceipts = receiptsMatchScope ? receipts : EMPTY_RECEIPTS;
  const exposedReceiptFailures = receiptsMatchScope ? receiptFailures : 0;
  const exposedReceiptLoading = receiptsMatchScope ? receiptLoading : stableReceiptIds !== '[]';
  const exposedFeedback = stateMatchesScope ? feedback : null;
  const runs = exposedState.kind === 'READY' ? exposedState.runs : EMPTY_RUNS;
  const selected = runs.find((run) => run.runId === selectedId) ?? runs[0] ?? null;
  const availability = payrollRunCommandAvailability(selected);
  const partial =
    exposedState.kind === 'READY' &&
    (exposedState.failures.length > 0 || exposedReceiptFailures > 0);
  const stale = exposedState.kind === 'READY' && now() - exposedState.loadedAt >= staleAfterMs;

  useEffect(() => {
    if (exposedState.kind !== 'READY' || stale) return;
    const remaining = exposedState.loadedAt + staleAfterMs - now();
    const timeout = globalThis.setTimeout(
      () => setFreshnessRevision((value) => value + 1),
      Math.max(0, Math.min(remaining + 1, 2_147_483_647))
    );
    return () => globalThis.clearTimeout(timeout);
  }, [exposedState, freshnessRevision, now, stale, staleAfterMs]);

  const execute = useCallback(
    async (command: PendingCommand) => {
      const executor = ownerExecutor(ownerBinding, command.kind);
      if (
        !executor ||
        !receiptReader ||
        busyRef.current ||
        !scope.ready ||
        currentScopeRef.current !== command.scopeIdentity
      ) {
        return;
      }
      busyRef.current = true;
      setBusy(true);
      if (command.kind !== 'CALCULATE') setFeedback({ kind: 'STEP_UP', command: command.kind });
      let dispatched = false;
      let dispatchedCommand = command;
      try {
        const receipt = await executor((authority) => {
          if (!mountedRef.current || currentScopeRef.current !== command.scopeIdentity) {
            throw new Error('Payroll calculation scope changed before command dispatch.');
          }
          const exactAuthority = commandAuthority(authority, command);
          dispatchedCommand = command.dispatched
            ? command
            : Object.freeze({ ...command, dispatched: true as const });
          pendingRef.current = dispatchedCommand;
          dispatched = true;
          if (command.kind === 'CALCULATE') {
            return dataSource.calculate(command.runId, command.request, exactAuthority);
          }
          if (command.kind === 'APPROVE') {
            return dataSource.approve(command.runId, command.request, exactAuthority);
          }
          return dataSource.finalize(command.runId, command.request, exactAuthority);
        }, command);
        if (!mountedRef.current || currentScopeRef.current !== command.scopeIdentity) return;
        if (command.observedReceipt && !sameReceipt(command.observedReceipt, receipt)) {
          pendingRef.current = command;
          setFeedback({
            kind: 'RESULT_UNKNOWN',
            command: command.kind,
            receipt: command.observedReceipt,
          });
          return;
        }
        setReceiptScopeIdentity(command.scopeIdentity);
        setReceipts((current) => upsertReceipt(current, receipt));
        if (isPayrollReceiptPending(receipt)) {
          pendingRef.current = Object.freeze({ ...dispatchedCommand, observedReceipt: receipt });
          setFeedback({ kind: 'RESULT_UNKNOWN', command: command.kind, receipt });
        } else if (receipt.status === 'SUCCEEDED') {
          pendingRef.current = null;
          setFeedback({ kind: 'SUCCEEDED', receipt });
          setReload((value) => value + 1);
        } else {
          pendingRef.current = null;
          setFeedback({ kind: 'REJECTED', command: command.kind });
        }
      } catch (error) {
        if (!mountedRef.current || currentScopeRef.current !== command.scopeIdentity) return;
        if ((dispatched || command.dispatched) && uncertain(error)) {
          pendingRef.current = dispatchedCommand;
          setFeedback({ kind: 'RESULT_UNKNOWN', command: command.kind });
        } else if (denied(error)) {
          pendingRef.current = null;
          setFeedback({ kind: 'PERMISSION', command: command.kind });
        } else if (error instanceof HttpError && [409, 412].includes(error.status)) {
          pendingRef.current = null;
          setFeedback({ kind: 'CONFLICT', command: command.kind });
        } else {
          pendingRef.current = null;
          setFeedback({ kind: 'REJECTED', command: command.kind });
        }
      } finally {
        if (currentScopeRef.current === command.scopeIdentity) {
          busyRef.current = false;
          if (mountedRef.current) setBusy(false);
        }
      }
    },
    [dataSource, ownerBinding, receiptReader, scope.ready]
  );

  const begin = useCallback(
    (kind: PayrollCalculationCommandKind, comment?: string) => {
      if (
        !selected ||
        !scope.contextScopeKey ||
        !scope.decisionRevision ||
        !receiptReader ||
        busyRef.current ||
        pendingRef.current ||
        partial
      )
        return;
      if (exposedState.kind !== 'READY' || now() - exposedState.loadedAt >= staleAfterMs) {
        setFreshnessRevision((value) => value + 1);
        return;
      }
      const allowed =
        (kind === 'CALCULATE' && availability.calculate) ||
        (kind === 'APPROVE' && availability.approve) ||
        (kind === 'FINALIZE' && availability.finalize);
      if (!allowed || !ownerExecutor(ownerBinding, kind)) return;
      const cleanComment = comment?.trim();
      const request: PayrollActionCommand = Object.freeze({
        reasonCode:
          kind === 'CALCULATE'
            ? 'PAYROLL_CALCULATION'
            : kind === 'APPROVE'
              ? 'PAYROLL_APPROVAL'
              : 'PAYROLL_FINALIZATION',
        ...(cleanComment ? { comment: cleanComment } : {}),
      });
      try {
        const idempotencyKey = idFactory();
        const correlationId = idFactory();
        if (!UUID.test(idempotencyKey) || !UUID.test(correlationId)) throw new Error('identity');
        const command: PendingCommand = Object.freeze({
          kind,
          runId: selected.runId,
          expectedVersion: selected.version,
          contextScopeKey: scope.contextScopeKey,
          decisionRevision: scope.decisionRevision,
          idempotencyKey,
          correlationId,
          request,
          scopeIdentity,
        });
        pendingRef.current = command;
        void execute(command);
      } catch {
        pendingRef.current = null;
        setFeedback({ kind: 'INVALID', message: 'Secure command identity is unavailable.' });
      }
    },
    [
      availability,
      execute,
      idFactory,
      ownerBinding,
      partial,
      receiptReader,
      scope.contextScopeKey,
      scope.decisionRevision,
      scopeIdentity,
      selected,
      exposedState,
      now,
      staleAfterMs,
    ]
  );

  const retryExact = useCallback(() => {
    const pending = pendingRef.current;
    if (pending && !pending.observedReceipt && pending.scopeIdentity === scopeIdentity) {
      void execute(pending);
    }
  }, [execute, scopeIdentity]);

  const reconcileReceipt = useCallback(async () => {
    const pending = pendingRef.current;
    if (
      !pending?.observedReceipt ||
      pending.scopeIdentity !== scopeIdentity ||
      !receiptReader ||
      busyRef.current
    )
      return;
    busyRef.current = true;
    setBusy(true);
    try {
      const correlationId = idFactory();
      if (!UUID.test(correlationId)) throw new Error('Invalid receipt correlation identity.');
      const receipt = await receiptReader(pending.observedReceipt.receiptId, {
        contextScopeKey: scope.contextScopeKey,
        correlationId,
      });
      if (!mountedRef.current || currentScopeRef.current !== pending.scopeIdentity) return;
      if (!sameReceipt(pending.observedReceipt, receipt)) {
        throw new Error('Payroll receipt identity changed during reconciliation.');
      }
      setReceiptScopeIdentity(pending.scopeIdentity);
      setReceipts((current) => upsertReceipt(current, receipt));
      if (isPayrollReceiptPending(receipt)) {
        pendingRef.current = Object.freeze({ ...pending, observedReceipt: receipt });
        setFeedback({ kind: 'RESULT_UNKNOWN', command: pending.kind, receipt });
      } else if (receipt.status === 'SUCCEEDED') {
        pendingRef.current = null;
        setFeedback({ kind: 'SUCCEEDED', receipt });
        setReload((value) => value + 1);
      } else {
        pendingRef.current = null;
        setFeedback({ kind: 'REJECTED', command: pending.kind });
      }
    } catch {
      if (!mountedRef.current || currentScopeRef.current !== pending.scopeIdentity) return;
      setFeedback({
        kind: 'RESULT_UNKNOWN',
        command: pending.kind,
        receipt: pending.observedReceipt,
      });
    } finally {
      if (currentScopeRef.current === pending.scopeIdentity) {
        busyRef.current = false;
        if (mountedRef.current) setBusy(false);
      }
    }
  }, [idFactory, receiptReader, scope.contextScopeKey, scopeIdentity]);

  const commandBlocked =
    busy ||
    exposedReceiptLoading ||
    Boolean(pendingRef.current) ||
    !stateMatchesScope ||
    stale ||
    partial;
  return useMemo(
    () => ({
      state: exposedState,
      runs,
      selected,
      selectedId: selected?.runId ?? null,
      partial,
      stale,
      busy,
      feedback: exposedFeedback,
      receipts: exposedReceipts,
      receiptFailures: exposedReceiptFailures,
      receiptLoading: exposedReceiptLoading,
      availability,
      commandBlocked,
      pendingHasReceipt: stateMatchesScope && Boolean(pendingRef.current?.observedReceipt),
      canCalculate:
        availability.calculate &&
        Boolean(calculateExecutor) &&
        Boolean(receiptReader) &&
        !commandBlocked,
      canApprove:
        availability.approve &&
        Boolean(approveExecutor) &&
        Boolean(receiptReader) &&
        !commandBlocked,
      canFinalize:
        availability.finalize &&
        Boolean(finalizeExecutor) &&
        Boolean(receiptReader) &&
        !commandBlocked,
      select: (runId: string) => {
        if (!busy && runs.some((run) => run.runId === runId)) setSelectedId(runId);
      },
      refresh: () => setReload((value) => value + 1),
      calculate: (comment?: string) => begin('CALCULATE', comment),
      approve: (comment?: string) => begin('APPROVE', comment),
      finalize: (comment?: string) => begin('FINALIZE', comment),
      retryExact,
      reconcileReceipt,
    }),
    [
      availability,
      begin,
      busy,
      calculateExecutor,
      commandBlocked,
      exposedFeedback,
      exposedReceiptFailures,
      exposedReceiptLoading,
      exposedReceipts,
      exposedState,
      finalizeExecutor,
      partial,
      approveExecutor,
      reconcileReceipt,
      receiptReader,
      retryExact,
      runs,
      selected,
      stale,
      stateMatchesScope,
    ]
  );
}

export type PayrollCalculationCommandCenterController = ReturnType<
  typeof usePayrollCalculationCommandCenter
>;
