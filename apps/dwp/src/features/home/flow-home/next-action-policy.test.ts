import { describe, expect, it } from 'vitest';

import { selectFlowActionRecommendation } from './next-action-policy';

import type { HomeOverview, HomeRecommendation } from '@dwp-frontend/shared-utils';

const communication: HomeRecommendation = {
  key: 'required-communication',
  kind: 'COMMUNICATION',
  priority: 'HIGH',
  title: 'Review the required policy update',
  description: 'A required organization notice is waiting.',
  actionPath: '/communications/required/4101',
  source: 'DWP_COMMUNICATIONS',
  evidenceCount: 1,
  confidence: 'HIGH',
};

const action: HomeRecommendation = {
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

function overviewWith(
  status: HomeOverview['recommendations']['status'],
  data: readonly HomeRecommendation[]
): HomeOverview {
  return {
    audience: { profile: 'MEMBER', ruleVersion: 'test', reasons: [] },
    work: { status: 'AVAILABLE', source: 'work', generatedAt: '', data: null },
    calendar: { status: 'AVAILABLE', source: 'calendar', generatedAt: '', data: null },
    communications: {
      status: 'AVAILABLE',
      source: 'communications',
      generatedAt: '',
      data: null,
    },
    activity: { status: 'AVAILABLE', source: 'activity', generatedAt: '', data: null },
    recommendations: { status, source: 'recommendations', generatedAt: '', data: [...data] },
    generatedAt: '',
  };
}

describe('selectFlowActionRecommendation', () => {
  it('skips a required communication and selects the first action recommendation', () => {
    expect(selectFlowActionRecommendation(overviewWith('AVAILABLE', [communication, action]))).toBe(
      action
    );
  });

  it('does not repeat schedule or communication recommendations in the action queue', () => {
    expect(
      selectFlowActionRecommendation(overviewWith('AVAILABLE', [communication]))
    ).toBeUndefined();
  });

  it('does not expose recommendations from a non-available section', () => {
    expect(selectFlowActionRecommendation(overviewWith('UNAVAILABLE', [action]))).toBeUndefined();
  });
});
