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
  approvalRetentionKey,
  approvalRetentionVersion,
} from '@dwp-frontend/shared-utils/api/approval-retention-contract';
import type {
  ApprovalRetentionPolicy,
  ApprovalRetentionRecord,
  ApprovalRetentionRules,
} from '@dwp-frontend/shared-utils/api/approval-retention-contract';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { ApprovalHighRiskCommandDialog } from './approval-high-risk-command-dialog';
import {
  useApprovalManagementCommandScope,
  useApprovalManagementHighRiskCommand,
} from './approval-management-command-scope';
import { approvalManagementSourceState } from './approval-management-source-state';
import {
  useApprovalManagementScopeReady,
  useApprovalManagementScopeReset,
} from './approval-management-scope';
import { useProductSurfaceAuthority } from '@dwp-frontend/shared-utils';
import { useOptionalAllowedProductSurface } from '../../components/allowed-product-surface-context';
import {
  approvalRetentionPolicyAbsent,
  resolveApprovalRetentionIdentity,
} from './approval-retention-source';
import type { ApprovalManagementScopeBinding } from './approval-management-command-scope';
import { ApprovalRetentionPolicyPanel } from './approval-retention-policy-panel';
import type { ApprovalRetentionPolicyReview } from './approval-retention-policy-panel';
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

function sourceIdentity(source: Readonly<ApprovalRetentionPolicy | ApprovalRetentionRecord>) {
  return JSON.stringify(source);
}

