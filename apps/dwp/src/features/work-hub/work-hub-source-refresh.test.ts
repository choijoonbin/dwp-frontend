import { describe, expect, it } from 'vitest';

import { hubItem, NOW, snapshot } from './work-hub.test-support';
import { mergeWorkHubSourceRefresh } from './work-hub-source-refresh';

import type { WorkHubSnapshot, WorkHubSourceSnapshot } from './work-hub-contracts';

function source(
  sourceId: WorkHubSourceSnapshot['sourceId'],
  overrides: Partial<WorkHubSourceSnapshot> = {}
): WorkHubSourceSnapshot {
  return {
    sourceId,
    state: 'READY',
    items: [],
    receivedAt: new Date(NOW).toISOString(),
    generatedAt: null,
    hasMore: false,
    ...overrides,
  };
}

describe('mergeWorkHubSourceRefresh', () => {
  it('replaces only the requested source and keeps independently verified neighbours', () => {
    const personal = hubItem({ key: 'personal', sourceId: 'personal', title: 'Personal' });
    const service = hubItem({ key: 'service', sourceId: 'services', title: 'Old service' });
    const previous: WorkHubSnapshot = {
      ...snapshot([]),
      items: [personal, service],
      sources: [
        source('personal', { items: [personal] }),
        source('services', { items: [service] }),
      ],
    };
    const current = { ...service, title: 'Current service', version: service.version + 1 };
    const refreshed = {
      ...snapshot([]),
      items: [current],
      sources: [
        source('personal', { state: 'NOT_REQUESTED' }),
        source('services', { items: [current] }),
      ],
    };

    const result = mergeWorkHubSourceRefresh(previous, refreshed, 'services');

    expect(result?.items).toEqual([personal, current]);
    expect(result?.sources.find((candidate) => candidate.sourceId === 'personal')?.items).toEqual([
      personal,
    ]);
  });

  it('removes a denied source without retaining its prior rows', () => {
    const service = hubItem({ key: 'service', sourceId: 'services' });
    const previous: WorkHubSnapshot = {
      ...snapshot([]),
      items: [service],
      sources: [source('services', { items: [service] })],
    };
    const refreshed = {
      ...snapshot([]),
      completeness: 'UNAVAILABLE' as const,
      sources: [source('services', { state: 'FORBIDDEN', receivedAt: null })],
    };

    expect(mergeWorkHubSourceRefresh(previous, refreshed, 'services')).toMatchObject({
      items: [],
      completeness: 'UNAVAILABLE',
      sources: [{ sourceId: 'services', state: 'FORBIDDEN', items: [] }],
    });
  });

  it('fails closed when the response contains another requested source or wrong-source rows', () => {
    const previous = snapshot();
    const foreign = hubItem({ key: 'foreign', sourceId: 'personal' });
    const mixed = {
      ...snapshot([]),
      sources: [source('services', { items: [foreign] }), source('personal', { items: [foreign] })],
    };
    expect(mergeWorkHubSourceRefresh(previous, mixed, 'services')).toBeNull();

    mixed.sources[1] = source('personal', { state: 'NOT_REQUESTED' });
    expect(mergeWorkHubSourceRefresh(previous, mixed, 'services')).toBeNull();
  });
});
