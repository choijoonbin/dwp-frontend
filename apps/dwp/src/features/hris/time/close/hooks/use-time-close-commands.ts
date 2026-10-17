import { useCallback, useEffect, useRef, useState } from 'react';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import { TimeCloseCommandOutcomeUnknownError } from '../api/time-close-api';
import {
  assertTimeCloseReceiptBinding,
  assertTimeCloseReceiptProgression,
  assertTimeCloseReceiptReplayInvariant,
  timeCloseCommandAllowed,
} from '../model/time-close-model';

import type {
  PayrollTimeHandoffCommand,
  TimeCloseCommand,
  TimeCloseDataSource,
  TimeClosePeriodSnapshot,
  TimeCloseValidationCommand,
  TimeReopenCommand,
} from '../api/time-close-api';
import type {
  TimeCloseCommandKind,
  TimeCloseCommandReceipt,
  TimeClosePeriod,
  TimeCloseScope,
} from '../model/time-close-model';
import type {
  ProductSurfaceGovernedMutationAuthority,
  ProductSurfaceSecureMutationAuthority,
} from '@dwp-frontend/shared-utils';

export type TimeCloseDialogMode = TimeCloseCommandKind | null;

export type TimeCloseCommandBinding = Readonly<{
  kind: TimeCloseCommandKind;
  periodId: string;
  expectedVersion: number;
  idempotencyKey: string;
  request: unknown;
}>;

export type TimeCloseCommandAuthorityExecutor = <T>(
  execute: (authority: ProductSurfaceGovernedMutationAuthority) => Promise<T>,
  binding: TimeCloseCommandBinding
) => Promise<T>;

export type TimeCloseCommandOwnerBinding = Readonly<{
  validate?: Readonly<{
    routeContractKey: 'route.hcm.operations.time-close-validate.action';
    execute: TimeCloseCommandAuthorityExecutor;
  }>;
  close?: Readonly<{
    routeContractKey: 'route.hcm.operations.time-close.action';
    execute: TimeCloseCommandAuthorityExecutor;
  }>;
  reopen?: Readonly<{
    routeContractKey: 'route.hcm.operations.time-reopen.action';
    execute: TimeCloseCommandAuthorityExecutor;
  }>;
  handoff?: Readonly<{
    routeContractKey: 'route.hcm.operations.time-payroll-handoff-create.action';
    execute: TimeCloseCommandAuthorityExecutor;
  }>;
  receipt?: Readonly<{
    routeContractKey: 'route.hcm.time.command-receipt.data';
  }>;
}>;

export type TimeCloseCommandFeedback =
  | Readonly<{ kind: 'RECEIPT'; receipt: TimeCloseCommandReceipt }>
  | Readonly<{ kind: 'REJECTED'; preserveInput: true }>
  | Readonly<{ kind: 'DENIED'; preserveInput: false }>
  | Readonly<{ kind: 'CONFLICT'; preserveInput: true; refreshRequired: true }>
  | Readonly<{
      kind: 'RESULT_UNKNOWN';
      preserveInput: true;
      retryExact: true;
      canReconcile: boolean;
      receipt?: TimeCloseCommandReceipt;
    }>
  | null;

type PendingCommand = Readonly<{
  kind: TimeCloseCommandKind;
  identity: string;
  snapshot: TimeClosePeriodSnapshot;
  idempotencyKey: string;
  request:
    TimeCloseValidationCommand | TimeCloseCommand | TimeReopenCommand | PayrollTimeHandoffCommand;
  replayReceipt?: TimeCloseCommandReceipt;
  observedReceipt?: TimeCloseCommandReceipt;
  recoveryReceiptId?: string;
}>;

function secureCommandAuthority(
  authority: ProductSurfaceGovernedMutationAuthority,
  command: PendingCommand
): ProductSurfaceSecureMutationAuthority {
  if (authority.mode !== 'SECURE') throw new Error('Secure TIM close authority is required.');
  if (
    (authority.idempotencyKey !== undefined &&
      authority.idempotencyKey !== command.idempotencyKey) ||
    (authority.objectVersion !== undefined && authority.objectVersion !== command.snapshot.version)
  ) {
    throw new Error('TIM close authority changed the immutable command binding.');
  }
  return {
    ...authority,
    idempotencyKey: command.idempotencyKey,
    objectVersion: command.snapshot.version,
  };
}

function isAmbiguous(error: unknown): boolean {
  return (
    error instanceof TimeCloseCommandOutcomeUnknownError ||
    error instanceof HttpTransportError ||
    (error instanceof HttpError &&
      (error.status === 408 || error.status === 429 || error.status >= 500))
  );
}

function newCommandId(): string {
  const value = globalThis.crypto?.randomUUID?.();
  if (!value) throw new Error('Secure TIM close command identity generation is unavailable.');
  return value;
}

