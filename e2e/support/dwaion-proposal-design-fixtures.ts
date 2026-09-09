import type { AgentComponents } from '../../libs/api-contracts/src';

type Proposal = AgentComponents['schemas']['AgentProposal'];

export const PROPOSAL_DESIGN_ITEMS = [
  {
    proposalId: '019d8cb0-27a6-7b11-82d1-9eb8a26c1201',
    kind: 'RISK',
    priority: 'HIGH',
    state: 'PENDING',
    revision: 2,
    agentKey: 'DWP_ASSISTANT',
    actionKey: 'SERVICE.REQUEST.CREATE',
    content: {
      title: 'Review customer meeting preparation',
      summary: 'Check the remaining work before the customer meeting.',
      rationale: 'The meeting is tomorrow and the preparation task is still open.',
      actionInputs: {},
      evidence: [
        {
          sourceType: 'WORK_ITEM',
          referenceId: 'work-100',
          label: 'Meeting preparation task',
          occurredAt: '2026-09-08T00:30:00Z',
        },
        {
          sourceType: 'CALENDAR',
          referenceId: 'event-100',
          label: 'Customer meeting schedule',
          occurredAt: '2026-09-08T00:15:00Z',
        },
      ],
    },
    proposedAt: '2026-09-08T00:30:00Z',
    availableAt: '2026-09-08T00:30:00Z',
    expiresAt: '2026-09-09T09:00:00Z',
    snoozedUntil: null,
    decidedAt: null,
  },
  {
    proposalId: '019d8cb0-27a6-7b11-82d1-9eb8a26c1202',
    kind: 'SCHEDULE',
    priority: 'MEDIUM',
    state: 'PENDING',
    revision: 1,
    agentKey: 'DWP_ASSISTANT',
    actionKey: null,
    content: {
      title: 'Check the product review agenda and outstanding decisions',
      summary: 'Review the agenda before preparing a meeting brief.',
      rationale: 'A product review is scheduled and needs your review of the open decisions.',
      actionInputs: {},
      evidence: [
        {
          sourceType: 'CALENDAR',
          referenceId: 'event-200',
          label: 'Product review',
          occurredAt: '2026-09-08T00:00:00Z',
        },
      ],
    },
    proposedAt: '2026-09-08T00:00:00Z',
    availableAt: '2026-09-08T00:00:00Z',
    expiresAt: '2026-09-09T02:00:00Z',
    snoozedUntil: null,
    decidedAt: null,
  },
] satisfies Proposal[];
