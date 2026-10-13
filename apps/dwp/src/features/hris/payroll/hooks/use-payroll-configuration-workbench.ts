import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import { payrollElementFormulaDataSource } from '../api/payroll-element-formula-api';
import {
  payrollWorkbenchCanPublish,
  type PayrollConfigurationWorkbench,
  type PayrollWorkbenchItem,
} from '../model/payroll-configuration-workbench-model';
import { validateSimulationCommand } from '../model/payroll-element-formula-model';

import type {
  PayrollElementFormulaDataSource,
  PayrollFormulaCommandAuthority,
  PayrollFormulaVersionCommand,
} from '../api/payroll-element-formula-api';
import type {
  PayrollFormulaReceipt,
  SimulatePayrollFormula,
} from '../model/payroll-element-formula-model';
import type { ProductSurfaceHighRiskCommandDescriptor } from '../../../../components/product-surface-high-risk-command';
import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';

export type PayrollConfigurationScope = Readonly<{
  ready: boolean;
  contextScopeKey: string;
  decisionRevision: string;
  locale: string;
  timeZone: string;
  correlationId: string;
}>;

export type PayrollFormulaCommandKind = 'VALIDATE' | 'SIMULATE' | 'PUBLISH';

export type PayrollFormulaCommandBinding = Readonly<{
  kind: PayrollFormulaCommandKind;
  formulaId: string;
  expectedVersion: number;
  idempotencyKey: string;
  correlationId: string;
  request: PayrollFormulaVersionCommand | SimulatePayrollFormula;
}>;

export type PayrollFormulaCommandExecutor = <T>(
  execute: (
    authority: ProductSurfaceGovernedMutationAuthority,
    command?: ProductSurfaceHighRiskCommandDescriptor
  ) => Promise<T>,
  binding: PayrollFormulaCommandBinding
) => Promise<T>;

export type PayrollConfigurationOwnerBinding = Readonly<{
  page?: Readonly<{
    contractId: 'IAQ-055';
    read: PayrollElementFormulaDataSource['workbench'];
  }>;
  validate?: Readonly<{
    contractId: 'PEP-PAY-006';
    execute: PayrollFormulaCommandExecutor;
  }>;
  simulate?: Readonly<{
    contractId: 'PEP-PAY-007';
    execute: PayrollFormulaCommandExecutor;
  }>;
  publish?: Readonly<{
    contractId: 'PEP-PAY-008';
    execute: PayrollFormulaCommandExecutor;
  }>;
}>;

export type PayrollSimulationDraft = Readonly<{
  inputKey: string;
  value: string;
  currency: string;
}>;

export type PayrollConfigurationCommandFeedback =
  | Readonly<{ kind: 'SUCCEEDED'; receipt: PayrollFormulaReceipt }>
  | Readonly<{ kind: 'STEP_UP'; command: 'PUBLISH' }>
  | Readonly<{ kind: 'RESULT_UNKNOWN'; command: PayrollFormulaCommandKind }>
  | Readonly<{ kind: 'PERMISSION'; command: PayrollFormulaCommandKind }>
  | Readonly<{ kind: 'CONFLICT'; command: PayrollFormulaCommandKind }>
  | Readonly<{ kind: 'REJECTED'; command: PayrollFormulaCommandKind }>
  | Readonly<{ kind: 'INPUT_INVALID'; errors: readonly string[] }>;

export type PayrollConfigurationRuntimeState =
  | Readonly<{ kind: 'CLOSED' | 'LOADING' | 'ERROR' | 'DENIED'; scopeIdentity: string }>
  | Readonly<{
      kind: 'READY';
      scopeIdentity: string;
      workbench: PayrollConfigurationWorkbench;
    }>;

type PendingCommand = PayrollFormulaCommandBinding &
  Readonly<{
    scopeIdentity: string;
    hasDispatched?: true;
    observedReceipt?: PayrollFormulaReceipt;
  }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const INPUT_KEY = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;

class PayrollFormulaReceiptBindingError extends Error {
  constructor() {
    super('The replay receipt does not match the preserved payroll command.');
    this.name = 'PayrollFormulaReceiptBindingError';
  }
}

class PayrollFormulaRetryRotationError extends Error {
  constructor() {
    super('An already-dispatched payroll command cannot rotate its idempotency key.');
    this.name = 'PayrollFormulaRetryRotationError';
  }
}

function createCommandId() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Secure payroll command identity generation is unavailable.');
  }
  return globalThis.crypto.randomUUID();
}

