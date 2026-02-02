import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import {
  getPiiPolicies,
  getAdminProfiles,
  getDataProtection,
  putDataProtection,
  putPiiPoliciesBulk,
  type PiiPolicyItem,
  getPiiFieldsCatalog,
  type DataProtectionDto,
} from '../api/synapse-admin-api';

// ----------------------------------------------------------------------

export const adminProfilesQueryKey = (tenantId: string) =>
  ['synapse', 'admin', 'profiles', tenantId] as const;

export const piiCatalogQueryKey = (tenantId: string) =>
  ['synapse', 'admin', 'pii-catalog', tenantId] as const;

export const piiPoliciesQueryKey = (tenantId: string, profileId: string) =>
  ['synapse', 'admin', 'pii-policies', tenantId, profileId] as const;

export const dataProtectionQueryKey = (tenantId: string, profileId: string) =>
  ['synapse', 'admin', 'data-protection', tenantId, profileId] as const;

// ----------------------------------------------------------------------

export const useAdminProfilesQuery = (options?: { enabled?: boolean }) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = options?.enabled !== false && isAuthenticated && Boolean(tenantId);

  const query = useQuery({
    queryKey: adminProfilesQueryKey(tenantId),
    queryFn: async () => {
      const res = await getAdminProfiles();
      if (res.data) return res.data;
      throw new Error(res.message || 'Failed to fetch profiles');
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

export const usePiiCatalogQuery = (options?: { enabled?: boolean }) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = options?.enabled !== false && isAuthenticated && Boolean(tenantId);

  const query = useQuery({
    queryKey: piiCatalogQueryKey(tenantId),
    queryFn: async () => {
      const res = await getPiiFieldsCatalog();
      if (res.data) return res.data;
      throw new Error(res.message || 'Failed to fetch PII catalog');
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

export const usePiiPoliciesQuery = (
  profileId: string | null,
  options?: { enabled?: boolean }
) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled =
    options?.enabled !== false &&
    isAuthenticated &&
    Boolean(tenantId) &&
    Boolean(profileId);

  const query = useQuery({
    queryKey: piiPoliciesQueryKey(tenantId, profileId ?? ''),
    queryFn: async () => {
      const res = await getPiiPolicies(profileId!);
      if (res.data) return res.data;
      throw new Error(res.message || 'Failed to fetch PII policies');
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

export const usePutPiiPoliciesBulkMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async ({
      profileId,
      policies,
    }: {
      profileId: string;
      policies: PiiPolicyItem[];
    }) => {
      const res = await putPiiPoliciesBulk({ profileId, policies });
      if (res.status === 'SUCCESS' || res.data?.success === true) {
        return res.data ?? { success: true };
      }
      throw new Error(res.message || 'Failed to save PII policies');
    },
    onSuccess: (_, { profileId }) => {
      queryClient.invalidateQueries({
        queryKey: piiPoliciesQueryKey(tenantId, profileId),
      });
    },
  });
};

export const useDataProtectionQuery = (
  profileId: string | null,
  options?: { enabled?: boolean }
) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled =
    options?.enabled !== false &&
    isAuthenticated &&
    Boolean(tenantId) &&
    Boolean(profileId);

  const query = useQuery({
    queryKey: dataProtectionQueryKey(tenantId, profileId ?? ''),
    queryFn: async () => {
      const res = await getDataProtection(profileId!);
      if (res.data) return res.data;
      throw new Error(res.message || 'Failed to fetch data protection');
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

export const usePutDataProtectionMutation = () => {
  const queryClient = useQueryClient();
  const tenantId = getTenantId();

  return useMutation({
    mutationFn: async ({
      profileId,
      payload,
    }: {
      profileId: string;
      payload: DataProtectionDto;
    }) => {
      const res = await putDataProtection(profileId, payload);
      if (res.status === 'SUCCESS' || res.data?.success === true) {
        return res.data ?? { success: true };
      }
      throw new Error(res.message || 'Failed to save data protection');
    },
    onSuccess: (_, { profileId }) => {
      queryClient.invalidateQueries({
        queryKey: dataProtectionQueryKey(tenantId, profileId),
      });
    },
  });
};
