import type { ApprovalDelegation, ApprovalPolicy } from '@dwp-frontend/shared-utils';
import type {
  HrisApprovalAdapterAdmission,
  HrisApprovalCommandAdmission,
} from '../model/hris-approval-adapter-contract';

export const POLICY_ID = 'policy-0001';
export const DELEGATION_ID = 'delegation-0001';

export function policy(overrides: Partial<ApprovalPolicy> = {}): ApprovalPolicy {
  return {
    policyId: POLICY_ID,
    policyKey: 'HRIS_EMPLOYMENT_CHANGE',
    nameKo: '인사 변경 승인 정책',
    nameEn: 'HR change approval policy',
    policyType: 'WORKFLOW',
    enforcementMode: 'ENFORCED',
    severity: 'HIGH',
    lifecycleState: 'ACTIVE',
    rule: { minimumApprovers: 2 },
    version: 7,
    pendingReview: true,
    pendingEnforcementMode: 'ENFORCED',
    pendingSeverity: 'HIGH',
    pendingLifecycleState: 'ACTIVE',
    pendingRule: { minimumApprovers: 2 },
    pendingChangeReason: 'Require independent HR review',
    pendingBy: 81,
    pendingAt: '2026-10-17T14:00:00Z',
    ...overrides,
  };
}

export function delegation(overrides: Partial<ApprovalDelegation> = {}): ApprovalDelegation {
  return {
    delegationId: DELEGATION_ID,
    delegatorUserId: 42,
    delegateUserId: 77,
    delegatePersonPublicId: 'person-77',
    delegateDisplayName: 'Alex Delegate',
    delegateEmail: 'alex@example.test',
    scopeType: 'ALL',
    startsAt: '2026-10-18T00:00:00Z',
    endsAt: '2026-10-19T00:00:00Z',
    lifecycleState: 'ACTIVE',
    reason: 'Planned leave',
    version: 9,
    direction: 'OUTGOING',
    ...overrides,
  };
}

export function workflowAdmission(
  overrides: Partial<HrisApprovalAdapterAdmission> = {}
): HrisApprovalAdapterAdmission {
  return {
    kind: 'TRUSTED_HRIS_APPROVAL_CROSS_PRODUCT',
    feature: 'HRIS_APPROVAL_WORKFLOW_AND_DELEGATION_ADAPTERS',
    workspace: 'SETTINGS_WORKFLOW',
    tenantEnrolled: true,
    tenantId: 'tenant-42',
    actorId: '42',
    ownerTenantId: 'tenant-42',
    ownerActorId: '42',
    hcmPageRouteContractKey: 'route.hcm.configuration.workflow.page',
    hcmContextScopeKey: 'hcm-configuration-scope-42',
    ownerContextScopeKey: 'approval-admin-scope-42',
    pageDecisionRevision: 'decision-workflow-7',
    read: {
      allowed: true,
      capability: 'approvals.policy.read',
      routeContractKey: 'route.approvals.admin.policies.page',
      contextScopeKey: 'approval-admin-scope-42',
      decisionRevision: 'decision-workflow-7',
    },
    ...overrides,
  };
}

export function workflowCommandAdmission(
  overrides: Partial<HrisApprovalCommandAdmission> = {}
): HrisApprovalCommandAdmission {
  return {
    allowed: true,
    capability: 'approvals.policy.publish',
    routeContractKeys: ['route.approvals.admin.policy-publish.action'],
    decisionRevision: 'decision-workflow-7',
    ...overrides,
  };
}

export function delegationAdmission(
  overrides: Partial<HrisApprovalAdapterAdmission> = {}
): HrisApprovalAdapterAdmission {
  return {
    kind: 'TRUSTED_HRIS_APPROVAL_CROSS_PRODUCT',
    feature: 'HRIS_APPROVAL_WORKFLOW_AND_DELEGATION_ADAPTERS',
    workspace: 'TEAM_DELEGATION',
    tenantEnrolled: true,
    tenantId: 'tenant-42',
    actorId: '42',
    ownerTenantId: 'tenant-42',
    ownerActorId: '42',
    hcmPageRouteContractKey: 'route.hcm.team.delegation.page',
    hcmContextScopeKey: 'manager-population-42',
    ownerContextScopeKey: 'approval-work-scope-42',
    populationScopeKey: 'manager-population-42',
    pageDecisionRevision: 'decision-delegation-9',
    read: {
      allowed: true,
      capability: 'approvals.work.delegation.read',
      routeContractKey: 'route.approvals.work.delegations.page',
      contextScopeKey: 'approval-work-scope-42',
      decisionRevision: 'decision-delegation-9',
    },
    ...overrides,
  };
}

export function delegationCommandAdmission(
  overrides: Partial<HrisApprovalCommandAdmission> = {}
): HrisApprovalCommandAdmission {
  return {
    allowed: true,
    capability: 'approvals.work.delegation.manage',
    routeContractKeys: [
      'route.approvals.work.delegation-create.action',
      'route.approvals.work.delegation-revoke.action',
    ],
    decisionRevision: 'decision-delegation-9',
    ...overrides,
  };
}
