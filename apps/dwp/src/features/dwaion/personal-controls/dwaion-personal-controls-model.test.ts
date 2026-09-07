import { describe, expect, it } from 'vitest';

import {
  clearEvidenceMatches,
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
        blockedScopes: [],
      },
    ] as const;
    expect(clearEvidenceMatches(['PROPOSALS', 'MEMORY'], evidence)).toBe(true);
    expect(clearEvidenceMatches(['ARTIFACT'], evidence)).toBe(false);
  });
});
