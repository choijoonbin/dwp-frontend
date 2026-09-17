import type { MailRuleCondition, MailSearchCriteria } from '@dwp-frontend/shared-utils';

export type MailRuleSearchSeed = {
  accountId?: string;
  conditions: MailRuleCondition[];
};

const MAX_RULE_VALUE_LENGTH = 500;

function bounded(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, MAX_RULE_VALUE_LENGTH) : undefined;
}

export function mailSearchRuleSeed(criteria: MailSearchCriteria): MailRuleSearchSeed | null {
  const conditions: MailRuleCondition[] = [];
  const sender = bounded(criteria.from);
  const recipient = bounded(criteria.to);
  const subject = bounded(criteria.query);
  if (sender) conditions.push({ field: 'SENDER', operator: 'CONTAINS', value: sender });
  if (recipient) conditions.push({ field: 'RECIPIENT', operator: 'CONTAINS', value: recipient });
  if (subject) conditions.push({ field: 'SUBJECT', operator: 'CONTAINS', value: subject });
  if (criteria.hasAttachment) {
    conditions.push({ field: 'HAS_ATTACHMENT', operator: 'IS', value: 'true' });
  }
  if (!conditions.length) return null;
  return { accountId: bounded(criteria.accountId), conditions };
}

export function mailSearchRuleHandoffParams(criteria: MailSearchCriteria) {
  const seed = mailSearchRuleSeed(criteria);
  if (!seed) return null;
  const params = new URLSearchParams({ section: 'rules', create: 'from-search' });
  if (seed.accountId) params.set('ruleAccountId', seed.accountId);
  for (const condition of seed.conditions) {
    if (condition.field === 'SENDER') params.set('ruleFrom', condition.value);
    if (condition.field === 'RECIPIENT') params.set('ruleTo', condition.value);
    if (condition.field === 'SUBJECT') params.set('ruleSubject', condition.value);
    if (condition.field === 'HAS_ATTACHMENT') params.set('ruleHasAttachment', 'true');
  }
  return params;
}

export function mailRuleSeedFromSearchParams(params: URLSearchParams) {
  if (params.get('create') !== 'from-search') return null;
  return mailSearchRuleSeed({
    accountId: bounded(params.get('ruleAccountId')),
    from: bounded(params.get('ruleFrom')),
    to: bounded(params.get('ruleTo')),
    query: bounded(params.get('ruleSubject')),
    hasAttachment: params.get('ruleHasAttachment') === 'true',
  });
}

export function clearMailSearchRuleHandoffParams(params: URLSearchParams) {
  const next = new URLSearchParams(params);
  for (const key of [
    'create',
    'ruleAccountId',
    'ruleFrom',
    'ruleTo',
    'ruleSubject',
    'ruleHasAttachment',
  ]) {
    next.delete(key);
  }
  return next;
}
