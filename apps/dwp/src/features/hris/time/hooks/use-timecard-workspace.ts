import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import { TimecardCommandOutcomeUnknownError, createTimecardDataSource } from '../api/timecard-api';
import {
  assertTimecardOperationScope,
  assertTimecardReceiptBinding,
  assertTimecardReceiptProgression,
  isTimecardUuid,
  parseTimecardCommandRequest,
  timecardCommandAllowed,
} from '../model/timecard-model';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type { TimecardDataSource } from '../api/timecard-api';
import type {
  TimecardCommandRequest,
  TimecardCorrectionCommand,
  TimecardDecisionCommand,
  TimecardOperationScope,
  TimecardSnapshot,
  TimecardSubmitCommand,
  TimeCommandReceipt,
} from '../model/timecard-model';

export type TimecardCommandExecutor = <T>(
  execute: (authority: ProductSurfaceGovernedMutationAuthority) => Promise<T>
) => Promise<T>;

type TimecardActionOwnerBinding<
  TContract extends 'PEP-TIM-012' | 'PEP-TIM-013' | 'PEP-TIM-014',
  TAction extends
    | 'hris.action.tim.timecard.correct'
    | 'hris.action.tim.timecard.submit'
    | 'hris.action.tim.timecard.decide',
  TRoute extends
    | 'route.hcm.time.timecard-correction.action'
    | 'route.hcm.time.timecard-submit.action'
    | 'route.hcm.time.timecard-decision.action',
> = Readonly<{
  contractId: TContract;
  actionKey: TAction;
  routeContractKey: TRoute;
  execute: TimecardCommandExecutor;
}>;

export type TimecardOwnerBinding = Readonly<{
  timecard: Readonly<{
    contractId: 'PEP-TIM-011';
    routeContractKey: 'route.hcm.time.timecard.data';
  }>;
  receipt: Readonly<{
    contractId: 'PEP-TIM-028';
    routeContractKey: 'route.hcm.time.command-receipt.data';
  }>;
  correct?: TimecardActionOwnerBinding<
    'PEP-TIM-012',
    'hris.action.tim.timecard.correct',
    'route.hcm.time.timecard-correction.action'
  >;
  submit?: TimecardActionOwnerBinding<
    'PEP-TIM-013',
    'hris.action.tim.timecard.submit',
    'route.hcm.time.timecard-submit.action'
  >;
  decide?: TimecardActionOwnerBinding<
    'PEP-TIM-014',
    'hris.action.tim.timecard.decide',
    'route.hcm.time.timecard-decision.action'
  >;
}>;

export type TimecardCommandFailureKind =
  'CONFLICT' | 'DENIED' | 'REJECTED' | 'UNKNOWN_OUTCOME' | 'RECEIPT_UNAVAILABLE';

export type TimecardCommandFailure = Readonly<{
  kind: TimecardCommandFailureKind;
  preserveInput: true;
  canRefresh: boolean;
  canRetrySameCommand: boolean;
  canReconcile: boolean;
}>;

export type TimecardPendingCommand = Readonly<{
  request: TimecardCommandRequest;
  snapshot: TimecardSnapshot;
  idempotencyKey: string;
  scopeIdentity: string;
  observedReceipt?: TimeCommandReceipt;
}>;

export type TimecardReadState =
  | Readonly<{ kind: 'CLOSED'; reason: 'SCOPE' | 'OWNER_CONTRACT' }>
  | Readonly<{ kind: 'LOADING' }>
  | Readonly<{ kind: 'ERROR'; reason: 'DENIED' | 'UNAVAILABLE' | 'INVALID' }>
  | Readonly<{
      kind: 'READY';
      snapshot: TimecardSnapshot;
      refreshFailure?: 'DENIED' | 'UNAVAILABLE' | 'INVALID';
    }>;

type TimecardReadRecord = Readonly<{
  identity: string;
  state: TimecardReadState;
}>;

export type TimecardCommandFeedback = Readonly<{
  status: TimeCommandReceipt['status'];
  receipt: TimeCommandReceipt;
}>;

export type UseTimecardWorkspaceOptions = Readonly<{
  timecardId: string;
  scope: TimecardOperationScope;
  ownerBinding?: TimecardOwnerBinding;
  dataSource?: TimecardDataSource;
  idFactory?: () => string;
}>;

const productionDataSource = createTimecardDataSource();