export function payrollFormulaId(item: PayrollWorkbenchItem | null | undefined): string | null {
  const value = item?.itemPublicId.startsWith('formula:')
    ? item.itemPublicId.slice('formula:'.length)
    : '';
  return UUID.test(value) ? value : null;
}

export function payrollFormulaVersion(
  item: PayrollWorkbenchItem | null | undefined
): number | null {
  const decision = item?.fieldGroups.POLICY_VERSION;
  if (!decision || decision.decision !== 'VIEW' || !('policyKey' in decision.value)) return null;
  return decision.value.revision;
}

function exactOwnerCommand(
  ownerBinding: PayrollConfigurationOwnerBinding | undefined,
  kind: PayrollFormulaCommandKind
) {
  if (kind === 'VALIDATE' && ownerBinding?.validate?.contractId === 'PEP-PAY-006') {
    return ownerBinding.validate.execute;
  }
  if (kind === 'SIMULATE' && ownerBinding?.simulate?.contractId === 'PEP-PAY-007') {
    return ownerBinding.simulate.execute;
  }
  if (kind === 'PUBLISH' && ownerBinding?.publish?.contractId === 'PEP-PAY-008') {
    return ownerBinding.publish.execute;
  }
  return undefined;
}

/**
 * A challenge may rotate its key before the first dispatch. Accept that key only from the exact
 * immutable payroll-formula descriptor; an ambiguous retry then carries this already-dispatched
 * binding forward and cannot create a new command identity.
 */
function bindPayrollFormulaDispatchCommand(
  command: PendingCommand,
  descriptor?: ProductSurfaceHighRiskCommandDescriptor
): PendingCommand {
  if (!descriptor) {
    if (command.kind === 'PUBLISH') {
      throw new Error('Payroll formula publication requires its exact command descriptor.');
    }
    return command;
  }
  const expectedPath = `/api/payroll/v1/formulas/${encodeURIComponent(command.formulaId)}/publish`;
  const payloadKeys = Object.keys(descriptor.payload);
  if (
    command.kind !== 'PUBLISH' ||
    descriptor.operation !== 'HCM_PAYROLL_FORMULA_PUBLISH' ||
    descriptor.commandMethod !== 'POST' ||
    descriptor.commandPath !== expectedPath ||
    descriptor.targetType !== 'PAYROLL_FORMULA' ||
    descriptor.targetId !== command.formulaId ||
    descriptor.expectedObjectVersion !== command.expectedVersion ||
    payloadKeys.length !== 1 ||
    descriptor.payload.expectedVersion !== command.expectedVersion ||
    !descriptor.idempotencyKey ||
    !UUID.test(descriptor.idempotencyKey)
  ) {
    throw new Error('Payroll formula publication changed before dispatch.');
  }
  if (command.hasDispatched && descriptor.idempotencyKey !== command.idempotencyKey) {
    throw new PayrollFormulaRetryRotationError();
  }
  return descriptor.idempotencyKey === command.idempotencyKey
    ? command
    : Object.freeze({ ...command, idempotencyKey: descriptor.idempotencyKey });
}

function commandAuthority(
  authority: ProductSurfaceGovernedMutationAuthority,
  command: PendingCommand
): PayrollFormulaCommandAuthority {
  if (authority.mode === 'LEGACY_COMPATIBILITY') {
    return {
      governance: authority,
      idempotencyKey: command.idempotencyKey,
      correlationId: command.correlationId,
      expectedObjectVersion: command.expectedVersion,
    };
  }
  const idempotencyMismatch =
    authority.idempotencyKey !== undefined && authority.idempotencyKey !== command.idempotencyKey;
  const versionMismatch =
    authority.objectVersion !== undefined && authority.objectVersion !== command.expectedVersion;
  if (
    authority.contextScopeKey.trim().length === 0 ||
    idempotencyMismatch ||
    versionMismatch ||
    (command.kind === 'PUBLISH' &&
      (!authority.stepUp ||
        authority.idempotencyKey !== command.idempotencyKey ||
        authority.objectVersion !== command.expectedVersion))
  ) {
    throw new Error('Payroll formula command authority does not match the exact command.');
  }
  const governance =
    command.kind === 'PUBLISH'
      ? authority
      : {
          ...authority,
          idempotencyKey: command.idempotencyKey,
          objectVersion: command.expectedVersion,
        };
  return {
    governance,
    idempotencyKey: command.idempotencyKey,
    correlationId: command.correlationId,
    expectedObjectVersion: command.expectedVersion,
  };
}

