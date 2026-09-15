import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileClock, Search, ShieldCheck } from 'lucide-react';
import {
  ActionButton,
  ErrorState,
  FormField,
  InlineFeedback,
  SignalMetric,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  createApprovalRetentionClaim,
  getApprovalRetentionClaim,
  getApprovalRetentionPolicy,
  getApprovalRetentionRecord,
  initializeApprovalRetentionPolicy,
  publishApprovalRetentionPolicy,
  saveApprovalRetentionPolicy,
} from '@dwp-frontend/shared-utils/api/approval-retention-api';
import {
  approvalRetentionId,
  type ApprovalRetentionPolicy,
  type ApprovalRetentionRecord,
  type ApprovalRetentionRules,
} from '@dwp-frontend/shared-utils/api/approval-retention-contract';
import {
  prepareApprovalRetentionReceiptOriginal,
  type ApprovalRetentionReceiptCommand,
  type ApprovalRetentionReceiptMetadata,
  type ApprovalRetentionReceiptOriginal,
} from '@dwp-frontend/shared-utils/api/approval-retention-receipt-profile';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { ApprovalHighRiskCommandDialog } from './approval-high-risk-command-dialog';
import {
  useApprovalManagementCommandScope,
  useApprovalManagementHighRiskCommand,
  type ApprovalManagementScopeBinding,
} from './approval-management-command-scope';
import { approvalManagementSourceState } from './approval-management-source-state';
import {
  useApprovalManagementScopeReady,
  useApprovalManagementScopeReset,
} from './approval-management-scope';
import { useAuth, useProductSurfaceAuthority } from '@dwp-frontend/shared-utils';
import { useOptionalAllowedProductSurface } from '../../components/allowed-product-surface-context';
import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../../routes/product-surface-authorization.generated';
import {
  approvalRetentionPolicyAbsent,
  resolveApprovalRetentionIdentity,
} from './approval-retention-source';
import {
  ApprovalRetentionPolicyPanel,
  type ApprovalRetentionPolicyReview,
} from './approval-retention-policy-panel';
import { ApprovalRetentionPolicyUnavailable } from './approval-retention-policy-unavailable';
import { useApprovalRetentionPolicyDraft } from './use-approval-retention-policy-draft';
import {
  approvalRetentionPolicyPublishCommand,
  approvalRetentionRecordClaimCommand,
} from './approval-retention-command';
import {
  approvalRetentionRouteInstalled,
  useApprovalRetentionMutation,
} from './use-approval-retention-mutation';
import {
  useApprovalExperience,
  useApprovalManagementRequestScope,
} from './use-approval-experience';
import { ApprovalSurface } from './approval-ui';
import { ApprovalRetentionReceipt } from './approval-retention-receipt';
import { approvalRetentionReceiptRouteInstalled } from './approval-retention-receipt-authority';
import {
  approvalRetentionClaimReceiptCommand,
  approvalRetentionInitializeReceiptCommand,
  approvalRetentionPublishReceiptCommand,
  approvalRetentionQuerySourceReady,
  approvalRetentionReceiptAttemptMatches,
  approvalRetentionReceiptCapability,
  approvalRetentionReceiptCommitsOriginal,
  approvalRetentionReceiptOnlyController,
  approvalRetentionReceiptSourceIdentity,
  approvalRetentionSaveReceiptCommand,
  clearApprovalRetentionReceiptAttempt,
  preserveApprovalRetentionReceiptAttempt,
} from './approval-retention-receipt-owner';
import type { RetentionReceiptAttempt } from './approval-retention-receipt-owner';
import {
  useApprovalRetentionHighRiskReceiptRecovery,
  useApprovalRetentionHighRiskReceiptTracker,
} from './use-approval-retention-high-risk-receipt';

