import { APPROVAL_ATTACHMENT_ACTION_CONTRACTS } from './approval-attachment-action-contracts';

export const APPROVAL_EXTENSION_ACTION_CONTRACTS = [
  ...APPROVAL_ATTACHMENT_ACTION_CONTRACTS,
  {
    apiFunction: 'branchApprovalFormWorkspaceVersion',
    routeContractKey: 'route.approvals.admin.form-version-branch.action',
    method: 'POST',
    path: '/api/approvals/v1/admin/forms/{formId}/versions/{formVersionId}/branch',
  },
  {
    apiFunction: 'updateApprovalFormWorkingDraft',
    routeContractKey: 'route.approvals.admin.form-working-draft-update.action',
    method: 'PUT',
    path: '/api/approvals/v1/admin/forms/{formId}/working-draft',
  },
  {
    apiFunction: 'retireApprovalFormWorkspace',
    routeContractKey: 'route.approvals.admin.form-retire.action',
    method: 'POST',
    path: '/api/approvals/v1/admin/forms/{formId}/retire',
  },
  {
    apiFunction: 'reinstateApprovalFormWorkspace',
    routeContractKey: 'route.approvals.admin.form-reinstate.action',
    method: 'POST',
    path: '/api/approvals/v1/admin/forms/{formId}/reinstate',
  },
  {
    apiFunction: 'publishReviewedApprovalFormWorkspace',
    routeContractKey: 'route.approvals.admin.form-reviewed-publish.action',
    method: 'POST',
    path: '/api/approvals/v1/admin/forms/{formId}/publish-reviewed',
  },
  {
    apiFunction: 'saveApprovalAttachmentPolicyDraft',
    routeContractKey: 'route.approvals.admin.attachment-policy-draft.action',
    method: 'PUT',
    path: '/api/approvals/v1/admin/attachments/policies/{policyId}/draft',
  },
  {
    apiFunction: 'publishApprovalAttachmentPolicy',
    routeContractKey: 'route.approvals.admin.attachment-policy-publish.action',
    method: 'POST',
    path: '/api/approvals/v1/admin/attachments/policies/{policyId}/publish',
  },
  {
    apiFunction: 'initializeApprovalAttachmentPolicy',
    routeContractKey: 'route.approvals.admin.attachment-policy-initialize.action',
    method: 'POST',
    path: '/api/approvals/v1/admin/attachments/policies',
  },
] as const;
