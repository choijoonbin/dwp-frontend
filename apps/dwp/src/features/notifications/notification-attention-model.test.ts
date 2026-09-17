import { describe, expect, it } from 'vitest';

import {
  hasBlockingAttentionConflict,
  isAttentionScopeActionable,
  notificationTestStageProgress,
  resolveAttentionRuleLimit,
  resolveAttentionRuleState,
  resolveNotificationTestAction,
  selectedAttentionExpiration,
  validNotificationAttentionCount,
} from './notification-attention-model';

import type {
  NotificationAttentionRule,
  NotificationAttentionScopeOption,
  NotificationTestDiagnostics,
} from './notification-attention-model';

const option: NotificationAttentionScopeOption = {
  optionId: 'context-1',
  action: 'FOLLOW_CONTEXT',
  label: 'Follow this work item',
  description: 'Prioritize updates from this exact work item.',
  scopeLabel: 'Project Atlas / review thread',
  scopeKind: 'THREAD',
  current: false,
  availability: 'AVAILABLE',
  expirationOptions: [
    { optionId: 'week', label: 'One week', expiresAt: '2026-09-23T00:00:00Z' },
    { optionId: 'ongoing', label: 'Ongoing', expiresAt: null },
  ],
};

const rule: NotificationAttentionRule = {
  ruleId: 'rule-1',
  kind: 'FOLLOW_CONTEXT',
  label: 'Atlas review',
  scopeLabel: 'Project Atlas / review thread',
  scopeKind: 'THREAD',
  source: 'USER',
  sourceLabel: 'My setting',
  effect: 'FOLLOW',
  channelLabels: ['In-app'],
  state: 'ENABLED',
  expiresAt: '2026-09-20T00:00:00Z',
  updatedAt: '2026-09-16T00:00:00Z',
  actions: {
    canEdit: true,
    canDelete: true,
    canPause: true,
    canResume: false,
    canExtend: true,
  },
};

describe('notification attention model', () => {
  it('resolves expiry without rewriting an explicitly paused state', () => {
    expect(resolveAttentionRuleState(rule, Date.parse('2026-09-19T00:00:00Z'))).toBe('ENABLED');
    expect(resolveAttentionRuleState(rule, Date.parse('2026-09-20T00:00:00Z'))).toBe('EXPIRED');
    expect(
      resolveAttentionRuleState(
        { state: 'PAUSED', expiresAt: '2026-09-23T00:00:00Z' },
        Date.parse('2026-09-19T00:00:00Z')
      )
    ).toBe('PAUSED');
  });

  it('accepts only exact server-provided expiry option identifiers', () => {
    expect(selectedAttentionExpiration(option, 'week')).toEqual(option.expirationOptions[0]);
    expect(selectedAttentionExpiration(option, 'custom-client-value')).toBeNull();
    expect(selectedAttentionExpiration(undefined, 'week')).toBeNull();
  });

  it('keeps locked and unavailable scopes non-actionable', () => {
    expect(isAttentionScopeActionable(option)).toBe(true);
    expect(
      isAttentionScopeActionable({
        ...option,
        availability: 'LOCKED',
        policyLock: {
          ownerLabel: 'Security policy',
          reason: 'Mandatory notification',
          exceptionAllowed: false,
        },
      })
    ).toBe(false);
    expect(isAttentionScopeActionable({ ...option, availability: 'UNAVAILABLE' })).toBe(false);
  });

  it('fails closed when server rule-capacity counters are inconsistent', () => {
    expect(resolveAttentionRuleLimit({ used: 4, limit: 5, reached: false })).toEqual({
      valid: true,
      reached: false,
      remaining: 1,
    });
    expect(resolveAttentionRuleLimit({ used: 6, limit: 5, reached: false })).toEqual({
      valid: false,
      reached: true,
      remaining: 0,
    });
    expect(resolveAttentionRuleLimit({ used: 5, limit: 5, reached: false }).reached).toBe(true);
    expect(resolveAttentionRuleLimit(undefined)).toEqual({
      valid: false,
      reached: true,
      remaining: 0,
    });
    expect(validNotificationAttentionCount(0)).toBe(true);
    expect(validNotificationAttentionCount(-1)).toBe(false);
    expect(validNotificationAttentionCount(Number.NaN)).toBe(false);
  });

  it('distinguishes blocking conflicts from informational findings', () => {
    expect(
      hasBlockingAttentionConflict({
        ...rule,
        conflicts: [{ conflictId: 'info', severity: 'INFO', message: 'Broader rule exists.' }],
      })
    ).toBe(false);
    expect(
      hasBlockingAttentionConflict({
        ...rule,
        conflicts: [{ conflictId: 'blocked', severity: 'BLOCKING', message: 'Policy wins.' }],
      })
    ).toBe(true);
  });

  it('blocks test dispatch for offline, rate-limited, expired, and provider-disabled states', () => {
    const diagnostics = (
      state: NotificationTestDiagnostics['state']
    ): NotificationTestDiagnostics => {
      const runAvailability =
        state === 'OFFLINE'
          ? 'OFFLINE'
          : state === 'RATE_LIMITED'
            ? 'RATE_LIMITED'
            : state === 'EXPIRED'
              ? 'EXPIRED'
              : state === 'DISABLED'
                ? 'DISABLED'
                : 'AVAILABLE';
      return { state, runAvailability, stages: [] };
    };
    expect(resolveNotificationTestAction(diagnostics('IDLE'), false)).toEqual({
      allowed: true,
      reason: 'AVAILABLE',
    });
    expect(resolveNotificationTestAction(diagnostics('OFFLINE'), false).reason).toBe('OFFLINE');
    expect(resolveNotificationTestAction(diagnostics('RATE_LIMITED'), false).reason).toBe(
      'RATE_LIMITED'
    );
    expect(resolveNotificationTestAction(diagnostics('EXPIRED'), false).reason).toBe('EXPIRED');
    expect(resolveNotificationTestAction(diagnostics('DISABLED'), false).reason).toBe('DISABLED');
    expect(resolveNotificationTestAction(diagnostics('IDLE'), true).reason).toBe('BUSY');
    expect(
      resolveNotificationTestAction(
        { state: 'EXPIRED', runAvailability: 'AVAILABLE', stages: [] },
        false
      )
    ).toEqual({ allowed: true, reason: 'AVAILABLE' });
  });

  it('counts only supported diagnostic stages and never infers provider-disabled progress', () => {
    expect(
      notificationTestStageProgress([
        {
          stageId: 'banner',
          label: 'Banner',
          description: 'In-app banner',
          capability: 'SUPPORTED',
          status: 'REACHED',
        },
        {
          stageId: 'push',
          label: 'Browser push',
          description: 'Push provider',
          capability: 'DISABLED',
          status: 'SKIPPED',
        },
        {
          stageId: 'privacy',
          label: 'Privacy preview',
          description: 'Safe preview',
          capability: 'SUPPORTED',
          status: 'RUNNING',
        },
      ])
    ).toEqual({ observed: 1, total: 2 });
  });
});
