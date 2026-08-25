import {
  productSurfaceServerNow,
  useAuth,
  usePermissions,
  useProductSurfaceAuthority,
} from '@dwp-frontend/shared-utils';

import { useOptionalAllowedProductSurface } from '../../components/allowed-product-surface-context';
import { resolveCanonicalProductSurfaceContext } from '../../components/product-surface-capability-access';

import type { AllowedSurfaceDecision } from '../../components/product-surface-context';

type PermissionChecker = (resourceKey: string, permissionCode: string) => boolean;
type ApprovalEntryContext = Readonly<{
  contextKey: string;
  productKey: string;
  surfaceKey: string;
  plane: string;
  accessMode: string;
  effectiveGrants: readonly Readonly<{
    grantKind: string;
    capabilityContractKey?: string;
    activationState?: string;
    scopeKeys: readonly string[];
    validUntil?: string | null;
    readOnly: boolean;
  }>[];
  scopes: readonly Readonly<{ key: string; kind: string; validUntil?: string | null }>[];
  revalidateAt: string;
}>;

export type ApprovalExperience = {
  canViewTasks: boolean;
  canClaimTasks: boolean;
  canDecideTasks: boolean;
  canViewRequests: boolean;
  canCreateRequests: boolean;
  canUpdateRequests: boolean;
  canStartRequests: boolean;
  canManageDelegations: boolean;
  canDesign: boolean;
  canEditDesign: boolean;
  canPublish: boolean;
  canViewPolicies: boolean;
  canEditPolicies: boolean;
  canPublishPolicies: boolean;
  canViewOperations: boolean;
  canOperate: boolean;
  canViewSignatures: boolean;
  canManageSignatures: boolean;
  canAskExpert: boolean;
  canAdmin: boolean;
};

export type ApprovalManagementRequestScope = Readonly<{
  contextScopeKey?: string;
  cacheKey: readonly [string, string, string, string, string, string];
}>;

const DESIGN_READ_CAPABILITIES = [
  'approvals.design.read',
  'approvals.design.create',
  'approvals.design.update',
  'approvals.design.publish',
  'approvals.oversight.design.read',
] as const;
const POLICY_READ_CAPABILITIES = [
  'approvals.policy.read',
  'approvals.policy.update',
  'approvals.policy.publish',
  'approvals.oversight.policy.read',
] as const;
const OPERATIONS_READ_CAPABILITIES = [
  'approvals.operations.read',
  'approvals.operations.execute',
  'approvals.audit.operations.read',
  'approvals.oversight.overview.read',
  'approvals.oversight.operations.read',
] as const;
const SIGNATURE_READ_CAPABILITIES = [
  'approvals.signature.read',
  'approvals.oversight.signature.read',
] as const;

function governedCapabilityChecker(
  decision: AllowedSurfaceDecision,
  entryContext: ApprovalEntryContext,
  nowMs: number
): (contractKey: string, mutation?: boolean, includeEligible?: boolean) => boolean {
  const scopeKey = decision.scope.key;
  const decisionReadOnly = decision.effectiveReadOnly || decision.scope.readOnly;
  const decisionExpiry = Math.min(
    Date.parse(decision.revalidateAt),
    Date.parse(decision.context.revalidateAt),
    Date.parse(entryContext.revalidateAt)
  );
  return (contractKey, mutation = false, includeEligible = false) => {
    if (!Number.isFinite(decisionExpiry) || decisionExpiry <= nowMs) return false;
    return entryContext.effectiveGrants.some((grant) => {
      if (
        grant.grantKind !== 'CAPABILITY' ||
        grant.capabilityContractKey !== contractKey ||
        (grant.activationState !== 'ACTIVE' &&
          !(includeEligible && grant.activationState === 'ELIGIBLE')) ||
        !grant.scopeKeys.includes(scopeKey) ||
        (grant.validUntil != null && Date.parse(grant.validUntil) <= nowMs)
      ) {
        return false;
      }
      return !mutation || (!decisionReadOnly && !grant.readOnly);
    });
  };
}

