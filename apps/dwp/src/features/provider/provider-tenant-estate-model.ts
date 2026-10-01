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

export type ProviderTenantServiceHealth =
  'FAILED' | 'DEGRADED' | 'PROVISIONING' | 'SUSPENDED' | 'RETIRED' | 'READY' | 'UNAVAILABLE';

export function providerTenantServiceHealth(tenant: ProviderTenant): ProviderTenantServiceHealth {
  if (tenant.services.some((service) => service.lifecycleState === 'FAILED')) return 'FAILED';
  if (tenant.services.some((service) => service.lifecycleState === 'DEGRADED')) return 'DEGRADED';
  if (tenant.services.some((service) => service.lifecycleState === 'PROVISIONING')) {
    return 'PROVISIONING';
  }
  if (tenant.services.some((service) => service.lifecycleState === 'SUSPENDED')) return 'SUSPENDED';
  if (tenant.services.some((service) => service.lifecycleState === 'RETIRED')) return 'RETIRED';
  return tenant.services.length > 0 &&
    tenant.services.every((service) => service.lifecycleState === 'READY')
    ? 'READY'
    : 'UNAVAILABLE';
}

export function providerEstateState(
  estate: ProviderEstateOverview | null | undefined
): 'CRITICAL' | 'ATTENTION' | 'HEALTHY' | 'UNAVAILABLE' {
  if (!estate) return 'UNAVAILABLE';
  const counts = [
    estate.organizations,
    estate.tenants,
    estate.activeTenants,
    estate.provisioningTenants,
    estate.suspendedTenants,
    estate.failedTenants,
    estate.openOperations,
    estate.activeSupportSessions,
  ];
  const lifecycleCoverage =
    estate.activeTenants + estate.provisioningTenants + estate.suspendedTenants;
  if (
    counts.some((count) => !Number.isSafeInteger(count) || count < 0) ||
    lifecycleCoverage !== estate.tenants
  ) {
    return 'UNAVAILABLE';
  }
  if (estate.failedTenants) return 'CRITICAL';
  if (estate.provisioningTenants || estate.suspendedTenants) return 'ATTENTION';
  return 'HEALTHY';
}
