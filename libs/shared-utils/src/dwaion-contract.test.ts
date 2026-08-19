import { describe, expect, it } from 'vitest';

import {
  DWAION_APPROVAL_EXPERT_AGENT_KEY,
  createDwaionHandoff,
  dwaionWorkspaceRoute,
  parseDwaionHandoff,
  resolveDwaionAgentKey,
} from './dwaion-contract';

describe('dwaion contract', () => {
  it('opens an existing conversation without resubmitting its latest question', () => {
    expect(dwaionWorkspaceRoute('repeat this question', 'conversation-1')).toBe(
      '/dwaion?conversation=conversation-1'
    );
  });

  it('preserves a new question when no conversation exists', () => {
    expect(dwaionWorkspaceRoute('today priorities')).toBe('/dwaion?q=today+priorities');
  });

  it('adds the specialist agent only when explicitly selected', () => {
    expect(dwaionWorkspaceRoute(undefined, undefined, DWAION_APPROVAL_EXPERT_AGENT_KEY)).toBe(
      '/dwaion?agent=DWP_APPROVAL_EXPERT'
    );
    expect(resolveDwaionAgentKey('dwp_approval_expert')).toBe(DWAION_APPROVAL_EXPERT_AGENT_KEY);
  });

  it('accepts a current, action-bound reviewed handoff', () => {
    const now = new Date('2026-08-19T01:00:00Z');
    const handoff = createDwaionHandoff(
      {
        actionKey: 'CALENDAR.EVENT.CREATE',
        planHash: 'a'.repeat(64),
        reviewedInputs: {
          title: 'Weekly review',
          startsAt: '2026-08-20T01:00:00Z',
          endsAt: '2026-08-20T01:30:00Z',
        },
        sourceReferences: ['src-01'],
      },
      now
    );

    expect(
      parseDwaionHandoff({ dwaionHandoff: handoff }, 'CALENDAR.EVENT.CREATE', now.getTime())
    ).toEqual(handoff);
  });

  it('rejects expired, cross-action, and tampered handoffs', () => {
    const createdAt = new Date('2026-08-19T01:00:00Z');
    const handoff = createDwaionHandoff(
      {
        actionKey: 'MAIL.DRAFT.CREATE',
        planHash: 'b'.repeat(64),
        reviewedInputs: { subject: 'Review' },
        sourceReferences: [],
      },
      createdAt
    );

    expect(
      parseDwaionHandoff({ dwaionHandoff: handoff }, 'CALENDAR.EVENT.CREATE', createdAt.getTime())
    ).toBeNull();
    expect(
      parseDwaionHandoff({ dwaionHandoff: handoff }, undefined, Date.parse(handoff.expiresAt))
    ).toBeNull();
    expect(
      parseDwaionHandoff(
        { dwaionHandoff: { ...handoff, reviewedInputs: { sendImmediately: true } } },
        undefined,
        createdAt.getTime()
      )
    ).toBeNull();
  });
});
