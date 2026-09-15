import type { ApprovalPolicy, ApprovalPolicyCreateInput } from '@dwp-frontend/shared-utils';

export const APPROVAL_POLICY_CREATE_TYPES = [
  'IDENTITY',
  'DECISION',
  'SLA',
  'DATA',
  'SEGREGATION_OF_DUTIES',
] as const;
export const APPROVAL_POLICY_CREATE_ENFORCEMENT_MODES = ['BLOCK', 'WARN', 'MONITOR'] as const;
export const APPROVAL_POLICY_CREATE_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export const APPROVAL_POLICY_CREATE_LIFECYCLE_STATES = ['ACTIVE', 'DISABLED', 'RETIRED'] as const;
export const APPROVAL_POLICY_CREATE_RULE_KINDS = ['BOOLEAN', 'INTEGER', 'STRING', 'JSON'] as const;

export type ApprovalPolicyCreateRuleKind = (typeof APPROVAL_POLICY_CREATE_RULE_KINDS)[number];

export type ApprovalPolicyCreateRuleDraft = Readonly<{
  id: string;
  key: string;
  kind: ApprovalPolicyCreateRuleKind;
  value: string;
}>;

export type ApprovalPolicyCreateDraft = Readonly<{
  policyKey: string;
  nameKo: string;
  nameEn: string;
  policyType: ApprovalPolicyCreateInput['policyType'];
  enforcementMode: ApprovalPolicyCreateInput['enforcementMode'];
  severity: ApprovalPolicyCreateInput['severity'];
  lifecycleState: ApprovalPolicyCreateInput['lifecycleState'];
  rules: readonly ApprovalPolicyCreateRuleDraft[];
  changeReason: string;
}>;

export type ApprovalPolicyCreateIssueCode =
  'REQUIRED' | 'FORMAT' | 'TOO_LONG' | 'DUPLICATE' | 'INVALID_VALUE' | 'TOO_MANY' | 'TOO_LARGE';

export type ApprovalPolicyCreateIssue = Readonly<{
  path: string;
  code: ApprovalPolicyCreateIssueCode;
}>;

export type ApprovalPolicyCreateValidation = Readonly<{
  input: ApprovalPolicyCreateInput | null;
  issues: readonly ApprovalPolicyCreateIssue[];
}>;

const POLICY_KEY = /^[A-Z][A-Z0-9_.-]{2,99}$/u;
const RULE_KEY = /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/u;

export function newApprovalPolicyCreateRule(
  kind: ApprovalPolicyCreateRuleKind = 'BOOLEAN'
): ApprovalPolicyCreateRuleDraft {
  return {
    id: crypto.randomUUID(),
    key: '',
    kind,
    value: kind === 'BOOLEAN' ? 'true' : kind === 'JSON' ? '{}' : '',
  };
}

export function emptyApprovalPolicyCreateDraft(): ApprovalPolicyCreateDraft {
  return {
    policyKey: '',
    nameKo: '',
    nameEn: '',
    policyType: 'SEGREGATION_OF_DUTIES',
    enforcementMode: 'BLOCK',
    severity: 'HIGH',
    lifecycleState: 'ACTIVE',
    rules: [newApprovalPolicyCreateRule()],
    changeReason: '',
  };
}

function safeRuleValue(value: unknown, depth: number): boolean {
  if (depth > 8) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isSafeInteger(value);
  if (Array.isArray(value)) {
    return value.length <= 100 && value.every((entry) => safeRuleValue(entry, depth + 1));
  }
  if (!value || typeof value !== 'object') return false;
  const entries = Object.entries(value as Record<string, unknown>);
  return (
    entries.length <= 64 &&
    entries.every(([key, entry]) => RULE_KEY.test(key) && safeRuleValue(entry, depth + 1))
  );
}

function ruleValue(rule: ApprovalPolicyCreateRuleDraft): unknown | typeof INVALID {
  if (rule.kind === 'BOOLEAN') {
    return rule.value === 'true' ? true : rule.value === 'false' ? false : INVALID;
  }
  if (rule.kind === 'INTEGER') {
    if (!/^-?(?:0|[1-9][0-9]*)$/u.test(rule.value)) return INVALID;
    const value = Number(rule.value);
    return Number.isSafeInteger(value) ? value : INVALID;
  }
  if (rule.kind === 'STRING') return rule.value;
  try {
    const value: unknown = JSON.parse(rule.value);
    return (Array.isArray(value) || (value !== null && typeof value === 'object')) &&
      safeRuleValue(value, 1)
      ? value
      : INVALID;
  } catch {
    return INVALID;
  }
}

