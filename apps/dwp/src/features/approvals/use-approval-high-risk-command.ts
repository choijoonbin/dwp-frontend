import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  getProductSurfaceStepUpContinuation,
  HttpError,
  HttpTransportError,
  isTrustedProductSurfaceStepUpWindowCompletion,
  issueProductSurfaceStepUpChallenge,
  matchesProductSurfaceStepUpCompletion,
  productSurfaceServerNow,
  PRODUCT_SURFACE_STEP_UP_COMPLETION_CHANNEL,
  useAuth,
  useProductSurfaceAuthority,
} from '@dwp-frontend/shared-utils';

import { useOptionalAllowedProductSurface } from '../../components/allowed-product-surface-context';
import {
  ProductSurfaceOperationCancelledError,
  isProductSurfaceOperationCancelledError,
  productSurfaceOperationCoordinator,
  sameProductSurfaceOperationIdentity,
} from '../../components/product-surface-operation-coordinator';
import {
  APPROVAL_HIGH_RISK_ROUTE_CONTRACT_KEY_BY_OPERATION,
  applyApprovalStepUpChallenge,
  applyApprovalStepUpContinuation,
  beginApprovalHighRiskCommandExecution,
  buildApprovalHighRiskMutationContext,
  buildApprovalStepUpIssuerRequest,
  createApprovalHighRiskAttempt,
  restartApprovalHighRiskAttempt,
  resolveApprovalHighRiskActionAuthority,
  selectApprovalStepUpProvider,
  transitionApprovalHighRiskAttempt,
} from './approval-high-risk-command-model';

import type {
  ApprovalMutationExecution,
  ProductSurfaceAuthoritySnapshot,
  ProductSurfaceEvaluationRequest,
  ProductSurfaceStepUpCompletionMessage,
} from '@dwp-frontend/shared-utils';
import type {
  ApprovalHighRiskAttempt,
  ApprovalHighRiskCommandDescriptor,
  ApprovalHighRiskOperation,
} from './approval-high-risk-command-model';
import type {
  ProductSurfaceOperationIdentity,
  ProductSurfaceOperationTicket,
} from '../../components/product-surface-operation-coordinator';

export type ApprovalHighRiskCommandError =
  | 'authority-unavailable'
  | 'pending-attempt'
  | 'issuer-retry'
  | 'provider-unavailable'
  | 'revision-conflict'
  | 'popup-blocked'
  | 'popup-closed'
  | 'popup-timeout'
  | 'challenge-expired'
  | 'command-retry'
  | 'command-rejected'
  | 'command-uncertain'
  | 'legacy-command-failed'
  | null;

export type ApprovalHighRiskCommandController = Readonly<{
  open: boolean;
  busy: boolean;
  attempt: ApprovalHighRiskAttempt | null;
  error: ApprovalHighRiskCommandError;
  close: () => void;
  confirm: () => Promise<void>;
  continueWithIdentityProvider: () => void;
  selectIdentityProvider: (providerKey: string) => Promise<void>;
}>;

export type ApprovalHighRiskEntryBinding = Readonly<{
  contextKey: string;
  contextScopeKey: string;
}>;

const POPUP_POLL_MS = 500;
const APPROVAL_HIGH_RISK_OPERATION_TARGET = {
  productKey: 'approvals',
  surfaceKey: 'approvals.admin',
} as const;

export type ApprovalHighRiskOperationBinding = Readonly<{
  identity: ProductSurfaceOperationIdentity;
  ticket: ProductSurfaceOperationTicket;
  actionDecisionRevision: { current: string | null };
}>;

export type ApprovalHighRiskCommandFailureDisposition =
  | 'AMBIGUOUS_RETRY'
  | 'REISSUE_PROOF'
  | 'REPLAY_SUCCESS'
  | 'AUTHORITY_CONFLICT'
  | 'DETERMINISTIC_REJECT';

function errorCode(error: HttpError): string | null {
  if (!error.details || typeof error.details !== 'object' || Array.isArray(error.details)) {
    return null;
  }
  const value = (error.details as Record<string, unknown>).errorCode;
  return typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : null;
}

