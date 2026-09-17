import { describe, expect, it } from 'vitest';

import { resolveMzGroundingState } from './mz-grounded-workspace';

import type { HomeContributionModel } from '../contributions';

function model(
  states: HomeContributionModel['providers'][number]['state'][],
  visibleCount = 0
): HomeContributionModel {
  return {
    buckets: { action: [], timeline: [], response: [], request: [], pulse: [] },
    bucketStates: {
      action: 'EMPTY',
      timeline: 'EMPTY',
      response: 'EMPTY',
      request: 'EMPTY',
      pulse: 'EMPTY',
    },
    providers: states.map((state, index) => ({
      providerKey: `provider-${index}`,
      owner: { source: `SOURCE_${index}`, appKey: `APP.${index}` },
      supportedKinds: ['ACTION'],
      state,
      sourceState: state,
      generatedAt: '2026-09-17T00:00:00.000Z',
      freshnessMs: 0,
      unavailableSources: [],
      receivedCount: visibleCount,
      visibleCount,
    })),
    diagnostics: {
      receivedCount: visibleCount,
      unauthorizedCount: 0,
      hiddenCount: 0,
      deduplicatedCount: 0,
      visibleCount,
    },
  };
}

describe('MZ grounded workspace state', () => {
  it('does not misrepresent forbidden data as a true empty result', () => {
    expect(resolveMzGroundingState(model(['FORBIDDEN']))).toBe('RESTRICTED');
  });

  it('separates provider setup, transport failure, and true empty states', () => {
    expect(resolveMzGroundingState(model(['CONFIGURATION_REQUIRED']))).toBe(
      'CONFIGURATION_REQUIRED'
    );
    expect(resolveMzGroundingState(model(['UNAVAILABLE']))).toBe('UNAVAILABLE');
    expect(resolveMzGroundingState(model(['AVAILABLE']))).toBe('EMPTY');
  });

  it('marks mixed visible and degraded sources as partial', () => {
    expect(resolveMzGroundingState(model(['AVAILABLE', 'FORBIDDEN'], 2))).toBe('PARTIAL');
    expect(resolveMzGroundingState(model(['AVAILABLE', 'UNAVAILABLE'], 2))).toBe('PARTIAL');
  });

  it('keeps stale and ready sources distinct', () => {
    expect(resolveMzGroundingState(model(['STALE'], 1))).toBe('STALE');
    expect(resolveMzGroundingState(model(['AVAILABLE'], 1))).toBe('READY');
  });

  it('keeps initial loading, background refresh, and aggregate partial status distinct from empty', () => {
    const empty = model(['AVAILABLE']);
    expect(resolveMzGroundingState(empty, 'LOADING')).toBe('LOADING');
    expect(resolveMzGroundingState(empty, 'REFRESHING')).toBe('REFRESHING');
    expect(resolveMzGroundingState(empty, 'PARTIAL')).toBe('PARTIAL');
  });
});
