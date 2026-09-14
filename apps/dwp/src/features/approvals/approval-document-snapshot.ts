import type { ApprovalDocumentTools } from '@dwp-frontend/shared-utils/api/approval-document-contract';

export function sameApprovalDocumentSnapshot(
  previous: ApprovalDocumentTools,
  current: ApprovalDocumentTools,
  allowCommentsAdvance = false
) {
  const keys = [
    'requestId',
    'taskId',
    'requestVersion',
    'taskVersion',
    'payloadRevision',
    'payloadSha256',
    'policyId',
    'policyVersion',
    'resourceSetKey',
    'holdVersion',
    'legalHold',
    'preservationPending',
    'maxBatchItems',
  ] as const;
  return (
    keys.every((key) => previous[key] === current[key]) &&
    (allowCommentsAdvance
      ? current.commentsVersion >= previous.commentsVersion
      : current.commentsVersion === previous.commentsVersion)
  );
}
