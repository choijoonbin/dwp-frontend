/**
 * Tenant Scope 조회 (Profile-Scoped API)
 * Mutations는 use-tenant-scope-mutations.ts로 분리
 */

import { useQuery, useQueries } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import {
  sodRulesQueryKey,
  currenciesQueryKey,
  companyCodesQueryKey,
  currencyCatalogQueryKey,
  companyCodeCatalogQueryKey,
} from './tenant-scope-query-keys';
import {
  getCurrencyCatalog,
  type TenantScopeMeta,
  getCompanyCodeCatalog,
  type TenantScopeSodRule,
  getProfileScopedSodRules,
  type TenantScopeCurrency,
  getProfileScopedCurrencies,
  type TenantScopeCompanyCode,
  getProfileScopedCompanyCodes,
} from '../api/synapse-admin-api';

// Re-export keys and mutations for backward compatibility
export {
  sodRulesQueryKey,
  currenciesQueryKey,
  tenantScopeQueryKey,
  companyCodesQueryKey,
  currencyCatalogQueryKey,
  companyCodeCatalogQueryKey,
} from './tenant-scope-query-keys';
export {
  usePatchSodRuleMutation,
  useAddCurrenciesMutation,
  usePatchCurrencyMutation,
  useAddCompanyCodesMutation,
  usePatchCompanyCodeMutation,
} from './use-tenant-scope-mutations';

// ----------------------------------------------------------------------

export type TenantScopeCombinedData = {
  companyCodes: TenantScopeCompanyCode[];
  currencies: TenantScopeCurrency[];
  sodRules: TenantScopeSodRule[];
  meta?: TenantScopeMeta;
};

/**
 * Tenant Scope 조회 (Profile-Scoped API)
 * GET /tenant-scope/company-codes, /currencies, /sod-rules
 */
export const useTenantScopeQuery = (
  options?: { profileId?: string | null; enabled?: boolean }
) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const profileId = options?.profileId;
  const enabled =
    options?.enabled !== false && isAuthenticated && Boolean(tenantId);

  const results = useQueries({
    queries: [
      {
        queryKey: companyCodesQueryKey(tenantId, profileId),
        queryFn: async () => {
          const res = await getProfileScopedCompanyCodes(profileId);
          if (res.data?.items) return res.data;
          throw new Error(res.message || 'Failed to fetch company codes');
        },
        enabled: enabled && Boolean(profileId),
        staleTime: 1 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
      },
      {
        queryKey: currenciesQueryKey(tenantId, profileId),
        queryFn: async () => {
          const res = await getProfileScopedCurrencies(profileId);
          if (res.data?.items) return res.data;
          throw new Error(res.message || 'Failed to fetch currencies');
        },
        enabled: enabled && Boolean(profileId),
        staleTime: 1 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
      },
      {
        queryKey: sodRulesQueryKey(tenantId, profileId),
        queryFn: async () => {
          const res = await getProfileScopedSodRules(profileId);
          if (res.data) return res.data;
          throw new Error(res.message || 'Failed to fetch SoD rules');
        },
        enabled: enabled && Boolean(profileId),
        staleTime: 1 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
      },
    ],
  });

  const [companyCodesRes, currenciesRes, sodRulesRes] = results;
  const ccData = companyCodesRes.data;
  const currData = currenciesRes.data;
  const sodData = sodRulesRes.data;

  const data: TenantScopeCombinedData | undefined =
    ccData?.items && currData?.items && sodData?.rules
      ? {
          companyCodes: ccData.items.map((i) => ({
            bukrs: i.bukrs,
            enabled: i.included,
            bukrsName: i.bukrsName,
            defaultCurrency: i.defaultCurrency,
            isActive: i.isActive,
          })),
          currencies: currData.items.map((i) => ({
            waers: i.currencyCode,
            enabled: i.included,
          })),
          sodRules: sodData.rules.map((r) => ({
            ruleKey: r.ruleKey,
            title: r.title,
            description: r.description,
            enabled: r.isEnabled,
          })),
          meta: { sodMode: sodData.mode },
        }
      : undefined;

  const isLoading = results.some((r) => r.isLoading);
  const error = companyCodesRes.error ?? currenciesRes.error ?? sodRulesRes.error;
  const refetch = async () => {
    await Promise.all(results.map((r) => r.refetch()));
  };

  return {
    data,
    isLoading,
    error,
    refetch,
  };
};

/**
 * Company Code 카탈로그 조회 (Add from catalog)
 */
export const useCompanyCodeCatalogQuery = (options?: { enabled?: boolean }) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = options?.enabled !== false && isAuthenticated && Boolean(tenantId);

  const query = useQuery({
    queryKey: companyCodeCatalogQueryKey(tenantId),
    queryFn: async () => {
      const res = await getCompanyCodeCatalog();
      if (res.data?.companyCodes != null) {
        return res.data.companyCodes;
      }
      throw new Error(res.message || 'Failed to fetch company code catalog');
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

/**
 * Currency 카탈로그 조회 (Add from catalog)
 */
export const useCurrencyCatalogQuery = (options?: { enabled?: boolean }) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = options?.enabled !== false && isAuthenticated && Boolean(tenantId);

  const query = useQuery({
    queryKey: currencyCatalogQueryKey(tenantId),
    queryFn: async () => {
      const res = await getCurrencyCatalog();
      if (res.data?.currencies != null) {
        return res.data.currencies;
      }
      throw new Error(res.message || 'Failed to fetch currency catalog');
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};
