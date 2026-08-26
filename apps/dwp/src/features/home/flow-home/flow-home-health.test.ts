import { describe, expect, it } from 'vitest';

import { resolveFlowHomeHealth } from './flow-home-health';

import type { HomeOverview } from '@dwp-frontend/shared-utils';
import type { HomeContributionModel } from '../contributions';

const NOW = new Date('2026-08-25T08:00:00.000Z');

function section(status: 'AVAILABLE' | 'FORBIDDEN' | 'UNAVAILABLE', generatedAt: string) {
  return { status, source: 'DWP_TEST', generatedAt, data: null, reason: null };
}

function overview(generatedAt = '2026-08-25T07:58:00.000Z'): HomeOverview {
  return {
    audience: { profile: 'MEMBER', ruleVersion: 'v1', reasons: [] },
    work: section('AVAILABLE', generatedAt),
    calendar: section('AVAILABLE', generatedAt),
    activity: section('AVAILABLE', generatedAt),
    communications: section('AVAILABLE', generatedAt),
    recommendations: section('AVAILABLE', generatedAt),
    generatedAt,
  } as HomeOverview;
}

function providers(
  states: readonly Readonly<{
    appKey: string;
    state: HomeContributionModel['providers'][number]['state'];
    generatedAt?: string;
  }>[]
): HomeContributionModel['providers'] {
  return states.map((entry, index) => ({
    providerKey: `provider-${index}`,
    owner: { source: `SOURCE_${index}`, appKey: entry.appKey },
    supportedKinds: ['ACTION'],
    state: entry.state,
    sourceState: entry.state,
    generatedAt: entry.generatedAt ?? '2026-08-25T07:58:00.000Z',
    freshnessMs: 300_000,
    unavailableSources: [],
    receivedCount: 0,
    visibleCount: 0,
  }));
}

function resolve(input: Partial<Parameters<typeof resolveFlowHomeHealth>[0]> = {}) {
  return resolveFlowHomeHealth({
    now: NOW,
    overview: overview(),
    overviewFailed: false,
    overviewFetching: false,
    supplementalPartial: false,
    contributionFetching: false,
    providers: [],
    ...input,
  });
}

describe('Flow Home health presentation model', () => {
  it('keeps forbidden and configuration-required providers out of failure messaging', () => {
    const result = resolve({
      providers: providers([
        { appKey: 'APP.HCM', state: 'FORBIDDEN' },
        { appKey: 'APP.WORKPLACE', state: 'CONFIGURATION_REQUIRED' },
      ]),
    });

    expect(result.state).toBe('HEALTHY');
    expect(result.issues).toEqual([]);
  });

  it('names the delayed business domain without exposing a provider id', () => {
    const result = resolve({
      providers: providers([
        {
          appKey: 'APP.NOTIFICATIONS',
          state: 'STALE',
          generatedAt: '2026-08-25T07:48:00.000Z',
        },
      ]),
    });

    expect(result.state).toBe('DELAYED');
    expect(result.issues).toEqual([
      expect.objectContaining({ domain: 'notifications', state: 'DELAYED', lagMinutes: 12 }),
    ]);
  });

  it('deduplicates overlapping overview and contribution failures by business domain', () => {
    const degradedOverview = overview();
    degradedOverview.calendar = section('UNAVAILABLE', '2026-08-25T07:56:00.000Z');
    const result = resolve({
      overview: degradedOverview,
      providers: providers([{ appKey: 'APP.CALENDAR', state: 'PARTIAL' }]),
    });

    expect(result.state).toBe('PARTIAL');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ domain: 'calendar', state: 'UNAVAILABLE' });
  });

  it('distinguishes a total overview failure from a usable partial home', () => {
    const result = resolve({ overview: undefined, overviewFailed: true });

    expect(result.state).toBe('UNAVAILABLE');
    expect(result.issues).toEqual([{ domain: 'overview', state: 'UNAVAILABLE' }]);
  });

  it('reports refresh progress without turning a healthy home into an error', () => {
    const result = resolve({ overviewFetching: true, contributionFetching: true });

    expect(result.state).toBe('REFRESHING');
    expect(result.refreshing).toBe(true);
  });

  it('attributes a partial notification summary to notifications', () => {
    const result = resolve({ notificationPartial: true });

    expect(result.state).toBe('PARTIAL');
    expect(result.issues).toEqual([{ domain: 'notifications', state: 'PARTIAL' }]);
  });
});
