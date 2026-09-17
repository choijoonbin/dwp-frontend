import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  addMailSharedInboxMember,
  approveMailDeliveryAuditExport,
  approveMailLegalHoldRelease,
  approveMailPurge,
  approveMailRetentionEvidenceExport,
  cancelMailDeliveryAdmin,
  createMailDeliveryAuditExport,
  createMailLegalHold,
  createMailRetentionEvidenceExport,
  downloadMailDeliveryAuditExport,
  downloadMailRetentionEvidenceExport,
  executeMailPurge,
  executeMailLegalHoldRelease,
  getMailActivePurgePreviews,
  getMailAdminOperations,
  getMailDeliveryAudit,
  getMailDeliveryAuditExport,
  getMailLegalHoldReleasePreview,
  getMailPolicyGovernance,
  getMailPurgePreview,
  getMailRetention,
  getMailRetentionEvidenceExport,
  getMailSharedInboxAccess,
  HttpError,
  previewMailPurge,
  previewMailLegalHoldRelease,
  previewMailSharedInboxMemberRevoke,
  reconcileMailDeliveryAdmin,
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
import {
  mailAdminEvidenceExportFileName,
  saveMailAttachmentBlob,
} from './mail-attachment-download';
import {
  mailDeliveryAuditFiltersFromSearch,
  updateMailDeliveryAuditFilterSearch,
} from './mail-delivery-audit-filters';
import { MailAdminOperationsContent } from './mail-admin-operations-ui';
import { MAIL_PURGE_RESOURCE_TYPES } from './mail-admin-operations-model';
import {
  useMailAdminWorkspaceOverview,
  useSurfaceHeading,
} from './mail-admin-operations-workspace-config';

import type { MailLegalHoldReleasePreview } from '@dwp-frontend/shared-utils';
import type {
  MailAdminOperationalException,
  MailAuditExport,
  MailConnectionOperation,
  MailPurgeCandidateSnapshot,
  MailRetentionExport,
  MailRetentionSnapshot,
  MailSharedInboxAccess,
} from './mail-admin-operations-model';
import type { MailAdminOperationsWorkspaceProps } from './mail-admin-operations-workspace-config';