function commandBinding(
  owner: TimeCloseCommandOwnerBinding | undefined,
  kind: TimeCloseCommandKind
) {
  const candidate = {
    VALIDATE: owner?.validate,
    CLOSE: owner?.close,
    REOPEN: owner?.reopen,
    HANDOFF: owner?.handoff,
  }[kind];
  const expected = {
    VALIDATE: 'route.hcm.operations.time-close-validate.action',
    CLOSE: 'route.hcm.operations.time-close.action',
    REOPEN: 'route.hcm.operations.time-reopen.action',
    HANDOFF: 'route.hcm.operations.time-payroll-handoff-create.action',
  }[kind];
  return candidate?.routeContractKey === expected ? candidate : undefined;
}

export function useTimeCloseCommands({
  dataSource,
  owner,
  scope,
  period,
  scopeIdentity,
  readSuccessRevision,
  commandAuthorityCurrent,
  reload,
  onDenied,
  idFactory = newCommandId,
}: Readonly<{
  dataSource: TimeCloseDataSource;
  owner?: TimeCloseCommandOwnerBinding;
  scope: TimeCloseScope;
  period: TimeClosePeriod | null;
  scopeIdentity: string;
  readSuccessRevision: number;
  commandAuthorityCurrent: boolean;
  reload: () => void;
  onDenied: () => void;
  idFactory?: () => string;
}>) {
  const identity = `${scopeIdentity}:${period?.periodId ?? 'none'}`;
  const identityRef = useRef(identity);
  const commandAbortRef = useRef<AbortController | null>(null);
  const pendingRef = useRef<PendingCommand | null>(null);
  const busyRef = useRef(false);
  const commandAuthorityCurrentRef = useRef(commandAuthorityCurrent);
  commandAuthorityCurrentRef.current = commandAuthorityCurrent;
  const [dialogRecord, setDialogRecord] = useState<
    Readonly<{ identity: string; mode: TimeCloseDialogMode }>
  >({ identity, mode: null });
  const [feedbackRecord, setFeedbackRecord] = useState<
    Readonly<{ identity: string; feedback: TimeCloseCommandFeedback }>
  >({ identity, feedback: null });
  const [busyRecord, setBusyRecord] = useState<Readonly<{ identity: string; busy: boolean }>>({
    identity,
    busy: false,
  });
  const [refreshRequiredRecord, setRefreshRequiredRecord] = useState<
    Readonly<{ identity: string; required: boolean; afterRevision: number }>
  >({ identity, required: false, afterRevision: readSuccessRevision });

  if (identityRef.current !== identity) {
    identityRef.current = identity;
    commandAbortRef.current?.abort();
    commandAbortRef.current = null;
    pendingRef.current = null;
    busyRef.current = false;
  }

  const current = (recordIdentity: string) => recordIdentity === identity;
  const mode = current(dialogRecord.identity) ? dialogRecord.mode : null;
  const feedback = current(feedbackRecord.identity) ? feedbackRecord.feedback : null;
  const busy = current(busyRecord.identity) ? busyRecord.busy : false;
  const refreshRequired = current(refreshRequiredRecord.identity)
    ? refreshRequiredRecord.required
    : false;

  useEffect(() => {
    setDialogRecord({ identity, mode: null });
    setFeedbackRecord({ identity, feedback: null });
    setBusyRecord({ identity, busy: false });
    setRefreshRequiredRecord({ identity, required: false, afterRevision: 0 });
  }, [identity]);

  useEffect(
    () => () => {
      commandAbortRef.current?.abort();
    },
    []
  );

  const open = useCallback(
    (kind: TimeCloseCommandKind) => {
      if (
        busyRef.current ||
        refreshRequired ||
        !commandAuthorityCurrent ||
        !period ||
        !commandBinding(owner, kind) ||
        !timeCloseCommandAllowed(period, kind)
      ) {
        return;
      }
      setFeedbackRecord({ identity, feedback: null });
      setDialogRecord({ identity, mode: kind });
    },
    [commandAuthorityCurrent, identity, owner, period, refreshRequired]
  );

  const closeDialog = useCallback(() => {
    if (!busyRef.current) setDialogRecord({ identity, mode: null });
  }, [identity]);

  const executePending = useCallback(
    async (pending: PendingCommand) => {
      const binding = commandBinding(owner, pending.kind);
      if (
        !binding ||
        pending.identity !== identityRef.current ||
        !commandAuthorityCurrentRef.current
      ) {
        return;
      }
      const abort = new AbortController();
      commandAbortRef.current = abort;
      busyRef.current = true;
      setBusyRecord({ identity: pending.identity, busy: true });
      try {
        const receipt = await binding.execute(
          (authority) => {
            if (!commandAuthorityCurrentRef.current) {
              throw new Error('Current TIM close projection authority is required.');
            }
            const secured = secureCommandAuthority(authority, pending);
            if (pending.kind === 'VALIDATE') {
              return dataSource.validate(
                pending.snapshot,
                pending.request as TimeCloseValidationCommand,
                pending.idempotencyKey,
                scope,
                secured,
                abort.signal
              );
            }
            if (pending.kind === 'CLOSE') {
              return dataSource.close(
                pending.snapshot,
                pending.request as TimeCloseCommand,
                pending.idempotencyKey,
                scope,
                secured,
                abort.signal
              );
            }
            if (pending.kind === 'REOPEN') {
              return dataSource.reopen(
                pending.snapshot,
                pending.request as TimeReopenCommand,
                pending.idempotencyKey,
                scope,
                secured,
                abort.signal
              );
            }
            return dataSource.createHandoff(
              pending.snapshot,
              pending.request as PayrollTimeHandoffCommand,
              pending.idempotencyKey,
              scope,
              secured,
              abort.signal
            );
          },
          {
            kind: pending.kind,
            periodId: pending.snapshot.periodId,
            expectedVersion: pending.snapshot.version,
            idempotencyKey: pending.idempotencyKey,
            request: pending.request,
          }
        );
        if (abort.signal.aborted || pending.identity !== identityRef.current) return;
        assertTimeCloseReceiptBinding(pending.kind, receipt, scope.correlationId);
        if (pending.replayReceipt) {
          assertTimeCloseReceiptReplayInvariant(pending.replayReceipt, receipt);
        }
        const observedReceipt = pending.observedReceipt ?? receipt;
        const observed = {
          ...pending,
          replayReceipt: pending.replayReceipt ?? receipt,
          observedReceipt,
        };
        pendingRef.current = observed;
        setFeedbackRecord({
          identity: pending.identity,
          feedback:
            receipt.status === 'RESULT_UNKNOWN'
              ? {
                  kind: 'RESULT_UNKNOWN',
                  preserveInput: true,
                  retryExact: true,
                  canReconcile: Boolean(owner?.receipt),
                  receipt: observedReceipt,
                }
              : { kind: 'RECEIPT', receipt: observedReceipt },
        });
        if (receipt.status === 'SUCCEEDED') {
          setDialogRecord({ identity: pending.identity, mode: null });
          reload();
        }
      } catch (error) {
        if (abort.signal.aborted || pending.identity !== identityRef.current) return;
        if (error instanceof HttpError && (error.status === 409 || error.status === 412)) {
          setRefreshRequiredRecord({
            identity: pending.identity,
            required: true,
            afterRevision: readSuccessRevision,
          });
          setFeedbackRecord({
            identity: pending.identity,
            feedback: { kind: 'CONFLICT', preserveInput: true, refreshRequired: true },
          });
        } else if (
          error instanceof HttpError &&
          (error.status === 401 || error.status === 403 || error.status === 404)
        ) {
          pendingRef.current = null;
          setDialogRecord({ identity: pending.identity, mode: null });
          onDenied();
          setFeedbackRecord({
            identity: pending.identity,
            feedback: { kind: 'DENIED', preserveInput: false },
          });
        } else if (isAmbiguous(error)) {
          const recoveryReceiptId =
            error instanceof TimeCloseCommandOutcomeUnknownError ? error.receiptId : undefined;
          const recoverable = {
            ...pending,
            ...(recoveryReceiptId ? { recoveryReceiptId } : {}),
          };
          pendingRef.current = recoverable;
          setFeedbackRecord({
            identity: pending.identity,
            feedback: {
              kind: 'RESULT_UNKNOWN',
              preserveInput: true,
              retryExact: true,
              canReconcile: Boolean(
                (pending.observedReceipt || recoveryReceiptId) && owner?.receipt
              ),
              ...(pending.observedReceipt ? { receipt: pending.observedReceipt } : {}),
            },
          });
        } else {
          setFeedbackRecord({
            identity: pending.identity,
            feedback: { kind: 'REJECTED', preserveInput: true },
          });
        }
      } finally {
        if (commandAbortRef.current === abort) commandAbortRef.current = null;
        if (pending.identity === identityRef.current) {
          busyRef.current = false;
          setBusyRecord({ identity: pending.identity, busy: false });
        }
      }
    },
    [dataSource, onDenied, owner, readSuccessRevision, reload, scope]
  );

  const submit = useCallback(
    (
      kind: TimeCloseCommandKind,
      request:
        | TimeCloseValidationCommand
        | TimeCloseCommand
        | TimeReopenCommand
        | PayrollTimeHandoffCommand
    ) => {
      if (
        busyRef.current ||
        refreshRequired ||
        !commandAuthorityCurrent ||
        !period ||
        period.version === null ||
        !commandBinding(owner, kind) ||
        !timeCloseCommandAllowed(period, kind)
      ) {
        return Promise.resolve();
      }
      let idempotencyKey: string;
      try {
        idempotencyKey = idFactory();
      } catch {
        setFeedbackRecord({ identity, feedback: { kind: 'REJECTED', preserveInput: true } });
        return Promise.resolve();
      }
      if (idempotencyKey.length < 16 || idempotencyKey.length > 128) {
        setFeedbackRecord({ identity, feedback: { kind: 'REJECTED', preserveInput: true } });
        return Promise.resolve();
      }
      const pending: PendingCommand = {
        kind,
        identity,
        snapshot: { periodId: period.periodId, version: period.version },
        idempotencyKey,
        request,
      };
      pendingRef.current = pending;
      return executePending(pending);
    },
    [commandAuthorityCurrent, executePending, idFactory, identity, owner, period, refreshRequired]
  );

  const retryExact = useCallback(() => {
    const pending = pendingRef.current;
    if (
      !pending ||
      pending.identity !== identity ||
      busyRef.current ||
      refreshRequired ||
      !commandAuthorityCurrent
    ) {
      return Promise.resolve();
    }
    return executePending(pending);
  }, [commandAuthorityCurrent, executePending, identity, refreshRequired]);

  const reconcile = useCallback(async () => {
    const pending = pendingRef.current;
    if (
      !(pending?.observedReceipt || pending?.recoveryReceiptId) ||
      pending.identity !== identity ||
      owner?.receipt?.routeContractKey !== 'route.hcm.time.command-receipt.data' ||
      busyRef.current
    ) {
      return;
    }
    const abort = new AbortController();
    commandAbortRef.current = abort;
    busyRef.current = true;
    setBusyRecord({ identity, busy: true });
    try {
      const receipt = await dataSource.readReceipt(
        pending.observedReceipt?.receiptId ?? (pending.recoveryReceiptId as string),
        scope,
        abort.signal
      );
      if (abort.signal.aborted || identityRef.current !== identity) return;
      assertTimeCloseReceiptBinding(pending.kind, receipt, scope.correlationId);
      if (pending.observedReceipt) {
        assertTimeCloseReceiptProgression(pending.observedReceipt, receipt);
      }
      pendingRef.current = { ...pending, observedReceipt: receipt };
      setFeedbackRecord({
        identity,
        feedback:
          receipt.status === 'RESULT_UNKNOWN'
            ? {
                kind: 'RESULT_UNKNOWN',
                preserveInput: true,
                retryExact: true,
                canReconcile: true,
                receipt,
              }
            : { kind: 'RECEIPT', receipt },
      });
      if (receipt.status === 'SUCCEEDED') {
        setDialogRecord({ identity, mode: null });
        reload();
      }
    } catch (error) {
      if (
        !abort.signal.aborted &&
        identityRef.current === identity &&
        error instanceof HttpError &&
        (error.status === 401 || error.status === 403 || error.status === 404)
      ) {
        pendingRef.current = null;
        setDialogRecord({ identity, mode: null });
        onDenied();
        setFeedbackRecord({
          identity,
          feedback: { kind: 'DENIED', preserveInput: false },
        });
      } else if (!abort.signal.aborted && identityRef.current === identity) {
        setFeedbackRecord({
          identity,
          feedback: {
            kind: 'RESULT_UNKNOWN',
            preserveInput: true,
            retryExact: true,
            canReconcile: true,
            ...(pending.observedReceipt ? { receipt: pending.observedReceipt } : {}),
          },
        });
      }
    } finally {
      if (commandAbortRef.current === abort) commandAbortRef.current = null;
      if (identityRef.current === identity) {
        busyRef.current = false;
        setBusyRecord({ identity, busy: false });
      }
    }
  }, [dataSource, identity, onDenied, owner?.receipt?.routeContractKey, reload, scope]);

  const acceptSuccessfulRefresh = useCallback(
    (successRevision: number) => {
      const pending = pendingRef.current;
      if (
        !refreshRequired ||
        !pending ||
        pending.identity !== identity ||
        successRevision <= refreshRequiredRecord.afterRevision
      ) {
        return;
      }
      pendingRef.current = null;
      setRefreshRequiredRecord({ identity, required: false, afterRevision: successRevision });
      setFeedbackRecord({ identity, feedback: null });
    },
    [identity, refreshRequired, refreshRequiredRecord.afterRevision]
  );

  return {
    mode,
    feedback,
    busy,
    refreshRequired,
    commandDisabled: busy || refreshRequired || !commandAuthorityCurrent,
    open,
    closeDialog,
    submit,
    retryExact,
    reconcile,
    acceptSuccessfulRefresh,
  } as const;
}