export function classifyApprovalHighRiskCommandFailure(
  error: unknown
): ApprovalHighRiskCommandFailureDisposition {
  if (error instanceof HttpTransportError) return 'AMBIGUOUS_RETRY';
  if (!(error instanceof HttpError)) return 'DETERMINISTIC_REJECT';
  const code = errorCode(error);
  if (
    error.status === 403 &&
    (code === 'STEP_UP_REQUIRED' ||
      code === 'STEP_UP_CHALLENGE_EXPIRED' ||
      code === 'STEP_UP_CHALLENGE_INVALID')
  ) {
    return 'REISSUE_PROOF';
  }
  if (
    error.status === 409 &&
    (code === 'IDEMPOTENCY_REPLAY_SUCCESS' || code === 'IDEMPOTENT_REPLAY_SUCCESS')
  ) {
    return 'REPLAY_SUCCESS';
  }
  if (
    error.status === 409 &&
    (code === 'DECISION_REVISION_CONFLICT' ||
      code === 'SCOPE_CONTEXT_EXPIRED' ||
      code === 'OBJECT_VERSION_CONFLICT')
  ) {
    return 'AUTHORITY_CONFLICT';
  }
  if (error.status === 408 || error.status >= 500) return 'AMBIGUOUS_RETRY';
  return 'DETERMINISTIC_REJECT';
}

export async function runApprovalHighRiskResumeSingleFlight(
  flag: { current: boolean },
  task: () => Promise<void>
): Promise<boolean> {
  if (flag.current) return false;
  flag.current = true;
  try {
    await task();
    return true;
  } finally {
    flag.current = false;
  }
}

export function assertApprovalHighRiskOperationBindingCurrent(
  binding: ApprovalHighRiskOperationBinding,
  currentIdentity: ProductSurfaceOperationIdentity | null
): void {
  binding.ticket.assertCurrent();
  if (!sameProductSurfaceOperationIdentity(currentIdentity, binding.identity)) {
    throw new ProductSurfaceOperationCancelledError();
  }
}

export function assertApprovalHighRiskAttemptBinding(
  attempt: ApprovalHighRiskAttempt,
  binding: ApprovalHighRiskOperationBinding
): void {
  if (
    attempt.authority.contextKey !== binding.identity.contextKey ||
    attempt.authority.contextScopeKey !== binding.identity.contextScopeKey ||
    attempt.authority.expectedDecisionRevision !== binding.actionDecisionRevision.current
  ) {
    throw new ProductSurfaceOperationCancelledError();
  }
}

export class ApprovalHighRiskDispatchContextChangedError extends Error {
  readonly dispatchError: unknown;

  constructor(dispatchError: unknown) {
    super('The HIGH command result is uncertain after its authority context changed.');
    this.name = 'ApprovalHighRiskDispatchContextChangedError';
    this.dispatchError = dispatchError;
  }
}

export async function runApprovalHighRiskBoundDispatch<TResult>(
  binding: ApprovalHighRiskOperationBinding,
  dispatch: () => Promise<TResult>
): Promise<TResult> {
  binding.ticket.markDispatched();
  try {
    const result = await dispatch();
    binding.ticket.finish();
    return result;
  } catch (caught) {
    try {
      binding.ticket.markPreflight();
    } catch (bindingError) {
      if (isProductSurfaceOperationCancelledError(bindingError)) {
        throw new ApprovalHighRiskDispatchContextChangedError(caught);
      }
      throw bindingError;
    }
    throw caught;
  }
}

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function resolveApprovalHighRiskEntryBinding(
  snapshot: ProductSurfaceAuthoritySnapshot | undefined,
  requestedScopeKey: string | undefined,
  clientNowMs = Date.now()
): ApprovalHighRiskEntryBinding | null {
  if (!snapshot) return null;
  const serverNowMs = productSurfaceServerNow(snapshot, clientNowMs);
  const contexts = snapshot.envelope.contexts.filter(
    (context) => context.productKey === 'approvals' && context.surfaceKey === 'approvals.admin'
  );
  if (contexts.length !== 1) return null;
  const context = contexts[0]!;
  const contextExpiry = Date.parse(context.revalidateAt);
  if (
    !nonBlank(context.contextKey) ||
    !Number.isFinite(contextExpiry) ||
    contextExpiry <= serverNowMs
  ) {
    return null;
  }
  const eligibleScopes = context.scopes.filter((scope) => {
    const validUntilMs = scope.validUntil ? Date.parse(scope.validUntil) : undefined;
    return (
      !scope.readOnly &&
      (validUntilMs === undefined || (Number.isFinite(validUntilMs) && validUntilMs > serverNowMs))
    );
  });
  const selected = requestedScopeKey
    ? eligibleScopes.filter((scope) => scope.key === requestedScopeKey)
    : eligibleScopes.length === 1
      ? eligibleScopes
      : [];
  return selected.length === 1 && nonBlank(selected[0]!.key)
    ? { contextKey: context.contextKey, contextScopeKey: selected[0]!.key }
    : null;
}

