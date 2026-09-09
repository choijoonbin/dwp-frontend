import { describe, expect, it } from 'vitest';

import {
  clearEvidenceMatches,
  deletionCompletionVerified,
  governanceBoundaryState,
  deletionStatusPollInterval,
  clearRequestIsValid,
  memoryCanMutate,
  memoryDraftErrors,
  sourcePreferenceCanChange,
} from './dwaion-personal-controls-model';

import type { DwaionMemoryRecord, DwaionSourcePreference } from './dwaion-personal-controls-model';

const preference: DwaionSourcePreference = {
  sourceKey: 'CALENDAR',
  label: 'Calendar',
  description: 'Upcoming meetings',
  enabled: true,
  effective: true,
  available: true,
  revision: 3,
  effectScope: 'PERSONAL_ROUTINE_DRY_RUN_ONLY',
  retentionLabel: 'REFERENCE_ONLY_NO_RAW_COPY',
};

const memory: DwaionMemoryRecord = {
  memoryId: 'memory-1',
  kind: 'TONE',
  label: 'Tone',
  value: 'Use concise summaries',
  state: 'ACTIVE',
  revision: 2,
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-02T00:00:00Z',
};

describe('DWAI personal AI controls model', () => {
  it('changes source consent only when the source is available and revision matches', () => {
    expect(sourcePreferenceCanChange(preference, 3)).toBe('ALLOWED');
    expect(sourcePreferenceCanChange(preference, 2)).toBe('REVISION_CONFLICT');
    expect(sourcePreferenceCanChange({ ...preference, available: false }, 3)).toBe('UNAVAILABLE');
  });

  it('accepts only a typed explicit preference with a nonblank value', () => {
    expect(memoryDraftErrors({ kind: 'TONE', value: '' })).toEqual(['VALUE_REQUIRED']);
    expect(memoryDraftErrors({ kind: 'OUTPUT_FORMAT', value: 'Use a table' })).toEqual([]);
  });

  it('fails closed for stale or deleted memory mutations', () => {
    expect(memoryCanMutate(memory, 2)).toBe('ALLOWED');
    expect(memoryCanMutate(memory, 1)).toBe('REVISION_CONFLICT');
    expect(memoryCanMutate({ ...memory, state: 'DELETED' }, 2)).toBe('DELETED');
  });

  it('rejects empty and duplicate cleanup scopes', () => {
    expect(clearRequestIsValid([])).toBe(false);
    expect(clearRequestIsValid(['MEMORY', 'MEMORY'])).toBe(false);
    expect(clearRequestIsValid(['MEMORY', 'PROPOSALS'])).toBe(true);
  });

  it('matches proposal clear and deletion request evidence without claiming completion', () => {
    const evidence = [
      {
        kind: 'PROPOSAL_CLEAR',
        receiptId: 'proposal-clear-2026-09-04',
        completedAt: '2026-09-04T00:00:00Z',
        hiddenCount: 4,
        scopes: ['PROPOSALS'],
      },
      {
        kind: 'DELETION_REQUEST',
        receiptId: 'deletion-1',
        requestedAt: '2026-09-04T00:00:00Z',
        state: 'REQUESTED',
        scopes: ['MEMORY'],
        deletionPerformed: false,
        deletionExecutionAvailable: false,
        deletionCompletionClaimAvailable: false,
        blockedScopes: [],
      },
    ] as const;
    expect(clearEvidenceMatches(['PROPOSALS', 'MEMORY'], evidence)).toBe(true);
    expect(clearEvidenceMatches(['ARTIFACT'], evidence)).toBe(false);
  });
  it('requires complete unblocked deletion evidence before displaying completion', () => {
    const receipt = {
      kind: 'DELETION_REQUEST',
      receiptId: 'deletion-1',
      requestedAt: '2026-09-09T00:00:00Z',
      completedAt: '2026-09-09T00:01:00Z',
      state: 'COMPLETED',
      scopes: ['MEMORY'],
      deletionPerformed: true,
      deletionExecutionAvailable: false,
      deletionCompletionClaimAvailable: true,
      blockedScopes: [],
    } as const;
    expect(deletionCompletionVerified(receipt)).toBe(true);
    expect(deletionCompletionVerified({ ...receipt, completedAt: null })).toBe(false);
    expect(deletionCompletionVerified({ ...receipt, blockedScopes: ['MEMORY'] })).toBe(false);
    expect(deletionCompletionVerified({ ...receipt, deletionPerformed: false })).toBe(false);
    expect(
      deletionCompletionVerified({ ...receipt, deletionCompletionClaimAvailable: false })
    ).toBe(false);
    expect(deletionCompletionVerified({ ...receipt, state: 'RUNNING' })).toBe(false);
  });
  it('requires an explicit false for blocked security evidence', () => {
    expect(governanceBoundaryState(false)).toBe('BLOCKED');
    expect(governanceBoundaryState(true)).toBe('ALLOWED');
    for (const value of [undefined, null, 'false', 0, {}]) {
      expect(governanceBoundaryState(value)).toBe('UNKNOWN');
    }
  });

  it('continues deletion polling from the accepted receipt after an initial read failure', () => {
    expect(deletionStatusPollInterval({ receiptState: 'REQUESTED', errorStatus: 503 })).toBe(1000);
    expect(deletionStatusPollInterval({ receiptState: 'RUNNING' })).toBe(1000);
    expect(deletionStatusPollInterval({ receiptState: 'RUNNING', latestState: 'COMPLETED' })).toBe(
      false
    );
    expect(deletionStatusPollInterval({ receiptState: 'RUNNING', latestState: 'FAILED' })).toBe(
      false
    );
    expect(deletionStatusPollInterval({ receiptState: 'RUNNING', errorStatus: 403 })).toBe(false);
    expect(deletionStatusPollInterval({})).toBe(false);
  });
});
