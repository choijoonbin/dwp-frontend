import { APPROVAL_DOCUMENT_ACTION_CONTRACTS } from './approval-document-action-contracts';
import { APPROVAL_EXTENSION_ACTION_CONTRACTS } from './approval-extension-action-contracts';
import { APPROVAL_RELEASE10_ACTION_CONTRACTS } from './approval-release10-action-contracts';
import { APPROVAL_RELEASE14_ACTION_CONTRACTS } from './approval-release14-action-contracts';
import { APPROVAL_RELEASE15_ACTION_CONTRACTS } from './approval-release15-action-contracts';

const base = '/api/approvals/v1';

export type ApprovalGovernedMutationApiContract = Readonly<{
  apiFunction: string;
  routeContractKey: `route.approvals.${string}.action`;
  method: 'DELETE' | 'POST' | 'PUT';
  path: string;
}>;

/** Approval-owned mutation inventory; read clients must not import this module. */
export const APPROVAL_GOVERNED_MUTATION_API_CONTRACTS = [
  ...APPROVAL_DOCUMENT_ACTION_CONTRACTS,
  ...APPROVAL_EXTENSION_ACTION_CONTRACTS,
  ...APPROVAL_RELEASE10_ACTION_CONTRACTS,
  ...APPROVAL_RELEASE14_ACTION_CONTRACTS,
  ...APPROVAL_RELEASE15_ACTION_CONTRACTS,
  {
    apiFunction: 'claimApprovalTask',
    routeContractKey: 'route.approvals.work.task-claim.action',
    method: 'POST',
    path: `${base}/tasks/{taskId}/claim`,
  },
  {
    apiFunction: 'decideApprovalTask',
    routeContractKey: 'route.approvals.work.task-decision.action',
    method: 'POST',
    path: `${base}/tasks/{taskId}/decisions`,
  },
  {
    apiFunction: 'createApprovalRequest',
    routeContractKey: 'route.approvals.work.request-create.action',
    method: 'POST',
    path: `${base}/requests`,
  },
  {
    apiFunction: 'updateApprovalDraft',
    routeContractKey: 'route.approvals.work.request-draft-update.action',
    method: 'PUT',
    path: `${base}/requests/{requestId}/draft`,
  },
  {
    apiFunction: 'migrateApprovalDraft',
    routeContractKey: 'route.approvals.work.request-draft-migrate.action',
    method: 'POST',
    path: `${base}/requests/{requestId}/draft/migrate`,
  },
  {
    apiFunction: 'submitApprovalRequest',
    routeContractKey: 'route.approvals.work.request-submit.action',
    method: 'POST',
    path: `${base}/requests/{requestId}/submit`,
  },
  {
    apiFunction: 'preflightApprovalRequest',
    routeContractKey: 'route.approvals.work.request-preflight.action',
    method: 'POST',
    path: `${base}/requests/{requestId}/preflight`,
  },
  {
    apiFunction: 'recoverApprovalDraft',
    routeContractKey: 'route.approvals.work.request-draft-recover.action',
    method: 'POST',
    path: `${base}/requests/{requestId}/draft/recover`,
  },
  {
    apiFunction: 'deleteApprovalDraft',
    routeContractKey: 'route.approvals.work.request-draft-delete.action',
    method: 'POST',
    path: `${base}/requests/{requestId}/draft/delete`,
  },
  {
    apiFunction: 'restoreApprovalDraft',
    routeContractKey: 'route.approvals.work.request-draft-restore.action',
    method: 'POST',
    path: `${base}/requests/{requestId}/draft/restore`,
  },
  {
    apiFunction: 'respondToApprovalInformationRequest',
    routeContractKey: 'route.approvals.work.request-information-response.action',
    method: 'POST',
    path: `${base}/requests/{requestId}/information-response`,
  },
  {
    apiFunction: 'withdrawApprovalRequest',
    routeContractKey: 'route.approvals.work.request-withdraw.action',
    method: 'POST',
    path: `${base}/requests/{requestId}/withdraw`,
  },
  {
    apiFunction: 'createApprovalDelegation',
    routeContractKey: 'route.approvals.work.delegation-create.action',
    method: 'POST',
    path: `${base}/delegations`,
  },
  {
    apiFunction: 'revokeApprovalDelegation',
    routeContractKey: 'route.approvals.work.delegation-revoke.action',
    method: 'POST',
    path: `${base}/delegations/{delegationId}/revoke`,
  },
  {
    apiFunction: 'createApprovalWorkflowDraft',
    routeContractKey: 'route.approvals.admin.workflow-create.action',
    method: 'POST',
    path: `${base}/admin/workflows`,
  },
  {
    apiFunction: 'updateApprovalWorkflowDraft',
    routeContractKey: 'route.approvals.admin.workflow-update.action',
    method: 'PUT',
    path: `${base}/admin/workflows/{workflowId}/draft`,
  },
  {
    apiFunction: 'publishApprovalWorkflow',
    routeContractKey: 'route.approvals.admin.workflow-publish.action',
    method: 'POST',
    path: `${base}/admin/workflows/{workflowId}/publish`,
  },
  {
    apiFunction: 'createApprovalFormCategory',
    routeContractKey: 'route.approvals.admin.form-category-create.action',
    method: 'POST',
    path: `${base}/admin/form-categories`,
  },
  {
    apiFunction: 'updateApprovalFormCategory',
    routeContractKey: 'route.approvals.admin.form-category-update.action',
    method: 'PUT',
    path: `${base}/admin/form-categories/{categoryId}`,
  },
  {
    apiFunction: 'createApprovalFormDraft',
    routeContractKey: 'route.approvals.admin.form-create.action',
    method: 'POST',
    path: `${base}/admin/forms`,
  },
  {
    apiFunction: 'updateApprovalFormDraft',
    routeContractKey: 'route.approvals.admin.form-update.action',
    method: 'PUT',
    path: `${base}/admin/forms/{formId}/draft`,
  },
  {
    apiFunction: 'publishApprovalForm',
    routeContractKey: 'route.approvals.admin.form-publish.action',
    method: 'POST',
    path: `${base}/admin/forms/{formId}/publish`,
  },
  {
    apiFunction: 'updateApprovalPolicy',
    routeContractKey: 'route.approvals.admin.policy-update.action',
    method: 'PUT',
    path: `${base}/admin/policies/{policyId}`,
  },
  {
    apiFunction: 'createApprovalPolicyDraft',
    routeContractKey: 'route.approvals.admin.policy-create.action',
    method: 'POST',
    path: `${base}/admin/policies`,
  },
  {
    apiFunction: 'publishApprovalPolicy',
    routeContractKey: 'route.approvals.admin.policy-publish.action',
    method: 'POST',
    path: `${base}/admin/policies/{policyId}/publish`,
  },
  {
    apiFunction: 'retryApprovalIntegrationDelivery',
    routeContractKey: 'route.approvals.admin.operations.retry.action',
    method: 'POST',
    path: `${base}/admin/operations/events/{outboxId}/retry`,
  },
] as const satisfies readonly ApprovalGovernedMutationApiContract[];
