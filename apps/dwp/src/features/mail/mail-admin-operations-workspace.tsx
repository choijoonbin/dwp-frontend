import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  addMailSharedInboxMember,
  approveMailPurge,
  cancelMailDeliveryAdmin,
  createMailDeliveryAuditExport,
  createMailLegalHold,
  executeMailPurge,
  getMailAdminOperations,
  getMailAdminOverview,
  getMailDeliveryAudit,
  getMailPolicyGovernance,
  getMailRetention,
  getMailSharedInboxAccess,
  previewMailPurge,
  reconcileMailDeliveryAdmin,
  releaseMailLegalHold,
  removeMailSharedInboxMember,
  retryMailDeliveryAdmin,
  runMailConnectionDiagnostic,
  sendMailConnectionTest,
  startMailConnectionSync,
  updateMailLegalHold,
  updateMailSharedInboxMember,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';
import { ActionButton, PageCanvas } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

import { MailPageHeading } from './mail-components';
import { MailAdminOperationsContent } from './mail-admin-operations-ui';

import type { MailAdminOverview } from '@dwp-frontend/shared-utils';
import type {
  MailAdminOperationalException,
  MailAdminOperationsSnapshot,
  MailAdminSurface,
  MailAuditExport,
  MailConnectionOperation,
  MailDeliveryAuditPage,
  MailDeliveryRecoveryEvidence,
  MailLegalHoldInput,
  MailPolicyGovernance,
  MailPurgeCandidateSnapshot,
  MailPurgeGateEvidence,
  MailRetentionSnapshot,
  MailSharedInboxAccess,
  MailSharedInboxMember,
  MailSharedInboxMemberInput,
} from './mail-admin-operations-model';

export type MailAdminOperationsWorkspaceProps = {
  surface: MailAdminSurface;
  overview?: MailAdminOverview;
  canManage?: boolean;
  canManageConnections?: boolean;
  canManageSharedInboxes?: boolean;
  canManagePolicy?: boolean;
  canManageHolds?: boolean;
  canAuthorizePurge?: boolean;
  canExecutePurge?: boolean;
  canReadAudit?: boolean;
  canRecoverDeliveries?: boolean;
  canExportAudit?: boolean;
  now?: number;
  operations?: MailAdminOperationsSnapshot;
  connectionOperations?: readonly MailConnectionOperation[];
  sharedAccess?: readonly MailSharedInboxAccess[];
  policyGovernance?: MailPolicyGovernance;
  retention?: MailRetentionSnapshot;
  deliveryAudit?: MailDeliveryAuditPage;
  auditExport?: MailAuditExport;
  deliveryEvidence?: readonly MailDeliveryRecoveryEvidence[];
  purgeEvidence?: MailPurgeGateEvidence;
  onRefresh?: () => void | Promise<unknown>;
  onOpenConnectionSettings?: () => void;
  onOpenSharedInboxSettings?: () => void;
  onOpenPolicySettings?: () => void;
  onOpenException?: (exception: MailAdminOperationalException) => void;
  onRunConnectionDiagnostic?: (connectionId: string) => void;
  onStartConnectionSync?: (connectionId: string) => void;
  onSendConnectionTest?: (connectionId: string, recipient: string) => void;
  onAddSharedMember?: (sharedInboxId: string, input: MailSharedInboxMemberInput) => void;
  onUpdateSharedMember?: (
    sharedInboxId: string,
    memberId: string,
    input: MailSharedInboxMemberInput
  ) => void;
  onRemoveSharedMember?: (
    sharedInboxId: string,
    member: MailSharedInboxMember,
    memberVersion: number
  ) => void;
  onCreateLegalHold?: (input: MailLegalHoldInput) => void;
  onUpdateLegalHold?: (holdId: string, input: MailLegalHoldInput) => void;
  onReleaseLegalHold?: (holdId: string, version: number) => void;
  onPreviewPurge?: () => void;
  onApprovePurge?: (candidate: MailPurgeCandidateSnapshot) => void;
  onExecutePurge?: (candidate: MailPurgeCandidateSnapshot) => void;
  onReconcileDelivery?: (deliveryId: string) => void;
  onRetryDelivery?: (deliveryId: string) => void;
  onCancelDelivery?: (deliveryId: string) => void;
  onExportDeliveryAudit?: () => void;
};

