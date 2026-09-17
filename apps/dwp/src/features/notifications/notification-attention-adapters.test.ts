import { describe, expect, it } from 'vitest';

import {
  attentionRuleLimit,
  attentionRuleSummary,
  toAttentionRule,
  toAttentionScopeOption,
  toNoiseQualityView,
  toTestDiagnostics,
} from './notification-attention-adapters';

import type {
  NotificationAttentionControl,
  NotificationAttentionRule,
} from '@dwp-frontend/shared-utils/api/notification-attention-api';

const t = (key: string, options?: Record<string, unknown>) =>
  typeof options?.defaultValue === 'string' ? options.defaultValue : key;

function rule(overrides: Partial<NotificationAttentionRule> = {}): NotificationAttentionRule {
  return {
    ruleId: 'rule-1',
    scopeKind: 'ACTOR',
    scopeKey: 'actor-1',
    displayLabel: 'Kim Mina',
    effect: 'PRIORITIZE',
    channels: { IN_APP: true },
    source: 'USER',
    managed: false,
    exceptionAllowed: false,
    enabled: true,
    version: '3',
    createdAt: '2026-09-16T00:00:00Z',
    updatedAt: '2026-09-16T01:00:00Z',
    ...overrides,
  };
}

describe('notification attention runtime adapters', () => {
  it('maps user and managed rules without granting forbidden actions', () => {
    expect(toAttentionRule(rule(), t).kind).toBe('VIP');
    expect(toAttentionRule(rule(), t).actions.canDelete).toBe(true);

    const managed = toAttentionRule(
      rule({ source: 'TENANT_POLICY', managed: true, exceptionAllowed: false }),
      t
    );
    expect(managed.managed).toEqual({
      ownerLabel: 'attention.managed.owner',
      reason: 'attention.managed.reason',
      exceptionAllowed: false,
    });
    expect(managed.actions).toEqual({
      canEdit: false,
      canDelete: false,
      canPause: false,
      canResume: false,
      canExtend: false,
    });
  });

  it('uses the server rule limit and counts only active non-expired rules', () => {
    const items = [
      rule(),
      rule({ ruleId: 'paused', enabled: false }),
      rule({ ruleId: 'expired', expiresAt: '2026-09-15T00:00:00Z' }),
    ];
    expect(
      attentionRuleLimit({ items, maxActiveRules: 2 }, Date.parse('2026-09-16T00:00:00Z'))
    ).toEqual({ used: 1, limit: 2, reached: false });
    expect(attentionRuleSummary(items.map((item) => toAttentionRule(item, t)))).toEqual({
      VIP: 3,
      FOLLOW_CONTEXT: 0,
      MUTE_SCOPE: 0,
      TOPIC_WATCH: 0,
    });
  });

  it('accepts only canonical contextual actions and preserves policy locks', () => {
    const control: NotificationAttentionControl = {
      controlKey: 'MUTE_TYPE',
      scopeKind: 'APP_TYPE',
      label: 'Security device risk',
      allowedEffects: ['MUTE'],
      currentEffect: null,
      policyLocked: true,
      policyReason: 'Mandatory security notification',
      dndBypassAllowed: true,
    };
    expect(toAttentionScopeOption(control, t)).toMatchObject({
      action: 'MUTE_TYPE',
      availability: 'LOCKED',
      policyLock: { reason: 'Mandatory security notification' },
    });
    expect(toAttentionScopeOption({ ...control, controlKey: 'CLIENT_DEFINED' }, t)).toBeNull();
  });

  it('keeps provider-disabled diagnostic stages explicit and outside success', () => {
    const result = toTestDiagnostics(
      {
        testId: 'test-1',
        state: 'PARTIAL',
        requestedChannels: ['IN_APP', 'WEB_PUSH'],
        stages: [
          { stage: 'IN_APP_PREVIEW', state: 'SUCCEEDED' },
          { stage: 'ENDPOINT_DELIVERY', state: 'DISABLED' },
        ],
        createdAt: '2026-09-16T00:00:00Z',
        expiresAt: '2026-09-17T00:00:00Z',
      },
      t,
      Date.parse('2026-09-16T01:00:00Z')
    );
    expect(result.state).toBe('PARTIAL');
    expect(result.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'REACHED', capability: 'SUPPORTED' }),
        expect.objectContaining({ status: 'SKIPPED', capability: 'DISABLED' }),
      ])
    );
  });

  it('carries per-type cohort evidence into every administrator metric', () => {
    const view = toNoiseQualityView(
      {
        partial: false,
        unavailableSources: [],
        sufficientCohort: true,
        minimumCohortSize: 10,
        observedCohortSize: 60,
        muteRate: 0.2,
        deduplicationRate: 0.1,
        actionConversionRate: 0.5,
        fatigueExposedUsers: null,
        noisyTypes: [
          {
            contractId: '10000000-0000-0000-0000-000000000001',
            appKey: 'messaging',
            typeKey: 'MESSAGE.MENTION',
            ownerTeam: 'Messaging Platform',
            cohortSize: 24,
            volume: 70,
            muteRate: 0.1,
            deduplicationRate: 0.2,
            actionConversionRate: null,
          },
        ],
        trend: [],
        fourEyes: {
          state: 'UNAVAILABLE',
          publishedPolicyCount: 0,
          draftPolicyCount: 0,
          reviewerSeparationRequired: false,
        },
        range: 'LAST_30_DAYS',
        windowStart: '2026-08-17T00:00:00Z',
        generatedAt: '2026-09-16T00:00:00Z',
      },
      t
    );
    expect(view.noisyTypes[0]?.sent.cohortSize).toBe(24);
    expect(view.noisyTypes[0]?.actionConversion.state).toBe('MISSING');
    expect(view.fourEyesPolicy.state).toBe('UNAVAILABLE');
  });

  it('withholds per-type values when that row is below the privacy threshold', () => {
    const view = toNoiseQualityView(
      {
        partial: false,
        unavailableSources: [],
        sufficientCohort: true,
        minimumCohortSize: 20,
        observedCohortSize: 80,
        muteRate: 0.2,
        deduplicationRate: 0.1,
        actionConversionRate: 0.5,
        fatigueExposedUsers: 12,
        noisyTypes: [
          {
            contractId: '10000000-0000-0000-0000-000000000002',
            appKey: 'messaging',
            typeKey: 'MESSAGE.PRIVATE_THREAD',
            ownerTeam: 'Messaging Platform',
            cohortSize: 7,
            volume: 14,
            muteRate: 0.5,
            deduplicationRate: 0.25,
            actionConversionRate: 0.4,
          },
        ],
        trend: [],
        fourEyes: {
          state: 'UNAVAILABLE',
          publishedPolicyCount: 0,
          draftPolicyCount: 0,
          reviewerSeparationRequired: false,
        },
        range: 'LAST_30_DAYS',
        windowStart: '2026-08-17T00:00:00Z',
        generatedAt: '2026-09-16T00:00:00Z',
      },
      t
    );

    expect(view.metrics.MUTED_RATE.datum.state).toBe('AVAILABLE');
    expect(view.noisyTypes[0]).toMatchObject({
      sent: { state: 'PRIVACY_WITHHELD', value: null, cohortSize: 7 },
      mutedRate: { state: 'PRIVACY_WITHHELD', value: null, cohortSize: 7 },
      deduplicationRate: { state: 'PRIVACY_WITHHELD', value: null, cohortSize: 7 },
      actionConversion: { state: 'PRIVACY_WITHHELD', value: null, cohortSize: 7 },
    });
  });

  it('never infers four-eyes enforcement from an empty or contradictory policy state', () => {
    const view = toNoiseQualityView(
      {
        partial: false,
        unavailableSources: [],
        sufficientCohort: true,
        minimumCohortSize: 10,
        observedCohortSize: 20,
        muteRate: 0.1,
        deduplicationRate: 0.2,
        actionConversionRate: 0.4,
        fatigueExposedUsers: 0,
        noisyTypes: [],
        trend: [],
        fourEyes: {
          state: 'ENFORCED',
          publishedPolicyCount: 0,
          draftPolicyCount: 0,
          reviewerSeparationRequired: true,
        },
        range: 'LAST_30_DAYS',
        windowStart: '2026-08-17T00:00:00Z',
        generatedAt: '2026-09-16T00:00:00Z',
      },
      t
    );

    expect(view.fourEyesPolicy).toMatchObject({
      state: 'UNAVAILABLE',
      reviewerSeparationRequired: false,
      canOpenPolicy: true,
    });
  });

  it('uses server evidence for enforced governance and preserves exact finding targets', () => {
    const view = toNoiseQualityView(
      {
        partial: false,
        unavailableSources: [],
        sufficientCohort: true,
        minimumCohortSize: 10,
        observedCohortSize: 30,
        muteRate: 0.55,
        deduplicationRate: 0.1,
        actionConversionRate: 0.4,
        fatigueExposedUsers: 0,
        noisyTypes: [
          {
            contractId: '10000000-0000-0000-0000-000000000003',
            appKey: 'approvals',
            typeKey: 'APPROVAL.ACTION_REQUIRED',
            ownerTeam: 'Approval Platform',
            cohortSize: 30,
            volume: 70,
            muteRate: 0.55,
            deduplicationRate: 0.1,
            actionConversionRate: 0.4,
            findingCode: 'HIGH_MUTE_RATE',
            findingSeverity: 'CRITICAL',
            findingTarget: 'POLICY',
            findingTargetKey: '20000000-0000-0000-0000-000000000001',
          },
        ],
        trend: [
          {
            bucketStart: '2026-09-15T00:00:00Z',
            cohortSize: 30,
            volume: 70,
            muteRate: 0.55,
            deduplicationRate: 0.1,
            actionConversionRate: 0.4,
          },
        ],
        fourEyes: {
          state: 'ENFORCED',
          publishedPolicyCount: 2,
          draftPolicyCount: 1,
          reviewerSeparationRequired: true,
          updatedAt: '2026-09-16T00:05:00Z',
        },
        range: 'LAST_30_DAYS',
        windowStart: '2026-08-17T00:00:00Z',
        generatedAt: '2026-09-16T00:00:00Z',
      },
      t
    );

    expect(view.fourEyesPolicy.state).toBe('ENFORCED');
    expect(view.noisyTypes[0]).toMatchObject({
      contractId: '10000000-0000-0000-0000-000000000003',
      ownerLabel: 'Approval Platform',
      finding: {
        severity: 'CRITICAL',
        target: 'POLICY',
        targetKey: '20000000-0000-0000-0000-000000000001',
      },
    });
    expect(view.trend).toHaveLength(1);
  });

  it('falls back to the contract when a non-contract finding lacks a canonical target id', () => {
    const view = toNoiseQualityView(
      {
        partial: false,
        unavailableSources: [],
        sufficientCohort: true,
        minimumCohortSize: 10,
        observedCohortSize: 20,
        noisyTypes: [
          {
            contractId: '10000000-0000-0000-0000-000000000004',
            appKey: 'approvals',
            typeKey: 'APPROVAL.REVIEW',
            ownerTeam: 'Approval Platform',
            cohortSize: 20,
            volume: 25,
            findingCode: 'HIGH_MUTE_RATE',
            findingSeverity: 'WARNING',
            findingTarget: 'POLICY',
            findingTargetKey: 'not-a-canonical-id',
          },
        ],
        trend: [],
        fourEyes: {
          state: 'NOT_CONFIGURED',
          publishedPolicyCount: 0,
          draftPolicyCount: 0,
          reviewerSeparationRequired: false,
        },
        range: 'LAST_30_DAYS',
        windowStart: '2026-08-17T00:00:00Z',
        generatedAt: '2026-09-16T00:00:00Z',
      },
      t
    );

    expect(view.noisyTypes[0]?.finding).toMatchObject({
      target: 'CONTRACT',
      targetKey: '10000000-0000-0000-0000-000000000004',
    });
  });
});