export type { MailAdminOperationsWorkspaceProps } from './mail-admin-operations-workspace-config';

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
  const canPreviewPurge =
    props.canPreviewPurge ??
    legacyPermissionOverride ??
    hasPermission('ADMIN.MAIL', 'PURGE_PREVIEW');
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
  const canRevealAudit =
    props.canRevealAudit ?? legacyPermissionOverride ?? hasPermission('ADMIN.MAIL', 'AUDIT_REVEAL');
  const legacyDeliveryRecovery = props.canRecoverDeliveries ?? legacyPermissionOverride;
  const canReconcileDeliveries =
    props.canReconcileDeliveries ??
    legacyDeliveryRecovery ??
    hasPermission('ADMIN.MAIL', 'DELIVERY_RECONCILE');
  const canRetryDeliveries =
    props.canRetryDeliveries ??
    legacyDeliveryRecovery ??
    hasPermission('ADMIN.MAIL', 'DELIVERY_RETRY');
  const canCancelDeliveries =
    props.canCancelDeliveries ??
    legacyDeliveryRecovery ??
    hasPermission('ADMIN.MAIL', 'DELIVERY_CANCEL');
  const canRecoverDeliveries =
    props.canRecoverDeliveries ??
    legacyPermissionOverride ??
    (canReconcileDeliveries || canRetryDeliveries || canCancelDeliveries);
  const canExportAudit =
    props.canExportAudit ??
    legacyPermissionOverride ??
    hasPermission('ADMIN.MAIL', 'EVIDENCE_EXPORT');
  const canRunAnyMutation =
    canManageConnections ||
    canManageSharedInboxes ||
    canManagePolicy ||
    canManageHolds ||
    canPreviewPurge ||
    canAuthorizePurge ||
    canExecutePurge ||
    canReconcileDeliveries ||
    canRetryDeliveries ||
    canCancelDeliveries ||
    canExportAudit;
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [connectionOperations, setConnectionOperations] = useState<MailConnectionOperation[]>([]);
  const [purgeCandidate, setPurgeCandidate] = useState<MailPurgeCandidateSnapshot | null>(null);
  const [retentionExport, setRetentionExport] = useState<MailRetentionExport | null>(null);
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
  const purgePreviewsQuery = useQuery({
    queryKey: ['mail', 'admin', 'retention', 'purge-previews'],
    queryFn: getMailActivePurgePreviews,
    enabled: surface === 'retention' && canPreviewPurge && !props.retention,
    staleTime: 0,
    retry: 1,
  });
  const deliveryAuditFilters = mailDeliveryAuditFiltersFromSearch(
    new URLSearchParams(location.search)
  );
  const deliveryAuditQuery = useQuery({
    queryKey: ['mail', 'admin', 'delivery-audit', deliveryAuditFilters],
    queryFn: () => getMailDeliveryAudit(deliveryAuditFilters),
    enabled:
      surface === 'delivery-audit' &&
      (canReadAudit || canRecoverDeliveries) &&
      !props.deliveryAudit,
    staleTime: 10_000,
    retry: 1,
  });
  const retentionExportId = props.retentionExport?.exportId ?? retentionExport?.exportId;
  const retentionExportQuery = useQuery({
    queryKey: ['mail', 'admin', 'retention', 'evidence-export', retentionExportId],
    queryFn: () => getMailRetentionEvidenceExport(retentionExportId!),
    enabled: surface === 'retention' && canExportAudit && Boolean(retentionExportId),
    staleTime: 0,
    retry: 1,
  });
  const auditExportId = props.auditExport?.exportId ?? auditExport?.exportId;
  const auditExportQuery = useQuery({
    queryKey: ['mail', 'admin', 'delivery-audit', 'export', auditExportId],
    queryFn: () => getMailDeliveryAuditExport(auditExportId!),
    enabled: surface === 'delivery-audit' && canExportAudit && Boolean(auditExportId),
    staleTime: 0,
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
  ): Promise<boolean> => {
    if (busyAction) return false;
    setBusyAction(key);
    let commandAccepted = false;
    try {
      await action();
      commandAccepted = true;
      await after?.();
      idempotencyKeys.current.delete(idempotencyScope);
      toast.success(
        t('admin.operationsWorkspace.actionAccepted', {
          defaultValue: 'The command response was received and the evidence was refreshed.',
        })
      );
      return true;
    } catch (error) {
      if (!commandAccepted && error instanceof HttpError && error.status === 409) {
        idempotencyKeys.current.delete(idempotencyScope);
        await refresh();
        toast.error(t('admin.conflict'));
        return false;
      }
      toast.error(
        t('admin.operationsWorkspace.actionFailed', {
          defaultValue:
            'The command did not complete. Review the current evidence before retrying.',
        })
      );
      return false;
    } finally {
      setBusyAction(null);
    }
  };

  async function refresh() {
    if (props.onRefresh) {
      await props.onRefresh();
      return;
    }
    await query.refetch();
    if (surface === 'operations') await operationsQuery.refetch();
    if (surface === 'governance') await policyGovernanceQuery.refetch();
    if (surface === 'retention') {
      await retentionQuery.refetch();
      if (canPreviewPurge) await purgePreviewsQuery.refetch();
      if (retentionExportId) await retentionExportQuery.refetch();
    }
    if (surface === 'delivery-audit') {
      await deliveryAuditQuery.refetch();
      if (auditExportId) await auditExportQuery.refetch();
    }
    if (surface === 'shared-access') {
      await Promise.all(sharedAccessQueries.map((accessQuery) => accessQuery.refetch()));
    }
  }

  const openException = (exception: MailAdminOperationalException) => {
    if (props.onOpenException) return props.onOpenException(exception);
    if (exception.nextAction === 'OPEN_CONNECTION') navigate('/mail/admin/connections');
    else if (exception.nextAction === 'OPEN_DELIVERY') {
      if (!canReadAudit && !canRecoverDeliveries) {
        toast.error(
          t('admin.operationsWorkspace.auditReadRequired', {
            defaultValue: 'Delivery audit access is required to open this evidence.',
          })
        );
        return;
      }
      const correlation =
        canRevealAudit && exception.correlationId
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
  const refreshPurgeSources = async () => {
    await refetchRetention();
    if (canPreviewPurge) await purgePreviewsQuery.refetch();
  };
  const refetchDeliveryAudit = () =>
    queryClient.invalidateQueries({ queryKey: ['mail', 'admin', 'delivery-audit'] });

  const operations = props.operations ?? operationsQuery.data;
  const policyGovernance = props.policyGovernance ?? policyGovernanceQuery.data;
  const retentionSource = props.retention ?? retentionQuery.data;
  const projectedRetention = retentionSource as MailRetentionSnapshot | undefined;
  const purgeCandidates = useMemo(
    () => projectedRetention?.candidates ?? purgePreviewsQuery.data ?? [],
    [projectedRetention?.candidates, purgePreviewsQuery.data]
  );
  useEffect(() => {
    if (surface !== 'retention') return;
    setPurgeCandidate((current) => {
      if (current) {
        return (
          purgeCandidates.find(
            (candidate) => candidate.candidateSnapshotId === current.candidateSnapshotId
          ) ?? current
        );
      }
      return purgeCandidates[0] ?? null;
    });
  }, [purgeCandidates, surface]);
  const retention = retentionSource
    ? ({
        ...retentionSource,
        candidate: projectedRetention?.candidate ?? purgeCandidate,
        candidates: purgeCandidates,
        purgeJobs: canExecutePurge ? retentionSource.purgeJobs : [],
      } as MailRetentionSnapshot)
    : undefined;
  const deliveryAudit = props.deliveryAudit ?? deliveryAuditQuery.data;
  const currentRetentionExport =
    props.retentionExport ?? retentionExportQuery.data ?? retentionExport ?? undefined;
  const currentAuditExport = props.auditExport ?? auditExportQuery.data ?? auditExport ?? undefined;
  const detailError =
    operationsQuery.isError ||
    policyGovernanceQuery.isError ||
    retentionQuery.isError ||
    purgePreviewsQuery.isError ||
    deliveryAuditQuery.isError ||
    sharedAccessQueries.some((accessQuery) => accessQuery.isError);
  const detailLoading =
    operationsQuery.isLoading ||
    policyGovernanceQuery.isLoading ||
    retentionQuery.isLoading ||
    purgePreviewsQuery.isLoading ||
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
            canPreviewPurge={canPreviewPurge}
            canAuthorizePurge={canAuthorizePurge}
            canExecutePurge={canExecutePurge}
            canReadAudit={canReadAudit}
            canRevealAudit={canRevealAudit}
            canRecoverDeliveries={canRecoverDeliveries}
            canReconcileDeliveries={canReconcileDeliveries}
            canRetryDeliveries={canRetryDeliveries}
            canCancelDeliveries={canCancelDeliveries}
            canExportAudit={canExportAudit}
            now={props.now}
            operations={operations}
            connectionOperations={props.connectionOperations ?? connectionOperations}
            sharedAccess={sharedAccess}
            policyGovernance={policyGovernance}
            retention={retention}
            retentionExport={canExportAudit ? currentRetentionExport : undefined}
            deliveryAudit={canReadAudit || canRecoverDeliveries ? deliveryAudit : undefined}
            auditExport={canExportAudit ? currentAuditExport : undefined}
            deliveryEvidence={
              canReadAudit || canRecoverDeliveries ? props.deliveryEvidence : undefined
            }
            deliveryAuditFilters={deliveryAuditFilters}
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
              ((sharedInboxId, member, preview, impactAcknowledged) => {
                const actionKey = `remove-member:${member.memberId}`;
                const actionScope = `${actionKey}:${preview.fingerprint}`;
                return runAction(
                  actionKey,
                  () =>
                    removeMailSharedInboxMember(sharedInboxId, member.memberId, {
                      previewId: preview.previewId,
                      fingerprint: preview.fingerprint,
                      impactAcknowledged,
                      idempotencyKey: idempotencyKeyFor(actionScope),
                      version: preview.memberVersion,
                    }),
                  () => refetchSharedAccess(sharedInboxId),
                  actionScope
                );
              })
            }
            onPreviewSharedMemberRevoke={
              props.onPreviewSharedMemberRevoke ??
              ((sharedInboxId, member) =>
                previewMailSharedInboxMemberRevoke(sharedInboxId, member.memberId, member.version))
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
                      startsAt: input.startsAt ?? new Date(props.now ?? Date.now()).toISOString(),
                      idempotencyKey: idempotencyKeyFor(actionScope),
                    }),
                  refetchRetention,
                  actionScope
                );
              })
            }
            onPreviewLegalHoldRelease={
              props.onPreviewLegalHoldRelease ??
              (async (hold) => {
                if (!retention) return null;
                const actionKey = `preview-release-hold:${hold.holdId}`;
                const actionScope = `${actionKey}:${hold.version}:${retention.policyVersion}`;
                let preview: MailLegalHoldReleasePreview | null = null;
                const completed = await runAction(
                  actionKey,
                  async () => {
                    preview = await previewMailLegalHoldRelease(hold.holdId, {
                      idempotencyKey: idempotencyKeyFor(actionScope),
                      holdVersion: hold.version,
                      policyVersion: retention.policyVersion,
                    });
                  },
                  undefined,
                  actionScope
                );
                return completed ? preview : null;
              })
            }
            onApproveLegalHoldRelease={
              props.onApproveLegalHoldRelease ??
              (async (preview) => {
                const actionKey = `approve-release-hold:${preview.releasePreviewId}`;
                const actionScope = `${actionKey}:${preview.fingerprint}:${preview.distinctApproverCount}`;
                let refreshed: MailLegalHoldReleasePreview | null = null;
                const completed = await runAction(
                  actionKey,
                  async () => {
                    await approveMailLegalHoldRelease(preview.releasePreviewId, {
                      decision: 'APPROVE',
                      idempotencyKey: idempotencyKeyFor(actionScope),
                      fingerprint: preview.fingerprint,
                      holdVersion: preview.holdVersion,
                      policyVersion: preview.policyVersion,
                    });
                    refreshed = await getMailLegalHoldReleasePreview(preview.releasePreviewId);
                  },
                  undefined,
                  actionScope
                );
                return completed ? refreshed : null;
              })
            }
            onExecuteLegalHoldRelease={
              props.onExecuteLegalHoldRelease ??
              (async (preview) => {
                const actionKey = `execute-release-hold:${preview.releasePreviewId}`;
                const actionScope = `${actionKey}:${preview.fingerprint}`;
                return runAction(
                  actionKey,
                  () =>
                    executeMailLegalHoldRelease(preview.releasePreviewId, {
                      idempotencyKey: idempotencyKeyFor(actionScope),
                      fingerprint: preview.fingerprint,
                      holdVersion: preview.holdVersion,
                      policyVersion: preview.policyVersion,
                    }),
                  refetchRetention,
                  actionScope
                );
              })
            }
            onPreviewPurge={
              props.onPreviewPurge ??
              ((input) => {
                if (!retention) return;
                const request = input ?? {
                  scope: { tenant: true },
                  resourceTypes: [...MAIL_PURGE_RESOURCE_TYPES],
                  before: new Date(props.now ?? Date.now()).toISOString(),
                };
                const actionScope = `preview-purge:${retention.policyVersion}:${JSON.stringify(request)}`;
                void runAction(
                  'preview-purge',
                  async () => {
                    const preview = await previewMailPurge({
                      ...request,
                      idempotencyKey: idempotencyKeyFor(actionScope),
                      policyVersion: retention.policyVersion,
                    });
                    setPurgeCandidate(preview);
                  },
                  refreshPurgeSources,
                  actionScope
                );
              })
            }
            onSelectPurgeCandidate={
              props.onSelectPurgeCandidate ?? ((candidate) => setPurgeCandidate(candidate))
            }
            onApprovePurge={
              props.onApprovePurge ??
              ((candidate) => {
                const actionScope = `approve-purge:${candidate.candidateSnapshotId}:${candidate.distinctApproverCount}`;
                void runAction(
                  'approve-purge',
                  async () => {
                    await approveMailPurge(candidate.candidateSnapshotId, {
                      decision: 'APPROVE',
                      idempotencyKey: idempotencyKeyFor(actionScope),
                      policyVersion: candidate.policyVersion,
                    });
                  },
                  async () => {
                    const authoritative = await getMailPurgePreview(candidate.candidateSnapshotId);
                    setPurgeCandidate(authoritative);
                    await refreshPurgeSources();
                  },
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
                  refreshPurgeSources,
                  actionScope
                );
              })
            }
            onExportRetentionEvidence={
              props.onExportRetentionEvidence ??
              (() => {
                if (!retention) return;
                const actionScope = `export-retention:${retention.policyVersion}:${retention.generatedAt}`;
                void runAction(
                  'export-retention',
                  async () => {
                    const result = await createMailRetentionEvidenceExport({
                      scope: {
                        tenant: true,
                        resourceTypes: retention.resourcePolicies.map(
                          (policy) => policy.resourceType
                        ),
                      },
                      purpose: 'Retention policy and legal hold evidence review',
                      policyVersion: retention.policyVersion,
                      idempotencyKey: idempotencyKeyFor(actionScope),
                    });
                    setRetentionExport(result);
                  },
                  undefined,
                  actionScope
                );
              })
            }
            onApproveRetentionEvidenceExport={
              props.onApproveRetentionEvidenceExport ??
              ((exportId) => {
                const actionScope = `approve-retention-export:${exportId}:${currentRetentionExport?.distinctApproverCount ?? 0}`;
                void runAction(
                  'approve-retention-export',
                  async () => {
                    const result = await approveMailRetentionEvidenceExport(exportId, {
                      decision: 'APPROVE',
                      idempotencyKey: idempotencyKeyFor(actionScope),
                    });
                    setRetentionExport(result);
                  },
                  async () => {
                    setRetentionExport(await getMailRetentionEvidenceExport(exportId));
                  },
                  actionScope
                );
              })
            }
            onRefreshRetentionEvidenceExport={
              props.onRefreshRetentionEvidenceExport ??
              ((exportId) => {
                void getMailRetentionEvidenceExport(exportId)
                  .then(setRetentionExport)
                  .catch(() => toast.error(t('admin.loadError')));
              })
            }
            onDownloadRetentionEvidenceExport={
              props.onDownloadRetentionEvidenceExport ??
              ((exportId) => {
                void runAction('download-retention-export', async () => {
                  const latest = await getMailRetentionEvidenceExport(exportId);
                  setRetentionExport(latest);
                  if (
                    latest.approvalState !== 'APPROVED' ||
                    latest.state !== 'READY' ||
                    !latest.downloadUrl ||
                    !Number.isFinite(Date.parse(latest.expiresAt)) ||
                    Date.parse(latest.expiresAt) <= (props.now ?? Date.now())
                  ) {
                    throw new Error('Retention export is not currently downloadable');
                  }
                  const blob = await downloadMailRetentionEvidenceExport(exportId);
                  saveMailAttachmentBlob(
                    blob,
                    mailAdminEvidenceExportFileName('RETENTION', exportId)
                  );
                });
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
            onDeliveryAuditFiltersChange={(filters) => {
              const next = updateMailDeliveryAuditFilterSearch(
                new URLSearchParams(location.search),
                filters
              );
              navigate({ pathname: location.pathname, search: next.toString() }, { replace: true });
            }}
            onExportDeliveryAudit={
              props.onExportDeliveryAudit ??
              (() => {
                const actionScope = `export-audit:${JSON.stringify(deliveryAuditFilters)}`;
                void runAction(
                  'export-audit',
                  async () => {
                    const result = await createMailDeliveryAuditExport({
                      filters: deliveryAuditFilters,
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
            onApproveDeliveryAuditExport={
              props.onApproveDeliveryAuditExport ??
              ((exportId) => {
                const actionScope = `approve-audit-export:${exportId}:${currentAuditExport?.distinctApproverCount ?? 0}`;
                void runAction(
                  'approve-audit-export',
                  async () => {
                    const result = await approveMailDeliveryAuditExport(exportId, {
                      decision: 'APPROVE',
                      idempotencyKey: idempotencyKeyFor(actionScope),
                    });
                    setAuditExport(result);
                  },
                  async () => {
                    setAuditExport(await getMailDeliveryAuditExport(exportId));
                  },
                  actionScope
                );
              })
            }
            onRefreshDeliveryAuditExport={
              props.onRefreshDeliveryAuditExport ??
              ((exportId) => {
                void getMailDeliveryAuditExport(exportId)
                  .then(setAuditExport)
                  .catch(() => toast.error(t('admin.loadError')));
              })
            }
            onDownloadDeliveryAuditExport={
              props.onDownloadDeliveryAuditExport ??
              ((exportId) => {
                void runAction('download-audit-export', async () => {
                  const latest = await getMailDeliveryAuditExport(exportId);
                  setAuditExport(latest);
                  if (
                    latest.approvalState !== 'APPROVED' ||
                    latest.state !== 'READY' ||
                    !latest.downloadUrl ||
                    !Number.isFinite(Date.parse(latest.expiresAt)) ||
                    Date.parse(latest.expiresAt) <= (props.now ?? Date.now())
                  ) {
                    throw new Error('Delivery audit export is not currently downloadable');
                  }
                  const blob = await downloadMailDeliveryAuditExport(exportId);
                  saveMailAttachmentBlob(
                    blob,
                    mailAdminEvidenceExportFileName('DELIVERY_AUDIT', exportId)
                  );
                });
              })
            }
          />
        </Box>
      ) : null}
    </PageCanvas>
  );
}
