import type { ApprovalPolicy } from '@dwp-frontend/shared-utils';

export type ApprovalPolicyRuleEditorEntry = Readonly<{
  key: string;
  kind: 'boolean' | 'number' | 'string' | 'structured';
  value: unknown;
}>;

export type ApprovalPolicyComparisonRow = Readonly<{
  key: string;
  field: 'enforcement' | 'severity' | 'lifecycle' | 'rule';
  ruleKey?: string;
  current: unknown;
  proposed: unknown;
  changed: boolean;
}>;

export type ApprovalPolicyDraft = Readonly<{
  enforcementMode: string;
  severity: string;
  lifecycleState: string;
  rules: readonly ApprovalPolicyRuleEditorEntry[];
  changeReason: string;
}>;

function canonicalPolicyValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalPolicyValue);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalPolicyValue(entry)])
  );
}

export function approvalPolicyValuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalPolicyValue(left)) === JSON.stringify(canonicalPolicyValue(right));
}

export function isApprovalPolicySourceCurrent(
  original: ApprovalPolicy | null | undefined,
  current: ApprovalPolicy | null | undefined
): boolean {
  return Boolean(
    original &&
    current &&
    Number.isSafeInteger(original.version) &&
    original.version >= 0 &&
    approvalPolicyValuesEqual(original, current)
  );
}

export function buildApprovalPolicyComparisonRows(
  policy: ApprovalPolicy
): ApprovalPolicyComparisonRow[] {
  const pendingRule = policy.pendingReview ? policy.pendingRule : policy.rule;
  const ruleKeys = Array.from(
    new Set([...Object.keys(policy.rule), ...Object.keys(pendingRule)])
  ).sort((left, right) => left.localeCompare(right));
  const values = [
    {
      key: 'enforcement',
      field: 'enforcement' as const,
      current: policy.enforcementMode,
      proposed: policy.pendingReview
        ? (policy.pendingEnforcementMode ?? policy.enforcementMode)
        : policy.enforcementMode,
    },
    {
      key: 'severity',
      field: 'severity' as const,
      current: policy.severity,
      proposed: policy.pendingReview
        ? (policy.pendingSeverity ?? policy.severity)
        : policy.severity,
    },
    {
      key: 'lifecycle',
      field: 'lifecycle' as const,
      current: policy.lifecycleState,
      proposed: policy.pendingReview
        ? (policy.pendingLifecycleState ?? policy.lifecycleState)
        : policy.lifecycleState,
    },
    ...ruleKeys.map((ruleKey) => ({
      key: `rule-${ruleKey}`,
      field: 'rule' as const,
      ruleKey,
      current: policy.rule[ruleKey],
      proposed: pendingRule[ruleKey],
    })),
  ];
  return values.map((value) => ({
    ...value,
    changed: !approvalPolicyValuesEqual(value.current, value.proposed),
  }));
}

export function approvalPolicyRuleEditorEntries(
  rule: Record<string, unknown>
): ApprovalPolicyRuleEditorEntry[] {
  return Object.entries(rule)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({
      key,
      kind:
        typeof value === 'boolean'
          ? 'boolean'
          : typeof value === 'number'
            ? 'number'
            : typeof value === 'string'
              ? 'string'
              : 'structured',
      value,
    }));
}

export function approvalPolicyRuleInput(
  entries: readonly ApprovalPolicyRuleEditorEntry[]
): Record<string, unknown> {
  return Object.fromEntries(entries.map((entry) => [entry.key, entry.value]));
}

export function createApprovalPolicyDraft(policy: ApprovalPolicy): ApprovalPolicyDraft {
  return {
    enforcementMode: policy.pendingReview
      ? (policy.pendingEnforcementMode ?? policy.enforcementMode)
      : policy.enforcementMode,
    severity: policy.pendingReview ? (policy.pendingSeverity ?? policy.severity) : policy.severity,
    lifecycleState: policy.pendingReview
      ? (policy.pendingLifecycleState ?? policy.lifecycleState)
      : policy.lifecycleState,
    rules: approvalPolicyRuleEditorEntries(policy.pendingReview ? policy.pendingRule : policy.rule),
    changeReason: policy.pendingReview ? (policy.pendingChangeReason ?? '') : '',
  };
}

export function isApprovalPolicyDraftValid(draft: ApprovalPolicyDraft): boolean {
  return (
    draft.changeReason.trim().length >= 10 &&
    draft.rules.every(
      (entry) =>
        entry.key.trim().length > 0 && (entry.kind !== 'number' || Number.isFinite(entry.value))
    )
  );
}

export function isApprovalPolicyMakerBlocked(
  policy: ApprovalPolicy | null | undefined,
  actorId: string | null | undefined
): boolean {
  return Boolean(
    policy?.pendingReview &&
    policy.pendingBy != null &&
    actorId &&
    String(policy.pendingBy) === actorId
  );
}