function createCommandId(): string {
  const value = globalThis.crypto?.randomUUID?.();
  if (!value) throw new Error('A secure timecard command identity is unavailable.');
  return value;
}

function exactOwnerBindings(binding: TimecardOwnerBinding | undefined) {
  const read =
    binding?.timecard?.contractId === 'PEP-TIM-011' &&
    binding.timecard.routeContractKey === 'route.hcm.time.timecard.data';
  const receipt =
    binding?.receipt?.contractId === 'PEP-TIM-028' &&
    binding.receipt.routeContractKey === 'route.hcm.time.command-receipt.data';
  const correct =
    binding?.correct?.contractId === 'PEP-TIM-012' &&
    binding.correct.actionKey === 'hris.action.tim.timecard.correct' &&
    binding.correct.routeContractKey === 'route.hcm.time.timecard-correction.action'
      ? binding.correct
      : undefined;
  const submit =
    binding?.submit?.contractId === 'PEP-TIM-013' &&
    binding.submit.actionKey === 'hris.action.tim.timecard.submit' &&
    binding.submit.routeContractKey === 'route.hcm.time.timecard-submit.action'
      ? binding.submit
      : undefined;
  const decide =
    binding?.decide?.contractId === 'PEP-TIM-014' &&
    binding.decide.actionKey === 'hris.action.tim.timecard.decide' &&
    binding.decide.routeContractKey === 'route.hcm.time.timecard-decision.action'
      ? binding.decide
      : undefined;
  return { read, receipt, correct, submit, decide } as const;
}

type TimecardReadError = Extract<TimecardReadState, { kind: 'ERROR' }>;

function readFailure(error: unknown): TimecardReadError {
  if (
    error instanceof HttpError &&
    (error.status === 401 || error.status === 403 || error.status === 404)
  ) {
    return { kind: 'ERROR', reason: 'DENIED' };
  }
  if (error instanceof HttpTransportError || (error instanceof HttpError && error.status >= 500)) {
    return { kind: 'ERROR', reason: 'UNAVAILABLE' };
  }
  return { kind: 'ERROR', reason: 'INVALID' };
}

function commandFailure(error: unknown): TimecardCommandFailure | null {
  if (
    (error instanceof HttpTransportError && error.reason === 'ABORT') ||
    (error instanceof Error && error.name === 'AbortError')
  ) {
    return null;
  }
  if (error instanceof HttpError) {
    if (error.status === 409 || error.status === 412) {
      return {
        kind: 'CONFLICT',
        preserveInput: true,
        canRefresh: true,
        canRetrySameCommand: false,
        canReconcile: false,
      };
    }
    if (error.status === 401 || error.status === 403 || error.status === 404) {
      return {
        kind: 'DENIED',
        preserveInput: true,
        canRefresh: false,
        canRetrySameCommand: false,
        canReconcile: false,
      };
    }
    if (error.status === 400 || error.status === 422) {
      return {
        kind: 'REJECTED',
        preserveInput: true,
        canRefresh: false,
        canRetrySameCommand: false,
        canReconcile: false,
      };
    }
  }
  return {
    kind: 'UNKNOWN_OUTCOME',
    preserveInput: true,
    canRefresh: true,
    canRetrySameCommand: true,
    canReconcile: false,
  };
}

function scopeIdentity(scope: TimecardOperationScope, timecardId: string): string {
  return JSON.stringify([
    scope.ready,
    scope.contextScopeKey,
    scope.decisionRevision,
    scope.actorWorkerId,
    scope.populationKind,
    scope.timecardPurpose,
    scope.receiptPurpose,
    timecardId.toLowerCase(),
  ]);
}

function idempotencyKey(value: string): boolean {
  return value.length >= 16 && value.length <= 128 && value === value.trim();
}

function operationScopeReady(scope: TimecardOperationScope): boolean {
  try {
    assertTimecardOperationScope(scope);
    return true;
  } catch {
    return false;
  }
}