const INVALID = Symbol('approval-policy-rule-invalid');

function issue(
  issues: ApprovalPolicyCreateIssue[],
  path: string,
  code: ApprovalPolicyCreateIssueCode
) {
  issues.push({ path, code });
}

function validateText(
  issues: ApprovalPolicyCreateIssue[],
  path: string,
  value: string,
  max: number,
  min = 1
): string {
  const normalized = value.trim();
  if (normalized.length < min) issue(issues, path, 'REQUIRED');
  else if (normalized.length > max) issue(issues, path, 'TOO_LONG');
  return normalized;
}

export function validateApprovalPolicyCreateDraft(
  draft: ApprovalPolicyCreateDraft,
  policies: readonly Pick<ApprovalPolicy, 'policyKey'>[]
): ApprovalPolicyCreateValidation {
  const issues: ApprovalPolicyCreateIssue[] = [];
  const policyKey = draft.policyKey.trim().toUpperCase();
  if (!policyKey) issue(issues, 'policyKey', 'REQUIRED');
  else if (!POLICY_KEY.test(policyKey)) issue(issues, 'policyKey', 'FORMAT');
  else if (policies.some((policy) => policy.policyKey.trim().toUpperCase() === policyKey)) {
    issue(issues, 'policyKey', 'DUPLICATE');
  }
  const nameKo = validateText(issues, 'nameKo', draft.nameKo, 200);
  const nameEn = validateText(issues, 'nameEn', draft.nameEn, 200);
  const changeReason = validateText(issues, 'changeReason', draft.changeReason, 1000, 10);

  if (!APPROVAL_POLICY_CREATE_TYPES.includes(draft.policyType)) {
    issue(issues, 'policyType', 'INVALID_VALUE');
  }
  if (!APPROVAL_POLICY_CREATE_ENFORCEMENT_MODES.includes(draft.enforcementMode)) {
    issue(issues, 'enforcementMode', 'INVALID_VALUE');
  }
  if (!APPROVAL_POLICY_CREATE_SEVERITIES.includes(draft.severity)) {
    issue(issues, 'severity', 'INVALID_VALUE');
  }
  if (!APPROVAL_POLICY_CREATE_LIFECYCLE_STATES.includes(draft.lifecycleState)) {
    issue(issues, 'lifecycleState', 'INVALID_VALUE');
  }

  if (draft.rules.length < 1) issue(issues, 'rules', 'REQUIRED');
  if (draft.rules.length > 64) issue(issues, 'rules', 'TOO_MANY');
  const rule: Record<string, unknown> = {};
  const keys = new Set<string>();
  for (const entry of draft.rules) {
    const key = entry.key.trim();
    if (!key) issue(issues, `rules.${entry.id}.key`, 'REQUIRED');
    else if (!RULE_KEY.test(key)) issue(issues, `rules.${entry.id}.key`, 'FORMAT');
    else if (keys.has(key)) issue(issues, `rules.${entry.id}.key`, 'DUPLICATE');
    keys.add(key);
    const value = ruleValue(entry);
    if (value === INVALID) issue(issues, `rules.${entry.id}.value`, 'INVALID_VALUE');
    else if (key && RULE_KEY.test(key) && !Object.prototype.hasOwnProperty.call(rule, key)) {
      rule[key] = value;
    }
  }
  if (new TextEncoder().encode(JSON.stringify(rule)).byteLength > 65_536) {
    issue(issues, 'rules', 'TOO_LARGE');
  }

  if (issues.length) return { input: null, issues };
  return {
    input: {
      policyKey,
      nameKo,
      nameEn,
      policyType: draft.policyType,
      enforcementMode: draft.enforcementMode,
      severity: draft.severity,
      lifecycleState: draft.lifecycleState,
      rule,
      changeReason,
    },
    issues,
  };
}

export function approvalPolicyCreateIssue(
  validation: ApprovalPolicyCreateValidation,
  path: string
): ApprovalPolicyCreateIssueCode | undefined {
  return validation.issues.find((candidate) => candidate.path === path)?.code;
}
