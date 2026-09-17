import type { MailRule } from '@dwp-frontend/shared-utils';

export type MailRuleMoveDirection = 'DOWN' | 'UP';

export function mailRuleOrderAfterMove(
  rules: readonly MailRule[],
  ruleId: string,
  direction: MailRuleMoveDirection
) {
  const selected = rules.find((rule) => rule.ruleId === ruleId);
  if (!selected) return null;
  const accountRules = rules
    .filter((rule) => rule.accountId === selected.accountId)
    .sort(
      (left, right) => left.priority - right.priority || left.ruleId.localeCompare(right.ruleId)
    );
  const index = accountRules.findIndex((rule) => rule.ruleId === ruleId);
  const target = direction === 'UP' ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= accountRules.length) return null;
  [accountRules[index], accountRules[target]] = [accountRules[target]!, accountRules[index]!];
  return accountRules.map((rule) => ({ ruleId: rule.ruleId, version: rule.version }));
}

export function mailRuleMoveAvailability(rules: readonly MailRule[], ruleId: string) {
  const selected = rules.find((rule) => rule.ruleId === ruleId);
  if (!selected) return { up: false, down: false };
  const accountRules = rules
    .filter((rule) => rule.accountId === selected.accountId)
    .sort(
      (left, right) => left.priority - right.priority || left.ruleId.localeCompare(right.ruleId)
    );
  const index = accountRules.findIndex((rule) => rule.ruleId === ruleId);
  return { up: index > 0, down: index >= 0 && index < accountRules.length - 1 };
}
