import { usePermissions } from '@dwp-frontend/shared-utils';

export function useApprovalExperience() {
  const { hasPermission } = usePermissions();
  const any = (resource: string, actions: readonly string[]) =>
    actions.some((action) => hasPermission(resource, action));
  const canDesign = any('ADMIN.APPROVAL_DESIGN', ['VIEW', 'CREATE', 'UPDATE', 'APPROVE', 'MANAGE']);
  const canEditDesign = any('ADMIN.APPROVAL_DESIGN', ['CREATE', 'UPDATE', 'MANAGE']);
  const canViewPolicies = any('ADMIN.APPROVAL_POLICY', ['VIEW', 'UPDATE', 'APPROVE', 'MANAGE']);
  const canEditPolicies = any('ADMIN.APPROVAL_POLICY', ['UPDATE', 'MANAGE']);
  const canPublishPolicies = any('ADMIN.APPROVAL_POLICY', ['APPROVE', 'MANAGE']);
  const canViewOperations = any('ADMIN.APPROVAL_OPERATIONS', ['VIEW', 'UPDATE', 'MANAGE']);
  const canOperate = any('ADMIN.APPROVAL_OPERATIONS', ['UPDATE', 'MANAGE']);
  const canViewSignatures = any('ADMIN.APPROVAL_SIGNATURE', ['VIEW', 'MANAGE']);
  const canManageSignatures = hasPermission('ADMIN.APPROVAL_SIGNATURE', 'MANAGE');
  const canAskExpert = hasPermission('APP.ASK', 'VIEW') && hasPermission('APP.APPROVALS', 'VIEW');
  const canViewTasks = any('ACTION.APPROVAL_TASK', ['VIEW', 'MANAGE']);
  const canClaimTasks = any('ACTION.APPROVAL_TASK', ['UPDATE', 'MANAGE']);
  const canDecideTasks = any('ACTION.APPROVAL_TASK', ['APPROVE', 'MANAGE']);
  const canViewRequests = any('ACTION.APPROVAL_REQUEST', ['VIEW', 'MANAGE']);
  const canCreateRequests = any('ACTION.APPROVAL_REQUEST', ['CREATE', 'MANAGE']);
  const canUpdateRequests = any('ACTION.APPROVAL_REQUEST', ['UPDATE', 'MANAGE']);
  return {
    canViewTasks,
    canClaimTasks,
    canDecideTasks,
    canViewRequests,
    canCreateRequests,
    canUpdateRequests,
    canStartRequests: canCreateRequests && canUpdateRequests,
    canDesign,
    canEditDesign,
    canPublish: hasPermission('ADMIN.APPROVAL_DESIGN', 'APPROVE'),
    canViewPolicies,
    canEditPolicies,
    canPublishPolicies,
    canViewOperations,
    canOperate,
    canViewSignatures,
    canManageSignatures,
    canAskExpert,
    canAdmin: canDesign || canViewPolicies || canViewOperations || canViewSignatures,
  };
}
