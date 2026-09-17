import { MailAdminOperationsWorkspace } from './mail-admin-operations-workspace';

import type { MailAdminOperationsWorkspaceProps } from './mail-admin-operations-workspace-config';

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
