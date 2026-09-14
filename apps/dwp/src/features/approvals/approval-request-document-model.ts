import type { ApprovalDocumentTools } from '@dwp-frontend/shared-utils/api/approval-document-contract';
import type { ApprovalRequest } from '@dwp-frontend/shared-utils';

import { sameApprovalDocumentSnapshot } from './approval-document-snapshot';

export const APPROVAL_REQUEST_DOCUMENT_ROUTES = {
  comment: 'route.approvals.work.request-comment.action',
  export: 'route.approvals.work.request-document-export.action',
  archive: 'route.approvals.work.archive-document-export.action',
} as const;

export function approvalRequestDocumentMatches(
  tools: ApprovalDocumentTools | undefined,
  request: Pick<ApprovalRequest, 'requestId' | 'version'>
): tools is ApprovalDocumentTools {
  return Boolean(
    tools &&
    tools.requestId === request.requestId &&
    tools.requestVersion === request.version &&
    tools.taskId === null &&
    tools.taskVersion === null
  );
}

export function sameApprovalRequestDocument(
  previous: ApprovalDocumentTools,
  current: ApprovalDocumentTools,
  allowCommentsAdvance = false
): boolean {
  return sameApprovalDocumentSnapshot(previous, current, allowCommentsAdvance);
}

export function approvalArchiveDocumentsEligible(
  tools: readonly ApprovalDocumentTools[],
  requests: readonly ApprovalRequest[]
): boolean {
  const first = tools[0];
  return Boolean(
    first &&
    requests.length === tools.length &&
    tools.length <= 50 &&
    new Set(requests.map((request) => request.requestId)).size === requests.length &&
    tools.every(
      (item, index) =>
        approvalRequestDocumentMatches(item, requests[index]!) &&
        ['APPROVED', 'REJECTED', 'WITHDRAWN', 'CANCELLED'].includes(requests[index]!.status) &&
        item.archiveExport.allowed &&
        item.jsonExport.allowed &&
        tools.length <= item.maxBatchItems &&
        item.policyId === first.policyId &&
        item.policyVersion === first.policyVersion &&
        item.resourceSetKey === first.resourceSetKey
    )
  );
}
