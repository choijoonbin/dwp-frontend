import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getMailAdminOverview } from '@dwp-frontend/shared-utils';

import type { MailAdminOverview, MailLegalHoldReleasePreview } from '@dwp-frontend/shared-utils';
import type {
  MailAdminOperationalException,
  MailAdminOperationsSnapshot,
  MailAdminSurface,
  MailAuditExport,
  MailConnectionOperation,
  MailDeliveryAuditPage,
  MailDeliveryRecoveryEvidence,
  MailLegalHold,
  MailLegalHoldInput,
  MailPolicyGovernance,
  MailPurgeCandidateSnapshot,
  MailPurgeGateEvidence,
  MailRetentionExport,
  MailRetentionSnapshot,
  MailSharedInboxAccess,
  MailSharedInboxMember,
  MailSharedInboxMemberInput,
  MailSharedInboxMemberRevokePreview,
} from './mail-admin-operations-model';

export type MailAdminOperationsWorkspaceProps = {
  surface: MailAdminSurface;
  overview?: MailAdminOverview;
  canManage?: boolean;
  canManageConnections?: boolean;
  canManageSharedInboxes?: boolean;
  canManagePolicy?: boolean;
  canManageHolds?: boolean;
  canPreviewPurge?: boolean;
  canAuthorizePurge?: boolean;
  canExecutePurge?: boolean;
  canReadAudit?: boolean;
  canRevealAudit?: boolean;
  canRecoverDeliveries?: boolean;
  canReconcileDeliveries?: boolean;
  canRetryDeliveries?: boolean;
  canCancelDeliveries?: boolean;
  canExportAudit?: boolean;
  now?: number;
  operations?: MailAdminOperationsSnapshot;
  connectionOperations?: readonly MailConnectionOperation[];
  sharedAccess?: readonly MailSharedInboxAccess[];
  policyGovernance?: MailPolicyGovernance;
  retention?: MailRetentionSnapshot;
  retentionExport?: MailRetentionExport;
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
  onPreviewSharedMemberRevoke?: (
    sharedInboxId: string,
    member: MailSharedInboxMember
  ) => Promise<MailSharedInboxMemberRevokePreview>;
  onRemoveSharedMember?: (
    sharedInboxId: string,
    member: MailSharedInboxMember,
    preview: MailSharedInboxMemberRevokePreview,
    impactAcknowledged: boolean
  ) => void | Promise<boolean>;
  onCreateLegalHold?: (input: MailLegalHoldInput) => void;
  onUpdateLegalHold?: (holdId: string, input: MailLegalHoldInput) => void;
  onPreviewLegalHoldRelease?: (hold: MailLegalHold) => Promise<MailLegalHoldReleasePreview | null>;
  onApproveLegalHoldRelease?: (
    preview: MailLegalHoldReleasePreview
  ) => Promise<MailLegalHoldReleasePreview | null>;
  onExecuteLegalHoldRelease?: (preview: MailLegalHoldReleasePreview) => Promise<boolean>;
  onPreviewPurge?: (input?: {
    scope: Record<string, unknown>;
    resourceTypes: string[];
    before: string;
  }) => void;
  onSelectPurgeCandidate?: (candidate: MailPurgeCandidateSnapshot) => void;
  onApprovePurge?: (candidate: MailPurgeCandidateSnapshot) => void;
  onExecutePurge?: (candidate: MailPurgeCandidateSnapshot) => void;
  onExportRetentionEvidence?: () => void;
  onApproveRetentionEvidenceExport?: (exportId: string) => void;
  onRefreshRetentionEvidenceExport?: (exportId: string) => void;
  onDownloadRetentionEvidenceExport?: (exportId: string) => void;
  onReconcileDelivery?: (deliveryId: string) => void;
  onRetryDelivery?: (deliveryId: string) => void;
  onCancelDelivery?: (deliveryId: string) => void;
  onExportDeliveryAudit?: () => void;
  onApproveDeliveryAuditExport?: (exportId: string) => void;
  onRefreshDeliveryAuditExport?: (exportId: string) => void;
  onDownloadDeliveryAuditExport?: (exportId: string) => void;
};

export function useMailAdminWorkspaceOverview(injectedOverview?: MailAdminOverview) {
  return useQuery({
    queryKey: ['mail', 'admin'],
    queryFn: getMailAdminOverview,
    staleTime: 30_000,
    retry: 1,
    enabled: !injectedOverview,
  });
}

export function useSurfaceHeading(surface: MailAdminSurface) {
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
