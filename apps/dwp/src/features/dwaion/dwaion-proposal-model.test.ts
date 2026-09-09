import { describe, expect, it } from 'vitest';

import {
  proposalCanDecide,
  proposalCanSnoozeUntil,
  proposalEvidenceRoute,
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
  it('keeps only unexpired pending and snoozed proposals actionable', () => {
    const now = new Date('2026-08-27T01:00:00Z');
    expect(proposalCanDecide(base, now)).toBe(true);
    expect(proposalCanDecide({ ...base, state: 'SNOOZED' }, now)).toBe(true);
    expect(proposalCanDecide({ ...base, state: 'ACCEPTED' }, now)).toBe(false);
    expect(proposalCanDecide({ ...base, state: 'EXPIRED' }, now)).toBe(false);
    expect(proposalCanDecide({ ...base, expiresAt: now.toISOString() }, now)).toBe(false);
    expect(proposalCanDecide({ ...base, expiresAt: 'invalid' }, now)).toBe(false);
  });

  it('bounds snooze strictly between now and expiry', () => {
    const now = new Date('2026-08-27T01:00:00Z');
    expect(proposalCanSnoozeUntil(base, '2026-08-27T03:00:00Z', now)).toBe(true);
    for (const until of [now.toISOString(), base.expiresAt, '2026-08-30T01:00:00Z', 'invalid']) {
      expect(proposalCanSnoozeUntil(base, until, now)).toBe(false);
    }
    expect(
      proposalCanSnoozeUntil({ ...base, state: 'ACCEPTED' }, '2026-08-27T03:00:00Z', now)
    ).toBe(false);
  });

  it('resolves day-based snoozes in the displayed zone across DST', () => {
    const now = new Date('2026-03-07T17:30:00Z');
    expect(proposalSnoozeTime('TOMORROW', now, 'America/Los_Angeles')).toBe(
      '2026-03-08T16:00:00.000Z'
    );
    expect(proposalSnoozeTime('NEXT_WEEK', now, 'America/Los_Angeles')).toBe(
      '2026-03-09T16:00:00.000Z'
    );
    expect(proposalSnoozeTime('TOMORROW', now, 'Asia/Seoul')).toBe('2026-03-09T00:00:00.000Z');
  });

  it('links only well-formed workspace-relative evidence routes', () => {
    expect(proposalEvidenceRoute('/work/queue?item=opaque-id')).toBe('/work/queue?item=opaque-id');
    for (const route of [
      null,
      '',
      'https://example.com',
      '//example.com',
      '/\\example.com',
      '/%2fexample.com',
      '/%5cexample.com',
      '/work%0a',
      '/work?item=%00',
      '/work?item=%',
      '/ work',
    ]) {
      expect(proposalEvidenceRoute(route)).toBeNull();
    }
  });

  it('uses explicit priority and deterministic snooze windows', () => {
    const now = new Date('2026-08-27T01:00:00Z');
    expect(proposalIsHighPriority(base)).toBe(true);
    expect(proposalIsHighPriority({ ...base, priority: 'MEDIUM' })).toBe(false);
    expect(proposalSnoozeTime('TWO_HOURS', now)).toBe('2026-08-27T03:00:00.000Z');
  });
});
