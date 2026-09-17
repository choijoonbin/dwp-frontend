import { describe, expect, it } from 'vitest';

import {
  canPreviewWorkplaceConnectorReplay,
  replayDateTimeToInstant,
  summarizeWorkplaceConnectorRuntime,
  workplaceConnectorRuntimeTone,
} from './workplace-connector-operations-model';

import type { WorkplaceConnectorRuntimeTruth } from '@dwp-frontend/shared-utils';

function connector(state: WorkplaceConnectorRuntimeTruth['state']): WorkplaceConnectorRuntimeTruth {
  return {
    kind: 'CALENDAR',
    provider: 'calendar-adapter',
    enabled: true,
    state,
    providerReportedState: state === 'HEALTHY' ? 'HEALTHY' : 'DEGRADED',
    capabilities: ['HEALTH', 'REPLAY'],
    configurationVersion: 7,
    observedConfigurationVersion: 7,
    runtimeVersion: 11,
    sourceObservedAt: '2026-09-16T03:59:20Z',
    receivedAt: '2026-09-16T03:59:25Z',
    lastSuccessAt: '2026-09-16T03:59:20Z',
    lagSeconds: 40,
    checkpointReference: 'cursor:700',
    retryQueueDepth: 2,
    deadLetterQueueDepth: 1,
    errorCode: null,
    activeReplayJobId: null,
    evaluatedAt: '2026-09-16T04:00:00Z',
  };
}

describe('Workplace connector operations model', () => {
  it('separates healthy, attention and replaying runtime truth', () => {
    expect(
      summarizeWorkplaceConnectorRuntime([
        connector('HEALTHY'),
        connector('DEGRADED'),
        connector('STALE'),
        connector('CONFIGURED_UNVERIFIED'),
        connector('REPLAYING'),
      ])
    ).toEqual({ total: 5, healthy: 1, attention: 3, replaying: 1 });
  });

  it('only permits preview when verified runtime evidence advertises replay', () => {
    expect(canPreviewWorkplaceConnectorReplay(connector('HEALTHY'))).toBe(true);
    expect(canPreviewWorkplaceConnectorReplay(connector('STALE'))).toBe(true);
    expect(canPreviewWorkplaceConnectorReplay(connector('CONFIGURED_UNVERIFIED'))).toBe(false);
    expect(
      canPreviewWorkplaceConnectorReplay({ ...connector('HEALTHY'), capabilities: ['HEALTH'] })
    ).toBe(false);
  });

  it('assigns accessible semantic tones and validates replay instants', () => {
    expect(workplaceConnectorRuntimeTone('HEALTHY')).toBe('success');
    expect(workplaceConnectorRuntimeTone('STALE')).toBe('error');
    expect(replayDateTimeToInstant('invalid')).toBeNull();
    expect(replayDateTimeToInstant('2026-09-16T04:00:00Z')).toBe('2026-09-16T04:00:00.000Z');
  });
});
