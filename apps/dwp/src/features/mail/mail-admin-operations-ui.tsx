import { OperationsSurface } from './mail-admin-operations-a01';
import { ConnectionsSurface } from './mail-admin-operations-a02';
import { SharedAccessSurface } from './mail-admin-operations-a03';
import { GovernanceSurface } from './mail-admin-operations-a04';
import { RetentionSurface } from './mail-admin-operations-a05';
import { DeliveryAuditSurface } from './mail-admin-operations-a06';

import type { MailAdminOperationsContentProps } from './mail-admin-operations-ui-shared';

export type { MailAdminOperationsContentProps } from './mail-admin-operations-ui-shared';

export function MailAdminOperationsContent(props: MailAdminOperationsContentProps) {
  const now = props.now ?? Date.now();
  const fallback = props.canManage;
  if (props.surface === 'operations')
    return (
      <OperationsSurface
        overview={props.overview}
        operations={props.operations}
        now={now}
        onOpenException={props.onOpenException}
      />
    );
  if (props.surface === 'connections')
    return (
      <ConnectionsSurface
        overview={props.overview}
        operations={props.connectionOperations}
        now={now}
        canManage={props.canManageConnections ?? fallback}
        busyAction={props.busyAction}
        onOpenSettings={props.onOpenConnectionSettings}
        onDiagnostic={props.onRunConnectionDiagnostic}
        onSync={props.onStartConnectionSync}
        onTest={props.onSendConnectionTest}
      />
    );
  if (props.surface === 'shared-access')
    return (
      <SharedAccessSurface
        overview={props.overview}
        access={props.sharedAccess}
        canManage={props.canManageSharedInboxes ?? fallback}
        busyAction={props.busyAction}
        onOpenSettings={props.onOpenSharedInboxSettings}
        onAdd={props.onAddSharedMember}
        onUpdate={props.onUpdateSharedMember}
        onPreviewRevoke={props.onPreviewSharedMemberRevoke}
        onRemove={props.onRemoveSharedMember}
      />
    );
  if (props.surface === 'governance')
    return (
      <GovernanceSurface
        overview={props.overview}
        governance={props.policyGovernance}
        canManage={props.canManagePolicy ?? fallback}
        onOpenSettings={props.onOpenPolicySettings}
      />
    );
  if (props.surface === 'retention')
    return (
      <RetentionSurface
        overview={props.overview}
        retention={props.retention}
        retentionExport={props.retentionExport}
        fallbackEvidence={props.purgeEvidence}
        canManageHolds={props.canManageHolds ?? fallback}
        canPreviewPurge={props.canPreviewPurge ?? fallback}
        canAuthorizePurge={props.canAuthorizePurge ?? fallback}
        canExecutePurge={props.canExecutePurge ?? fallback}
        canExport={props.canExportAudit ?? fallback}
        now={now}
        busyAction={props.busyAction}
        onCreateHold={props.onCreateLegalHold}
        onUpdateHold={props.onUpdateLegalHold}
        onPreviewHoldRelease={props.onPreviewLegalHoldRelease}
        onApproveHoldRelease={props.onApproveLegalHoldRelease}
        onExecuteHoldRelease={props.onExecuteLegalHoldRelease}
        onPreview={props.onPreviewPurge}
        onSelectCandidate={props.onSelectPurgeCandidate}
        onApprove={props.onApprovePurge}
        onExecute={props.onExecutePurge}
        onExport={props.onExportRetentionEvidence}
        onApproveExport={props.onApproveRetentionEvidenceExport}
        onRefreshExport={props.onRefreshRetentionEvidenceExport}
        onDownloadExport={props.onDownloadRetentionEvidenceExport}
      />
    );
  return (
    <DeliveryAuditSurface
      overview={props.overview}
      page={props.deliveryAudit}
      auditExport={props.auditExport}
      evidence={props.deliveryEvidence}
      filters={props.deliveryAuditFilters}
      canReadAudit={props.canReadAudit ?? fallback}
      canRevealAudit={props.canRevealAudit ?? fallback}
      canReconcile={props.canReconcileDeliveries ?? props.canRecoverDeliveries ?? fallback}
      canRetry={props.canRetryDeliveries ?? props.canRecoverDeliveries ?? fallback}
      canCancel={props.canCancelDeliveries ?? props.canRecoverDeliveries ?? fallback}
      canExport={props.canExportAudit ?? fallback}
      now={now}
      busyAction={props.busyAction}
      onReconcile={props.onReconcileDelivery}
      onRetry={props.onRetryDelivery}
      onCancel={props.onCancelDelivery}
      onFiltersChange={props.onDeliveryAuditFiltersChange}
      onExport={props.onExportDeliveryAudit}
      onApproveExport={props.onApproveDeliveryAuditExport}
      onRefreshExport={props.onRefreshDeliveryAuditExport}
      onDownloadExport={props.onDownloadDeliveryAuditExport}
    />
  );
}
