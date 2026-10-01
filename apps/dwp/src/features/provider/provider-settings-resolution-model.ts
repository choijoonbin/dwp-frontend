import type { ProviderSettingApplicationState } from '@dwp-frontend/shared-utils/api/provider-settings-api';
import type { ProviderTenant } from '@dwp-frontend/shared-utils';

export type ProviderSettingStateTone = 'default' | 'info' | 'success' | 'warning' | 'error';

export function providerSettingStateTone(
  state: ProviderSettingApplicationState
): ProviderSettingStateTone {
  if (state === 'CONVERGED') return 'success';
  if (state === 'DRIFTED' || state === 'FAILED') return 'error';
  if (state === 'APPLYING' || state === 'OBSERVATION_UNSUPPORTED') return 'info';
  if (
    [
      'APPROVAL_PENDING',
      'READY_TO_PUBLISH',
      'PUBLISH_PENDING',
      'PUBLISHED_UNOBSERVED',
      'PARTIAL',
      'OBSERVATION_STALE',
    ].includes(state)
  ) {
    return 'warning';
  }
  return 'default';
}

export type ProviderSettingValuePresentation =
  | { kind: 'unavailable' }
  | { kind: 'scalar'; value: string }
  | { kind: 'collection'; collection: 'OBJECT' | 'ARRAY'; count: number };

export function providerSettingValuePresentation(value: unknown): ProviderSettingValuePresentation {
  if (value === null || value === undefined) return { kind: 'unavailable' };
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return { kind: 'scalar', value: String(value) };
  }
  if (Array.isArray(value)) return { kind: 'collection', collection: 'ARRAY', count: value.length };
  if (typeof value === 'object') {
    return { kind: 'collection', collection: 'OBJECT', count: Object.keys(value).length };
  }
  return { kind: 'unavailable' };
}

const METADATA_VALUES = {
  valueType: ['BOOLEAN', 'STRING', 'NUMBER', 'OBJECT', 'ARRAY', 'JSON'],
  riskTier: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
  workflow: ['DIRECT', 'REVIEW_AND_PUBLISH', 'APPROVE_AND_ACTIVATE', 'OWNER_MANAGED'],
  lifecycle: ['ACTIVE', 'DEPRECATED', 'UNAVAILABLE'],
  resolutionReason: [
    'SETTING_NOT_REGISTERED',
    'SCOPE_NOT_SUPPORTED_BY_OWNER',
    'VALUE_REDACTED_BY_SENSITIVITY',
    'OWNER_VALUE_RESOLVED',
  ],
  sourceType: [
    'DEFAULT',
    'PROVIDER_POLICY',
    'TENANT_POLICY',
    'USER_PREFERENCE',
    'ACTIVE_ROLLOUT',
    'APPLICATION_OVERRIDE',
  ],
  decisionCode: ['DEFAULT', 'TARGET_MISS', 'PERCENTAGE_EXCLUDED', 'ROLLOUT_MATCH'],
} as const;

export type ProviderSettingMetadataKind = keyof typeof METADATA_VALUES;

export function providerSettingMetadataPresentation(
  kind: ProviderSettingMetadataKind,
  value: string
): string {
  return (METADATA_VALUES[kind] as readonly string[]).includes(value) ? value : 'UNAVAILABLE_VALUE';
}

const WORKFLOW_STATE_VALUES = {
  resolution: [
    'RESOLVED',
    'REDACTED',
    'UNSUPPORTED_SETTING',
    'UNSUPPORTED_SCOPE',
    'VALUE_UNAVAILABLE',
  ],
  desired: [
    'NONE',
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'PUBLISH_REQUESTED',
    'PUBLISHED',
    'FAILED',
  ],
  application: [
    'NOT_CONFIGURED',
    'DRAFT',
    'APPROVAL_PENDING',
    'READY_TO_PUBLISH',
    'PUBLISH_PENDING',
    'OBSERVATION_UNSUPPORTED',
    'PUBLISHED_UNOBSERVED',
    'APPLYING',
    'CONVERGED',
    'PARTIAL',
    'DRIFTED',
    'FAILED',
    'OBSERVATION_STALE',
  ],
} as const;

export type ProviderSettingWorkflowStateKind = keyof typeof WORKFLOW_STATE_VALUES;

export function providerSettingWorkflowStatePresentation(
  kind: ProviderSettingWorkflowStateKind,
  value: string
): string {
  return (WORKFLOW_STATE_VALUES[kind] as readonly string[]).includes(value)
    ? value
    : 'UNAVAILABLE_STATE';
}

export function providerSettingManagementPath(path: string): string | null {
  const normalized = path.trim();
  return normalized === '/provider' || normalized.startsWith('/provider/') ? normalized : null;
}

export type ProviderSettingTenantTarget = Pick<ProviderTenant, 'tenantId' | 'environmentKey'>;

export function resolveProviderSettingTenantTarget(
  selectedTenantId: string,
  selectedTenant: ProviderSettingTenantTarget | null,
  listedTenants: readonly ProviderSettingTenantTarget[]
): ProviderSettingTenantTarget | undefined {
  if (selectedTenant?.tenantId === selectedTenantId) return selectedTenant;
  return listedTenants.find((tenant) => tenant.tenantId === selectedTenantId) ?? listedTenants[0];
}