function useMailAdminWorkspaceOverview(injectedOverview?: MailAdminOverview) {
  return useQuery({
    queryKey: ['mail', 'admin'],
    queryFn: getMailAdminOverview,
    staleTime: 30_000,
    retry: 1,
    enabled: !injectedOverview,
  });
}

function useSurfaceHeading(surface: MailAdminSurface) {
  const { t } = useTranslation('mail');
  if (surface === 'operations') {
    return {
      eyebrow: t('admin.overview.eyebrow'),
      title: t('admin.overview.title'),
      description: t('admin.operationsWorkspace.a01.pageDescription', {
        defaultValue:
          'Review reported exceptions and customer impact before opening infrastructure details.',
      }),
    };
  }
  if (surface === 'connections') {
    return {
      eyebrow: t('admin.connections.eyebrow'),
      title: t('admin.connections.title'),
      description: t('admin.operationsWorkspace.a02.pageDescription', {
        defaultValue:
          'Separate reported provider state from confirmed connection, sign-in, and synchronization readiness.',
      }),
    };
  }
  if (surface === 'shared-access') {
    return {
      eyebrow: t('admin.shared.eyebrow'),
      title: t('admin.operationsWorkspace.a03.title', { defaultValue: 'Shared inbox access' }),
      description: t('admin.operationsWorkspace.a03.pageDescription', {
        defaultValue:
          'Review workload and access information without treating a member role as permission for every action.',
      }),
    };
  }
  if (surface === 'governance') {
    return {
      eyebrow: t('admin.policies.eyebrow'),
      title: t('admin.policies.title'),
      description: t('admin.operationsWorkspace.a04.pageDescription', {
        defaultValue:
          'Keep saved settings, effective values, and enforcement evidence visibly separate.',
      }),
    };
  }
  if (surface === 'retention') {
    return {
      eyebrow: t('admin.operationsWorkspace.a05.eyebrow', { defaultValue: 'Retention governance' }),
      title: t('admin.operationsWorkspace.a05.title', {
        defaultValue: 'Retention, legal hold, and purge',
      }),
      description: t('admin.operationsWorkspace.a05.pageDescription', {
        defaultValue:
          'Protect held content and require a current candidate snapshot, separate approvals, and verification before purge.',
      }),
    };
  }
  return {
    eyebrow: t('admin.operationsWorkspace.a06.eyebrow', { defaultValue: 'Delivery assurance' }),
    title: t('admin.operationsWorkspace.a06.title', {
      defaultValue: 'Delivery audit and recovery',
    }),
    description: t('admin.operationsWorkspace.a06.pageDescription', {
      defaultValue:
        'Reconcile unknown outcomes before retry and preserve command, provider, and audit evidence.',
    }),
  };
}