export function resolveApprovalExperience({
  decision,
  entryContext,
  hasPermission,
  nowMs = Date.now(),
}: {
  decision: AllowedSurfaceDecision | null;
  entryContext?: ApprovalEntryContext | null;
  hasPermission: PermissionChecker;
  nowMs?: number;
}): ApprovalExperience {
  if (!decision) {
    const any = (resource: string, actions: readonly string[]) =>
      actions.some((action) => hasPermission(resource, action));
    const canDesign = any('ADMIN.APPROVAL_DESIGN', [
      'VIEW',
      'CREATE',
      'UPDATE',
      'APPROVE',
      'MANAGE',
    ]);
    const canEditDesign = any('ADMIN.APPROVAL_DESIGN', ['CREATE', 'UPDATE', 'MANAGE']);
    const canViewPolicies = any('ADMIN.APPROVAL_POLICY', ['VIEW', 'UPDATE', 'APPROVE', 'MANAGE']);
    const canEditPolicies = any('ADMIN.APPROVAL_POLICY', ['UPDATE', 'MANAGE']);
    const canPublishPolicies = any('ADMIN.APPROVAL_POLICY', ['APPROVE', 'MANAGE']);
    const canViewOperations = any('ADMIN.APPROVAL_OPERATIONS', ['VIEW', 'UPDATE', 'MANAGE']);
    const canOperate = any('ADMIN.APPROVAL_OPERATIONS', ['UPDATE', 'MANAGE']);
    const canViewSignatures = any('ADMIN.APPROVAL_SIGNATURE', ['VIEW', 'MANAGE']);
    const canViewTasks = any('ACTION.APPROVAL_TASK', ['VIEW', 'MANAGE']);
    const canCreateRequests = any('ACTION.APPROVAL_REQUEST', ['CREATE', 'MANAGE']);
    const canUpdateRequests = any('ACTION.APPROVAL_REQUEST', ['UPDATE', 'MANAGE']);
    return {
      canViewTasks,
      canClaimTasks: any('ACTION.APPROVAL_TASK', ['UPDATE', 'MANAGE']),
      canDecideTasks: any('ACTION.APPROVAL_TASK', ['APPROVE', 'MANAGE']),
      canViewRequests: any('ACTION.APPROVAL_REQUEST', ['VIEW', 'MANAGE']),
      canCreateRequests,
      canUpdateRequests,
      canStartRequests: canCreateRequests && canUpdateRequests,
      canManageDelegations: hasPermission('ACTION.APPROVAL_DELEGATION', 'MANAGE'),
      canDesign,
      canEditDesign,
      canPublish: hasPermission('ADMIN.APPROVAL_DESIGN', 'APPROVE'),
      canViewPolicies,
      canEditPolicies,
      canPublishPolicies,
      canViewOperations,
      canOperate,
      canViewSignatures,
      canManageSignatures: hasPermission('ADMIN.APPROVAL_SIGNATURE', 'MANAGE'),
      canAskExpert: hasPermission('APP.ASK', 'VIEW') && hasPermission('APP.APPROVALS', 'VIEW'),
      canAdmin: canDesign || canViewPolicies || canViewOperations || canViewSignatures,
    };
  }

  const selectedEntryScopes =
    entryContext?.scopes.filter(
      (scope) => scope.key === decision.scope.key && scope.kind === decision.scope.kind
    ) ?? [];
  const selectedEntryScope = selectedEntryScopes.length === 1 ? selectedEntryScopes[0] : undefined;
  const scopeRemainsValid = (value: string | null | undefined) => {
    if (value == null) return true;
    const instant = Date.parse(value);
    return Number.isFinite(instant) && instant > nowMs;
  };
  const governedEntry =
    entryContext &&
    entryContext.productKey === decision.context.productKey &&
    entryContext.surfaceKey === decision.context.surfaceKey &&
    entryContext.accessMode === decision.context.accessMode &&
    entryContext.plane === decision.context.plane &&
    selectedEntryScope &&
    scopeRemainsValid(selectedEntryScope.validUntil) &&
    scopeRemainsValid(decision.scope.validUntil)
      ? entryContext
      : null;
  const can = governedEntry
    ? governedCapabilityChecker(decision, governedEntry, nowMs)
    : () => false;
  const any = (contractKeys: readonly string[], mutation = false) =>
    contractKeys.some((contractKey) => can(contractKey, mutation));
  const canViewTasks = can('approvals.work.task.read');
  const canCreateRequests = can('approvals.work.request.create', true);
  const canUpdateRequests = can('approvals.work.request.update', true);
  const canDesign = any(DESIGN_READ_CAPABILITIES);
  const canViewPolicies = any(POLICY_READ_CAPABILITIES);
  const canViewOperations = any(OPERATIONS_READ_CAPABILITIES);
  const canViewSignatures = any(SIGNATURE_READ_CAPABILITIES);
  return {
    canViewTasks,
    canClaimTasks: can('approvals.work.task.update', true),
    canDecideTasks: can('approvals.work.task.approve', true),
    canViewRequests: can('approvals.work.request.read'),
    canCreateRequests,
    canUpdateRequests,
    canStartRequests: canCreateRequests && canUpdateRequests,
    canManageDelegations: can('approvals.work.delegation.manage', true),
    canDesign,
    canEditDesign: any(['approvals.design.create', 'approvals.design.update'], true),
    canPublish: can('approvals.design.publish', true, true),
    canViewPolicies,
    canEditPolicies: can('approvals.policy.update', true),
    canPublishPolicies: can('approvals.policy.publish', true, true),
    canViewOperations,
    canOperate: can('approvals.operations.execute', true, true),
    canViewSignatures,
    canManageSignatures: false,
    canAskExpert: hasPermission('APP.ASK', 'VIEW'),
    canAdmin: canDesign || canViewPolicies || canViewOperations || canViewSignatures,
  };
}

export function useApprovalExperience(): ApprovalExperience {
  const { hasPermission } = usePermissions();
  const decision = useOptionalAllowedProductSurface();
  const authority = useProductSurfaceAuthority();
  const entryContext = resolveCanonicalProductSurfaceContext(decision, authority.snapshot);
  const nowMs = authority.snapshot ? productSurfaceServerNow(authority.snapshot) : Date.now();
  return resolveApprovalExperience({ decision, entryContext, hasPermission, nowMs });
}

export function useApprovalManagementRequestScope(): ApprovalManagementRequestScope {
  const auth = useAuth();
  const decision = useOptionalAllowedProductSurface();
  const authority = useProductSurfaceAuthority();
  const governed =
    decision?.context.productKey === 'approvals' &&
    decision.context.surfaceKey === 'approvals.admin'
      ? decision
      : undefined;
  const contextScopeKey = governed?.scope.key;
  return {
    ...(contextScopeKey ? { contextScopeKey } : {}),
    cacheKey: [
      String(auth.user?.tenantId ?? ''),
      String(auth.user?.userId ?? ''),
      governed?.context.accessMode ?? authority.snapshot?.envelope.activeAccessMode ?? 'LEGACY',
      governed?.context.surfaceKey ?? 'approvals.admin.legacy',
      contextScopeKey ?? '',
      governed?.decisionRevision ?? authority.snapshot?.envelope.decisionRevision ?? '',
    ],
  };
}
