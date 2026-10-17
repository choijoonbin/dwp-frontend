import type { ApprovalMutationExecution } from '@dwp-frontend/shared-utils';

export const HRIS_APPROVAL_ADAPTER_FEATURE =
  'HRIS_APPROVAL_WORKFLOW_AND_DELEGATION_ADAPTERS' as const;
export const HRIS_WORKFLOW_ROUTE = '/hr/settings/workflow' as const;
export const HRIS_DELEGATION_ROUTE = '/hr/team/delegation' as const;

export const HRIS_APPROVAL_SHARED_API_CONTRACTS = Object.freeze({
  policyList: Object.freeze({
    id: 'SHARED-API-005',
    method: 'GET',
    path: '/api/approvals/v1/admin/policies',
    capability: 'approvals.policy.read',
    duty: 'HRIS_DUTY_CONFIGURATION_WORKBENCH_READER',
    routeContractKey: 'route.approvals.admin.policies.page',
  }),
  policyPublish: Object.freeze({
    id: 'SHARED-API-006',
    method: 'POST',
    path: '/api/approvals/v1/admin/policies/{policyId}/publish',
    capability: 'approvals.policy.publish',
    duty: 'HRIS_DUTY_POLICY_PUBLISHER',
    routeContractKey: 'route.approvals.admin.policy-publish.action',
  }),
  delegationList: Object.freeze({
    id: 'SHARED-API-010',
    method: 'GET',
    path: '/api/approvals/v1/delegations',
    capability: 'approvals.work.delegation.read',
    duty: 'HRIS_DUTY_MANAGER_TEAM_READER',
    routeContractKey: 'route.approvals.work.delegations.page',
  }),
  delegationCreate: Object.freeze({
    id: 'SHARED-API-011',
    method: 'POST',
    path: '/api/approvals/v1/delegations',
    capability: 'approvals.work.delegation.manage',
    routeContractKey: 'route.approvals.work.delegation-create.action',
  }),
  delegationRevoke: Object.freeze({
    id: 'SHARED-API-012',
    method: 'POST',
    path: '/api/approvals/v1/delegations/{delegationId}/revoke',
    capability: 'approvals.work.delegation.manage',
    routeContractKey: 'route.approvals.work.delegation-revoke.action',
  }),
});

export type HrisApprovalReadAdmission = Readonly<{
  allowed: true;
  capability: string;
  duty: string;
  routeContractKey: string;
}>;

export type HrisApprovalCommandAdmission = Readonly<{
  allowed: true;
  capability: string;
  duty: string;
  routeContractKeys: readonly string[];
  decisionRevision: string;
  purposeBound: true;
  subjectRevisionBound: true;
  separationOfDuties: readonly string[];
}>;

export type HrisApprovalAdapterAdmission = Readonly<{
  kind: 'TRUSTED_HRIS_APPROVAL_CROSS_PRODUCT';
  feature: typeof HRIS_APPROVAL_ADAPTER_FEATURE;
  workspace: 'SETTINGS_WORKFLOW' | 'TEAM_DELEGATION';
  tenantEnrolled: true;
  hcmProductAccess: 'VIEW';
  approvalsProductAccess: 'VIEW';
  tenantId: string;
  actorId: string;
  ownerTenantId: string;
  ownerActorId: string;
  rolePlane: 'SETTINGS_ADMIN' | 'MANAGER';
  ownerContextScopeKey: string;
  populationScopeKey?: string;
  pageDecisionRevision: string;
  purposeBound: true;
  read: HrisApprovalReadAdmission;
  command?: HrisApprovalCommandAdmission;
}>;

export type HrisApprovalCommandRunner = <T>(input: Readonly<{
  routeContractKey: string;
  expectedDecisionRevision: string;
  expectedObjectVersion?: number;
  run: (execution: ApprovalMutationExecution) => Promise<T>;
}>) => Promise<T>;

const NON_BLANK = /\S/u;
const SCOPE_KEY = /^[A-Za-z0-9._:-]{1,256}$/u;

function commonAdmission(
  admission: HrisApprovalAdapterAdmission | undefined,
  workspace: HrisApprovalAdapterAdmission['workspace'],
  rolePlane: HrisApprovalAdapterAdmission['rolePlane']
): admission is HrisApprovalAdapterAdmission {
  return Boolean(
    admission?.kind === 'TRUSTED_HRIS_APPROVAL_CROSS_PRODUCT' &&
      admission.feature === HRIS_APPROVAL_ADAPTER_FEATURE &&
      admission.workspace === workspace &&
      admission.tenantEnrolled === true &&
      admission.hcmProductAccess === 'VIEW' &&
      admission.approvalsProductAccess === 'VIEW' &&
      admission.rolePlane === rolePlane &&
      NON_BLANK.test(admission.tenantId) &&
      NON_BLANK.test(admission.actorId) &&
      admission.ownerTenantId === admission.tenantId &&
      admission.ownerActorId === admission.actorId &&
      SCOPE_KEY.test(admission.ownerContextScopeKey) &&
      NON_BLANK.test(admission.pageDecisionRevision) &&
      admission.purposeBound === true &&
      admission.read.allowed === true
  );
}

