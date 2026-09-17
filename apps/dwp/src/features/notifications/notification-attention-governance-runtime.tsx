import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createNotificationAttentionGovernanceDraft,
  getNotificationAttentionGovernance,
  publishNotificationAttentionGovernance,
  rejectNotificationAttentionGovernance,
  withdrawNotificationAttentionGovernance,
} from '@dwp-frontend/shared-utils/api/notification-attention-governance-api';
import { createNotificationIdempotencyKey } from '@dwp-frontend/shared-utils/api/notification-api';
import { useAuth, usePermissions } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';

import { NotificationAttentionGovernanceStudio } from './notification-attention-governance-studio';

import type { NotificationAttentionGovernanceCopy } from './notification-attention-governance-studio';

const notificationAttentionGovernanceQueryKey = [
  'notifications',
  'admin',
  'attention-governance',
] as const;

const notificationNoiseQualityQueryKey = ['notifications', 'admin', 'noise-quality'] as const;

function statusOf(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('status' in error)) return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : null;
}

function isNotificationAttentionGovernanceStale(error: unknown): boolean {
  return statusOf(error) === 409;
}

export function NotificationAttentionGovernanceRuntime() {
  const { t } = useTranslation('notifications');
  const auth = useAuth();
  const { hasPermission, isLoaded: permissionsLoaded } = usePermissions();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const attentionRequested = searchParams.get('tab') === 'attention';
  const surfaceRef = useRef<HTMLDivElement>(null);

  const canView = hasPermission('ADMIN.NOTIFICATION_POLICY', 'VIEW');
  const canManage = hasPermission('ADMIN.NOTIFICATION_POLICY', 'MANAGE');
  const canApprove = hasPermission('ADMIN.NOTIFICATION_POLICY', 'APPROVE');
  const canRead = canView || canManage || canApprove;
  const actorUserId = auth.user?.userId;
  const identityReady = !auth.isLoading && permissionsLoaded;
  const queryEnabled =
    identityReady &&
    auth.isAuthenticated &&
    canRead &&
    typeof actorUserId === 'number' &&
    Number.isInteger(actorUserId) &&
    actorUserId > 0;

  const workspace = useQuery({
    queryKey: notificationAttentionGovernanceQueryKey,
    queryFn: ({ signal }) => getNotificationAttentionGovernance(signal),
    enabled: queryEnabled,
    staleTime: 20_000,
    retry: 1,
  });

  const invalidateWorkspace = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: notificationAttentionGovernanceQueryKey }),
      queryClient.invalidateQueries({ queryKey: notificationNoiseQualityQueryKey }),
    ]);
  };
  const refreshAfterConflict = async (error: unknown) => {
    if (isNotificationAttentionGovernanceStale(error)) await invalidateWorkspace();
  };

  const createDraft = useMutation({
    mutationFn: (input: Parameters<typeof createNotificationAttentionGovernanceDraft>[0]) =>
      createNotificationAttentionGovernanceDraft(input),
    onSuccess: invalidateWorkspace,
    onError: refreshAfterConflict,
  });
  const publish = useMutation({
    mutationFn: ({
      governanceId,
      input,
    }: {
      governanceId: string;
      input: Parameters<typeof publishNotificationAttentionGovernance>[1];
    }) => publishNotificationAttentionGovernance(governanceId, input),
    onSuccess: invalidateWorkspace,
    onError: refreshAfterConflict,
  });
  const reject = useMutation({
    mutationFn: ({
      governanceId,
      input,
    }: {
      governanceId: string;
      input: Parameters<typeof rejectNotificationAttentionGovernance>[1];
    }) => rejectNotificationAttentionGovernance(governanceId, input),
    onSuccess: invalidateWorkspace,
    onError: refreshAfterConflict,
  });
  const withdraw = useMutation({
    mutationFn: ({
      governanceId,
      input,
    }: {
      governanceId: string;
      input: Parameters<typeof withdrawNotificationAttentionGovernance>[1];
    }) => withdrawNotificationAttentionGovernance(governanceId, input),
    onSuccess: invalidateWorkspace,
    onError: refreshAfterConflict,
  });

  const copy = useMemo<NotificationAttentionGovernanceCopy>(
    () => ({
      title: t('admin.attentionGovernance.title'),
      description: t('admin.attentionGovernance.description'),
      liveStatus: t('admin.attentionGovernance.liveStatus'),
      draftStatus: t('admin.attentionGovernance.draftStatus'),
      loading: t('admin.attentionGovernance.loading'),
      loadErrorTitle: t('admin.attentionGovernance.loadErrorTitle'),
      retry: t('actions.retry'),
      emptyTitle: t('admin.attentionGovernance.emptyTitle'),
      emptyDescription: t('admin.attentionGovernance.emptyDescription'),
      ruleLimitsTitle: t('admin.attentionGovernance.ruleLimitsTitle'),
      ruleLimitsDescription: t('admin.attentionGovernance.ruleLimitsDescription'),
      maxActiveRules: t('admin.attentionGovernance.maxActiveRules'),
      maxVipRules: t('admin.attentionGovernance.maxVipRules'),
      maxFollowRules: t('admin.attentionGovernance.maxFollowRules'),
      topicTitle: t('admin.attentionGovernance.topicTitle'),
      topicDescription: t('admin.attentionGovernance.topicDescription'),
      topicInputLabel: t('admin.attentionGovernance.topicInputLabel'),
      addTopic: t('admin.attentionGovernance.addTopic'),
      removeTopic: (topic) => t('admin.attentionGovernance.removeTopic', { topic }),
      policyTitle: t('admin.attentionGovernance.policyTitle'),
      mandatoryPrecedence: t('admin.attentionGovernance.mandatoryPrecedence'),
      mandatoryPrecedenceDetail: t('admin.attentionGovernance.mandatoryPrecedenceDetail'),
      minimumCohort: t('admin.attentionGovernance.minimumCohort'),
      minimumCohortDetail: t('admin.attentionGovernance.minimumCohortDetail'),
      independentReviewer: t('admin.attentionGovernance.independentReviewer'),
      independentReviewerDetail: t('admin.attentionGovernance.independentReviewerDetail'),
      changeReason: t('admin.attentionGovernance.changeReason'),
      saveDraft: t('admin.attentionGovernance.saveDraft'),
      pipelineTitle: t('admin.attentionGovernance.pipelineTitle'),
      pipelineDescription: t('admin.attentionGovernance.pipelineDescription'),
      activeRevision: t('admin.attentionGovernance.activeRevision'),
      noActiveRevision: t('admin.attentionGovernance.noActiveRevision'),
      draftRevision: t('admin.attentionGovernance.draftRevision'),
      createdBy: (userId) => t('admin.attentionGovernance.createdBy', { userId }),
      approvedBy: (userId) => t('admin.attentionGovernance.approvedBy', { userId }),
      version: (revision, version) => t('admin.attentionGovernance.version', { revision, version }),
      stateLabel: (state) => t(`admin.attentionGovernance.states.${state}`),
      decisionReason: t('admin.attentionGovernance.decisionReason'),
      publish: t('admin.attentionGovernance.publish'),
      reject: t('admin.attentionGovernance.reject'),
      withdraw: t('admin.attentionGovernance.withdraw'),
      selfApprovalBlocked: t('admin.attentionGovernance.selfApprovalBlocked'),
      guardrailBlocked: t('admin.attentionGovernance.guardrailBlocked'),
      permissionBlocked: t('admin.attentionGovernance.permissionBlocked'),
      pendingDraftBlocked: t('admin.attentionGovernance.pendingDraftBlocked'),
      mutationError: t('admin.attentionGovernance.mutationError'),
    }),
    [t]
  );

  const busy = createDraft.isPending || publish.isPending || reject.isPending || withdraw.isPending;
  const status = !identityReady
    ? 'LOADING'
    : !queryEnabled || workspace.isError
      ? 'ERROR'
      : workspace.isLoading
        ? 'LOADING'
        : 'READY';
  const loadError = !canRead
    ? t('admin.attentionGovernance.viewPermissionBlocked')
    : !auth.isAuthenticated || !actorUserId
      ? t('admin.attentionGovernance.identityUnavailable')
      : statusOf(workspace.error) === 403
        ? t('admin.attentionGovernance.viewPermissionBlocked')
        : t('admin.attentionGovernance.loadErrorDescription');

  useEffect(() => {
    if (!attentionRequested || status !== 'READY') return;
    const frame = globalThis.requestAnimationFrame(() => {
      surfaceRef.current?.scrollIntoView({ block: 'start' });
      surfaceRef.current?.focus({ preventScroll: true });
    });
    return () => globalThis.cancelAnimationFrame(frame);
  }, [attentionRequested, status]);

  return (
    <Box
      id="attention-governance"
      ref={surfaceRef}
      tabIndex={-1}
      data-testid="notification-attention-governance-runtime"
      sx={{ minWidth: 0, scrollMarginTop: 16, outline: 'none' }}
    >
      <NotificationAttentionGovernanceStudio
        workspace={workspace.data}
        status={status}
        errorMessage={status === 'ERROR' ? loadError : undefined}
        actorUserId={actorUserId ?? 0}
        canManage={queryEnabled && canManage}
        canApprove={queryEnabled && canApprove}
        busy={busy}
        copy={copy}
        onRefresh={queryEnabled ? () => void workspace.refetch() : undefined}
        resolveMutationError={(error) =>
          isNotificationAttentionGovernanceStale(error)
            ? t('admin.attentionGovernance.staleMutation')
            : statusOf(error) === 403
              ? t('admin.attentionGovernance.permissionBlocked')
              : t('admin.attentionGovernance.mutationError')
        }
        onCreateDraft={async (input) => {
          await createDraft.mutateAsync({
            ...input,
            idempotencyKey: createNotificationIdempotencyKey('attention-governance-draft'),
          });
        }}
        onPublish={async (governanceId, input) => {
          await publish.mutateAsync({
            governanceId,
            input: {
              ...input,
              idempotencyKey: createNotificationIdempotencyKey('attention-governance-publish'),
            },
          });
        }}
        onReject={async (governanceId, input) => {
          await reject.mutateAsync({
            governanceId,
            input: {
              ...input,
              idempotencyKey: createNotificationIdempotencyKey('attention-governance-reject'),
            },
          });
        }}
        onWithdraw={async (governanceId, input) => {
          await withdraw.mutateAsync({
            governanceId,
            input: {
              ...input,
              idempotencyKey: createNotificationIdempotencyKey('attention-governance-withdraw'),
            },
          });
        }}
      />
    </Box>
  );
}
