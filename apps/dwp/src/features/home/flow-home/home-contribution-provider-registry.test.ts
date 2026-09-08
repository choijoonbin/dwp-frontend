import { describe, expect, it } from 'vitest';

import {
  canonicalHomeSourceNamespace,
  HOME_CONTRIBUTION_PROVIDERS,
  homeContributionWorkIdentity,
} from './home-contribution-providers';

describe('Home contribution provider registry', () => {
  it('registers every implemented app provider exactly once', () => {
    expect(HOME_CONTRIBUTION_PROVIDERS.map((provider) => provider.key)).toEqual([
      'workspace-work',
      'personal-work',
      'personal-day-plan',
      'calendar-home',
      'workspace-activity',
      'approval-home',
      'hr-home',
      'service-requests',
      'workplace-bookings',
      'notification-summary',
    ]);
  });

  it('canonicalizes real workspace source labels for cross-provider dedupe', () => {
    expect(canonicalHomeSourceNamespace('Approval Service')).toBe('APPROVAL');
    expect(canonicalHomeSourceNamespace('DWP_APPROVAL')).toBe('APPROVAL');
    expect(canonicalHomeSourceNamespace('IT Service')).toBe('SERVICE');
    expect(canonicalHomeSourceNamespace('DWP_EMPLOYEE_SERVICES')).toBe('SERVICE');
    expect(canonicalHomeSourceNamespace('HR')).toBe('HCM');
    expect(canonicalHomeSourceNamespace('DWP Workplace')).toBe('WORKPLACE');
  });

  it('keeps an optional work obligation in the cross-provider identity', () => {
    expect(homeContributionWorkIdentity('PERSONAL_TASK', 'task-1')).toBe('PERSONAL_TASK:task-1');
    expect(homeContributionWorkIdentity('Approval Service', 'request-1')).toBe(
      'APPROVAL:request-1'
    );
    expect(homeContributionWorkIdentity('APPROVAL_TASK', 'task-1', 'security-review')).toBe(
      'APPROVAL_TASK:task-1:security-review'
    );
  });
});
