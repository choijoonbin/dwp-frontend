import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getProductSurfaceStepUpContinuation,
  isTrustedProductSurfaceStepUpWindowCompletion,
  issueProductSurfaceStepUpChallenge,
  matchesProductSurfaceStepUpCompletion,
  PRODUCT_SURFACE_STEP_UP_COMPLETION_CHANNEL,
  productSurfaceServerNow,
  useProductSurfaceAuthority,
} from '@dwp-frontend/shared-utils';
import { executeApprovalAdminV2HighRiskCommand } from '@dwp-frontend/shared-utils/api/approval-admin-v2-command-api';

import {
  resolveApprovalHighRiskActionAuthority,
  resolveApprovalHighRiskEntryBinding,
} from '../../../components/use-product-surface-high-risk-command';
import { useApprovalManagementCommandScope } from '../approval-management-command-scope';
import {
  approvalAdminV2CommandErrorState,
  approvalAdminV2CommandFailureState,
} from './approval-admin-v2-runtime-model';
import {
  approvalAdminV2IssuerRequest,
  approvalAdminV2SecureExecution,
} from './approval-admin-v2-command-model';

import type { ProductSurfaceStepUpCompletionMessage } from '@dwp-frontend/shared-utils';
import type { ApprovalAdminV2HighRiskCommand } from '@dwp-frontend/shared-utils/api/approval-admin-v2-command-api';
import type { ApprovalAdminV2CommandAttempt } from './approval-admin-v2-command-model';
import type { AdminV2SourceState } from './admin-v2-types';

export type ApprovalAdminV2CommandError =
  | 'authorityUnavailable'
  | 'issuerUnavailable'
  | 'providerUnavailable'
  | 'popupBlocked'
  | 'commandConflict'
  | 'commandUncertain'
  | 'commandRejected'
  | null;

type CommandSource = Readonly<{
  state: AdminV2SourceState;
  scopeReady: boolean;
  requestScope: Readonly<{ contextScopeKey?: string; cacheKey: readonly string[] }>;
  refetch: () => unknown;
}>;

type ApprovalAdminV2TargetFence = () => boolean;

type GuardedApprovalAdminV2CommandAttempt = ApprovalAdminV2CommandAttempt &
  Readonly<{
    generation: number;
    isTargetCurrent: ApprovalAdminV2TargetFence;
  }>;

const CURRENT_TARGET: ApprovalAdminV2TargetFence = () => true;

