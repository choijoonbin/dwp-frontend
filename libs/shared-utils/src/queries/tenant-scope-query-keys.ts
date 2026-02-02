/**
 * Tenant Scope query keys (순환 참조 방지용 분리)
 */

export const tenantScopeQueryKey = (tenantId: string, profileId?: string | null) =>
  ['synapse', 'admin', 'tenant-scope', tenantId, profileId ?? ''] as const;

export const companyCodesQueryKey = (tenantId: string, profileId?: string | null) =>
  ['synapse', 'admin', 'tenant-scope', 'company-codes', tenantId, profileId ?? ''] as const;

export const currenciesQueryKey = (tenantId: string, profileId?: string | null) =>
  ['synapse', 'admin', 'tenant-scope', 'currencies', tenantId, profileId ?? ''] as const;

export const sodRulesQueryKey = (tenantId: string, profileId?: string | null) =>
  ['synapse', 'admin', 'tenant-scope', 'sod-rules', tenantId, profileId ?? ''] as const;

export const companyCodeCatalogQueryKey = (tenantId: string) =>
  ['synapse', 'admin', 'catalog', 'company-codes', tenantId] as const;

export const currencyCatalogQueryKey = (tenantId: string) =>
  ['synapse', 'admin', 'catalog', 'currencies', tenantId] as const;