export function workflowReadAdmitted(
  admission: HrisApprovalAdapterAdmission | undefined
): admission is HrisApprovalAdapterAdmission {
  const contract = HRIS_APPROVAL_SHARED_API_CONTRACTS.policyList;
  return Boolean(
    commonAdmission(admission, 'SETTINGS_WORKFLOW', 'SETTINGS_ADMIN') &&
      admission.read.capability === contract.capability &&
      admission.read.duty === contract.duty &&
      admission.read.routeContractKey === contract.routeContractKey
  );
}

export function workflowPublishAdmitted(admission: HrisApprovalAdapterAdmission): boolean {
  const command = admission.command;
  const contract = HRIS_APPROVAL_SHARED_API_CONTRACTS.policyPublish;
  return Boolean(
    workflowReadAdmitted(admission) &&
      command?.allowed === true &&
      command.capability === contract.capability &&
      command.duty === contract.duty &&
      command.routeContractKeys.length === 1 &&
      command.routeContractKeys[0] === contract.routeContractKey &&
      command.decisionRevision === admission.pageDecisionRevision &&
      command.purposeBound === true &&
      command.subjectRevisionBound === true &&
      command.separationOfDuties.length === 2 &&
      command.separationOfDuties[0] === 'SOD_HRIS_CONFIG_FOUR_EYES' &&
      command.separationOfDuties[1] === 'SOD_HRIS_AUDIT_INDEPENDENCE'
  );
}

export function delegationReadAdmitted(
  admission: HrisApprovalAdapterAdmission | undefined
): admission is HrisApprovalAdapterAdmission {
  const contract = HRIS_APPROVAL_SHARED_API_CONTRACTS.delegationList;
  return Boolean(
    commonAdmission(admission, 'TEAM_DELEGATION', 'MANAGER') &&
      admission.read.capability === contract.capability &&
      admission.read.duty === contract.duty &&
      admission.read.routeContractKey === contract.routeContractKey &&
      admission.populationScopeKey &&
      SCOPE_KEY.test(admission.populationScopeKey)
  );
}

export function delegationManageAdmitted(admission: HrisApprovalAdapterAdmission): boolean {
  const command = admission.command;
  const expectedRoutes = [
    HRIS_APPROVAL_SHARED_API_CONTRACTS.delegationCreate.routeContractKey,
    HRIS_APPROVAL_SHARED_API_CONTRACTS.delegationRevoke.routeContractKey,
  ];
  return Boolean(
    delegationReadAdmitted(admission) &&
      command?.allowed === true &&
      command.capability ===
        HRIS_APPROVAL_SHARED_API_CONTRACTS.delegationCreate.capability &&
      command.duty === HRIS_APPROVAL_SHARED_API_CONTRACTS.delegationList.duty &&
      command.routeContractKeys.length === 2 &&
      command.routeContractKeys.every((route, index) => route === expectedRoutes[index]) &&
      command.decisionRevision === admission.pageDecisionRevision &&
      command.purposeBound === true &&
      command.subjectRevisionBound === true &&
      command.separationOfDuties.length === 1 &&
      command.separationOfDuties[0] === 'SOD_HRIS_AUDIT_INDEPENDENCE'
  );
}

export function approvalAdapterScopeIdentity(admission: HrisApprovalAdapterAdmission): string {
  return JSON.stringify([
    admission.tenantId,
    admission.actorId,
    admission.ownerTenantId,
    admission.ownerActorId,
    admission.rolePlane,
    admission.ownerContextScopeKey,
    admission.populationScopeKey ?? '',
    admission.pageDecisionRevision,
  ]);
}

export type HrisApprovalQueryState = Readonly<{ tab: 'overview'; focus: string | null }>;

const FOCUS = /^[A-Za-z0-9._:-]{1,160}$/u;

export function parseHrisApprovalQueryState(search: URLSearchParams): HrisApprovalQueryState {
  const focus = search.get('focus');
  return Object.freeze({
    tab: 'overview',
    focus: focus && FOCUS.test(focus) ? focus : null,
  });
}

export function mergeHrisApprovalQueryState(
  search: URLSearchParams,
  patch: Partial<HrisApprovalQueryState>
): URLSearchParams {
  const next = new URLSearchParams(search);
  next.set('tab', 'overview');
  const focus = patch.focus;
  if (focus === null) next.delete('focus');
  else if (focus !== undefined && FOCUS.test(focus)) next.set('focus', focus);
  return next;
}
