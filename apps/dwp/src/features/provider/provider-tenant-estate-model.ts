import type { ProviderEstateOverview, ProviderTenant } from '@dwp-frontend/shared-utils';
import type { GridPaginationModel } from '@mui/x-data-grid';

export const PROVIDER_TENANT_LIFECYCLE_STATES = [
  'ALL',
  'PROVISIONING',
  'ACTIVE',
  'SUSPENDED',
  'RETIRED',
] as const;
export const PROVIDER_TENANT_SERVICE_TIERS = [
  'ALL',
  'STANDARD',
  'ENTERPRISE',
  'REGULATED',
] as const;
export const PROVIDER_TENANT_ISOLATION_MODELS = ['ALL', 'POOL', 'BRIDGE', 'SILO'] as const;
export const PROVIDER_TENANT_PAGE_SIZES = [25, 50, 100] as const;

export function providerTenantPagination(
  pageValue: string | null,
  sizeValue: string | null
): GridPaginationModel {
  const requestedPage = Number(pageValue);
  const requestedSize = Number(sizeValue);
  return {
    page: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage - 1 : 0,
    pageSize: PROVIDER_TENANT_PAGE_SIZES.includes(
      requestedSize as (typeof PROVIDER_TENANT_PAGE_SIZES)[number]
    )
      ? requestedSize
      : 25,
  };
}

export function providerTenantServiceHealth(tenant: ProviderTenant): string {
  if (tenant.services.some((service) => service.lifecycleState === 'FAILED')) return 'FAILED';
  if (tenant.services.some((service) => service.lifecycleState === 'DEGRADED')) return 'DEGRADED';
  if (tenant.services.some((service) => service.lifecycleState === 'PROVISIONING')) {
    return 'PROVISIONING';
  }
  return 'READY';
}

export function providerEstateState(
  estate: ProviderEstateOverview | null | undefined
): 'CRITICAL' | 'ATTENTION' | 'HEALTHY' {
  if (estate?.failedTenants) return 'CRITICAL';
  if (estate?.provisioningTenants || estate?.suspendedTenants) return 'ATTENTION';
  return 'HEALTHY';
}
