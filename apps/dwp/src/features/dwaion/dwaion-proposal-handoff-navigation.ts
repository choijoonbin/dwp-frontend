import {
  createDwaionHandoff,
  type DwaionActionKey,
  type DwaionHandoff,
  type DwaionProposal,
  type DwaionProposalHandoff,
} from '@dwp-frontend/shared-utils';

export type DwaionProposalTargetState = {
  dwaionHandoff: DwaionHandoff;
  dwaionProposalHandoff: {
    version: 1;
    handoffId: string;
    proposalId: string;
    actionKey: string;
    handoffVersion: number;
    evidence: Array<{ sourceType: string; referenceId: string; label: string }>;
    receiptId: string | null;
  };
};

export async function createDwaionProposalTargetState(
  proposal: DwaionProposal,
  handoff: DwaionProposalHandoff
): Promise<DwaionProposalTargetState> {
  const actionKey = proposal.actionKey;
  if (!actionKey || !isDwaionActionKey(actionKey) || handoff.actionKey !== actionKey)
    throw new TypeError('Proposal handoff action is not supported by the target application.');
  const reviewedInputs = reviewedHandoffInputs(proposal.content.actionInputs ?? {});
  const evidence = (proposal.content.evidence ?? []).map((item) => ({
    sourceType: item.sourceType,
    referenceId: item.referenceId,
    label: item.label,
  }));
  const planHash = await sha256(
    JSON.stringify({
      proposalId: proposal.proposalId,
      revision: proposal.revision,
      actionKey,
      handoffVersion: handoff.version,
      reviewedInputs,
      evidence,
    })
  );
  const targetHandoff = createDwaionHandoff({
    actionKey,
    planHash,
    reviewedInputs,
    sourceReferences: evidence.map((item) => item.referenceId),
    origin: {
      appKey: 'APP.ASK',
      route: '/dwaion/proposals',
      surface: 'proposal-handoff',
      sourceRunId: handoff.handoffId,
      sourceRequestId: proposal.proposalId,
      sourceCorrelationId: handoff.handoffId,
      conversationId: null,
    },
  });
  return {
    dwaionHandoff: { ...targetHandoff, handoffId: handoff.handoffId },
    dwaionProposalHandoff: {
      version: 1,
      handoffId: handoff.handoffId,
      proposalId: proposal.proposalId,
      actionKey,
      handoffVersion: handoff.version,
      evidence,
      receiptId: handoff.receiptId,
    },
  };
}

function reviewedHandoffInputs(value: Record<string, unknown>): Record<string, string | string[]> {
  const entries = Object.entries(value).map(([key, item]) => {
    if (typeof item === 'string') return [key, item] as const;
    if (Array.isArray(item) && item.every((entry) => typeof entry === 'string'))
      return [key, item] as const;
    throw new TypeError(
      `Proposal handoff input ${key} is not supported by the target application.`
    );
  });
  return Object.fromEntries(entries);
}

function isDwaionActionKey(value: string): value is DwaionActionKey {
  return [
    'CALENDAR.EVENT.CREATE',
    'MAIL.DRAFT.CREATE',
    'SERVICE.REQUEST.CREATE',
    'APPROVAL.REQUEST.CREATE',
  ].includes(value);
}

async function sha256(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
