import type { WorkforceAccessPolicy } from '@dwp-frontend/shared-utils';

const EXPIRING_WINDOW_MS = 30 * 24 * 60 * 60 * 1_000;

type WorkforceAccessAction = WorkforceAccessPolicy['actionCodes'][number];
type WorkforceAccessState = WorkforceAccessPolicy['lifecycleState'];
type SearchTermValue = string | readonly string[] | null | undefined;

export type EffectiveWorkforceAccessState = WorkforceAccessState | 'SCHEDULED';

export type WorkforceAccessSummary = {
  active: number;
  userOverrides: number;
  exportEnabled: number;
  expiringSoon: number;
};

export type WorkforceAccessFilters = {
  search: string;
  state: EffectiveWorkforceAccessState | 'ALL';
  operation: WorkforceAccessAction | 'ALL';
};

export type WorkforceAccessSearchTerms = Readonly<Record<string, SearchTermValue>>;

export function effectiveWorkforcePolicyState(
  policy: WorkforceAccessPolicy,
  now = Date.now()
): EffectiveWorkforceAccessState {
  if (policy.lifecycleState !== 'ACTIVE') return policy.lifecycleState;

  if (policy.validTo) {
    const validTo = Date.parse(policy.validTo);
    if (Number.isFinite(validTo) && validTo <= now) return 'EXPIRED';
  }
  if (policy.validFrom) {
    const validFrom = Date.parse(policy.validFrom);
    if (Number.isFinite(validFrom) && validFrom > now) return 'SCHEDULED';
  }
  return 'ACTIVE';
}

export function summarizeWorkforceAccess(
  policies: readonly WorkforceAccessPolicy[],
  now = Date.now()
): WorkforceAccessSummary {
  return policies.reduce<WorkforceAccessSummary>(
    (summary, policy) => {
      if (effectiveWorkforcePolicyState(policy, now) !== 'ACTIVE') return summary;

      summary.active += 1;
      if (policy.subjectType === 'USER') summary.userOverrides += 1;
      if (policy.actionCodes.includes('EXPORT')) summary.exportEnabled += 1;

      if (policy.validTo) {
        const remaining = Date.parse(policy.validTo) - now;
        if (remaining > 0 && remaining <= EXPIRING_WINDOW_MS) summary.expiringSoon += 1;
      }

      return summary;
    },
    { active: 0, userOverrides: 0, exportEnabled: 0, expiringSoon: 0 }
  );
}

function searchTerms(value: SearchTermValue): readonly string[] {
  if (!value) return [];
  return typeof value === 'string' ? [value] : value;
}

function policySearchText(
  policy: WorkforceAccessPolicy,
  searchTermsByPolicy?: WorkforceAccessSearchTerms
) {
  return [
    policy.policyId,
    policy.subjectType,
    policy.subjectRef,
    policy.populationType,
    policy.organizationId,
    policy.organizationName,
    ...policy.fieldGroups,
    ...policy.actionCodes,
    effectiveWorkforcePolicyState(policy),
    policy.justification,
    policy.validFrom,
    policy.validTo,
    ...searchTerms(searchTermsByPolicy?.[policy.policyId]),
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLocaleLowerCase();
}

export function filterWorkforceAccessPolicies(
  policies: readonly WorkforceAccessPolicy[],
  filters: WorkforceAccessFilters,
  searchTermsByPolicy?: WorkforceAccessSearchTerms
): WorkforceAccessPolicy[] {
  const queries = filters.search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);

  return policies.filter((policy) => {
    if (filters.state !== 'ALL' && effectiveWorkforcePolicyState(policy) !== filters.state) {
      return false;
    }
    if (filters.operation !== 'ALL' && !policy.actionCodes.includes(filters.operation)) {
      return false;
    }
    if (queries.length === 0) return true;

    const searchable = policySearchText(policy, searchTermsByPolicy);
    return queries.every((query) => searchable.includes(query));
  });
}
