import { afterEach, describe, expect, it, vi } from 'vitest';

import { getHomeOverview } from './home-overview-api';

const generatedAt = '2026-08-18T09:10:00Z';
const recommendation = {
  key: 'work-due-soon',
  kind: 'ACTION',
  priority: 'HIGH',
  title: 'Review work approaching its deadline',
  description: 'Your personal work queue contains time-sensitive items.',
  actionPath: '/work',
  source: 'DWP_WORKSPACE',
  evidenceCount: 1,
  confidence: 'HIGH',
};

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

function overviewResponse() {
  return {
    audience: {
      profile: 'MEMBER',
      ruleVersion: 'home-rules-2026.08',
      reasons: ['AUTHENTICATED_WORKFORCE_MEMBER'],
    },
    work: {
      status: 'AVAILABLE',
      source: 'DWP_WORKSPACE',
      generatedAt,
      data: {
        summary: { total: 0, dueSoon: 0, inProgress: 0, waiting: 0, completed: 0 },
        items: [],
        generatedAt,
      },
      reason: null,
    },
    calendar: {
      status: 'AVAILABLE',
      source: 'DWP_CALENDAR',
      generatedAt,
      data: null,
      reason: null,
    },
    communications: {
      status: 'AVAILABLE',
      source: 'DWP_COMMUNICATIONS',
      generatedAt,
      data: null,
      reason: null,
    },
    activity: {
      status: 'AVAILABLE',
      source: 'DWP_ACTIVITY',
      generatedAt,
      data: { events: [], generatedAt },
      reason: null,
    },
    generatedAt,
  };
}

describe('home overview API boundary', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prefers the status-bearing recommendation section during a rolling deployment', async () => {
    const response = {
      ...overviewResponse(),
      recommendations: [recommendation],
      recommendationSection: {
        status: 'UNAVAILABLE',
        source: 'DWP_HOME_RECOMMENDATIONS',
        generatedAt,
        data: null,
        reason: 'SOURCE_UNAVAILABLE',
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(response)));

    const overview = await getHomeOverview();

    expect(overview.recommendations).toEqual(response.recommendationSection);
  });

  it('wraps the legacy recommendation array as an available section', async () => {
    const response = { ...overviewResponse(), recommendations: [recommendation] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(response)));

    const overview = await getHomeOverview();

    expect(overview.recommendations).toEqual({
      status: 'AVAILABLE',
      source: 'DWP_HOME_RECOMMENDATIONS',
      generatedAt,
      data: [recommendation],
      reason: null,
    });
  });

  it('treats a missing recommendation contract as unavailable instead of healthy-empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(overviewResponse())));

    const overview = await getHomeOverview();

    expect(overview.recommendations).toEqual({
      status: 'UNAVAILABLE',
      source: 'DWP_HOME_RECOMMENDATIONS',
      generatedAt,
      data: null,
      reason: 'MISSING_RECOMMENDATION_CONTRACT',
    });
  });
});
