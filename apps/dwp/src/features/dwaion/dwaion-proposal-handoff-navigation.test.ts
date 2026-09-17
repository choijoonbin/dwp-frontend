import { describe, expect, it } from 'vitest';
import { parseDwaionHandoff, parseDwaionProposalHandoffBinding } from '@dwp-frontend/shared-utils';

import { createDwaionProposalTargetState } from './dwaion-proposal-handoff-navigation';

import type { DwaionProposal, DwaionProposalHandoff } from '@dwp-frontend/shared-utils';

const PROPOSAL_ID = '00000000-0000-4000-8000-000000000101';
const HANDOFF_ID = '00000000-0000-4000-8000-000000000102';

function proposal(): DwaionProposal {
  return {
    proposalId: PROPOSAL_ID,
    revision: 2,
    state: 'ACCEPTED',
    kind: 'APPROVAL',
    priority: 'HIGH',
    agentKey: 'DWP_ASSISTANT',
    actionKey: 'APPROVAL.REQUEST.CREATE',
    content: {
      title: 'Approve governed cloud capacity',
      summary: 'A reviewed approval draft is ready.',
      rationale: 'Verified demand exceeded the threshold.',
      actionInputs: {
        formType: 'CAPEX',
        title: 'Cloud capacity',
        businessJustification: 'Verified capacity threshold exceeded.',
        approvers: ['approver@example.test'],
      },
      evidence: [
        {
          sourceType: 'WORK_ITEM',
          referenceId: 'work-101',
          label: 'Capacity evidence',
          occurredAt: null,
          route: '/work/items/work-101',
        },
      ],
    },
    proposedAt: '2026-09-17T00:00:00Z',
    availableAt: '2026-09-17T00:00:00Z',
    expiresAt: '2099-09-17T01:00:00Z',
    snoozedUntil: null,
    decidedAt: '2026-09-17T00:01:00Z',
  };
}

function handoff(): DwaionProposalHandoff {
  return {
    handoffId: HANDOFF_ID,
    proposalId: PROPOSAL_ID,
    actionKey: 'APPROVAL.REQUEST.CREATE',
    state: 'REVIEW_REQUIRED',
    version: 1,
    targetRoute: '/approvals/requests/new',
    approvalRequired: true,
    receiptId: null,
    createdAt: '2026-09-17T00:01:00Z',
    updatedAt: '2026-09-17T00:01:00Z',
  };
}

describe('DWAI.ON proposal handoff navigation', () => {
  it('preserves reviewed inputs and evidence while producing a valid target handoff', async () => {
    const state = await createDwaionProposalTargetState(proposal(), handoff());

    expect(state.dwaionHandoff.handoffId).toBe(HANDOFF_ID);
    expect(state.dwaionHandoff.reviewedInputs).toMatchObject({ formType: 'CAPEX' });
    expect(state.dwaionProposalHandoff.evidence).toEqual([
      {
        sourceType: 'WORK_ITEM',
        referenceId: 'work-101',
        label: 'Capacity evidence',
      },
    ]);
    expect(state.dwaionProposalHandoff.handoffVersion).toBe(1);
    expect(parseDwaionHandoff({ dwaionHandoff: state.dwaionHandoff })).not.toBeNull();
    expect(parseDwaionProposalHandoffBinding(state)).toMatchObject({
      handoffId: HANDOFF_ID,
      proposalId: PROPOSAL_ID,
      actionKey: 'APPROVAL.REQUEST.CREATE',
      handoffVersion: 1,
    });
  });

  it.each([
    [
      'CALENDAR.EVENT.CREATE',
      '/calendar',
      { title: 'Governed event', startsAt: '2026-09-18T00:00:00Z' },
    ],
    ['MAIL.DRAFT.CREATE', '/mail', { subject: 'Governed draft', body: 'Reviewed body' }],
    [
      'SERVICE.REQUEST.CREATE',
      '/services',
      { serviceCategory: 'IT', requestSummary: 'Governed service request' },
    ],
    [
      'APPROVAL.REQUEST.CREATE',
      '/approvals/requests/new',
      { formType: 'CAPEX', title: 'Governed approval' },
    ],
  ] as const)(
    'creates an exact owner binding for %s',
    async (actionKey, targetRoute, actionInputs) => {
      const source = proposal();
      const target = handoff();
      source.actionKey = actionKey;
      source.content.actionInputs = actionInputs;
      target.actionKey = actionKey;
      target.targetRoute = targetRoute;

      const state = await createDwaionProposalTargetState(source, target);

      expect(parseDwaionProposalHandoffBinding(state)).toMatchObject({
        handoffId: HANDOFF_ID,
        proposalId: PROPOSAL_ID,
        actionKey,
        handoffVersion: 1,
      });
    }
  );

  it('fails closed instead of forwarding unsupported nested input values', async () => {
    const candidate = proposal();
    candidate.content.actionInputs = { title: { unsafe: true } };
    await expect(createDwaionProposalTargetState(candidate, handoff())).rejects.toThrow(
      /not supported/u
    );
  });
});
