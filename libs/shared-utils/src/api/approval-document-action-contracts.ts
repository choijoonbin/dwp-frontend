const base = '/api/approvals/v1';
export const APPROVAL_DOCUMENT_ACTION_CONTRACTS = [
  {
    apiFunction: 'appendApprovalRequestComment',
    routeContractKey: 'route.approvals.work.request-comment.action',
    method: 'POST',
    path: `${base}/requests/{requestId}/comments`,
  },
  {
    apiFunction: 'appendApprovalTaskComment',
    routeContractKey: 'route.approvals.work.task-comment.action',
    method: 'POST',
    path: `${base}/tasks/{taskId}/comments`,
  },
  {
    apiFunction: 'exportApprovalRequestDocument',
    routeContractKey: 'route.approvals.work.request-document-export.action',
    method: 'POST',
    path: `${base}/requests/{requestId}/document-exports`,
  },
  {
    apiFunction: 'exportApprovalTaskDocument',
    routeContractKey: 'route.approvals.work.task-document-export.action',
    method: 'POST',
    path: `${base}/tasks/{taskId}/document-exports`,
  },
  {
    apiFunction: 'exportApprovalArchive',
    routeContractKey: 'route.approvals.work.archive-document-export.action',
    method: 'POST',
    path: `${base}/requests/archive/document-exports`,
  },
  {
    apiFunction: 'saveApprovalDocumentPolicy',
    routeContractKey: 'route.approvals.admin.document-policy-draft.action',
    method: 'PUT',
    path: `${base}/admin/document-tools/policies/{policyId}/draft`,
  },
  {
    apiFunction: 'publishApprovalDocumentPolicy',
    routeContractKey: 'route.approvals.admin.document-policy-publish.action',
    method: 'POST',
    path: `${base}/admin/document-tools/policies/{policyId}/publish`,
  },
  {
    apiFunction: 'proposeApprovalDocumentHold',
    routeContractKey: 'route.approvals.admin.document-hold-proposal.action',
    method: 'POST',
    path: `${base}/admin/document-tools/holds/{requestId}/proposals`,
  },
  {
    apiFunction: 'publishApprovalDocumentHold',
    routeContractKey: 'route.approvals.admin.document-hold-publish.action',
    method: 'POST',
    path: `${base}/admin/document-tools/holds/{requestId}/publish`,
  },
] as const;
