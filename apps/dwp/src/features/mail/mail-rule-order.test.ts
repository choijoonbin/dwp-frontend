import { describe, expect, it } from 'vitest';

import { mailRuleMoveAvailability, mailRuleOrderAfterMove } from './mail-rule-order';

import type { MailRule } from '@dwp-frontend/shared-utils';

function rule(ruleId: string, accountId: string, priority: number, version = 0) {
  return { ruleId, accountId, priority, version } as MailRule;
}

describe('mail rule ordering', () => {
  const rules = [rule('a-1', 'a', 10, 1), rule('b-1', 'b', 10, 2), rule('a-2', 'a', 20, 3)];

  it('moves only within the selected account and carries expected versions', () => {
    expect(mailRuleOrderAfterMove(rules, 'a-2', 'UP')).toEqual([
      { ruleId: 'a-2', version: 3 },
      { ruleId: 'a-1', version: 1 },
    ]);
    expect(mailRuleOrderAfterMove(rules, 'a-1', 'UP')).toBeNull();
  });

  it('reports valid move directions within each account', () => {
    expect(mailRuleMoveAvailability(rules, 'a-1')).toEqual({ up: false, down: true });
    expect(mailRuleMoveAvailability(rules, 'a-2')).toEqual({ up: true, down: false });
    expect(mailRuleMoveAvailability(rules, 'b-1')).toEqual({ up: false, down: false });
  });
});
