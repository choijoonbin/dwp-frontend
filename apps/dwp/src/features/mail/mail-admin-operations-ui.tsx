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
        canManage={props.canManage}
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
        canManage={props.canManage}
        busyAction={props.busyAction}
        onOpenSettings={props.onOpenSharedInboxSettings}
        onAdd={props.onAddSharedMember}
        onUpdate={props.onUpdateSharedMember}
        onRemove={props.onRemoveSharedMember}
      />
    );
  if (props.surface === 'governance')
    return (
      <GovernanceSurface
        overview={props.overview}
        governance={props.policyGovernance}
        canManage={props.canManage}
        onOpenSettings={props.onOpenPolicySettings}
      />
    );
  if (props.surface === 'retention')
    return (
      <RetentionSurface
        overview={props.overview}
        retention={props.retention}
        fallbackEvidence={props.purgeEvidence}
        canManage={props.canManage}
        busyAction={props.busyAction}
        onCreateHold={props.onCreateLegalHold}
        onUpdateHold={props.onUpdateLegalHold}
        onReleaseHold={props.onReleaseLegalHold}
        onPreview={props.onPreviewPurge}
        onApprove={props.onApprovePurge}
        onExecute={props.onExecutePurge}
      />
    );
  return (
    <DeliveryAuditSurface
      overview={props.overview}
      page={props.deliveryAudit}
      auditExport={props.auditExport}
      evidence={props.deliveryEvidence}
      canManage={props.canManage}
      now={now}
      busyAction={props.busyAction}
      onReconcile={props.onReconcileDelivery}
      onRetry={props.onRetryDelivery}
      onCancel={props.onCancelDelivery}
      onExport={props.onExportDeliveryAudit}
    />
  );
}
