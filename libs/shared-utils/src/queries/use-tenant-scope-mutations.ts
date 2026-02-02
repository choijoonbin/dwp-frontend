/**
 * Tenant Scope mutations (Profile-Scoped bulk API)
 * 분리 목적: use-tenant-scope-query.ts 400줄 이하 유지
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import {
  sodRulesQueryKey,
  currenciesQueryKey,
  companyCodesQueryKey,
} from './tenant-scope-query-keys';
import {
  putProfileScopedSodRulesBulk,
  putProfileScopedCurrenciesBulk,
  putProfileScopedCompanyCodesBulk,
} from '../api/synapse-admin-api';

// ----------------------------------------------------------------------

export const usePatchCompanyCodeMutation = (profileId?: string | null) => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async ({
      bukrs,
      enabled,
      currentItems,
    }: {
      bukrs: string;
      enabled: boolean;
      currentItems: { bukrs: string; enabled: boolean }[];
    }) => {
      if (!profileId) throw new Error('Profile required');
      const updates = currentItems.map((i) => ({
        bukrs: i.bukrs,
        included: i.bukrs === bukrs ? enabled : i.enabled,
      }));
      const res = await putProfileScopedCompanyCodesBulk(profileId, updates);
      if (res.status === 'SUCCESS' || res.success === true) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to update company code');
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.setQueryData(companyCodesQueryKey(tenantId, profileId), data);
      } else {
        queryClient.invalidateQueries({
          queryKey: companyCodesQueryKey(tenantId, profileId),
        });
      }
    },
  });
};

export const usePatchCurrencyMutation = (profileId?: string | null) => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async ({
      waers,
      enabled,
      currentItems,
    }: {
      waers: string;
      enabled: boolean;
      currentItems: { waers: string; enabled: boolean }[];
      fxControlMode?: string;
    }) => {
      if (!profileId) throw new Error('Profile required');
      const updates = currentItems.map((i) => ({
        currencyCode: i.waers,
        included: i.waers === waers ? enabled : i.enabled,
      }));
      const res = await putProfileScopedCurrenciesBulk(profileId, updates);
      if (res.status === 'SUCCESS' || res.success === true) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to update currency');
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.setQueryData(currenciesQueryKey(tenantId, profileId), data);
      } else {
        queryClient.invalidateQueries({
          queryKey: currenciesQueryKey(tenantId, profileId),
        });
      }
    },
  });
};

export const usePatchSodRuleMutation = (profileId?: string | null) => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async ({
      ruleKey,
      enabled,
      currentItems,
    }: {
      ruleKey: string;
      enabled: boolean;
      currentItems: { ruleKey: string; enabled: boolean }[];
      severity?: string;
    }) => {
      if (!profileId) throw new Error('Profile required');
      const updates = currentItems.map((i) => ({
        ruleKey: i.ruleKey,
        isEnabled: i.ruleKey === ruleKey ? enabled : i.enabled,
      }));
      const res = await putProfileScopedSodRulesBulk(profileId, updates);
      if (res.status === 'SUCCESS' || res.success === true) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to update SoD rule');
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.setQueryData(sodRulesQueryKey(tenantId, profileId), data);
      } else {
        queryClient.invalidateQueries({
          queryKey: sodRulesQueryKey(tenantId, profileId),
        });
      }
    },
  });
};

export const useAddCompanyCodesMutation = (profileId?: string | null) => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async ({
      bukrsList,
      currentItems,
    }: {
      bukrsList: string[];
      currentItems: { bukrs: string; enabled: boolean }[];
    }) => {
      if (!profileId) throw new Error('Profile required');
      const existingKeys = new Set(currentItems.map((i) => i.bukrs));
      const updates = [
        ...currentItems.map((i) => ({ bukrs: i.bukrs, included: i.enabled })),
        ...bukrsList.filter((b) => !existingKeys.has(b)).map((bukrs) => ({ bukrs, included: true })),
      ];
      const res = await putProfileScopedCompanyCodesBulk(profileId, updates);
      if (res.status === 'SUCCESS' || res.success === true) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to add company codes');
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.setQueryData(companyCodesQueryKey(tenantId, profileId), data);
      } else {
        queryClient.invalidateQueries({
          queryKey: companyCodesQueryKey(tenantId, profileId),
        });
      }
    },
  });
};

export const useAddCurrenciesMutation = (profileId?: string | null) => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async ({
      waersList,
      currentItems,
    }: {
      waersList: string[];
      currentItems: { waers: string; enabled: boolean }[];
    }) => {
      if (!profileId) throw new Error('Profile required');
      const existingKeys = new Set(currentItems.map((i) => i.waers));
      const updates = [
        ...currentItems.map((i) => ({ currencyCode: i.waers, included: i.enabled })),
        ...waersList.filter((w) => !existingKeys.has(w)).map((currencyCode) => ({ currencyCode, included: true })),
      ];
      const res = await putProfileScopedCurrenciesBulk(profileId, updates);
      if (res.status === 'SUCCESS' || res.success === true) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to add currencies');
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.setQueryData(currenciesQueryKey(tenantId, profileId), data);
      } else {
        queryClient.invalidateQueries({
          queryKey: currenciesQueryKey(tenantId, profileId),
        });
      }
    },
  });
};