export function MailAdminOperationsWorkspace(props: MailAdminOperationsWorkspaceProps) {
  const { surface } = props;
  const { t } = useTranslation('mail');
  const heading = useSurfaceHeading(surface);
  const query = useMailAdminWorkspaceOverview(props.overview);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const overview = props.overview ?? query.data;
  const legacyPermissionOverride = props.canManage;
  const canManageConnections =
    props.canManageConnections ??
    legacyPermissionOverride ??
    hasPermission('ADMIN.MAIL', 'CONNECTION_MANAGE');
  const canManageSharedInboxes =
    props.canManageSharedInboxes ??
    legacyPermissionOverride ??
    hasPermission('ADMIN.MAIL', 'SHARED_INBOX_MANAGE');
  const canManagePolicy =
    props.canManagePolicy ??
    legacyPermissionOverride ??
    hasPermission('ADMIN.MAIL', 'POLICY_MANAGE');
  const canManageHolds =
    props.canManageHolds ?? legacyPermissionOverride ?? hasPermission('ADMIN.MAIL', 'HOLD_MANAGE');
  const canAuthorizePurge =
    props.canAuthorizePurge ??
    legacyPermissionOverride ??
    hasPermission('ADMIN.MAIL', 'PURGE_AUTHORIZE');
  const canExecutePurge =
    props.canExecutePurge ??
    legacyPermissionOverride ??
    hasPermission('ADMIN.MAIL', 'PURGE_EXECUTE');
  const canReadAudit =
    props.canReadAudit ?? legacyPermissionOverride ?? hasPermission('ADMIN.MAIL', 'AUDIT_READ');
  const canRecoverDeliveries =
    props.canRecoverDeliveries ??
    legacyPermissionOverride ??
    hasPermission('ADMIN.MAIL', 'RECOVERY');
  const canExportAudit =
    props.canExportAudit ?? legacyPermissionOverride ?? hasPermission('ADMIN.MAIL', 'EXPORT');
  const canRunAnyMutation =
    canManageConnections ||
    canManageSharedInboxes ||
    canManagePolicy ||
    canManageHolds ||
    canAuthorizePurge ||
    canExecutePurge ||
    canRecoverDeliveries ||
    canExportAudit;
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [connectionOperations, setConnectionOperations] = useState<MailConnectionOperation[]>([]);
  const [purgeCandidate, setPurgeCandidate] = useState<MailPurgeCandidateSnapshot | null>(null);
  const [auditExport, setAuditExport] = useState<MailAuditExport | null>(null);
  const idempotencyKeys = useRef(new Map<string, string>());
  const idempotencyKeyFor = (scope: string) => {
    const current = idempotencyKeys.current.get(scope);
    if (current) return current;
    const created = crypto.randomUUID();
    idempotencyKeys.current.set(scope, created);
    return created;
  };

  const operationsQuery = useQuery({
    queryKey: ['mail', 'admin', 'operations'],
    queryFn: getMailAdminOperations,
    enabled: surface === 'operations' && !props.operations,
    staleTime: 15_000,
    retry: 1,
  });
  const policyGovernanceQuery = useQuery({
    queryKey: ['mail', 'admin', 'policy-governance'],
    queryFn: getMailPolicyGovernance,
    enabled: surface === 'governance' && !props.policyGovernance,
    staleTime: 15_000,
    retry: 1,
  });
  const retentionQuery = useQuery({
    queryKey: ['mail', 'admin', 'retention'],
    queryFn: getMailRetention,
    enabled: surface === 'retention' && !props.retention,
    staleTime: 10_000,
    retry: 1,
  });
  const correlationId = new URLSearchParams(location.search).get('correlationId') ?? undefined;
  const deliveryAuditQuery = useQuery({
    queryKey: ['mail', 'admin', 'delivery-audit', correlationId ?? 'all'],
    queryFn: () => getMailDeliveryAudit({ page: 0, pageSize: 50, correlationId }),
    enabled: surface === 'delivery-audit' && canReadAudit && !props.deliveryAudit,
    staleTime: 10_000,
    retry: 1,
  });
  const sharedAccessQueries = useQueries({
    queries: (overview?.sharedInboxes ?? []).map((inbox) => ({
      queryKey: ['mail', 'admin', 'shared-access', inbox.sharedInboxId],
      queryFn: () => getMailSharedInboxAccess(inbox.sharedInboxId),
      enabled: surface === 'shared-access' && !props.sharedAccess,
      staleTime: 10_000,
      retry: 1,
    })),
  });
  const loadedSharedAccess = sharedAccessQueries
    .map((accessQuery) => accessQuery.data)
    .filter((access): access is MailSharedInboxAccess => Boolean(access));
  const sharedAccess =
    props.sharedAccess ??
    (surface === 'shared-access' &&
    sharedAccessQueries.every((accessQuery) => accessQuery.isSuccess)
      ? loadedSharedAccess
      : undefined);

  const runAction = async (
    key: string,
    action: () => Promise<unknown>,
    after?: () => void | Promise<unknown>,
    idempotencyScope = key
  ) => {
    if (busyAction) return;
    setBusyAction(key);
    try {
      await action();
      await after?.();
      idempotencyKeys.current.delete(idempotencyScope);
      toast.success(
        t('admin.operationsWorkspace.actionAccepted', {
          defaultValue: 'The command response was received and the evidence was refreshed.',
        })
      );
    } catch {
      toast.error(
        t('admin.operationsWorkspace.actionFailed', {
          defaultValue:
            'The command did not complete. Review the current evidence before retrying.',
        })
      );
    } finally {
      setBusyAction(null);
    }
  };

  const refresh = async () => {
    if (props.onRefresh) {
      await props.onRefresh();
      return;
    }
    await query.refetch();
    if (surface === 'operations') await operationsQuery.refetch();
    if (surface === 'governance') await policyGovernanceQuery.refetch();
    if (surface === 'retention') await retentionQuery.refetch();
    if (surface === 'delivery-audit') await deliveryAuditQuery.refetch();
    if (surface === 'shared-access') {
      await Promise.all(sharedAccessQueries.map((accessQuery) => accessQuery.refetch()));
    }
  };

  const openException = (exception: MailAdminOperationalException) => {
    if (props.onOpenException) return props.onOpenException(exception);
    if (exception.nextAction === 'OPEN_CONNECTION') navigate('/mail/admin/connections');
    else if (exception.nextAction === 'OPEN_DELIVERY') {
      if (!canReadAudit) {
        toast.error(
          t('admin.operationsWorkspace.auditReadRequired', {
            defaultValue: 'Delivery audit access is required to open this evidence.',
          })
        );
        return;
      }
      const correlation = exception.correlationId
        ? `?correlationId=${encodeURIComponent(exception.correlationId)}`
        : '';
      navigate(`/mail/admin/delivery-audit${correlation}`);
    } else if (exception.nextAction === 'REFRESH_SOURCE') void refresh();
    else
      toast.error(
        t('admin.operationsWorkspace.escalationRequired', {
          defaultValue: 'This exception requires an authorized escalation outside this workspace.',
        })
      );
  };

  const findConnection = (connectionId: string) =>
    overview?.connections.find((connection) => connection.connectionId === connectionId);

  const runConnectionOperation = async (
    key: string,
    operation: () => Promise<MailConnectionOperation>,
    idempotencyScope = key
  ) =>
    runAction(
      key,
      async () => {
        const result = await operation();
        setConnectionOperations((current) => [
          result,
          ...current.filter((item) => item.connectionId !== result.connectionId),
        ]);
      },
      undefined,
      idempotencyScope
    );

  const refetchSharedAccess = (sharedInboxId: string) =>
    queryClient.invalidateQueries({ queryKey: ['mail', 'admin', 'shared-access', sharedInboxId] });
  const refetchRetention = () =>
    queryClient.invalidateQueries({ queryKey: ['mail', 'admin', 'retention'] });
  const refetchDeliveryAudit = () =>
    queryClient.invalidateQueries({ queryKey: ['mail', 'admin', 'delivery-audit'] });

  const operations = props.operations ?? operationsQuery.data;
  const policyGovernance = props.policyGovernance ?? policyGovernanceQuery.data;
  const retentionSource = props.retention ?? retentionQuery.data;
  const retention = retentionSource
    ? ({
        ...retentionSource,
        candidate: props.retention?.candidate ?? purgeCandidate,
        purgeJobs: canAuthorizePurge ? retentionSource.purgeJobs : [],
      } as MailRetentionSnapshot)
    : undefined;
  const deliveryAudit = props.deliveryAudit ?? deliveryAuditQuery.data;
  const detailError =
    operationsQuery.isError ||
    policyGovernanceQuery.isError ||
    retentionQuery.isError ||
    deliveryAuditQuery.isError ||
    sharedAccessQueries.some((accessQuery) => accessQuery.isError);
  const detailLoading =
    operationsQuery.isLoading ||
    policyGovernanceQuery.isLoading ||
    retentionQuery.isLoading ||
    deliveryAuditQuery.isLoading ||
    sharedAccessQueries.some((accessQuery) => accessQuery.isLoading);

  return (
    <PageCanvas>
      <MailPageHeading
        eyebrow={heading.eyebrow}
        title={heading.title}
        description={heading.description}
        actions={
          <ActionButton
            intent="quiet"
            loading={query.isFetching && !props.overview}
            startIcon={<RefreshCw size={17} />}
            onClick={() => void refresh()}
          >
            {t('actions.refresh')}
          </ActionButton>
        }
      />

      {!canRunAnyMutation ? (
        <Alert severity="info" sx={{ mt: 2.5 }}>
          {t('admin.operationsWorkspace.readOnly', {
            defaultValue:
              'You have read-only access. Configuration and recovery actions require delegated mail administration.',
          })}
        </Alert>
      ) : null}

      {(query.isError && !props.overview) || detailError ? (
        <Alert severity="error" sx={{ mt: 2.5 }}>
          {t('admin.loadError')}
        </Alert>
      ) : null}

      {(query.isLoading && !props.overview) || detailLoading ? (
        <Stack spacing={1.5} sx={{ mt: 2.5 }} aria-busy="true">
          <Skeleton variant="rounded" height={72} />
          <Skeleton variant="rounded" height={280} />
        </Stack>
      ) : overview ? (
        <Box sx={{ mt: 2.5, minWidth: 0 }}>
          <MailAdminOperationsContent
            surface={surface}
            overview={overview}
            canManage={legacyPermissionOverride ?? canRunAnyMutation}
            canManageConnections={canManageConnections}
            canManageSharedInboxes={canManageSharedInboxes}
            canManagePolicy={canManagePolicy}
            canManageHolds={canManageHolds}
            canAuthorizePurge={canAuthorizePurge}
            canExecutePurge={canExecutePurge}
            canReadAudit={canReadAudit}
            canRecoverDeliveries={canRecoverDeliveries}
            canExportAudit={canExportAudit}
            now={props.now}
            operations={operations}
            connectionOperations={props.connectionOperations ?? connectionOperations}
            sharedAccess={sharedAccess}
            policyGovernance={policyGovernance}
            retention={retention}
            deliveryAudit={canReadAudit ? deliveryAudit : undefined}
            auditExport={
              canExportAudit ? (props.auditExport ?? auditExport ?? undefined) : undefined
            }
            deliveryEvidence={canReadAudit ? props.deliveryEvidence : undefined}
            purgeEvidence={props.purgeEvidence}
            busyAction={busyAction}
            onOpenConnectionSettings={props.onOpenConnectionSettings}
            onOpenSharedInboxSettings={props.onOpenSharedInboxSettings}
            onOpenPolicySettings={props.onOpenPolicySettings}
            onOpenException={openException}
            onRunConnectionDiagnostic={
              props.onRunConnectionDiagnostic ??
              ((connectionId) => {
                const connection = findConnection(connectionId);
                if (!connection) return;
                const actionKey = `diagnostic:${connectionId}`;
                void runConnectionOperation(actionKey, () =>
                  runMailConnectionDiagnostic(connectionId, {
                    capability: 'SYNC',
                    idempotencyKey: idempotencyKeyFor(actionKey),
                    version: connection.version,
                  })
                );
              })
            }
            onStartConnectionSync={
              props.onStartConnectionSync ??
              ((connectionId) => {
                const connection = findConnection(connectionId);
                if (!connection) return;
                const actionKey = `sync:${connectionId}`;
                void runConnectionOperation(actionKey, () =>
                  startMailConnectionSync(connectionId, {
                    scope: 'INCREMENTAL',
                    idempotencyKey: idempotencyKeyFor(actionKey),
                    version: connection.version,
                  })
                );
              })
            }
            onSendConnectionTest={
              props.onSendConnectionTest ??
              ((connectionId, recipient) => {
                const connection = findConnection(connectionId);
                if (!connection) return;
                const actionKey = `test:${connectionId}:${recipient.trim().toLowerCase()}`;
                void runConnectionOperation(
                  `test:${connectionId}`,
                  () =>
                    sendMailConnectionTest(connectionId, {
                      recipient,
                      confirmedExternalImpact: true,
                      idempotencyKey: idempotencyKeyFor(actionKey),
                      version: connection.version,
                    }),
                  actionKey
                );
              })
            }
            onAddSharedMember={
              props.onAddSharedMember ??
              ((sharedInboxId, input) => {
                const actionScope = `add-member:${sharedInboxId}:${input.userId}:${input.version}`;
                void runAction(
                  'save-member',
                  () =>
                    addMailSharedInboxMember(sharedInboxId, {
                      ...input,
                      idempotencyKey: idempotencyKeyFor(actionScope),
                    }),
                  () => refetchSharedAccess(sharedInboxId),
                  actionScope
                );
              })
            }
            onUpdateSharedMember={
              props.onUpdateSharedMember ??
              ((sharedInboxId, memberId, input) => {
                const actionScope = `update-member:${sharedInboxId}:${memberId}:${input.version}`;
                void runAction(
                  'save-member',
                  () =>
                    updateMailSharedInboxMember(sharedInboxId, memberId, {
                      ...input,
                      idempotencyKey: idempotencyKeyFor(actionScope),
                    }),
                  () => refetchSharedAccess(sharedInboxId),
                  actionScope
                );
              })
            }
            onRemoveSharedMember={
              props.onRemoveSharedMember ??
              ((sharedInboxId, member, memberVersion) => {
                const actionKey = `remove-member:${member.memberId}`;
                const actionScope = `${actionKey}:${memberVersion}`;
                void runAction(
                  actionKey,
                  () =>
                    removeMailSharedInboxMember(sharedInboxId, member.memberId, {
                      impactAcknowledged: true,
                      idempotencyKey: idempotencyKeyFor(actionScope),
                      version: memberVersion,
                    }),
                  () => refetchSharedAccess(sharedInboxId),
                  actionScope
                );
              })
            }
            onCreateLegalHold={
              props.onCreateLegalHold ??
              ((input) => {
                const actionScope = `create-hold:${input.safeCaseRef}:${input.version}`;
                void runAction(
                  'create-hold',
                  () =>
                    createMailLegalHold({
                      ...input,
                      scope: { reference: input.scope },
                      startsAt: new Date(props.now ?? Date.now()).toISOString(),
                      idempotencyKey: idempotencyKeyFor(actionScope),
                    }),
                  refetchRetention,
                  actionScope
                );
              })
            }
            onUpdateLegalHold={
              props.onUpdateLegalHold ??
              ((holdId, input) => {
                const actionKey = `update-hold:${holdId}`;
                const actionScope = `${actionKey}:${input.version}`;
                void runAction(
                  actionKey,
                  () =>
                    updateMailLegalHold(holdId, {
                      ...input,
                      scope: { reference: input.scope },
                      startsAt: input.startsAt ?? new Date(props.now ?? Date.now()).toISOString(),
                      idempotencyKey: idempotencyKeyFor(actionScope),
                    }),
                  refetchRetention,
                  actionScope
                );
              })
            }
            onReleaseLegalHold={
              props.onReleaseLegalHold ??
              ((holdId, version) => {
                const actionKey = `release-hold:${holdId}`;
                const actionScope = `${actionKey}:${version}`;
                void runAction(
                  actionKey,
                  () =>
                    releaseMailLegalHold(holdId, {
                      idempotencyKey: idempotencyKeyFor(actionScope),
                      version,
                    }),
                  refetchRetention,
                  actionScope
                );
              })
            }
            onPreviewPurge={
              props.onPreviewPurge ??
              (() => {
                if (!retention) return;
                const actionScope = `preview-purge:${retention.policyVersion}`;
                void runAction(
                  'preview-purge',
                  async () => {
                    const preview = await previewMailPurge({
                      scope: { tenant: true },
                      resourceTypes: retention.resourcePolicies.map(
                        (policy) => policy.resourceType
                      ),
                      before: new Date(props.now ?? Date.now()).toISOString(),
                      idempotencyKey: idempotencyKeyFor(actionScope),
                      policyVersion: retention.policyVersion,
                    });
                    setPurgeCandidate({ ...preview, distinctApproverCount: 0 });
                  },
                  refetchRetention,
                  actionScope
                );
              })
            }
            onApprovePurge={
              props.onApprovePurge ??
              ((candidate) => {
                const actionScope = `approve-purge:${candidate.candidateSnapshotId}:${candidate.distinctApproverCount}`;
                void runAction(
                  'approve-purge',
                  async () => {
                    const approval = await approveMailPurge(candidate.candidateSnapshotId, {
                      decision: 'APPROVE',
                      idempotencyKey: idempotencyKeyFor(actionScope),
                      policyVersion: candidate.policyVersion,
                    });
                    setPurgeCandidate((current) =>
                      current?.candidateSnapshotId === candidate.candidateSnapshotId
                        ? { ...current, distinctApproverCount: approval.distinctApproverCount }
                        : current
                    );
                  },
                  refetchRetention,
                  actionScope
                );
              })
            }
            onExecutePurge={
              props.onExecutePurge ??
              ((candidate) => {
                const actionScope = `execute-purge:${candidate.candidateSnapshotId}:${candidate.fingerprint}`;
                void runAction(
                  'execute-purge',
                  async () => {
                    await executeMailPurge(candidate.candidateSnapshotId, {
                      idempotencyKey: idempotencyKeyFor(actionScope),
                      policyVersion: candidate.policyVersion,
                      fingerprint: candidate.fingerprint,
                    });
                    setPurgeCandidate(null);
                  },
                  refetchRetention,
                  actionScope
                );
              })
            }
            onReconcileDelivery={
              props.onReconcileDelivery ??
              ((deliveryId) => {
                const delivery = deliveryAudit?.items.find(
                  (item) => item.deliveryId === deliveryId
                );
                if (!delivery) return;
                const actionKey = `reconcile:${deliveryId}`;
                const actionScope = `${actionKey}:${delivery.version}`;
                void runAction(
                  actionKey,
                  () =>
                    reconcileMailDeliveryAdmin(deliveryId, {
                      idempotencyKey: idempotencyKeyFor(actionScope),
                      version: delivery.version,
                    }),
                  refetchDeliveryAudit,
                  actionScope
                );
              })
            }
            onRetryDelivery={
              props.onRetryDelivery ??
              ((deliveryId) => {
                const delivery = deliveryAudit?.items.find(
                  (item) => item.deliveryId === deliveryId
                );
                if (!delivery) return;
                const actionKey = `retry:${deliveryId}`;
                const actionScope = `${actionKey}:${delivery.version}`;
                void runAction(
                  actionKey,
                  () =>
                    retryMailDeliveryAdmin(deliveryId, {
                      idempotencyKey: idempotencyKeyFor(actionScope),
                      version: delivery.version,
                    }),
                  refetchDeliveryAudit,
                  actionScope
                );
              })
            }
            onCancelDelivery={
              props.onCancelDelivery ??
              ((deliveryId) => {
                const delivery = deliveryAudit?.items.find(
                  (item) => item.deliveryId === deliveryId
                );
                if (!delivery) return;
                const actionKey = `cancel:${deliveryId}`;
                const actionScope = `${actionKey}:${delivery.version}`;
                void runAction(
                  actionKey,
                  () =>
                    cancelMailDeliveryAdmin(deliveryId, {
                      idempotencyKey: idempotencyKeyFor(actionScope),
                      version: delivery.version,
                    }),
                  refetchDeliveryAudit,
                  actionScope
                );
              })
            }
            onExportDeliveryAudit={
              props.onExportDeliveryAudit ??
              (() => {
                const actionScope = `export-audit:${correlationId ?? 'all'}`;
                void runAction(
                  'export-audit',
                  async () => {
                    const result = await createMailDeliveryAuditExport({
                      filters: { correlationId },
                      purpose: 'Delivery incident investigation',
                      idempotencyKey: idempotencyKeyFor(actionScope),
                    });
                    setAuditExport(result);
                  },
                  undefined,
                  actionScope
                );
              })
            }
          />
        </Box>
      ) : null}
    </PageCanvas>
  );
}

type SurfaceWorkspaceProps = Omit<MailAdminOperationsWorkspaceProps, 'surface'>;

export function MailOperationsAdminWorkspace(props: SurfaceWorkspaceProps) {
  return <MailAdminOperationsWorkspace {...props} surface="operations" />;
}

export function MailConnectionsAdminWorkspace(props: SurfaceWorkspaceProps) {
  return <MailAdminOperationsWorkspace {...props} surface="connections" />;
}

export function MailSharedAccessAdminWorkspace(props: SurfaceWorkspaceProps) {
  return <MailAdminOperationsWorkspace {...props} surface="shared-access" />;
}

export function MailGovernanceAdminWorkspace(props: SurfaceWorkspaceProps) {
  return <MailAdminOperationsWorkspace {...props} surface="governance" />;
}

export function MailRetentionAdminWorkspace(props: SurfaceWorkspaceProps) {
  return <MailAdminOperationsWorkspace {...props} surface="retention" />;
}

export function MailDeliveryAuditAdminWorkspace(props: SurfaceWorkspaceProps) {
  return <MailAdminOperationsWorkspace {...props} surface="delivery-audit" />;
}