function resultUnknown(error: unknown) {
  return (
    error instanceof PayrollFormulaReceiptBindingError ||
    error instanceof PayrollFormulaRetryRotationError ||
    error instanceof HttpTransportError ||
    (error instanceof HttpError &&
      (error.status === 408 || error.status === 429 || error.status >= 500)) ||
    (error instanceof Error &&
      /receipt\.status\.(?:ACCEPTED|RUNNING|RESULT_UNKNOWN)/u.test(error.message))
  );
}

function sameReceiptCommand(previous: PayrollFormulaReceipt, current: PayrollFormulaReceipt) {
  return (
    previous.commandType === current.commandType &&
    previous.originatingAction === current.originatingAction &&
    previous.correlationId === current.correlationId &&
    previous.requestDigest === current.requestDigest &&
    previous.populationScopeDigest === current.populationScopeDigest
  );
}

function commandFailure(
  error: unknown,
  command: PendingCommand,
  dispatched: boolean
): PayrollConfigurationCommandFeedback {
  if ((dispatched || command.hasDispatched) && resultUnknown(error)) {
    return { kind: 'RESULT_UNKNOWN', command: command.kind };
  }
  if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
    return { kind: 'PERMISSION', command: command.kind };
  }
  if (error instanceof HttpError && (error.status === 409 || error.status === 412)) {
    return { kind: 'CONFLICT', command: command.kind };
  }
  return { kind: 'REJECTED', command: command.kind };
}

function simulationRequest(
  draft: PayrollSimulationDraft,
  expectedVersion: number
): SimulatePayrollFormula | Readonly<{ errors: readonly string[] }> {
  const inputKey = draft.inputKey.trim();
  const value = draft.value.trim();
  const currency = draft.currency.trim().toUpperCase();
  if (!INPUT_KEY.test(inputKey)) return { errors: ['INPUT_KEY'] };
  const request: SimulatePayrollFormula = Object.freeze({
    expectedVersion,
    inputs: Object.freeze({
      [inputKey]: Object.freeze({ type: 'MONEY' as const, value, currency }),
    }),
    rounding: Object.freeze({ scale: 2, mode: 'HALF_UP' as const, increment: '0.01' }),
    timeoutMillis: 2_000,
  });
  const validation = validateSimulationCommand(request);
  return validation.valid ? request : { errors: validation.errors };
}

function receiptIsUncertain(receipt: PayrollFormulaReceipt) {
  return ['ACCEPTED', 'RUNNING', 'RESULT_UNKNOWN'].includes(receipt.status);
}

function receiptFailed(receipt: PayrollFormulaReceipt) {
  return receipt.status === 'FAILED' || receipt.status === 'REJECTED';
}

export type UsePayrollConfigurationWorkbenchOptions = Readonly<{
  scope: PayrollConfigurationScope;
  ownerBinding?: PayrollConfigurationOwnerBinding;
  dataSource?: PayrollElementFormulaDataSource;
  idFactory?: () => string;
}>;

