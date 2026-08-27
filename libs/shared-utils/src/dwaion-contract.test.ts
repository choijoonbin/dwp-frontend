import { describe, expect, it } from 'vitest';

import {
  DWAION_APPROVAL_EXPERT_AGENT_KEY,
  createDwaionQuestionLaunchState,
  createDwaionHandoff,
  dwaionWorkspaceRoute,
  hasDwaionQuestionLaunchState,
  parseDwaionQuestionLaunchState,
  parseDwaionHandoff,
  resolveDwaionAgentKey,
} from './dwaion-contract';
import type { AgentActionHandoffOrigin } from './api/agent-plan-api';

describe('dwaion contract', () => {
  it('opens an existing conversation without resubmitting its latest question', () => {
    expect(dwaionWorkspaceRoute('repeat this question', 'conversation-1')).toBe(
      '/dwaion/conversations/conversation-1'
    );
  });

  it('never serializes a work question into the workspace URL', () => {
    expect(dwaionWorkspaceRoute('today priorities')).toBe('/dwaion/new');
  });

  it('carries only an opaque server ticket across independently deployed products', () => {
    const launchId = '00000000-0000-4000-8000-000000000016';
    const state = createDwaionQuestionLaunchState(launchId);

    expect(state).toEqual({ dwaionQuestionLaunch: { version: 2, launchId } });
    expect(JSON.stringify(state)).not.toContain('today priorities');
    expect(parseDwaionQuestionLaunchState(state)).toBe(launchId);
    expect(hasDwaionQuestionLaunchState(state)).toBe(true);
    expect(createDwaionQuestionLaunchState('invalid')).toBeNull();
    expect(
      parseDwaionQuestionLaunchState({
        dwaionQuestionLaunch: { version: 1, handoffId: launchId },
      })
    ).toBeNull();
  });

  it('adds the specialist agent only when explicitly selected', () => {
    expect(dwaionWorkspaceRoute(undefined, undefined, DWAION_APPROVAL_EXPERT_AGENT_KEY)).toBe(
      '/dwaion/new?agent=DWP_APPROVAL_EXPERT'
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
        origin: origin(),
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
        origin: origin(),
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

function origin(): AgentActionHandoffOrigin {
  return {
    appKey: 'APP.ASK',
    route: '/dwaion/conversations/00000000-0000-4000-8000-000000000001',
    surface: 'action-shelf',
    sourceRunId: '00000000-0000-4000-8000-000000000002',
    sourceRequestId: 'request-source-1',
    sourceCorrelationId: 'correlation-source-1',
    conversationId: '00000000-0000-4000-8000-000000000001',
  };
}