export function ApprovalRetentionWorkspace() {
  const { t, i18n } = useTranslation('approvals');
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
    reset: resetDraft,
  } = useApprovalRetentionPolicyDraft();
  const [review, setReview] = useState<ApprovalRetentionPolicyReview | null>(null);
  const [notice, setNotice] = useState<'saved' | 'accepted' | 'commandUnknown' | null>(null);
  const ordinaryLock = useRef<symbol | null>(null);
  const selectedRequest = useRef(requestId);
  selectedRequest.current = requestId;
  const publishedOriginal = useRef<Readonly<ApprovalRetentionPolicy> | null>(null);
  const claimedOriginal = useRef<Readonly<ApprovalRetentionRecord> | null>(null);
  const current = useRef({ scopeReady, experience, binding: scope.binding, requestScope });
  current.current = { scopeReady, experience, binding: scope.binding, requestScope };
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
  const sourceReady = <T,>(
    key: readonly unknown[],
    original: T,
    identity: (value: T) => string
  ) => {
    const state = client.getQueryState<T>(key);
    return (
      state?.status === 'success' &&
      state.fetchStatus === 'idle' &&
      state.error == null &&
      state.fetchFailureCount === 0 &&
      state.data != null &&
      identity(state.data) === identity(original)
    );
  };
  const requirePolicy = (original: Readonly<ApprovalRetentionPolicy>, publish = false) => {
    requireScope();
    const currentIdentity = identity(
      publish ? 'approvals.policy.publish' : 'approvals.policy.update'
    );
    if (
      !currentIdentity ||
      currentIdentity.resourceSetKey !== original.resourceSetKey ||
      !sourceReady(policyKey, original, sourceIdentity) ||
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
      !sourceReady(recordKey, original, sourceIdentity)
    )
      throw new Error('Retention record source changed');
  };
  const invalidate = async () => {
    await client.invalidateQueries({ queryKey: ['approvals', 'admin', 'retention-policy'] });
    await client.invalidateQueries({ queryKey: ['approvals', 'admin', 'retention-record'] });
  };
  const highPolicy = useApprovalManagementHighRiskCommand({
    cacheKey: requestScope.cacheKey,
    operation: 'RETENTION_POLICY_PUBLISH',
    execute: (command, execution) => {
      const original = publishedOriginal.current;
      if (
        !original ||
        !approvalRetentionRouteInstalled('retention-policy-publish.action') ||
        command.targetId !== original.policyId ||
        command.expectedObjectVersion !== original.version
      )
        throw new Error('Retention publication changed');
      requirePolicy(original, true);
      return publishApprovalRetentionPolicy(
        command.targetId,
        {
          expectedVersion: command.expectedObjectVersion,
          idempotencyKey: approvalRetentionKey(command.payload.idempotencyKey),
          reviewComment:
            typeof command.payload.reviewComment === 'string' ? command.payload.reviewComment : '',
        },
        execution,
        () => requirePolicy(original, true)
      );
    },
    onSuccess: async () => {
      setNotice('saved');
      await invalidate();
    },
    onConflict: invalidate,
  });
  const highClaim = useApprovalManagementHighRiskCommand({
    cacheKey: requestScope.cacheKey,
    operation: 'RETENTION_RECORD_CLAIM',
    execute: (command, execution) => {
      const original = claimedOriginal.current;
      if (
        !original ||
        !approvalRetentionRouteInstalled('retention-record-claim.action') ||
        command.targetId !== original.requestId ||
        command.expectedObjectVersion !== original.version
      )
        throw new Error('Retention claim changed');
      requireRecord(original);
      return createApprovalRetentionClaim(
        command.targetId,
        {
          expectedVersion: command.expectedObjectVersion,
          policyId: approvalRetentionId(command.payload.policyId),
          expectedPolicyVersion: approvalRetentionVersion(command.payload.expectedPolicyVersion),
          expectedHoldVersion: approvalRetentionVersion(command.payload.expectedHoldVersion),
          inventorySha256:
            typeof command.payload.inventorySha256 === 'string'
              ? command.payload.inventorySha256
              : '',
          idempotencyKey: approvalRetentionKey(command.payload.idempotencyKey),
        },
        execution,
        () => requireRecord(original)
      );
    },
    onSuccess: async (data) => {
      setClaimSelection({ claimId: data.claimId, binding: scope.binding });
      setNotice('accepted');
      await invalidate();
    },
    onConflict: invalidate,
  });
  const runOrdinary = async (execute: () => Promise<unknown>) => {
    if (ordinaryLock.current) throw new Error('Retention command already running');
    const lock = Symbol('retention-command');
    ordinaryLock.current = lock;
    const binding = scope.binding;
    setBusy(true);
    setNotice(null);
    try {
      requireScope(binding);
      await execute();
      requireScope(binding);
      setNotice('saved');
      await invalidate();
    } catch (error) {
      if (scope.isCurrent(binding)) setNotice('commandUnknown');
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
    sourceReady(recordKey, record.data, sourceIdentity);
  const policyReady =
    approvalManagementSourceState(policy) === 'READY' &&
    !policy.isFetching &&
    scopeReady &&
    policyReadIdentity != null &&
    policy.data != null &&
    policyReadIdentity.resourceSetKey === policy.data.resourceSetKey &&
    sourceReady(policyKey, policy.data, sourceIdentity);
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
    closePolicy();
    closeClaim();
  }, [closePolicy, closeClaim, resetDraft]);
  useApprovalManagementScopeReset(requestScope.cacheKey, reset);
  let validId = false;
  try {
    approvalRetentionId(input.trim());
    validId = true;
  } catch {
    /* Keep the user's lookup input. */
  }
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  if (!policyInstalled && !recordInstalled)
    return <InlineFeedback severity="warning">{t('admin.retention.notInstalled')}</InlineFeedback>;
  return (
    <Stack gap={2} minWidth={0}>
      {notice ? (
        <InlineFeedback severity={notice === 'commandUnknown' ? 'warning' : 'info'}>
          {t(`admin.retention.${notice}`)}
        </InlineFeedback>
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
            busy={busy}
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
              let key: string | null = null;
              return runOrdinary(() => {
                requirePolicy(original);
                const attempt = prepareDraft(original, rules);
                key = attempt.idempotencyKey;
                return save.run((execution) =>
                  saveApprovalRetentionPolicy(
                    original.policyId,
                    {
                      expectedVersion: original.version,
                      idempotencyKey: attempt.idempotencyKey,
                      rules: attempt.rules,
                    },
                    execution,
                    () => requirePolicy(original)
                  )
                );
              }).then(() => {
                if (key) completeDraft(key);
              });
            }}
            onPublish={(comment, original) => {
              try {
                requirePolicy(original, true);
                publishedOriginal.current = original;
                void highPolicy
                  .begin(
                    approvalRetentionPolicyPublishCommand(
                      original.policyId,
                      original.version,
                      comment,
                      crypto.randomUUID()
                    )
                  )
                  .catch(() => setNotice('commandUnknown'));
                return true;
              } catch {
                setNotice('commandUnknown');
                return false;
              }
            }}
          />
        ) : (
          <ApprovalRetentionPolicyUnavailable
            loading={policy.isPending && policy.fetchStatus === 'fetching'}
            busy={busy}
            canInitialize={!busy && canInitialize()}
            onRefresh={() => void policy.refetch()}
            onInitialize={() => {
              const key = crypto.randomUUID();
              void runOrdinary(() => {
                requireInitialization();
                return initialize.run((execution) => {
                  requireInitialization();
                  return initializeApprovalRetentionPolicy(
                    { expectedAbsent: true, idempotencyKey: key },
                    execution,
                    requireInitialization
                  );
                });
              }).catch(() => undefined);
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
                if (!scopeReady || !recordInstalled || !experience.canViewOperations || !validId)
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
                  onChange={(event) => setInput(event.target.value)}
                  fullWidth
                />
                <ActionButton
                  type="submit"
                  startIcon={<Search size={16} />}
                  disabled={
                    !scopeReady || !recordInstalled || !experience.canViewOperations || !validId
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
                  <ActionButton intent="secondary" onClick={() => void record.refetch()}>
                    {t('actions.refresh')}
                  </ActionButton>
                  <ActionButton
                    startIcon={<ShieldCheck size={16} />}
                    disabled={
                      !experience.canOperate ||
                      !record.data!.claimEligible ||
                      busy ||
                      !approvalRetentionRouteInstalled('retention-record-claim.action')
                    }
                    onClick={() => {
                      const original = record.data!;
                      try {
                        requireRecord(original);
                        claimedOriginal.current = original;
                        highClaim.begin(
                          approvalRetentionRecordClaimCommand(original.requestId, {
                            expectedVersion: original.version,
                            policyId: original.policyId,
                            expectedPolicyVersion: original.policyVersion,
                            expectedHoldVersion: original.holdVersion,
                            inventorySha256: original.inventorySha256,
                            idempotencyKey: crypto.randomUUID(),
                          })
                        );
                      } catch {
                        setNotice('commandUnknown');
                      }
                    }}
                  >
                    {t('admin.retention.registerIntent')}
                  </ActionButton>
                </Stack>
              </>
            ) : requestId ? (
              <ErrorState
                title={t('admin.retention.sourceChanged')}
                retryLabel={t('actions.refresh')}
                onRetry={() => void record.refetch()}
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
                <ActionButton intent="secondary" onClick={() => void claim.refetch()}>
                  {t('actions.refresh')}
                </ActionButton>
              </>
            ) : claimId ? (
              <ErrorState
                title={t('admin.retention.sourceChanged')}
                onRetry={() => void claim.refetch()}
                retryLabel={t('actions.refresh')}
                size="compact"
              />
            ) : null}
          </Stack>
        </ApprovalSurface>
      </Box>
      <ApprovalHighRiskCommandDialog controller={highPolicy.controller} />
      <ApprovalHighRiskCommandDialog controller={highClaim.controller} />
    </Stack>
  );
}
