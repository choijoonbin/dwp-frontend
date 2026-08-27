import { describe, expect, it } from 'vitest';

import {
  proposalCanDecide,
  proposalIsHighPriority,
  proposalSnoozeTime,
} from './dwaion-proposal-model';

import type { DwaionProposal } from '@dwp-frontend/shared-utils';

const base = {
  proposalId: '00000000-0000-4000-8000-000000000201',
  kind: 'RISK',
  priority: 'HIGH',
  state: 'PENDING',
  revision: 1,
  agentKey: 'DWP_ASSISTANT',
  actionKey: null,
  content: {
    title: 'Risk review',
    summary: 'Review a work risk.',
    rationale: 'Deadline evidence.',
    actionInputs: {},
    evidence: [],
  },
  proposedAt: '2026-08-27T01:00:00Z',
  availableAt: '2026-08-27T01:00:00Z',
  expiresAt: '2026-08-29T01:00:00Z',
  snoozedUntil: null,
  decidedAt: null,
} satisfies DwaionProposal;

describe('DWAI·ON proposal model', () => {
  it('keeps only pending and snoozed proposals actionable', () => {
    expect(proposalCanDecide(base)).toBe(true);
    expect(proposalCanDecide({ ...base, state: 'SNOOZED' })).toBe(true);
    expect(proposalCanDecide({ ...base, state: 'ACCEPTED' })).toBe(false);
    expect(proposalCanDecide({ ...base, state: 'EXPIRED' })).toBe(false);
  });

  it('uses explicit priority and deterministic snooze windows', () => {
    const now = new Date('2026-08-27T01:00:00Z');
    expect(proposalIsHighPriority(base)).toBe(true);
    expect(proposalIsHighPriority({ ...base, priority: 'MEDIUM' })).toBe(false);
    expect(proposalSnoozeTime('TWO_HOURS', now)).toBe('2026-08-27T03:00:00.000Z');
  });
});
