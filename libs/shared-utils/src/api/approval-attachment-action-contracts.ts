const base = '/api/approvals/v1';

export const APPROVAL_ATTACHMENT_ACTION_CONTRACTS = [
  {
    apiFunction: 'reserveApprovalAttachmentUpload',
    routeContractKey: 'route.approvals.work.request-attachment-reserve.action',
    method: 'POST',
    path: `${base}/requests/{requestId}/attachment-uploads`,
  },
  {
    apiFunction: 'uploadApprovalAttachmentContent',
    routeContractKey: 'route.approvals.work.attachment-upload-content.action',
    method: 'PUT',
    path: `${base}/attachment-uploads/{uploadId}/content`,
  },
  {
    apiFunction: 'reconcileApprovalAttachmentUpload',
    routeContractKey: 'route.approvals.work.attachment-upload-reconcile.action',
    method: 'POST',
    path: `${base}/attachment-uploads/{uploadId}/reconcile`,
  },
  {
    apiFunction: 'cancelApprovalAttachmentUpload',
    routeContractKey: 'route.approvals.work.attachment-upload-cancel.action',
    method: 'POST',
    path: `${base}/attachment-uploads/{uploadId}/cancel`,
  },
  {
    apiFunction: 'selectApprovalAttachments',
    routeContractKey: 'route.approvals.work.request-attachment-selection.action',
    method: 'PUT',
    path: `${base}/requests/{requestId}/attachments`,
  },
  {
    apiFunction: 'createApprovalRequestAttachmentDownloadGrant',
    routeContractKey: 'route.approvals.work.request-attachment-download.action',
    method: 'POST',
    path: `${base}/requests/{requestId}/attachments/{attachmentId}/downloads`,
  },
  {
    apiFunction: 'createApprovalTaskAttachmentDownloadGrant',
    routeContractKey: 'route.approvals.work.task-attachment-download.action',
    method: 'POST',
    path: `${base}/tasks/{taskId}/attachments/{attachmentId}/downloads`,
  },
] as const;
