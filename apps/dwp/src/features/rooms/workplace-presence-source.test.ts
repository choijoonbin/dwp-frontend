import { describe, expect, it } from 'vitest';

import { workplacePresenceSource } from './workplace-presence-source';

const connector = {
  kind: 'ACTUAL_PRESENCE' as const,
  provider: 'DWP_LOCAL_VERIFICATION',
  configurationReference: null,
  lastVerifiedAt: '2026-10-27T07:20:00Z',
  version: 0,
};

describe('workplace presence source', () => {
  it('presents only fresh provider-owned truth as ready', () => {
    expect(workplacePresenceSource({ ...connector, status: 'HEALTHY' }, false, false)).toEqual({
      state: 'READY',
      provider: 'DWP_LOCAL_VERIFICATION',
      updatedAt: '2026-10-27T07:20:00Z',
    });
  });

  it('keeps degraded and stale evidence visible with their exact state', () => {
    expect(workplacePresenceSource({ ...connector, status: 'DEGRADED' }, false, false).state).toBe(
      'DEGRADED'
    );
    expect(workplacePresenceSource({ ...connector, status: 'STALE' }, false, false).state).toBe(
      'STALE'
    );
  });

  it.each(['NOT_CONFIGURED', 'DISABLED', 'CONFIGURED_UNVERIFIED'] as const)(
    'never promotes configuration state %s to verified presence',
    (status) => {
      expect(workplacePresenceSource({ ...connector, status }, false, false)).toEqual({
        state: 'UNAVAILABLE',
        provider: 'DWP_LOCAL_VERIFICATION',
        updatedAt: null,
      });
    }
  );

  it('fails closed when the member projection cannot be loaded', () => {
    expect(workplacePresenceSource(undefined, true, false).state).toBe('LOADING');
    expect(workplacePresenceSource(undefined, false, true).state).toBe('UNAVAILABLE');
    expect(workplacePresenceSource({ ...connector, status: 'HEALTHY' }, false, true)).toEqual({
      state: 'STALE',
      provider: 'DWP_LOCAL_VERIFICATION',
      updatedAt: '2026-10-27T07:20:00Z',
    });
  });
});