function currentReturnTo(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function useApprovalAdminV2Command(
  source: CommandSource,
  onSuccess?: () => void | Promise<void>
) {
  const productAuthority = useProductSurfaceAuthority();
  const commandScope = useApprovalManagementCommandScope(source.requestScope.cacheKey);
  const [attempt, setAttempt] = useState<GuardedApprovalAdminV2CommandAttempt | null>(null);
  const [error, setError] = useState<ApprovalAdminV2CommandError>(null);
  const [busy, setBusy] = useState(false);
  const [failureState, setFailureState] = useState<
    Extract<AdminV2SourceState, 'forbidden' | 'conflict' | 'unavailable'> | undefined
  >();
  const attemptRef = useRef(attempt);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const popupRef = useRef<Window | null>(null);
  attemptRef.current = attempt;

  const closePopup = useCallback(() => {
    popupRef.current?.close();
    popupRef.current = null;
  }, []);

  const isAttemptCurrent = useCallback((candidate: GuardedApprovalAdminV2CommandAttempt) => {
    return (
      mountedRef.current &&
      generationRef.current === candidate.generation &&
      candidate.isTargetCurrent()
    );
  }, []);

  const close = useCallback(() => {
    generationRef.current += 1;
    closePopup();
    if (!mountedRef.current) return;
    setAttempt(null);
    setError(null);
    setBusy(false);
  }, [closePopup]);

  const fail = useCallback((caught: unknown, commandError: ApprovalAdminV2CommandError) => {
    setFailureState(approvalAdminV2CommandFailureState(caught));
    setError(commandError);
  }, []);

  const resolveAuthority = useCallback(
    async (command: ApprovalAdminV2HighRiskCommand) => {
      const entry = resolveApprovalHighRiskEntryBinding(
        productAuthority.snapshot,
        source.requestScope.contextScopeKey
      );
      const rollout = productAuthority.rolloutForProduct('approvals');
      if (
        productAuthority.status !== 'ready' ||
        rollout.state !== 'ready' ||
        !entry ||
        !source.scopeReady
      ) {
        throw new Error('Approval command authority is unavailable.');
      }
      const evaluation = await productAuthority.evaluateProduct({
        subject: { type: 'PRODUCT', productKey: 'approvals', surfaceKey: 'approvals.admin' },
        routeContractKey: command.routeContractKey,
        contextScopeKey: entry.contextScopeKey,
      });
      const resolution = resolveApprovalHighRiskActionAuthority({
        rolloutState: rollout.rollout.state,
        evaluation,
        contextKey: entry.contextKey,
        contextScopeKey: entry.contextScopeKey,
      });
      if (resolution.mode !== 'secure') {
        throw new Error('Approval command authority is unavailable.');
      }
      return resolution.authority;
    },
    [productAuthority, source.requestScope.contextScopeKey, source.scopeReady]
  );

  const begin = useCallback(
    async (
      command: ApprovalAdminV2HighRiskCommand,
      isTargetCurrent: ApprovalAdminV2TargetFence = CURRENT_TARGET
    ) => {
      if (
        source.state !== 'ready' ||
        !source.scopeReady ||
        attemptRef.current ||
        !isTargetCurrent()
      ) {
        setFailureState('unavailable');
        setError('authorityUnavailable');
        return;
      }
      const generation = generationRef.current + 1;
      generationRef.current = generation;
      setBusy(true);
      setError(null);
      setFailureState(undefined);
      try {
        const authority = await resolveAuthority(command);
        if (!mountedRef.current || generationRef.current !== generation || !isTargetCurrent()) {
          return;
        }
        setAttempt({
          command,
          authority,
          scopeBinding: commandScope.binding,
          idempotencyKey: globalThis.crypto.randomUUID(),
          phase: 'CONFIRM_ISSUER',
          generation,
          isTargetCurrent,
        });
      } catch (caught) {
        if (mountedRef.current && generationRef.current === generation && isTargetCurrent()) {
          fail(caught, 'authorityUnavailable');
        }
      } finally {
        if (mountedRef.current && generationRef.current === generation) setBusy(false);
      }
    },
    [commandScope.binding, fail, resolveAuthority, source.scopeReady, source.state]
  );

  const issue = useCallback(
    async (candidate: GuardedApprovalAdminV2CommandAttempt) => {
      if (!isAttemptCurrent(candidate)) {
        close();
        return;
      }
      if (!commandScope.isCurrent(candidate.scopeBinding)) {
        close();
        setFailureState('unavailable');
        setError('authorityUnavailable');
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const issued = await issueProductSurfaceStepUpChallenge(
          approvalAdminV2IssuerRequest(candidate, currentReturnTo()),
          candidate.authority.expectedDecisionRevision
        );
        if (!isAttemptCurrent(candidate)) return;
        const serverNow = productAuthority.snapshot
          ? productSurfaceServerNow(productAuthority.snapshot)
          : Number.NaN;
        if (
          issued.decisionRevision !== candidate.authority.expectedDecisionRevision ||
          !Number.isFinite(serverNow) ||
          Date.parse(issued.expiresAt) <= serverNow
        ) {
          throw new Error('Issued Approval command proof is stale.');
        }
        closePopup();
        setAttempt({
          ...candidate,
          stepUp: issued,
          continuation: undefined,
          phase: 'RECONFIRM_COMMAND',
        });
      } catch (caught) {
        if (!isAttemptCurrent(candidate)) return;
        const continuation = getProductSurfaceStepUpContinuation(caught);
        if (continuation) {
          setAttempt({
            ...candidate,
            continuation: continuation.continuation,
            phase: 'CONTINUATION_REQUIRED',
          });
          return;
        }
        setAttempt({ ...candidate, phase: 'ISSUER_RETRY' });
        fail(caught, 'issuerUnavailable');
      } finally {
        if (isAttemptCurrent(candidate)) setBusy(false);
      }
    },
    [close, closePopup, commandScope, fail, isAttemptCurrent, productAuthority.snapshot]
  );

  const execute = useCallback(
    async (candidate: GuardedApprovalAdminV2CommandAttempt) => {
      if (!isAttemptCurrent(candidate)) {
        close();
        return;
      }
      let dispatched = false;
      setBusy(true);
      setError(null);
      try {
        if (!commandScope.isCurrent(candidate.scopeBinding)) {
          throw new Error('Approval management scope changed.');
        }
        const latestAuthority = await resolveAuthority(candidate.command);
        if (!isAttemptCurrent(candidate)) return;
        if (
          latestAuthority.contextKey !== candidate.authority.contextKey ||
          latestAuthority.contextScopeKey !== candidate.authority.contextScopeKey ||
          latestAuthority.expectedDecisionRevision !== candidate.authority.expectedDecisionRevision
        ) {
          throw new Error('Approval command authority changed.');
        }
        if (!isAttemptCurrent(candidate)) return;
        const scoped = { ...candidate.scopeBinding, input: candidate.command };
        await commandScope.run(scoped, (command) =>
          executeApprovalAdminV2HighRiskCommand(
            command,
            approvalAdminV2SecureExecution(candidate),
            {
              beforeDispatch: () => {
                if (
                  !commandScope.isCurrent(candidate.scopeBinding) ||
                  !isAttemptCurrent(candidate)
                ) {
                  throw new Error('Approval management scope changed.');
                }
                dispatched = true;
              },
            }
          )
        );
        setAttempt(null);
        setFailureState(undefined);
        await source.refetch();
        await onSuccess?.();
      } catch (caught) {
        if (isAttemptCurrent(candidate)) {
          fail(caught, approvalAdminV2CommandErrorState(caught, dispatched));
        }
      } finally {
        if (isAttemptCurrent(candidate)) setBusy(false);
      }
    },
    [close, commandScope, fail, isAttemptCurrent, onSuccess, resolveAuthority, source]
  );

  const confirm = useCallback(async () => {
    const candidate = attemptRef.current;
    if (!candidate || busy) return;
    if (!isAttemptCurrent(candidate)) {
      close();
      return;
    }
    if (candidate.phase === 'CONFIRM_ISSUER' || candidate.phase === 'ISSUER_RETRY') {
      await issue(candidate);
    } else if (candidate.phase === 'RECONFIRM_COMMAND') {
      await execute(candidate);
    }
  }, [busy, close, execute, isAttemptCurrent, issue]);

  const selectIdentityProvider = useCallback(
    async (providerKey: string) => {
      const candidate = attemptRef.current;
      if (
        !candidate ||
        !isAttemptCurrent(candidate) ||
        candidate.continuation?.type !== 'OIDC_PROVIDER_SELECTION' ||
        !candidate.continuation.providerKeys.includes(providerKey)
      ) {
        setError('providerUnavailable');
        return;
      }
      await issue({
        ...candidate,
        providerKey,
        continuation: undefined,
        phase: 'CONFIRM_ISSUER',
      });
    },
    [isAttemptCurrent, issue]
  );

  const continueWithIdentityProvider = useCallback(() => {
    const candidate = attemptRef.current;
    if (!candidate || !isAttemptCurrent(candidate) || candidate.continuation?.type !== 'OIDC')
      return;
    const popup = window.open(
      candidate.continuation.authorizationUrl,
      'dwp-approval-admin-v2-step-up',
      'popup=yes,width=520,height=720,resizable=yes,scrollbars=yes'
    );
    if (!popup) {
      setError('popupBlocked');
      return;
    }
    popupRef.current = popup;
    setAttempt({ ...candidate, phase: 'RESUME_REQUIRED' });
    popup.focus();
  }, [isAttemptCurrent]);

  const completePopup = useCallback(
    (message: ProductSurfaceStepUpCompletionMessage) => {
      const candidate = attemptRef.current;
      if (
        !candidate ||
        !isAttemptCurrent(candidate) ||
        candidate?.phase !== 'RESUME_REQUIRED' ||
        candidate.continuation?.type !== 'OIDC' ||
        candidate.continuation.flowRef !== message.flowId
      ) {
        return;
      }
      closePopup();
      void issue(candidate);
    },
    [closePopup, isAttemptCurrent, issue]
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      const candidate = attemptRef.current;
      const flowRef =
        candidate?.continuation?.type === 'OIDC' ? candidate.continuation.flowRef : '';
      if (
        !popupRef.current ||
        !isTrustedProductSurfaceStepUpWindowCompletion({
          value: event.data,
          expectedFlowRef: flowRef,
          eventOrigin: event.origin,
          expectedOrigin: window.location.origin,
          sourceMatches: event.source === popupRef.current,
        })
      ) {
        return;
      }
      completePopup(event.data as ProductSurfaceStepUpCompletionMessage);
    };
    window.addEventListener('message', onMessage);
    const channel =
      typeof BroadcastChannel === 'undefined'
        ? null
        : new BroadcastChannel(PRODUCT_SURFACE_STEP_UP_COMPLETION_CHANNEL);
    const onBroadcast = (event: MessageEvent<unknown>) => {
      const candidate = attemptRef.current;
      const flowRef =
        candidate?.continuation?.type === 'OIDC' ? candidate.continuation.flowRef : '';
      if (matchesProductSurfaceStepUpCompletion(event.data, flowRef)) {
        completePopup(event.data as ProductSurfaceStepUpCompletionMessage);
      }
    };
    channel?.addEventListener('message', onBroadcast);
    return () => {
      window.removeEventListener('message', onMessage);
      channel?.removeEventListener('message', onBroadcast);
      channel?.close();
    };
  }, [completePopup]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      closePopup();
    };
  }, [closePopup]);

  return {
    begin,
    failureState,
    reject: (caught: unknown) => {
      fail(caught, approvalAdminV2CommandErrorState(caught, true));
    },
    clearFailure: () => {
      setFailureState(undefined);
      setError(null);
    },
    controller: {
      open: attempt !== null,
      busy,
      attempt,
      error,
      close,
      confirm,
      continueWithIdentityProvider,
      selectIdentityProvider,
    },
  } as const;
}