export function buildApprovalHighRiskActionEvaluationRequest(
  operation: ApprovalHighRiskOperation,
  binding: ApprovalHighRiskEntryBinding
): ProductSurfaceEvaluationRequest {
  return {
    subject: {
      type: 'PRODUCT',
      productKey: 'approvals',
      surfaceKey: 'approvals.admin',
    },
    routeContractKey: APPROVAL_HIGH_RISK_ROUTE_CONTRACT_KEY_BY_OPERATION[operation],
    contextKey: binding.contextKey,
    contextScopeKey: binding.contextScopeKey,
  };
}

function currentReturnTo(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function popupDeadlineMs(
  attempt: ApprovalHighRiskAttempt,
  snapshot: ProductSurfaceAuthoritySnapshot | undefined
): number | null {
  if (attempt.continuation?.type !== 'OIDC' || !snapshot) return null;
  const expiresAtMs = Date.parse(attempt.continuation.expiresAt);
  const serverNowMs = productSurfaceServerNow(snapshot);
  return Number.isFinite(expiresAtMs) && expiresAtMs > serverNowMs
    ? Date.now() + (expiresAtMs - serverNowMs)
    : null;
}

export function useApprovalHighRiskCommand<TResult>({
  operation,
  execute,
  onSuccess,
  onConflict,
}: {
  operation: ApprovalHighRiskOperation;
  execute: (
    command: ApprovalHighRiskCommandDescriptor,
    execution: ApprovalMutationExecution
  ) => Promise<TResult>;
  onSuccess?: (result: TResult) => void | Promise<void>;
  onConflict?: () => void | Promise<void>;
}): {
  begin: (command: ApprovalHighRiskCommandDescriptor) => Promise<void>;
  controller: ApprovalHighRiskCommandController;
} {
  const auth = useAuth();
  const pageDecision = useOptionalAllowedProductSurface();
  const productAuthority = useProductSurfaceAuthority();
  const [attempt, setAttempt] = useState<ApprovalHighRiskAttempt | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApprovalHighRiskCommandError>(null);
  const attemptRef = useRef<ApprovalHighRiskAttempt | null>(null);
  const popupRef = useRef<Window | null>(null);
  const popupDeadlineRef = useRef<number | null>(null);
  const resumeInFlightRef = useRef(false);
  const operationBindingRef = useRef<ApprovalHighRiskOperationBinding | null>(null);
  const rollout = productAuthority.rolloutForProduct('approvals');
  const rolloutState = rollout.state === 'ready' ? rollout.rollout.state : undefined;
  const selectedScopeKey =
    pageDecision?.context.productKey === 'approvals' &&
    pageDecision.context.surfaceKey === 'approvals.admin'
      ? pageDecision.scope.key
      : undefined;
  const entryBinding = useMemo(
    () => resolveApprovalHighRiskEntryBinding(productAuthority.snapshot, selectedScopeKey),
    [productAuthority.snapshot, selectedScopeKey]
  );
  const operationIdentity = useMemo<ProductSurfaceOperationIdentity | null>(
    () =>
      entryBinding &&
      productAuthority.snapshot &&
      pageDecision?.context.productKey === APPROVAL_HIGH_RISK_OPERATION_TARGET.productKey &&
      pageDecision.context.surfaceKey === APPROVAL_HIGH_RISK_OPERATION_TARGET.surfaceKey
        ? {
            ...APPROVAL_HIGH_RISK_OPERATION_TARGET,
            tenantId: String(auth.user?.tenantId ?? ''),
            actorId: String(auth.user?.userId ?? ''),
            accessMode: productAuthority.snapshot.envelope.activeAccessMode,
            contextKey: entryBinding.contextKey,
            contextScopeKey: entryBinding.contextScopeKey,
            decisionRevision: pageDecision.decisionRevision,
          }
        : null,
    [auth.user?.tenantId, auth.user?.userId, entryBinding, pageDecision, productAuthority.snapshot]
  );
  const operationIdentityRef = useRef(operationIdentity);
  operationIdentityRef.current = operationIdentity;

  useLayoutEffect(() => {
    if (operationIdentity) {
      productSurfaceOperationCoordinator.observeIdentity(operationIdentity);
    } else {
      productSurfaceOperationCoordinator.observeAuthorityUnavailable(
        APPROVAL_HIGH_RISK_OPERATION_TARGET
      );
    }
  }, [operationIdentity]);

  const updateAttempt = useCallback((next: ApprovalHighRiskAttempt | null) => {
    attemptRef.current = next;
    setAttempt(next);
  }, []);

  const clearPopup = useCallback(() => {
    popupDeadlineRef.current = null;
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    popupRef.current = null;
  }, []);

  const finishOperationBinding = useCallback(
    (binding: ApprovalHighRiskOperationBinding | null = operationBindingRef.current) => {
      if (!binding) return;
      binding.ticket.finish();
      if (operationBindingRef.current === binding) operationBindingRef.current = null;
    },
    []
  );

  const cancelOperationBinding = useCallback(() => {
    const binding = operationBindingRef.current;
    if (!binding) return;
    binding.ticket.cancel();
    if (binding.ticket.signal.aborted && operationBindingRef.current === binding) {
      operationBindingRef.current = null;
    }
  }, []);

  const startOperationBinding = useCallback(
    (identity: ProductSurfaceOperationIdentity): ApprovalHighRiskOperationBinding => {
      if (operationBindingRef.current) throw new ProductSurfaceOperationCancelledError();
      const binding = {
        identity,
        actionDecisionRevision: { current: null },
        ticket: productSurfaceOperationCoordinator.beginOperation(
          APPROVAL_HIGH_RISK_OPERATION_TARGET
        ),
      };
      operationBindingRef.current = binding;
      return binding;
    },
    []
  );

  const currentOperationBinding = useCallback((): ApprovalHighRiskOperationBinding => {
    const binding = operationBindingRef.current;
    if (!binding) throw new ProductSurfaceOperationCancelledError();
    assertApprovalHighRiskOperationBindingCurrent(binding, operationIdentityRef.current);
    return binding;
  }, []);

  const dismissCancelledOperation = useCallback(
    (binding: ApprovalHighRiskOperationBinding | null = operationBindingRef.current) => {
      clearPopup();
      finishOperationBinding(binding);
      updateAttempt(null);
      setError(null);
      setOpen(false);
    },
    [clearPopup, finishOperationBinding, updateAttempt]
  );

  const conflict = useCallback(async () => {
    clearPopup();
    finishOperationBinding();
    updateAttempt(null);
    setError('revision-conflict');
    setOpen(true);
    await productAuthority.revalidate();
    await onConflict?.();
  }, [clearPopup, finishOperationBinding, onConflict, productAuthority, updateAttempt]);

  const restartProof = useCallback(
    async (candidate: ApprovalHighRiskAttempt) => {
      clearPopup();
      finishOperationBinding();
      updateAttempt(null);
      setBusy(true);
      setError('challenge-expired');
      setOpen(true);
      let binding: ApprovalHighRiskOperationBinding | null = null;
      try {
        if (!entryBinding || !operationIdentity) {
          setError('authority-unavailable');
          return;
        }
        binding = startOperationBinding(operationIdentity);
        const evaluation = await productAuthority.evaluateProduct(
          buildApprovalHighRiskActionEvaluationRequest(operation, entryBinding),
          { signal: binding.ticket.signal }
        );
        assertApprovalHighRiskOperationBindingCurrent(binding, operationIdentityRef.current);
        const resolution = resolveApprovalHighRiskActionAuthority({
          rolloutState,
          evaluation,
          contextKey: entryBinding.contextKey,
          contextScopeKey: entryBinding.contextScopeKey,
        });
        if (resolution.mode !== 'secure') {
          finishOperationBinding(binding);
          setError('authority-unavailable');
          return;
        }
        binding.actionDecisionRevision.current = resolution.authority.expectedDecisionRevision;
        assertApprovalHighRiskOperationBindingCurrent(binding, operationIdentityRef.current);
        const next = restartApprovalHighRiskAttempt(candidate, resolution.authority);
        assertApprovalHighRiskAttemptBinding(next, binding);
        updateAttempt(next);
      } catch (caught) {
        if (isProductSurfaceOperationCancelledError(caught) || binding?.ticket.signal.aborted) {
          dismissCancelledOperation(binding);
          return;
        }
        finishOperationBinding(binding);
        setError('authority-unavailable');
      } finally {
        setBusy(false);
      }
    },
    [
      clearPopup,
      dismissCancelledOperation,
      entryBinding,
      finishOperationBinding,
      operation,
      operationIdentity,
      productAuthority,
      rolloutState,
      startOperationBinding,
      updateAttempt,
    ]
  );

  const issue = useCallback(
    async (candidate: ApprovalHighRiskAttempt) => {
      setBusy(true);
      setError(null);
      let binding: ApprovalHighRiskOperationBinding | null = null;
      try {
        binding = currentOperationBinding();
        assertApprovalHighRiskAttemptBinding(candidate, binding);
        const issuer = buildApprovalStepUpIssuerRequest(candidate, currentReturnTo());
        const issued = await issueProductSurfaceStepUpChallenge(
          issuer.request,
          issuer.expectedDecisionRevision,
          { signal: binding.ticket.signal }
        );
        assertApprovalHighRiskOperationBindingCurrent(binding, operationIdentityRef.current);
        assertApprovalHighRiskAttemptBinding(candidate, binding);
        if (!productAuthority.snapshot) {
          finishOperationBinding(binding);
          updateAttempt(null);
          setError('authority-unavailable');
          return;
        }
        const next = applyApprovalStepUpChallenge(
          candidate,
          issued,
          productSurfaceServerNow(productAuthority.snapshot)
        );
        assertApprovalHighRiskOperationBindingCurrent(binding, operationIdentityRef.current);
        clearPopup();
        updateAttempt(next);
      } catch (caught) {
        if (isProductSurfaceOperationCancelledError(caught) || binding?.ticket.signal.aborted) {
          dismissCancelledOperation(binding);
          return;
        }
        if (caught instanceof HttpError && caught.status === 409) {
          await conflict();
          return;
        }
        if (
          caught instanceof Error &&
          caught.message.includes('decision revision does not match')
        ) {
          await conflict();
          return;
        }
        const continuation = getProductSurfaceStepUpContinuation(caught);
        if (continuation) {
          updateAttempt(applyApprovalStepUpContinuation(candidate, continuation));
          return;
        }
        updateAttempt(transitionApprovalHighRiskAttempt(candidate, 'ISSUER_RETRY'));
        setError(
          caught instanceof HttpError && caught.status === 403
            ? 'provider-unavailable'
            : 'issuer-retry'
        );
      } finally {
        setBusy(false);
      }
    },
    [
      clearPopup,
      conflict,
      currentOperationBinding,
      dismissCancelledOperation,
      finishOperationBinding,
      productAuthority.snapshot,
      updateAttempt,
    ]
  );

  const completePopup = useCallback(
    async (message: ProductSurfaceStepUpCompletionMessage) => {
      const candidate = attemptRef.current;
      if (
        !candidate ||
        candidate.phase !== 'RESUME_REQUIRED' ||
        candidate.continuation?.type !== 'OIDC' ||
        candidate.continuation.flowRef !== message.flowId
      ) {
        return;
      }
      clearPopup();
      await runApprovalHighRiskResumeSingleFlight(resumeInFlightRef, () => issue(candidate));
    },
    [clearPopup, issue]
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      const candidate = attemptRef.current;
      const expectedFlowRef =
        candidate?.continuation?.type === 'OIDC' ? candidate.continuation.flowRef : '';
      if (
        !popupRef.current ||
        !isTrustedProductSurfaceStepUpWindowCompletion({
          value: event.data,
          expectedFlowRef,
          eventOrigin: event.origin,
          expectedOrigin: window.location.origin,
          sourceMatches: event.source === popupRef.current,
        })
      ) {
        return;
      }
      const message = event.data as ProductSurfaceStepUpCompletionMessage;
      void completePopup(message);
    };
    window.addEventListener('message', onMessage);
    const channel =
      typeof BroadcastChannel === 'undefined'
        ? null
        : new BroadcastChannel(PRODUCT_SURFACE_STEP_UP_COMPLETION_CHANNEL);
    const onBroadcast = (event: MessageEvent<unknown>) => {
      const candidate = attemptRef.current;
      const expectedFlowRef =
        candidate?.continuation?.type === 'OIDC' ? candidate.continuation.flowRef : '';
      if (
        !popupRef.current ||
        !matchesProductSurfaceStepUpCompletion(event.data, expectedFlowRef)
      ) {
        return;
      }
      const message = event.data;
      void completePopup(message);
    };
    channel?.addEventListener('message', onBroadcast);
    return () => {
      window.removeEventListener('message', onMessage);
      channel?.removeEventListener('message', onBroadcast);
      channel?.close();
    };
  }, [completePopup]);

  useEffect(() => {
    if (attempt?.phase !== 'RESUME_REQUIRED' || !popupRef.current) return undefined;
    const interval = window.setInterval(() => {
      if (popupDeadlineRef.current !== null && Date.now() >= popupDeadlineRef.current) {
        clearPopup();
        const candidate = attemptRef.current;
        if (candidate) updateAttempt(transitionApprovalHighRiskAttempt(candidate, 'ISSUER_RETRY'));
        setError('popup-timeout');
        return;
      }
      if (popupRef.current?.closed) {
        clearPopup();
        const candidate = attemptRef.current;
        if (candidate) updateAttempt(transitionApprovalHighRiskAttempt(candidate, 'ISSUER_RETRY'));
        setError('popup-closed');
      }
    }, POPUP_POLL_MS);
    return () => window.clearInterval(interval);
  }, [attempt?.phase, clearPopup, updateAttempt]);

  useEffect(() => {
    const binding = operationBindingRef.current;
    if (!binding) return undefined;
    const onAbort = () => dismissCancelledOperation(binding);
    if (binding.ticket.signal.aborted) {
      onAbort();
      return undefined;
    }
    binding.ticket.signal.addEventListener('abort', onAbort, { once: true });
    return () => binding.ticket.signal.removeEventListener('abort', onAbort);
  }, [attempt, busy, dismissCancelledOperation]);

  useEffect(
    () => () => {
      clearPopup();
      cancelOperationBinding();
    },
    [cancelOperationBinding, clearPopup]
  );

  const runCommand = useCallback(
    async (candidate: ApprovalHighRiskAttempt) => {
      let binding: ApprovalHighRiskOperationBinding;
      try {
        binding = currentOperationBinding();
        assertApprovalHighRiskAttemptBinding(candidate, binding);
      } catch (caught) {
        if (isProductSurfaceOperationCancelledError(caught)) {
          dismissCancelledOperation();
          return;
        }
        throw caught;
      }
      if (!productAuthority.snapshot) {
        finishOperationBinding(binding);
        updateAttempt(null);
        setError('authority-unavailable');
        return;
      }
      let executing: ApprovalHighRiskAttempt;
      try {
        executing = beginApprovalHighRiskCommandExecution(
          candidate,
          productSurfaceServerNow(productAuthority.snapshot)
        );
      } catch {
        await restartProof(candidate);
        return;
      }
      updateAttempt(executing);
      setBusy(true);
      setError(null);
      let completedResult: TResult | undefined;
      let completed = false;
      let revalidateAfterSuccess = false;
      try {
        assertApprovalHighRiskOperationBindingCurrent(binding, operationIdentityRef.current);
        assertApprovalHighRiskAttemptBinding(executing, binding);
        const result = await runApprovalHighRiskBoundDispatch(binding, () =>
          execute(executing.descriptor, buildApprovalHighRiskMutationContext(executing))
        );
        revalidateAfterSuccess = !sameProductSurfaceOperationIdentity(
          operationIdentityRef.current,
          binding.identity
        );
        finishOperationBinding(binding);
        updateAttempt(null);
        setOpen(false);
        completedResult = result;
        completed = true;
      } catch (caught) {
        if (isProductSurfaceOperationCancelledError(caught)) {
          dismissCancelledOperation(binding);
          return;
        }
        if (caught instanceof ApprovalHighRiskDispatchContextChangedError) {
          finishOperationBinding(binding);
          updateAttempt({ ...executing, phase: 'COMMAND_UNCERTAIN' });
          setError('command-uncertain');
          return;
        }
        const disposition = classifyApprovalHighRiskCommandFailure(caught);
        if (disposition === 'REISSUE_PROOF') {
          await restartProof(executing);
          return;
        }
        if (disposition === 'REPLAY_SUCCESS') {
          clearPopup();
          finishOperationBinding(binding);
          updateAttempt(null);
          setOpen(false);
          await productAuthority.revalidate();
          await onConflict?.();
          return;
        }
        if (disposition === 'AUTHORITY_CONFLICT') {
          await conflict();
          return;
        }
        if (disposition === 'AMBIGUOUS_RETRY' && executing.commandAttemptCount < 2) {
          updateAttempt(transitionApprovalHighRiskAttempt(executing, 'COMMAND_RETRY'));
          setError('command-retry');
          return;
        }
        updateAttempt({ ...executing, phase: 'COMMAND_UNCERTAIN' });
        setError(disposition === 'DETERMINISTIC_REJECT' ? 'command-rejected' : 'command-uncertain');
      } finally {
        setBusy(false);
      }
      if (completed) {
        if (revalidateAfterSuccess) await productAuthority.revalidate();
        await onSuccess?.(completedResult as TResult);
      }
    },
    [
      clearPopup,
      conflict,
      currentOperationBinding,
      dismissCancelledOperation,
      execute,
      finishOperationBinding,
      onConflict,
      onSuccess,
      productAuthority,
      restartProof,
      updateAttempt,
    ]
  );

  const begin = useCallback(
    async (command: ApprovalHighRiskCommandDescriptor) => {
      if (command.operation !== operation) {
        setError('authority-unavailable');
        setOpen(true);
        return;
      }
      if (attemptRef.current || operationBindingRef.current) {
        setOpen(true);
        setError('pending-attempt');
        return;
      }
      if (rolloutState === '000' || rolloutState === '100') {
        setBusy(true);
        try {
          const result = await execute(command, {
            mode: 'LEGACY_COMPATIBILITY',
            rolloutState,
          });
          await onSuccess?.(result);
        } catch {
          setError('legacy-command-failed');
          setOpen(true);
        } finally {
          setBusy(false);
        }
        return;
      }
      if (
        (rolloutState !== '110' && rolloutState !== '111') ||
        productAuthority.status !== 'ready' ||
        !entryBinding ||
        !operationIdentity
      ) {
        setError('authority-unavailable');
        setOpen(true);
        return;
      }
      setBusy(true);
      let binding: ApprovalHighRiskOperationBinding | null = null;
      try {
        binding = startOperationBinding(operationIdentity);
        const evaluation = await productAuthority.evaluateProduct(
          buildApprovalHighRiskActionEvaluationRequest(operation, entryBinding),
          { signal: binding.ticket.signal }
        );
        assertApprovalHighRiskOperationBindingCurrent(binding, operationIdentityRef.current);
        const resolution = resolveApprovalHighRiskActionAuthority({
          rolloutState,
          evaluation,
          contextKey: entryBinding.contextKey,
          contextScopeKey: entryBinding.contextScopeKey,
        });
        if (resolution.mode !== 'secure') {
          finishOperationBinding(binding);
          setError('authority-unavailable');
          setOpen(true);
          return;
        }
        binding.actionDecisionRevision.current = resolution.authority.expectedDecisionRevision;
        const next = createApprovalHighRiskAttempt(command, resolution.authority);
        assertApprovalHighRiskAttemptBinding(next, binding);
        assertApprovalHighRiskOperationBindingCurrent(binding, operationIdentityRef.current);
        updateAttempt(next);
        setError(null);
        setOpen(true);
      } catch (caught) {
        if (isProductSurfaceOperationCancelledError(caught) || binding?.ticket.signal.aborted) {
          dismissCancelledOperation(binding);
          return;
        }
        finishOperationBinding(binding);
        setError('authority-unavailable');
        setOpen(true);
      } finally {
        setBusy(false);
      }
    },
    [
      dismissCancelledOperation,
      entryBinding,
      execute,
      finishOperationBinding,
      onSuccess,
      operation,
      operationIdentity,
      productAuthority,
      rolloutState,
      startOperationBinding,
      updateAttempt,
    ]
  );

  const confirm = useCallback(async () => {
    const candidate = attemptRef.current;
    if (!candidate || busy) return;
    if (candidate.phase === 'CONFIRM_ISSUER' || candidate.phase === 'ISSUER_RETRY') {
      await issue(candidate);
      return;
    }
    if (candidate.phase === 'RECONFIRM_COMMAND' || candidate.phase === 'COMMAND_RETRY') {
      await runCommand(candidate);
    }
  }, [busy, issue, runCommand]);

  const continueWithIdentityProvider = useCallback(() => {
    const candidate = attemptRef.current;
    if (candidate?.continuation?.type !== 'OIDC' || busy) return;
    try {
      const binding = currentOperationBinding();
      assertApprovalHighRiskAttemptBinding(candidate, binding);
    } catch (caught) {
      if (isProductSurfaceOperationCancelledError(caught)) {
        dismissCancelledOperation();
        return;
      }
      throw caught;
    }
    const deadline = popupDeadlineMs(candidate, productAuthority.snapshot);
    if (deadline === null) {
      updateAttempt(transitionApprovalHighRiskAttempt(candidate, 'ISSUER_RETRY'));
      setError('popup-timeout');
      return;
    }
    const popup = window.open(
      candidate.continuation.authorizationUrl,
      'dwp-approval-step-up',
      'popup=yes,width=520,height=720,resizable=yes,scrollbars=yes'
    );
    if (!popup) {
      setError('popup-blocked');
      return;
    }
    popupRef.current = popup;
    popupDeadlineRef.current = deadline;
    updateAttempt(transitionApprovalHighRiskAttempt(candidate, 'RESUME_REQUIRED'));
    setError(null);
    popup.focus();
  }, [
    busy,
    currentOperationBinding,
    dismissCancelledOperation,
    productAuthority.snapshot,
    updateAttempt,
  ]);

  const selectIdentityProvider = useCallback(
    async (providerKey: string) => {
      const candidate = attemptRef.current;
      if (!candidate || busy) return;
      try {
        const binding = currentOperationBinding();
        assertApprovalHighRiskAttemptBinding(candidate, binding);
        const selected = selectApprovalStepUpProvider(candidate, providerKey);
        updateAttempt(selected);
        await issue(selected);
      } catch (caught) {
        if (isProductSurfaceOperationCancelledError(caught)) {
          dismissCancelledOperation();
          return;
        }
        setError('provider-unavailable');
      }
    },
    [busy, currentOperationBinding, dismissCancelledOperation, issue, updateAttempt]
  );

  const close = useCallback(() => {
    const binding = operationBindingRef.current;
    if (binding) {
      cancelOperationBinding();
      if (!binding.ticket.signal.aborted) return;
    }
    clearPopup();
    updateAttempt(null);
    setError(null);
    setOpen(false);
  }, [cancelOperationBinding, clearPopup, updateAttempt]);

  return {
    begin,
    controller: {
      open,
      busy,
      attempt,
      error,
      close,
      confirm,
      continueWithIdentityProvider,
      selectIdentityProvider,
    },
  };
}
