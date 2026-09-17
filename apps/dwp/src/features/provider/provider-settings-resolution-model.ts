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

export function displayProviderSettingValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  const serialized = JSON.stringify(value, null, 2);
  return serialized ?? String(value);
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
