import { readApprovalQuorumVotePrecondition } from './approval-quorum-contract';

import type { ApprovalQuorumVotePrecondition } from './approval-quorum-contract';

export type ApprovalHrisSeparationWaiverTaskApproveInput = Readonly<{
  decision: 'APPROVE';
  comment?: string;
  expectedVersion: number;
  quorum: ApprovalQuorumVotePrecondition;
}>;

export function snapshotApprovalHrisSeparationWaiverTaskApproveInput(
  input: ApprovalHrisSeparationWaiverTaskApproveInput
): ApprovalHrisSeparationWaiverTaskApproveInput {
  if (
    !input ||
    input.decision !== 'APPROVE' ||
    !Number.isSafeInteger(input.expectedVersion) ||
    input.expectedVersion < 0 ||
    (input.comment !== undefined &&
      (typeof input.comment !== 'string' || input.comment.length > 2000))
  ) {
    throw new Error('Invalid HRIS separation-waiver approval command');
  }
  const quorum = readApprovalQuorumVotePrecondition(input.quorum);
  return Object.freeze({
    decision: 'APPROVE',
    ...(input.comment === undefined ? {} : { comment: input.comment }),
    expectedVersion: input.expectedVersion,
    quorum,
  });
}