export function useTimecardWorkspace({
  timecardId,
  scope,
  ownerBinding,
  dataSource = productionDataSource,
  idFactory = createCommandId,
}: UseTimecardWorkspaceOptions) {
  const bindings = useMemo(() => exactOwnerBindings(ownerBinding), [ownerBinding]);
  const validScope = operationScopeReady(scope);
  const identity = scopeIdentity(scope, timecardId);
  const currentIdentityRef = useRef(identity);
  currentIdentityRef.current = identity;
  const mountedRef = useRef(true);
  const commandBusyRef = useRef(false);
  const pendingRef = useRef<TimecardPendingCommand | null>(null);
  const commandAbortRef = useRef<AbortController | null>(null);
  const [reloadRevision, setReloadRevision] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [readRecord, setReadRecord] = useState<TimecardReadRecord>(() => ({
    identity,
    state:
      !validScope || !isTimecardUuid(timecardId)
        ? { kind: 'CLOSED', reason: 'SCOPE' }
        : !bindings.read || !bindings.receipt
          ? { kind: 'CLOSED', reason: 'OWNER_CONTRACT' }
          : { kind: 'LOADING' },
  }));
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<TimecardPendingCommand | null>(null);
  const [failure, setFailure] = useState<TimecardCommandFailure | null>(null);
  const [feedback, setFeedback] = useState<TimecardCommandFeedback | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      commandAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    commandAbortRef.current?.abort();
    commandAbortRef.current = null;
    commandBusyRef.current = false;
    pendingRef.current = null;
    setBusy(false);
    setPending(null);
    setFailure(null);
    setFeedback(null);
    setRefreshing(false);
  }, [identity]);

  useEffect(() => {
    if (!validScope || !isTimecardUuid(timecardId)) {
      setRefreshing(false);
      setReadRecord({ identity, state: { kind: 'CLOSED', reason: 'SCOPE' } });
      return;
    }
    if (!bindings.read || !bindings.receipt) {
      setRefreshing(false);
      setReadRecord({ identity, state: { kind: 'CLOSED', reason: 'OWNER_CONTRACT' } });
      return;
    }
    const requestIdentity = identity;
    const abort = new AbortController();
    setReadRecord((current) => ({
      identity: requestIdentity,
      state:
        current.identity === requestIdentity && current.state.kind === 'READY'
          ? { kind: 'READY', snapshot: current.state.snapshot }
          : { kind: 'LOADING' },
    }));
    setRefreshing(true);
    void dataSource
      .read(timecardId, scope, abort.signal)
      .then((snapshot) => {
        if (
          abort.signal.aborted ||
          !mountedRef.current ||
          currentIdentityRef.current !== requestIdentity
        ) {
          return;
        }
        setReadRecord({
          identity: requestIdentity,
          state: { kind: 'READY', snapshot },
        });
        setFailure((current) =>
          current?.kind === 'CONFLICT' || current?.kind === 'REJECTED' ? null : current
        );
      })
      .catch((error: unknown) => {
        if (
          abort.signal.aborted ||
          !mountedRef.current ||
          currentIdentityRef.current !== requestIdentity
        ) {
          return;
        }
        const nextFailure = readFailure(error);
        setReadRecord((current) => ({
          identity: requestIdentity,
          state:
            nextFailure.reason !== 'DENIED' &&
            current.identity === requestIdentity &&
            current.state.kind === 'READY'
              ? {
                  kind: 'READY',
                  snapshot: current.state.snapshot,
                  refreshFailure: nextFailure.reason,
                }
              : nextFailure,
        }));
      })
      .finally(() => {
        if (
          !abort.signal.aborted &&
          mountedRef.current &&
          currentIdentityRef.current === requestIdentity
        ) {
          setRefreshing(false);
        }
      });
    return () => abort.abort();
  }, [
    bindings.read,
    bindings.receipt,
    dataSource,
    identity,
    reloadRevision,
    scope,
    timecardId,
    validScope,
  ]);

  const readState: TimecardReadState =
    !validScope || !isTimecardUuid(timecardId)
      ? { kind: 'CLOSED', reason: 'SCOPE' }
      : !bindings.read || !bindings.receipt
        ? { kind: 'CLOSED', reason: 'OWNER_CONTRACT' }
        : readRecord.identity === identity
          ? readRecord.state
          : { kind: 'LOADING' };
  const snapshot = readState.kind === 'READY' ? readState.snapshot : null;
  const refreshFailed = readState.kind === 'READY' && readState.refreshFailure !== undefined;
  const conflictRefreshRequired = failure?.kind === 'CONFLICT';

  const settleReceipt = useCallback(
    (command: TimecardPendingCommand, receipt: TimeCommandReceipt) => {
      assertTimecardReceiptBinding(
        receipt,
        command.request.kind,
        command.snapshot.timecard.timecardId
      );
      if (command.observedReceipt) {
        assertTimecardReceiptProgression(command.observedReceipt, receipt);
      }
      setFeedback({ status: receipt.status, receipt });
      if (receipt.status === 'SUCCEEDED') {
        pendingRef.current = null;
        setPending(null);
        setFailure(null);
        setReloadRevision((value) => value + 1);
        return;
      }
      if (receipt.status === 'REJECTED' || receipt.status === 'FAILED') {
        pendingRef.current = null;
        setPending(null);
        setFailure({
          kind: 'REJECTED',
          preserveInput: true,
          canRefresh: true,
          canRetrySameCommand: false,
          canReconcile: false,
        });
        return;
      }
      const next = Object.freeze({ ...command, observedReceipt: receipt });
      pendingRef.current = next;
      setPending(next);
      setFailure(
        receipt.status === 'RESULT_UNKNOWN'
          ? {
              kind: 'UNKNOWN_OUTCOME',
              preserveInput: true,
              canRefresh: true,
              canRetrySameCommand: true,
              canReconcile: true,
            }
          : null
      );
    },
    []
  );

  const executeCommand = useCallback(
    async (command: TimecardPendingCommand) => {
      if (
        commandBusyRef.current ||
        refreshing ||
        currentIdentityRef.current !== command.scopeIdentity ||
        !validScope
      ) {
        return;
      }
      const binding =
        command.request.kind === 'CORRECT'
          ? bindings.correct
          : command.request.kind === 'SUBMIT'
            ? bindings.submit
            : bindings.decide;
      if (!binding) {
        setFailure({
          kind: 'DENIED',
          preserveInput: true,
          canRefresh: false,
          canRetrySameCommand: false,
          canReconcile: false,
        });
        return;
      }
      commandBusyRef.current = true;
      commandAbortRef.current?.abort();
      const abort = new AbortController();
      commandAbortRef.current = abort;
      pendingRef.current = command;
      setPending(command);
      setBusy(true);
      setFailure(null);
      setFeedback(null);
      try {
        const receipt = await binding.execute((authority) => {
          if (command.request.kind === 'CORRECT') {
            return dataSource.correct(
              command.snapshot,
              command.request.body,
              command.idempotencyKey,
              scope,
              authority,
              abort.signal
            );
          }
          if (command.request.kind === 'SUBMIT') {
            return dataSource.submit(
              command.snapshot,
              command.request.body,
              command.idempotencyKey,
              scope,
              authority,
              abort.signal
            );
          }
          return dataSource.decide(
            command.snapshot,
            command.request.body,
            command.idempotencyKey,
            scope,
            authority,
            abort.signal
          );
        });
        if (
          abort.signal.aborted ||
          !mountedRef.current ||
          currentIdentityRef.current !== command.scopeIdentity
        ) {
          return;
        }
        settleReceipt(command, receipt);
      } catch (error) {
        if (
          abort.signal.aborted ||
          !mountedRef.current ||
          currentIdentityRef.current !== command.scopeIdentity
        ) {
          return;
        }
        const nextFailure = commandFailure(error);
        if (!nextFailure) return;
        const outcomeUnknown =
          nextFailure.kind === 'UNKNOWN_OUTCOME' ||
          error instanceof TimecardCommandOutcomeUnknownError;
        const normalized = outcomeUnknown
          ? { ...nextFailure, kind: 'UNKNOWN_OUTCOME' as const }
          : nextFailure;
        setFailure(normalized);
        if (!normalized.canRetrySameCommand) {
          pendingRef.current = null;
          setPending(null);
        }
      } finally {
        if (
          mountedRef.current &&
          currentIdentityRef.current === command.scopeIdentity &&
          commandAbortRef.current === abort
        ) {
          commandBusyRef.current = false;
          commandAbortRef.current = null;
          setBusy(false);
        }
      }
    },
    [
      bindings.correct,
      bindings.decide,
      bindings.submit,
      dataSource,
      refreshing,
      scope,
      settleReceipt,
      validScope,
    ]
  );

  const start = useCallback(
    (request: TimecardCommandRequest) => {
      if (
        !snapshot ||
        refreshFailed ||
        conflictRefreshRequired ||
        busy ||
        refreshing ||
        pendingRef.current ||
        (request.kind === 'CORRECT' && !bindings.correct) ||
        (request.kind === 'SUBMIT' && !bindings.submit) ||
        (request.kind === 'DECIDE' && !bindings.decide) ||
        !timecardCommandAllowed(request.kind, snapshot.timecard, scope)
      ) {
        return false;
      }
      try {
        const canonicalRequest = parseTimecardCommandRequest(request, snapshot.timecard);
        const commandId = idFactory();
        if (!idempotencyKey(commandId)) throw new Error('Invalid timecard idempotency key.');
        const command: TimecardPendingCommand = Object.freeze({
          request: canonicalRequest,
          snapshot,
          idempotencyKey: commandId,
          scopeIdentity: identity,
        });
        void executeCommand(command);
        return true;
      } catch {
        setFailure({
          kind: 'REJECTED',
          preserveInput: true,
          canRefresh: false,
          canRetrySameCommand: false,
          canReconcile: false,
        });
        return false;
      }
    },
    [
      bindings.correct,
      bindings.decide,
      bindings.submit,
      busy,
      conflictRefreshRequired,
      executeCommand,
      idFactory,
      identity,
      refreshing,
      refreshFailed,
      scope,
      snapshot,
    ]
  );

  const retrySameCommand = useCallback(() => {
    const command = pendingRef.current;
    if (!command || busy || refreshing || !failure?.canRetrySameCommand) return;
    void executeCommand(command);
  }, [busy, executeCommand, failure?.canRetrySameCommand, refreshing]);

  const reconcileReceipt = useCallback(async () => {
    const command = pendingRef.current;
    const receipt = command?.observedReceipt;
    if (!command || !receipt || busy || refreshing || !bindings.receipt) {
      setFailure({
        kind: 'RECEIPT_UNAVAILABLE',
        preserveInput: true,
        canRefresh: true,
        canRetrySameCommand: Boolean(command),
        canReconcile: false,
      });
      return;
    }
    commandBusyRef.current = true;
    commandAbortRef.current?.abort();
    const abort = new AbortController();
    commandAbortRef.current = abort;
    setBusy(true);
    try {
      const next = await dataSource.receipt(receipt.receiptId, scope, abort.signal);
      if (
        abort.signal.aborted ||
        !mountedRef.current ||
        currentIdentityRef.current !== command.scopeIdentity
      ) {
        return;
      }
      settleReceipt(command, next);
    } catch {
      if (!abort.signal.aborted && mountedRef.current) {
        setFailure({
          kind: 'RECEIPT_UNAVAILABLE',
          preserveInput: true,
          canRefresh: true,
          canRetrySameCommand: true,
          canReconcile: true,
        });
      }
    } finally {
      if (mountedRef.current && commandAbortRef.current === abort) {
        commandBusyRef.current = false;
        commandAbortRef.current = null;
        setBusy(false);
      }
    }
  }, [bindings.receipt, busy, dataSource, refreshing, scope, settleReceipt]);

  const refresh = useCallback(() => {
    if (busy || refreshing) return;
    if (failure?.kind === 'REJECTED') {
      setFailure(null);
    }
    setReloadRevision((value) => value + 1);
  }, [busy, failure?.kind, refreshing]);

  const actions = useMemo(
    () => ({
      correct: Boolean(
        !refreshFailed &&
        !conflictRefreshRequired &&
        bindings.correct &&
        snapshot &&
        timecardCommandAllowed('CORRECT', snapshot.timecard, scope)
      ),
      submit: Boolean(
        !refreshFailed &&
        !conflictRefreshRequired &&
        bindings.submit &&
        snapshot &&
        timecardCommandAllowed('SUBMIT', snapshot.timecard, scope)
      ),
      decide: Boolean(
        !refreshFailed &&
        !conflictRefreshRequired &&
        bindings.decide &&
        snapshot &&
        timecardCommandAllowed('DECIDE', snapshot.timecard, scope)
      ),
    }),
    [
      bindings.correct,
      bindings.decide,
      bindings.submit,
      conflictRefreshRequired,
      refreshFailed,
      scope,
      snapshot,
    ]
  );

  return {
    readState,
    snapshot,
    actions,
    refreshing,
    busy,
    pending,
    failure,
    feedback,
    refresh,
    correct: (body: TimecardCorrectionCommand) => start({ kind: 'CORRECT', body }),
    submit: (body: TimecardSubmitCommand) => start({ kind: 'SUBMIT', body }),
    decide: (body: TimecardDecisionCommand) => start({ kind: 'DECIDE', body }),
    retrySameCommand,
    reconcileReceipt,
  } as const;
}
