const base = '/api/approvals/v1';

/** ACTION routes added after the release 10 Approval API surface was sealed. */
export const APPROVAL_RELEASE14_ACTION_CONTRACTS = [
  {
    apiFunction: 'requestApprovalFormPublishReview',
    routeContractKey: 'route.approvals.admin.form-publish-review-request.action',
    method: 'POST',
    path: `${base}/admin/forms/{formId}/publish-review-request`,
  },
  {
    apiFunction: 'rejectApprovalFormPublishReview',
    routeContractKey: 'route.approvals.admin.form-publish-review-reject.action',
    method: 'POST',
    path: `${base}/admin/forms/{formId}/publish-review-requests/{requestId}/reject`,
  },
  {
    apiFunction: 'runApprovalDeliveryBatch:RETRY',
    routeContractKey: 'route.approvals.admin.operations.batch-retry.action',
    method: 'POST',
    path: `${base}/admin/operations/deliveries/retry`,
  },
  {
    apiFunction: 'runApprovalDeliveryBatch:DEAD_LETTER',
    routeContractKey: 'route.approvals.admin.operations.batch-dead-letter.action',
    method: 'POST',
    path: `${base}/admin/operations/deliveries/dead-letter`,
  },
  {
    apiFunction: 'runApprovalDeliveryBatch:REPLAY',
    routeContractKey: 'route.approvals.admin.operations.batch-replay.action',
    method: 'POST',
    path: `${base}/admin/operations/deliveries/replay`,
  },
  {
    apiFunction: 'runApprovalDeliveryBatch:RECONCILE',
    routeContractKey: 'route.approvals.admin.operations.reconcile.action',
    method: 'POST',
    path: `${base}/admin/operations/deliveries/reconcile`,
  },
  {
    apiFunction: 'deadLetterApprovalEvent',
    routeContractKey: 'route.approvals.admin.operations.dead-letter.action',
    method: 'POST',
    path: `${base}/admin/operations/events/{outboxId}/dead-letter`,
  },
  {
    apiFunction: 'replayApprovalEvent',
    routeContractKey: 'route.approvals.admin.operations.replay.action',
    method: 'POST',
    path: `${base}/admin/operations/events/{outboxId}/replay`,
  },
  {
    apiFunction: 'reassignApprovalTask',
    routeContractKey: 'route.approvals.admin.operations.task-reassign.action',
    method: 'POST',
    path: `${base}/admin/operations/tasks/{taskId}/reassign`,
  },
  {
    apiFunction: 'reassignApprovalTasks',
    routeContractKey: 'route.approvals.admin.operations.task-batch-reassign.action',
    method: 'POST',
    path: `${base}/admin/operations/tasks/reassign`,
  },
  {
    apiFunction: 'probeApprovalSignatureProviderKms',
    routeContractKey: 'route.approvals.admin.signature-kms-probe.action',
    method: 'POST',
    path: `${base}/admin/signatures/kms/probes`,
  },
  {
    apiFunction: 'saveApprovalSignaturePolicyDraft',
    routeContractKey: 'route.approvals.admin.signature-policy-draft-update.action',
    method: 'PUT',
    path: `${base}/admin/signatures/policies/{policyId}/draft`,
  },
  {
    apiFunction: 'initializeApprovalSignaturePolicy',
    routeContractKey: 'route.approvals.admin.signature-policy-initialize.action',
    method: 'POST',
    path: `${base}/admin/signatures/policies`,
  },
  {
    apiFunction: 'publishApprovalSignaturePolicy',
    routeContractKey: 'route.approvals.admin.signature-policy-publish.action',
    method: 'POST',
    path: `${base}/admin/signatures/policies/{policyId}/publish`,
  },
  {
    apiFunction: 'probeApprovalSignatureProviders',
    routeContractKey: 'route.approvals.admin.signature-probe.action',
    method: 'POST',
    path: `${base}/admin/signatures/probes`,
  },
  {
    apiFunction: 'inspectApprovalSignatureWorm',
    routeContractKey: 'route.approvals.admin.signature-worm-inspection.action',
    method: 'POST',
    path: `${base}/admin/signatures/worm-inspections`,
  },
  {
    apiFunction: 'updateApprovalDelegation',
    routeContractKey: 'route.approvals.work.delegation-update.action',
    method: 'PUT',
    path: `${base}/delegations/{delegationId}`,
  },
  {
    apiFunction: 'cancelApprovalExternalSignatureRequest',
    routeContractKey: 'route.approvals.work.external-signature-cancel.action',
    method: 'POST',
    path: `${base}/external-signature-requests/{signatureRequestId}/cancel`,
  },
  {
    apiFunction: 'handoverApprovalExternalSignatureRequest',
    routeContractKey: 'route.approvals.work.external-signature-handover.action',
    method: 'POST',
    path: `${base}/external-signature-requests/{signatureRequestId}/handovers`,
  },
  {
    apiFunction: 'refreshApprovalExternalSignatureRequest',
    routeContractKey: 'route.approvals.work.external-signature-refresh.action',
    method: 'POST',
    path: `${base}/external-signature-requests/{signatureRequestId}/refresh`,
  },
  {
    apiFunction: 'createApprovalExternalSignatureRequest',
    routeContractKey: 'route.approvals.work.external-signature-request-create.action',
    method: 'POST',
    path: `${base}/requests/{requestId}/external-signature-requests`,
  },
  {
    apiFunction: 'createApprovalResubmitDraft',
    routeContractKey: 'route.approvals.work.request-resubmit-draft.action',
    method: 'POST',
    path: `${base}/requests/{requestId}/resubmit-draft`,
  },
] as const;
