export const APPROVAL_RELEASE10_ACTION_CONTRACTS = [
  {
    apiFunction: 'initializeApprovalRetentionPolicy',
    routeContractKey: 'route.approvals.admin.retention-policy-initialize.action',
    method: 'POST',
    path: '/api/approvals/v1/admin/retention/policies',
  },
  {
    apiFunction: 'saveApprovalRetentionPolicy',
    routeContractKey: 'route.approvals.admin.retention-policy-draft.action',
    method: 'PUT',
    path: '/api/approvals/v1/admin/retention/policies/{policyId}/draft',
  },
  {
    apiFunction: 'publishApprovalRetentionPolicy',
    routeContractKey: 'route.approvals.admin.retention-policy-publish.action',
    method: 'POST',
    path: '/api/approvals/v1/admin/retention/policies/{policyId}/publish',
  },
  {
    apiFunction: 'createApprovalRetentionClaim',
    routeContractKey: 'route.approvals.admin.retention-record-claim.action',
    method: 'POST',
    path: '/api/approvals/v1/admin/retention/records/{requestId}/claims',
  },
  {
    apiFunction: 'createApprovalSignatureRequest',
    routeContractKey: 'route.approvals.work.signature-request-create.action',
    method: 'POST',
    path: '/api/approvals/v1/requests/{requestId}/signature-requests',
  },
  {
    apiFunction: 'consentApprovalSignatureRequest',
    routeContractKey: 'route.approvals.work.signature-consent.action',
    method: 'POST',
    path: '/api/approvals/v1/signature-requests/{signatureRequestId}/consents',
  },
  {
    apiFunction: 'signApprovalSignatureRequest',
    routeContractKey: 'route.approvals.work.signature-sign.action',
    method: 'POST',
    path: '/api/approvals/v1/signature-requests/{signatureRequestId}/sign',
  },
  {
    apiFunction: 'cancelApprovalSignatureRequest',
    routeContractKey: 'route.approvals.work.signature-cancel.action',
    method: 'POST',
    path: '/api/approvals/v1/signature-requests/{signatureRequestId}/cancel',
  },
] as const;
