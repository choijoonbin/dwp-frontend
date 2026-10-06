import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cancelAssignmentProposal,
  createAssignmentProposal,
  getAssignmentDetail,
  getAssignmentProposal,
  getAssignmentTimeline,
  submitAssignmentProposal,
  validateAssignmentProposal,
} from './assignment-proposal-api';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../axios-instance', () => ({ axiosInstance: http }));

const AUTHORITY = {
  mode: 'SECURE',
  rolloutState: '111',
  expectedDecisionRevision: 'decision-7',
  contextKey: 'ctx:hcm.operations',
  contextScopeKey: 'scope:hcm:operations',
} as const;

const result = {
  receiptId: 'receipt-1',
  replayed: false,
  proposal: { proposalId: 'proposal-1' },
};

beforeEach(() => {
  vi.resetAllMocks();
  http.get.mockResolvedValue({ data: { data: {} } });
  http.post.mockResolvedValue({ data: { data: result } });
});

describe('assignment proposal API adapter', () => {
  it('uses the three exact read routes with the selected population scope', async () => {
    await getAssignmentDetail('assignment/1', AUTHORITY.contextScopeKey);
    await getAssignmentTimeline('assignment/1', AUTHORITY.contextScopeKey);
    await getAssignmentProposal('proposal/1', AUTHORITY.contextScopeKey);

    expect(http.get.mock.calls).toEqual([
      [
        '/api/people/v1/workforce/assignments/assignment%2F1',
        { contextScopeKey: 'scope:hcm:operations' },
      ],
      [
        '/api/people/v1/workforce/assignments/assignment%2F1/timeline',
        { contextScopeKey: 'scope:hcm:operations' },
      ],
      [
        '/api/people/v1/workforce/assignment-proposals/proposal%2F1',
        { contextScopeKey: 'scope:hcm:operations' },
      ],
    ]);
  });

  it('binds create, validate, and cancel idempotency to each command id', async () => {
    await createAssignmentProposal(
      {
        commandId: 'command-create',
        targetAssignmentId: 'assignment-1',
        changeType: 'CHANGE_LOCATION',
        effectiveDate: '2026-11-01',
        reasonCode: 'RELOCATION',
        proposedChanges: { locationKey: 'SEOUL_HQ' },
        expectedAssignmentVersion: 3,
      },
      AUTHORITY
    );
    await validateAssignmentProposal(
      'proposal-1',
      { commandId: 'command-validate', expectedVersion: 1 },
      AUTHORITY
    );
    await cancelAssignmentProposal(
      'proposal-1',
      { commandId: 'command-cancel', expectedVersion: 2, reason: 'Superseded' },
      AUTHORITY
    );

    expect(http.post.mock.calls.map(([, , config]) => config.headers)).toEqual([
      expect.objectContaining({
        'Idempotency-Key': 'command-create',
        'X-DWP-Expected-Decision-Revision': 'decision-7',
      }),
      expect.objectContaining({
        'Idempotency-Key': 'command-validate',
        'X-DWP-Expected-Decision-Revision': 'decision-7',
      }),
      expect.objectContaining({
        'Idempotency-Key': 'command-cancel',
        'X-DWP-Expected-Decision-Revision': 'decision-7',
      }),
    ]);
  });

  it('sends every canonical step-up header on submit', async () => {
    await submitAssignmentProposal(
      'proposal-1',
      { commandId: 'command-submit', expectedVersion: 4 },
      {
        ...AUTHORITY,
        idempotencyKey: 'command-submit',
        objectVersion: 4,
        stepUp: {
          challenge: 'signed-challenge',
          challengeId: 'challenge-1',
          decisionRevision: AUTHORITY.expectedDecisionRevision,
          expiresAt: '2099-01-01T00:00:00Z',
        },
      }
    );

    expect(http.post).toHaveBeenCalledWith(
      '/api/people/v1/workforce/assignment-proposals/proposal-1/submit',
      { commandId: 'command-submit', expectedVersion: 4 },
      {
        contextScopeKey: 'scope:hcm:operations',
        headers: {
          'Idempotency-Key': 'command-submit',
          'X-DWP-Expected-Decision-Revision': 'decision-7',
          'X-DWP-Expected-Object-Version': '4',
          'X-DWP-Step-Up-Challenge': 'signed-challenge',
        },
      }
    );
  });

  it('fails closed before dispatch when secure step-up authority is unavailable', async () => {
    await expect(
      submitAssignmentProposal(
        'proposal-1',
        { commandId: 'legacy-submit', expectedVersion: 4 },
        { mode: 'LEGACY_COMPATIBILITY', rolloutState: '100' }
      )
    ).rejects.toThrow('requires secure step-up authority');
    expect(http.post).not.toHaveBeenCalled();
  });
});