export function ApprovalRetentionWorkspace() {
  const { t, i18n } = useTranslation('approvals');
  const auth = useAuth();
  const experience = useApprovalExperience();
  const requestScope = useApprovalManagementRequestScope();
  const scopeReady = useApprovalManagementScopeReady(requestScope);
  const scope = useApprovalManagementCommandScope(requestScope.cacheKey);
  const client = useQueryClient();
  const authority = useProductSurfaceAuthority();
  const decision = useOptionalAllowedProductSurface();
  const identitySource = useRef({
    decision,
    snapshot: authority.snapshot,
    cacheKey: requestScope.cacheKey,
  });
  identitySource.current = {
    decision,
    snapshot: authority.snapshot,
    cacheKey: requestScope.cacheKey,
  };
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const identity = (capability: Parameters<typeof resolveApprovalRetentionIdentity>[3]) =>
    resolveApprovalRetentionIdentity(
      identitySource.current.decision,
      identitySource.current.snapshot,
      identitySource.current.cacheKey,
      capability
    );
  const policyReadIdentity = identity('approvals.policy.read');
  const recordReadIdentity = identity('approvals.operations.read');
  const [input, setInput] = useState('');
  const [selection, setSelection] = useState<{
    requestId: string;
    binding: ApprovalManagementScopeBinding;
  } | null>(null);
  const [claimSelection, setClaimSelection] = useState<{
    claimId: string;
    binding: ApprovalManagementScopeBinding;
  } | null>(null);
  const requestId = selection && scope.isCurrent(selection.binding) ? selection.requestId : null;
  const claimId =
    claimSelection && scope.isCurrent(claimSelection.binding) ? claimSelection.claimId : null;
  const [busy, setBusy] = useState(false);
  const {
    editor,
    setEditor,
    prepare: prepareDraft,
    complete: completeDraft,
    release: releaseDraft,
    reset: resetDraft,
  } = useApprovalRetentionPolicyDraft();
  const [review, setReview] = useState<ApprovalRetentionPolicyReview | null>(null);
  const [notice, setNotice] = useState<
    'saved' | 'accepted' | 'commandUnknown' | 'sourceChanged' | null
  >(null);
  const ordinaryLock = useRef<symbol | null>(null);
  const [uncertainAttempt, displayUncertainAttempt] = useState<RetentionReceiptAttempt | null>(
    null
  );
  const uncertainAttemptRef = useRef<RetentionReceiptAttempt | null>(null);
  const setUncertainAttempt = useCallback((value: RetentionReceiptAttempt | null) => {
    uncertainAttemptRef.current = value;
    displayUncertainAttempt(value);
  }, []);
  const selectedRequest = useRef(requestId);
  selectedRequest.current = requestId;
  const publishedOriginal = useRef<Readonly<ApprovalRetentionPolicy> | null>(null);
  const claimedOriginal = useRef<Readonly<ApprovalRetentionRecord> | null>(null);
  const current = useRef({
    scopeReady,
    experience,
    binding: scope.binding,
    requestScope,
    actorId: String(auth.user?.userId ?? ''),
  });
  current.current = {
    scopeReady,
    experience,
    binding: scope.binding,
    requestScope,
    actorId: String(auth.user?.userId ?? ''),
  };
  const policyKey = ['approvals', 'admin', 'retention-policy', ...requestScope.cacheKey] as const;
  const recordKey = [
    'approvals',
    'admin',
    'retention-record',
    requestId,
    ...requestScope.cacheKey,
  ] as const;
  const claimKey = [
    'approvals',
    'admin',
    'retention-claim',
    claimId,
    ...requestScope.cacheKey,
  ] as const;
  const policyInstalled = approvalRetentionRouteInstalled('retention-policy.data');
  const recordInstalled = approvalRetentionRouteInstalled('retention-record.data');
  const initialize = useApprovalRetentionMutation('retention-policy-initialize.action');
  const save = useApprovalRetentionMutation('retention-policy-draft.action');
  const requireScope = (original = scope.binding) => {
    if (!scope.isCurrent(original) || !current.current.scopeReady)
      throw new Error('Retention scope changed');
  };
  const readOptions = (
    signal: AbortSignal,
    capability: 'approvals.policy.read' | 'approvals.operations.read' = 'approvals.policy.read'
  ) => ({
    contextScopeKey: requestScope.contextScopeKey,
    expectedDecisionRevision:
      requestScope.cacheKey[3] === 'approvals.admin' ? requestScope.cacheKey[5] : undefined,
    signal,
    beforeDispatch: () => {
      requireScope();
      if (!identity(capability)) throw new Error('Retention read authority changed');
    },
  });
  const policy = useQuery({
    queryKey: policyKey,
    queryFn: ({ signal }) => getApprovalRetentionPolicy(readOptions(signal)),
    enabled:
      scopeReady && policyInstalled && experience.canViewPolicies && policyReadIdentity != null,
    retry: false,
    notifyOnChangeProps: 'all',
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const record = useQuery({
    queryKey: recordKey,
    queryFn: ({ signal }) =>
      getApprovalRetentionRecord(requestId!, {
        ...readOptions(signal, 'approvals.operations.read'),
        beforeDispatch: () => {
          requireScope();
          if (!identity('approvals.operations.read'))
            throw new Error('Retention read authority changed');
          if (selectedRequest.current !== requestId) throw new Error('Retention record changed');
        },
      }),
    enabled:
      scopeReady &&
      recordInstalled &&
      experience.canViewOperations &&
      requestId != null &&
      recordReadIdentity != null,
    retry: false,
    notifyOnChangeProps: 'all',
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const claim = useQuery({
    queryKey: claimKey,
    queryFn: ({ signal }) =>
      getApprovalRetentionClaim(claimId!, readOptions(signal, 'approvals.operations.read')),
    enabled:
      scopeReady &&
      approvalRetentionRouteInstalled('retention-claim.data') &&
      experience.canViewOperations &&
      claimId != null &&
      recordReadIdentity != null,
    retry: false,
    notifyOnChangeProps: 'all',
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const sourceReady = <T,>(key: readonly unknown[], original: T, identity: (value: T) => string) =>
    approvalRetentionQuerySourceReady(client.getQueryState<T>(key), original, identity);
  const receiptAttemptSourceCurrent = (
    attempt: RetentionReceiptAttempt,
    requireInstalledRoute = true
  ) => {
    const operation = attempt.original.command.operation;
    const capability = approvalRetentionReceiptCapability(operation);
    const liveIdentity = identity(capability);
    const actorId = Number(current.current.actorId);
    if (
      !scope.isCurrent(attempt.binding) ||
      !current.current.scopeReady ||
      identitySource.current.snapshot !== attempt.authoritySnapshot ||
      !Number.isSafeInteger(actorId) ||
      actorId !== attempt.original.actorUserId ||
      !liveIdentity ||
      liveIdentity.resourceSetKey !== attempt.original.resourceSetKey ||
      liveIdentity.fingerprint !== attempt.identityFingerprint ||
      (requireInstalledRoute &&
        !approvalRetentionReceiptRouteInstalled(operation, PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS))
    )
      return false;
    if (attempt.source.kind === 'ABSENT_POLICY')
      return approvalRetentionPolicyAbsent(client.getQueryState(policyKey));
    if (attempt.source.kind === 'POLICY')
      return (
        attempt.source.fingerprint ===
          approvalRetentionReceiptSourceIdentity(attempt.source.value) &&
        sourceReady(policyKey, attempt.source.value, approvalRetentionReceiptSourceIdentity)
      );
    return (
      selectedRequest.current === attempt.source.value.requestId &&
      attempt.source.fingerprint === approvalRetentionReceiptSourceIdentity(attempt.source.value) &&
      sourceReady(recordKey, attempt.source.value, approvalRetentionReceiptSourceIdentity)
    );
  };
  const prepareReceiptAttempt = async (
    command: ApprovalRetentionReceiptCommand,
    source: RetentionReceiptAttempt['source'],
    binding = scope.binding
  ) => {
    requireScope(binding);
    if (uncertainAttemptRef.current) throw new Error('A retention command remains uncertain');
    const capability = approvalRetentionReceiptCapability(command.operation);
    const liveIdentity = identity(capability);
    const authoritySnapshot = identitySource.current.snapshot;
    const actorUserId = Number(current.current.actorId);
    if (
      !liveIdentity ||
      !authoritySnapshot ||
      !Number.isSafeInteger(actorUserId) ||
      actorUserId <= 0
    )
      throw new Error('Retention receipt identity is unavailable');
    const original = await prepareApprovalRetentionReceiptOriginal(
      command,
      actorUserId,
      liveIdentity.resourceSetKey
    );
    const attempt = Object.freeze({
      original,
      binding,
      authoritySnapshot,
      identityFingerprint: liveIdentity.fingerprint,
      source,
    });
    if (!receiptAttemptSourceCurrent(attempt, false))
      throw new Error('Retention command source changed during preparation');
    return attempt;
  };
  const requirePolicy = (original: Readonly<ApprovalRetentionPolicy>, publish = false) => {
    requireScope();
    const currentIdentity = identity(
      publish ? 'approvals.policy.publish' : 'approvals.policy.update'
    );
    if (
      !currentIdentity ||
      currentIdentity.resourceSetKey !== original.resourceSetKey ||
      !sourceReady(policyKey, original, approvalRetentionReceiptSourceIdentity) ||
      !(publish
        ? current.current.experience.canPublishPolicies
        : current.current.experience.canEditPolicies) ||
      (publish &&
        (!original.publishEligible ||
          original.pendingMakerUserId === Number(current.current.requestScope.cacheKey[1])))
    )
      throw new Error('Retention policy source changed');
  };
  const canInitialize = () =>
    policyInstalled &&
    initialize.available &&
    current.current.scopeReady &&
    current.current.experience.canEditPolicies &&
    identity('approvals.policy.update') != null &&
    approvalRetentionPolicyAbsent(client.getQueryState(policyKey));
  const requireInitialization = () => {
    requireScope();
    if (!canInitialize()) throw new Error('Retention initialization source changed');
  };
  const requireRecord = (original: Readonly<ApprovalRetentionRecord>) => {
    requireScope();
    const currentIdentity = identity('approvals.operations.execute');
    if (
      !currentIdentity ||
      currentIdentity.resourceSetKey !== original.resourceSetKey ||
      !current.current.experience.canOperate ||
      selectedRequest.current !== original.requestId ||
      !original.claimEligible ||
      !sourceReady(recordKey, original, approvalRetentionReceiptSourceIdentity)
    )
      throw new Error('Retention record source changed');
  };
  const invalidate = async () => {
    await client.invalidateQueries({ queryKey: ['approvals', 'admin', 'retention-policy'] });
    await client.invalidateQueries({ queryKey: ['approvals', 'admin', 'retention-record'] });
  };
  const preserveUnknown = useCallback(
    (attempt: RetentionReceiptAttempt) => {
      setUncertainAttempt(
        preserveApprovalRetentionReceiptAttempt(uncertainAttemptRef.current, attempt)
      );
      setNotice('commandUnknown');
    },
    [setUncertainAttempt]
  );
  const policyReceipt = useApprovalRetentionHighRiskReceiptTracker(preserveUnknown);
  const claimReceipt = useApprovalRetentionHighRiskReceiptTracker(preserveUnknown);
  const highPolicy = useApprovalManagementHighRiskCommand({
    cacheKey: requestScope.cacheKey,
    operation: 'RETENTION_POLICY_PUBLISH',
    execute: (command, execution) => {
      const original = publishedOriginal.current;
      const attempt = policyReceipt.current();
      const witness = attempt?.original.command;
      if (
        !original ||
        !attempt ||
        witness?.operation !== 'PUBLISH_POLICY' ||
        !receiptAttemptSourceCurrent(attempt, false) ||
        !approvalRetentionRouteInstalled('retention-policy-publish.action') ||
        command.targetId !== witness.originalTargetId ||
        command.expectedObjectVersion !== witness.body.expectedVersion ||
        command.idempotencyKey !== witness.body.idempotencyKey
      )
        throw new Error('Retention publication changed');
      requirePolicy(original, true);
      return publishApprovalRetentionPolicy(
        witness.originalTargetId,
        witness.body,
        execution,
        () => {
          requirePolicy(original, true);
          if (!receiptAttemptSourceCurrent(attempt, false))
            throw new Error('Retention publication witness changed');
          policyReceipt.markDispatched();
        }
      );
    },
    onSuccess: async () => {
      policyReceipt.clear();
      setNotice('saved');
      await invalidate();
    },
    onConflict: async () => {
      policyReceipt.clear();
      await invalidate();
    },
  });
  const highClaim = useApprovalManagementHighRiskCommand({
    cacheKey: requestScope.cacheKey,
    operation: 'RETENTION_RECORD_CLAIM',
    execute: (command, execution) => {
      const original = claimedOriginal.current;
      const attempt = claimReceipt.current();
      const witness = attempt?.original.command;
      if (
        !original ||
        !attempt ||
        witness?.operation !== 'CLAIM_RECORD' ||
        !receiptAttemptSourceCurrent(attempt, false) ||
        !approvalRetentionRouteInstalled('retention-record-claim.action') ||
        command.targetId !== witness.originalTargetId ||
        command.expectedObjectVersion !== witness.body.expectedVersion ||
        command.idempotencyKey !== witness.body.idempotencyKey
      )
        throw new Error('Retention claim changed');
      requireRecord(original);
      return createApprovalRetentionClaim(witness.originalTargetId, witness.body, execution, () => {
        requireRecord(original);
        if (!receiptAttemptSourceCurrent(attempt, false))
          throw new Error('Retention claim witness changed');
        claimReceipt.markDispatched();
      });
    },
    onSuccess: async (data) => {
      claimReceipt.clear();
      setClaimSelection({ claimId: data.claimId, binding: scope.binding });
      setNotice('accepted');
      await invalidate();
    },
    onConflict: async () => {
      claimReceipt.clear();
      await invalidate();
    },
  });
  useApprovalRetentionHighRiskReceiptRecovery(highPolicy.controller, policyReceipt);
  useApprovalRetentionHighRiskReceiptRecovery(highClaim.controller, claimReceipt);
  const runOrdinary = async (
    command: ApprovalRetentionReceiptCommand,
    commandSource: RetentionReceiptAttempt['source'],
    execute: (
      original: ApprovalRetentionReceiptOriginal,
      beforeDispatch: () => void
    ) => Promise<unknown>,
    onNotDispatched?: (original: ApprovalRetentionReceiptOriginal) => void
  ) => {
    if (ordinaryLock.current) throw new Error('Retention command already running');
    if (uncertainAttemptRef.current) throw new Error('A retention command remains uncertain');
    const lock = Symbol('retention-command');
    ordinaryLock.current = lock;
    const binding = scope.binding;
    let attempt: RetentionReceiptAttempt | null = null;
    let dispatched = false;
    setBusy(true);
    setNotice(null);
    try {
      requireScope(binding);
      attempt = await prepareReceiptAttempt(command, commandSource, binding);
      await execute(attempt.original, () => {
        requireScope(binding);
        if (!attempt || !receiptAttemptSourceCurrent(attempt, false))
          throw new Error('Retention command source changed');
        dispatched = true;
      });
      requireScope(binding);
      setNotice('saved');
      await invalidate();
    } catch (error) {
      if (attempt && dispatched) preserveUnknown(attempt);
      else if (scope.isCurrent(binding)) {
        if (attempt) onNotDispatched?.(attempt.original);
        setNotice('sourceChanged');
      }
      throw error;
    } finally {
      if (ordinaryLock.current === lock) ordinaryLock.current = null;
      if (scope.isCurrent(binding)) setBusy(false);
    }
  };
  const recordReady =
    approvalManagementSourceState(record) === 'READY' &&
    !record.isFetching &&
    scopeReady &&
    recordReadIdentity != null &&
    record.data != null &&
    recordReadIdentity.resourceSetKey === record.data.resourceSetKey &&
    sourceReady(recordKey, record.data, approvalRetentionReceiptSourceIdentity);
  const policyReady =
    approvalManagementSourceState(policy) === 'READY' &&
    !policy.isFetching &&
    scopeReady &&
    policyReadIdentity != null &&
    policy.data != null &&
    policyReadIdentity.resourceSetKey === policy.data.resourceSetKey &&
    sourceReady(policyKey, policy.data, approvalRetentionReceiptSourceIdentity);
  const commandBusy = busy || highPolicy.controller.busy || highClaim.controller.busy;
  const commandBlocked =
    commandBusy ||
    highPolicy.controller.open ||
    highClaim.controller.open ||
    uncertainAttempt != null;
  const beginPolicyPublish = async (
    comment: string,
    originalPolicy: Readonly<ApprovalRetentionPolicy>
  ) => {
    if (commandBlocked || ordinaryLock.current) return false;
    const lock = Symbol('retention-policy-publication');
    ordinaryLock.current = lock;
    const binding = scope.binding;
    setBusy(true);
    setNotice(null);
    try {
      requirePolicy(originalPolicy, true);
      const command = approvalRetentionPublishReceiptCommand(
        originalPolicy,
        comment,
        crypto.randomUUID()
      );
      const attempt = await prepareReceiptAttempt(
        command,
        {
          kind: 'POLICY',
          value: originalPolicy,
          fingerprint: approvalRetentionReceiptSourceIdentity(originalPolicy),
        },
        binding
      );
      requirePolicy(originalPolicy, true);
      if (attempt.original.command.operation !== 'PUBLISH_POLICY')
        throw new Error('Retention publication witness changed');
      policyReceipt.stage(attempt);
      publishedOriginal.current = originalPolicy;
      await highPolicy.begin(
        approvalRetentionPolicyPublishCommand(
          attempt.original.command.originalTargetId,
          attempt.original.command.body.expectedVersion,
          attempt.original.command.body.reviewComment,
          attempt.original.command.body.idempotencyKey
        )
      );
      return true;
    } catch {
      policyReceipt.clear();
      publishedOriginal.current = null;
      if (scope.isCurrent(binding)) setNotice('sourceChanged');
      return false;
    } finally {
      if (ordinaryLock.current === lock) ordinaryLock.current = null;
      if (scope.isCurrent(binding)) setBusy(false);
    }
  };
  const beginRecordClaim = async (originalRecord: Readonly<ApprovalRetentionRecord>) => {
    if (commandBlocked || ordinaryLock.current) return;
    const lock = Symbol('retention-record-claim');
    ordinaryLock.current = lock;
    const binding = scope.binding;
    setBusy(true);
    setNotice(null);
    try {
      requireRecord(originalRecord);
      const command = approvalRetentionClaimReceiptCommand(originalRecord, crypto.randomUUID());
      const attempt = await prepareReceiptAttempt(
        command,
        {
          kind: 'RECORD',
          value: originalRecord,
          fingerprint: approvalRetentionReceiptSourceIdentity(originalRecord),
        },
        binding
      );
      requireRecord(originalRecord);
      if (attempt.original.command.operation !== 'CLAIM_RECORD')
        throw new Error('Retention claim witness changed');
      claimReceipt.stage(attempt);
      claimedOriginal.current = originalRecord;
      await highClaim.begin(
        approvalRetentionRecordClaimCommand(
          attempt.original.command.originalTargetId,
          attempt.original.command.body
        )
      );
    } catch {
      claimReceipt.clear();
      claimedOriginal.current = null;
      if (scope.isCurrent(binding)) setNotice('sourceChanged');
    } finally {
      if (ordinaryLock.current === lock) ordinaryLock.current = null;
      if (scope.isCurrent(binding)) setBusy(false);
    }
  };
  const closePolicy = highPolicy.controller.close;
  const closeClaim = highClaim.controller.close;
  const reset = useCallback(() => {
    selectedRequest.current = null;
    setInput('');
    setSelection(null);
    setClaimSelection(null);
    setNotice(null);
    setBusy(false);
    resetDraft();
    setReview(null);
    publishedOriginal.current = null;
    claimedOriginal.current = null;
    policyReceipt.settleScopeReset();
    claimReceipt.settleScopeReset();
    // UNKNOWN is cleared only by its matching COMMITTED receipt, never by a scope reset.
    closePolicy();
    closeClaim();
  }, [claimReceipt, closePolicy, closeClaim, policyReceipt, resetDraft]);
  useApprovalManagementScopeReset(requestScope.cacheKey, reset);
  let validId = false;
  try {
    approvalRetentionId(input.trim());
    validId = true;
  } catch {
    /* Keep the user's lookup input. */
  }
  const receiptSourceIsCurrent = (attempt: RetentionReceiptAttempt) =>
    uncertainAttemptRef.current === attempt && receiptAttemptSourceCurrent(attempt);
  const receiptOriginalIsCurrent = (original: ApprovalRetentionReceiptOriginal) => {
    const attempt = uncertainAttemptRef.current;
    return Boolean(
      attempt &&
      approvalRetentionReceiptAttemptMatches(attempt, original) &&
      receiptAttemptSourceCurrent(attempt)
    );
  };
  const confirmReceipt = async (
    original: ApprovalRetentionReceiptOriginal,
    receipt: ApprovalRetentionReceiptMetadata
  ) => {
    const attempt = uncertainAttemptRef.current;
    if (
      !attempt ||
      !approvalRetentionReceiptAttemptMatches(attempt, original) ||
      !receiptAttemptSourceCurrent(attempt) ||
      !approvalRetentionReceiptCommitsOriginal(receipt, original)
    )
      return;
    if (policyReceipt.current()?.original === original) policyReceipt.clear();
    if (claimReceipt.current()?.original === original) claimReceipt.clear();
    if (original.command.operation === 'SAVE_POLICY')
      completeDraft(original.command.body.idempotencyKey);
    if (original.command.operation === 'CLAIM_RECORD') {
      setClaimSelection({ claimId: receipt.resultReferenceId, binding: attempt.binding });
      setNotice('accepted');
    } else {
      setNotice('saved');
    }
    setUncertainAttempt(clearApprovalRetentionReceiptAttempt(attempt, original));
    await invalidate();
  };
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  if (!policyInstalled && !recordInstalled)
    return <InlineFeedback severity="warning">{t('admin.retention.notInstalled')}</InlineFeedback>;
  return (
    <Stack gap={2} minWidth={0}>
      {notice ? (
        <InlineFeedback
          severity={
            notice === 'commandUnknown' ? 'warning' : notice === 'sourceChanged' ? 'error' : 'info'
          }
        >
          {t(`admin.retention.${notice}`)}
        </InlineFeedback>
      ) : null}
      {uncertainAttempt ? (
        <ApprovalRetentionReceipt
          original={uncertainAttempt.original}
          sourceIsCurrent={() => receiptSourceIsCurrent(uncertainAttempt)}
          isOriginal={receiptOriginalIsCurrent}
          onConfirmed={confirmReceipt}
        />
      ) : null}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'repeat(2,minmax(0,1fr))' },
          gap: 2,
        }}
      >
        {policyReady ? (
          <ApprovalRetentionPolicyPanel
            policy={policy.data!}
            ready={policyReady}
            busy={commandBusy}
            blocked={commandBlocked}
            editor={editor}
            onEditorChange={setEditor}
            review={review}
            onReviewChange={setReview}
            canEdit={experience.canEditPolicies && save.available}
            canPublish={
              experience.canPublishPolicies &&
              policy.data!.publishEligible &&
              policy.data!.pendingMakerUserId !== Number(requestScope.cacheKey[1]) &&
              approvalRetentionRouteInstalled('retention-policy-publish.action')
            }
            onRefresh={() => {
              setNotice(null);
              void policy.refetch();
            }}
            onSave={(rules: Readonly<ApprovalRetentionRules>, original) => {
              requirePolicy(original);
              const draftAttempt = prepareDraft(original, rules);
              const command = approvalRetentionSaveReceiptCommand(
                original,
                draftAttempt.rules,
                draftAttempt.idempotencyKey
              );
              return runOrdinary(
                command,
                {
                  kind: 'POLICY',
                  value: original,
                  fingerprint: approvalRetentionReceiptSourceIdentity(original),
                },
                (receiptOriginal, beforeDispatch) => {
                  const witness = receiptOriginal.command;
                  if (witness.operation !== 'SAVE_POLICY')
                    throw new Error('Retention save witness changed');
                  return save.run((execution) =>
                    saveApprovalRetentionPolicy(
                      witness.originalTargetId,
                      witness.body,
                      execution,
                      () => {
                        requirePolicy(original);
                        beforeDispatch();
                      }
                    )
                  );
                },
                () => releaseDraft(draftAttempt.idempotencyKey)
              ).then(() => completeDraft(draftAttempt.idempotencyKey));
            }}
            onPublish={beginPolicyPublish}
          />
        ) : (
          <ApprovalRetentionPolicyUnavailable
            loading={policy.isPending && policy.fetchStatus === 'fetching'}
            busy={commandBusy}
            blocked={commandBlocked}
            canInitialize={!commandBlocked && canInitialize()}
            onRefresh={() => void policy.refetch()}
            onInitialize={() => {
              const key = crypto.randomUUID();
              const command = approvalRetentionInitializeReceiptCommand(key);
              void runOrdinary(
                command,
                { kind: 'ABSENT_POLICY' },
                (receiptOriginal, beforeDispatch) => {
                  const witness = receiptOriginal.command;
                  if (witness.operation !== 'INITIALIZE_POLICY')
                    throw new Error('Retention initialization witness changed');
                  return initialize.run((execution) => {
                    requireInitialization();
                    return initializeApprovalRetentionPolicy(witness.body, execution, () => {
                      requireInitialization();
                      beforeDispatch();
                    });
                  });
                }
              ).catch(() => undefined);
            }}
          />
        )}
        <ApprovalSurface
          title={t('admin.retention.recordTitle')}
          meta={t('admin.retention.recordDescription')}
        >
          <Stack gap={2} sx={{ p: 2 }}>
            <Box
              component="form"
              onSubmit={(event) => {
                event.preventDefault();
                if (
                  commandBlocked ||
                  !scopeReady ||
                  !recordInstalled ||
                  !experience.canViewOperations ||
                  !validId
                )
                  return;
                const id = input.trim();
                selectedRequest.current = id;
                setSelection({ requestId: id, binding: scope.binding });
                setClaimSelection(null);
                setNotice(null);
              }}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                <FormField
                  label={t('admin.retention.requestId')}
                  value={input}
                  disabled={commandBlocked}
                  onChange={(event) => setInput(event.target.value)}
                  fullWidth
                />
                <ActionButton
                  type="submit"
                  startIcon={<Search size={16} />}
                  disabled={
                    commandBlocked ||
                    !scopeReady ||
                    !recordInstalled ||
                    !experience.canViewOperations ||
                    !validId
                  }
                >
                  {t('admin.retention.inspect')}
                </ActionButton>
              </Stack>
            </Box>
            {requestId && recordReady ? (
              <>
                <InlineFeedback severity={record.data!.claimEligible ? 'info' : 'warning'}>
                  {t(`admin.retention.reasons.${record.data!.claimReason}`)}
                </InlineFeedback>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(3,minmax(0,1fr))' },
                    gap: 1,
                  }}
                >
                  <SignalMetric
                    label={t('admin.retention.inventoryRows')}
                    value={String(record.data!.inventoryRows)}
                    detail={record.data!.resourceSetKey}
                    icon={<FileClock size={16} />}
                  />
                  <SignalMetric
                    label={t('admin.retention.inventoryTables')}
                    value={String(record.data!.inventoryTables)}
                    detail={record.data!.resourceSetKey}
                    icon={<FileClock size={16} />}
                  />
                  <SignalMetric
                    label={t('admin.retention.objects')}
                    value={String(record.data!.objectCount)}
                    detail={record.data!.resourceSetKey}
                    icon={<FileClock size={16} />}
                  />
                </Box>
                <Box sx={{ typography: 'body2' }}>
                  {t('admin.retention.eligibleAfter')} ·{' '}
                  {record.data!.eligibleAfter
                    ? formatDate(
                        record.data!.eligibleAfter,
                        { dateStyle: 'medium', timeStyle: 'short' },
                        locale
                      )
                    : t('admin.retention.none')}
                </Box>
                <Box
                  sx={{ typography: 'caption', color: 'text.secondary', overflowWrap: 'anywhere' }}
                >
                  {t('admin.retention.inventoryDigest')} · {record.data!.inventorySha256}
                </Box>
                <InlineFeedback severity="warning">
                  {t('admin.retention.intentNotDeletion')}
                </InlineFeedback>
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                  <ActionButton
                    intent="secondary"
                    disabled={commandBlocked}
                    onClick={() => void record.refetch()}
                  >
                    {t('actions.refresh')}
                  </ActionButton>
                  <ActionButton
                    startIcon={<ShieldCheck size={16} />}
                    disabled={
                      !experience.canOperate ||
                      !record.data!.claimEligible ||
                      commandBlocked ||
                      !approvalRetentionRouteInstalled('retention-record-claim.action')
                    }
                    onClick={() => {
                      void beginRecordClaim(record.data!);
                    }}
                  >
                    {t('admin.retention.registerIntent')}
                  </ActionButton>
                </Stack>
              </>
            ) : requestId ? (
              <ErrorState
                title={t('admin.retention.sourceChanged')}
                retryLabel={commandBlocked ? undefined : t('actions.refresh')}
                onRetry={commandBlocked ? undefined : () => void record.refetch()}
                size="compact"
              />
            ) : null}
            {claimId &&
            scopeReady &&
            claim.data &&
            recordReadIdentity?.resourceSetKey === claim.data.resourceSetKey &&
            approvalManagementSourceState(claim) === 'READY' &&
            !claim.isFetching ? (
              <>
                <InlineFeedback
                  severity={
                    claim.data.foreignCopyState === 'ALL_DECLARED_COPIES_CONFIRMED'
                      ? 'info'
                      : 'warning'
                  }
                >
                  {t(`admin.retention.copyStates.${claim.data.foreignCopyState}`)}
                </InlineFeedback>
                <Box sx={{ typography: 'body2' }}>
                  {t('admin.retention.acknowledgements')} · {claim.data.verifiedAcknowledgements}/
                  {claim.data.foreignRequests}
                </Box>
                <ActionButton
                  intent="secondary"
                  disabled={commandBlocked}
                  onClick={() => void claim.refetch()}
                >
                  {t('actions.refresh')}
                </ActionButton>
              </>
            ) : claimId ? (
              <ErrorState
                title={t('admin.retention.sourceChanged')}
                onRetry={commandBlocked ? undefined : () => void claim.refetch()}
                retryLabel={commandBlocked ? undefined : t('actions.refresh')}
                size="compact"
              />
            ) : null}
          </Stack>
        </ApprovalSurface>
      </Box>
      <ApprovalHighRiskCommandDialog
        controller={approvalRetentionReceiptOnlyController(highPolicy.controller)}
      />
      <ApprovalHighRiskCommandDialog
        controller={approvalRetentionReceiptOnlyController(highClaim.controller)}
      />
    </Stack>
  );
}
