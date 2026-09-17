import { describe, expect, it } from 'vitest';

import {
  mailRuleSeedFromSearchParams,
  mailSearchRuleHandoffParams,
  mailSearchRuleSeed,
} from './mail-search-rule-handoff';

describe('mail search to rule handoff', () => {
  it('projects only rule-supported search criteria and bounds URL values', () => {
    const params = mailSearchRuleHandoffParams({
      accountId: 'account-2',
      from: 'sender@example.com',
      query: 'x'.repeat(700),
      unread: true,
      dateFrom: '2026-01-01',
      hasAttachment: true,
    });
    expect(params?.get('ruleAccountId')).toBe('account-2');
    expect(params?.get('ruleFrom')).toBe('sender@example.com');
    expect(params?.get('ruleSubject')).toHaveLength(500);
    expect(params?.has('unread')).toBe(false);
    expect(mailRuleSeedFromSearchParams(params!)).toEqual({
      accountId: 'account-2',
      conditions: [
        { field: 'SENDER', operator: 'CONTAINS', value: 'sender@example.com' },
        { field: 'SUBJECT', operator: 'CONTAINS', value: 'x'.repeat(500) },
        { field: 'HAS_ATTACHMENT', operator: 'IS', value: 'true' },
      ],
    });
  });

  it('does not offer a rule handoff when no supported condition exists', () => {
    expect(mailSearchRuleSeed({ unread: true, scope: 'SHARED' })).toBeNull();
  });
});
