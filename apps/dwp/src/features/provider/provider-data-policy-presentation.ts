import type { ProviderDataPolicy } from '@dwp-frontend/shared-utils';

export type ProviderPolicyRuleFact = {
  field: string;
  text?: string;
  items?: string[];
  translationKey?: string;
};

const CLASSIFICATIONS = new Set(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']);
const DELETION_MODES = new Set(['SOFT_DELETE', 'HARD_DELETE', 'ANONYMIZE']);
const HANDLING_MODES = new Set(['MASK', 'DENY', 'TOKENIZE']);
const POLICY_TYPES = new Set([
  'CLASSIFICATION',
  'MINIMIZATION',
  'RESIDENCY',
  'RETENTION',
  'DELETION',
  'LEGAL_HOLD',
  'RESTRICTED_FIELD',
  'TENANT_RLS',
]);
const POLICY_SCOPES = new Set(['GLOBAL', 'DATABASE', 'ASSET']);
const IMPACT_CODES = new Set([
  'SCOPE_HAS_NO_LIVE_ASSETS',
  'RESTRICTED_FIELDS_NOT_FOUND',
  'MINIMIZATION_FIELDS_NOT_FOUND',
  'NO_TENANT_SCOPED_ASSETS',
  'TENANT_COLUMN_MISSING',
  'NON_TENANT_ASSETS_EXCLUDED',
  'RUNTIME_RESIDENCY_ADAPTER_REQUIRES_R3_04',
  'DELETION_WORKER_REQUIRES_APPROVED_INFRASTRUCTURE',
  'ACTIVE_LEGAL_HOLD',
]);

function stringList(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : null;
}

export function providerPolicyRuleFacts(
  type: ProviderDataPolicy['policyType'],
  rule: Record<string, unknown>
): ProviderPolicyRuleFact[] | null {
  switch (type) {
    case 'CLASSIFICATION':
      return typeof rule.classification === 'string' && CLASSIFICATIONS.has(rule.classification)
        ? [
            {
              field: 'classification',
              translationKey: `dataGovernance.classification.${rule.classification}`,
            },
          ]
        : null;
    case 'MINIMIZATION': {
      const items = stringList(rule.allowedFields);
      return items && typeof rule.purpose === 'string'
        ? [
            { field: 'allowedFields', items },
            { field: 'purpose', text: rule.purpose },
          ]
        : null;
    }
    case 'RESIDENCY': {
      const items = stringList(rule.allowedRegions);
      return items ? [{ field: 'allowedRegions', items }] : null;
    }
    case 'RETENTION':
      return typeof rule.retentionDays === 'number'
        ? [{ field: 'retentionDays', text: String(rule.retentionDays) }]
        : null;
    case 'DELETION':
      return typeof rule.deletionSlaDays === 'number' &&
        typeof rule.mode === 'string' &&
        DELETION_MODES.has(rule.mode)
        ? [
            { field: 'deletionSlaDays', text: String(rule.deletionSlaDays) },
            {
              field: 'deletionMode',
              translationKey: `dataGovernance.policy.deletionModes.${rule.mode}`,
            },
          ]
        : null;
    case 'LEGAL_HOLD':
      return typeof rule.holdKey === 'string' && typeof rule.active === 'boolean'
        ? [
            { field: 'holdKey', text: rule.holdKey },
            {
              field: 'holdActive',
              translationKey: rule.active
                ? 'dataGovernance.policy.boolean.active'
                : 'dataGovernance.policy.boolean.inactive',
            },
          ]
        : null;
    case 'RESTRICTED_FIELD': {
      const items = stringList(rule.fields);
      return items && typeof rule.handling === 'string' && HANDLING_MODES.has(rule.handling)
        ? [
            { field: 'restrictedFields', items },
            {
              field: 'handling',
              translationKey: `dataGovernance.policy.handling.${rule.handling}`,
            },
          ]
        : null;
    }
    case 'TENANT_RLS': {
      const items = stringList(rule.tenantColumns);
      return items && rule.enforcement === 'REQUIRED'
        ? [
            { field: 'tenantColumns', items },
            { field: 'enforcement', translationKey: 'dataGovernance.policy.enforcement.REQUIRED' },
          ]
        : null;
    }
  }
}

export function providerPolicyImpactCode(value: string): { code: string; detail: string } | null {
  const [code, ...details] = value.split(':');
  return IMPACT_CODES.has(code) ? { code, detail: details.join(':') } : null;
}

export function providerPolicyTypePresentation(value: string): string {
  return POLICY_TYPES.has(value) ? value : 'UNKNOWN';
}

export function providerPolicyScopePresentation(value: string): string {
  return POLICY_SCOPES.has(value) ? value : 'UNKNOWN';
}