export function usePayrollConfigurationWorkbench({
  scope,
  ownerBinding,
  dataSource = payrollElementFormulaDataSource,
  idFactory = createCommandId,
}: UsePayrollConfigurationWorkbenchOptions) {
  const scopeIdentity = JSON.stringify([
    scope.ready,
    scope.contextScopeKey,
    scope.decisionRevision,
    scope.locale,
    scope.timeZone,
    scope.correlationId,
  ]);
  const currentScopeRef = useRef(scopeIdentity);
  currentScopeRef.current = scopeIdentity;
  const readScopeRef = useRef(scopeIdentity);
  const mountedRef = useRef(true);
  const busyRef = useRef(false);
  const pendingRef = useRef<PendingCommand | null>(null);
  const [reloadRevision, setReloadRevision] = useState(0);
  const [state, setState] = useState<PayrollConfigurationRuntimeState>({
    kind: 'CLOSED',
    scopeIdentity,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [simulationDraft, setSimulationDraft] = useState<PayrollSimulationDraft>({
    inputKey: 'basePay',
    value: '100.00',
    currency: 'TST',
  });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<PayrollConfigurationCommandFeedback | null>(null);
  const [publishReviewOpen, setPublishReviewOpen] = useState(false);

  const pageReader =
    ownerBinding?.page?.contractId === 'IAQ-055' ? ownerBinding.page.read : undefined;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const scopeChanged = readScopeRef.current !== scopeIdentity;
    readScopeRef.current = scopeIdentity;
    if (scopeChanged) {
      busyRef.current = false;
      pendingRef.current = null;
      setBusy(false);
      setFeedback(null);
      setSelectedId(null);
      setPublishReviewOpen(false);
    }
    if (!scope.ready || !pageReader) {
      setState({ kind: 'CLOSED', scopeIdentity });
      return;
    }
    const abort = new AbortController();
    setState({ kind: 'LOADING', scopeIdentity });
    void pageReader(
      {
        limit: 50,
        sort: ['itemPublicId:ASC'],
        locale: scope.locale,
        timeZone: scope.timeZone,
        correlationId: scope.correlationId,
      },
      { contextScopeKey: scope.contextScopeKey, signal: abort.signal }
    )
      .then((workbench) => {
        if (
          abort.signal.aborted ||
          !mountedRef.current ||
          currentScopeRef.current !== scopeIdentity
        ) {
          return;
        }
        setState({ kind: 'READY', scopeIdentity, workbench });
        setSelectedId((current) =>
          workbench.items.some((item) => item.itemPublicId === current)
            ? current
            : (workbench.items[0]?.itemPublicId ?? null)
        );
      })
      .catch((error: unknown) => {
        if (
          abort.signal.aborted ||
          !mountedRef.current ||
          currentScopeRef.current !== scopeIdentity
        ) {
          return;
        }
        setState({
          kind:
            error instanceof HttpError && (error.status === 401 || error.status === 403)
              ? 'DENIED'
              : 'ERROR',
          scopeIdentity,
        });
      });
    return () => abort.abort();
  }, [
    pageReader,
    reloadRevision,
    scope.contextScopeKey,
    scope.correlationId,
    scope.locale,
    scope.ready,
    scope.timeZone,
    scopeIdentity,
  ]);

  const workbench =
    state.kind === 'READY' && state.scopeIdentity === scopeIdentity ? state.workbench : null;
  const selected =
    workbench?.items.find((item) => item.itemPublicId === selectedId) ??
    workbench?.items[0] ??
    null;
  const formulaId = payrollFormulaId(selected);
  const expectedVersion = payrollFormulaVersion(selected);
  const validateExecutor = exactOwnerCommand(ownerBinding, 'VALIDATE');
  const simulateExecutor = exactOwnerCommand(ownerBinding, 'SIMULATE');
  const publishExecutor = exactOwnerCommand(ownerBinding, 'PUBLISH');

  const execute = useCallback(
    async (command: PendingCommand) => {
      const executor = exactOwnerCommand(ownerBinding, command.kind);
      if (
        busyRef.current ||
        !executor ||
        !scope.ready ||
        currentScopeRef.current !== command.scopeIdentity
      ) {
        return;
      }
      busyRef.current = true;
      setBusy(true);
      setFeedback(command.kind === 'PUBLISH' ? { kind: 'STEP_UP', command: 'PUBLISH' } : null);
      let receipt: PayrollFormulaReceipt | undefined;
      let dispatched = false;
      let dispatchedCommand = command;
      try {
        receipt = await executor((authority, descriptor) => {
          const boundCommand = bindPayrollFormulaDispatchCommand(command, descriptor);
          const exactAuthority = commandAuthority(authority, boundCommand);
          dispatchedCommand = boundCommand.hasDispatched
            ? boundCommand
            : Object.freeze({ ...boundCommand, hasDispatched: true as const });
          dispatched = true;
          pendingRef.current = dispatchedCommand;
          if (dispatchedCommand.kind === 'VALIDATE') {
            return dataSource.validateFormula(
              dispatchedCommand.formulaId,
              dispatchedCommand.request as PayrollFormulaVersionCommand,
              exactAuthority
            );
          }
          if (dispatchedCommand.kind === 'SIMULATE') {
            return dataSource.simulateFormula(
              dispatchedCommand.formulaId,
              dispatchedCommand.request as SimulatePayrollFormula,
              exactAuthority
            );
          }
          return dataSource.publishFormula(
            dispatchedCommand.formulaId,
            dispatchedCommand.request as PayrollFormulaVersionCommand,
            exactAuthority
          );
        }, command);
        if (!mountedRef.current || currentScopeRef.current !== dispatchedCommand.scopeIdentity) {
          return;
        }
        if (
          dispatchedCommand.observedReceipt &&
          !sameReceiptCommand(dispatchedCommand.observedReceipt, receipt)
        ) {
          throw new PayrollFormulaReceiptBindingError();
        }
        if (receiptIsUncertain(receipt)) {
          pendingRef.current = { ...dispatchedCommand, observedReceipt: receipt };
          setFeedback({ kind: 'RESULT_UNKNOWN', command: dispatchedCommand.kind });
        } else if (receiptFailed(receipt)) {
          pendingRef.current = null;
          setFeedback({ kind: 'REJECTED', command: dispatchedCommand.kind });
        } else {
          pendingRef.current = null;
          setFeedback({ kind: 'SUCCEEDED', receipt });
          setReloadRevision((value) => value + 1);
        }
      } catch (error) {
        if (!mountedRef.current || currentScopeRef.current !== dispatchedCommand.scopeIdentity) {
          return;
        }
        const next = commandFailure(error, dispatchedCommand, dispatched);
        if (next.kind === 'RESULT_UNKNOWN') {
          pendingRef.current = {
            ...dispatchedCommand,
            ...(receipt ? { observedReceipt: receipt } : {}),
          };
        } else {
          pendingRef.current = null;
        }
        setFeedback(next);
      } finally {
        if (currentScopeRef.current === dispatchedCommand.scopeIdentity) {
          busyRef.current = false;
          if (mountedRef.current) setBusy(false);
        }
      }
    },
    [dataSource, ownerBinding, scope.ready]
  );

  const beginCommand = useCallback(
    (kind: PayrollFormulaCommandKind) => {
      const executor = exactOwnerCommand(ownerBinding, kind);
      if (
        !formulaId ||
        !expectedVersion ||
        !executor ||
        busyRef.current ||
        pendingRef.current ||
        currentScopeRef.current !== scopeIdentity
      ) {
        return;
      }
      let request: PayrollFormulaVersionCommand | SimulatePayrollFormula = Object.freeze({
        expectedVersion,
      });
      if (kind === 'SIMULATE') {
        const candidate = simulationRequest(simulationDraft, expectedVersion);
        if ('errors' in candidate) {
          setFeedback({ kind: 'INPUT_INVALID', errors: candidate.errors });
          return;
        }
        request = candidate;
      }
      try {
        const idempotencyKey = idFactory();
        const correlationId = idFactory();
        if (!UUID.test(idempotencyKey) || !UUID.test(correlationId)) {
          throw new Error('Invalid payroll command identity.');
        }
        const command: PendingCommand = Object.freeze({
          kind,
          formulaId,
          expectedVersion,
          idempotencyKey,
          correlationId,
          request,
          scopeIdentity,
        });
        pendingRef.current = command;
        setPublishReviewOpen(false);
        void execute(command);
      } catch {
        pendingRef.current = null;
        setFeedback({ kind: 'REJECTED', command: kind });
      }
    },
    [execute, expectedVersion, formulaId, idFactory, ownerBinding, scopeIdentity, simulationDraft]
  );

  const retryExact = useCallback(() => {
    const pending = pendingRef.current;
    if (pending && pending.scopeIdentity === scopeIdentity) void execute(pending);
  }, [execute, scopeIdentity]);

  const refresh = useCallback(() => setReloadRevision((value) => value + 1), []);
  const commandBlocked = busy || Boolean(pendingRef.current);
  const canValidate = Boolean(formulaId && expectedVersion && validateExecutor && !commandBlocked);
  const canSimulate = Boolean(formulaId && expectedVersion && simulateExecutor && !commandBlocked);
  const canPublish = Boolean(
    formulaId &&
    expectedVersion &&
    publishExecutor &&
    payrollWorkbenchCanPublish(selected) &&
    !commandBlocked
  );

  return useMemo(
    () => ({
      scopeIdentity,
      state,
      workbench,
      selected,
      selectedId: selected?.itemPublicId ?? null,
      simulationDraft,
      busy,
      feedback,
      publishReviewOpen,
      commandBlocked,
      canValidate,
      canSimulate,
      canPublish,
      select: (itemPublicId: string) => {
        if (!commandBlocked) {
          setSelectedId(itemPublicId);
          setPublishReviewOpen(false);
        }
      },
      setSimulationDraft,
      refresh,
      validate: () => beginCommand('VALIDATE'),
      simulate: () => beginCommand('SIMULATE'),
      openPublishReview: () => {
        if (canPublish) setPublishReviewOpen(true);
      },
      closePublishReview: () => {
        if (!busy) setPublishReviewOpen(false);
      },
      publish: () => beginCommand('PUBLISH'),
      retryExact,
    }),
    [
      beginCommand,
      busy,
      canPublish,
      canSimulate,
      canValidate,
      commandBlocked,
      feedback,
      publishReviewOpen,
      refresh,
      retryExact,
      scopeIdentity,
      selected,
      simulationDraft,
      state,
      workbench,
    ]
  );
}

export type PayrollConfigurationWorkbenchController = ReturnType<
  typeof usePayrollConfigurationWorkbench
>;
