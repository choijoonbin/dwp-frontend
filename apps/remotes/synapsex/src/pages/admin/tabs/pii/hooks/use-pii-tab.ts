import { useMemo, useState } from 'react';
import {
  usePiiCatalogQuery,
  usePiiPoliciesQuery,
  useAdminProfilesQuery,
  useDataProtectionQuery,
} from '@dwp-frontend/shared-utils';

/**
 * PII & Encryption 탭용 통합 훅.
 * profileId 선택, catalog, policies, dataProtection 조합.
 */
export const usePiiTab = (options?: { enabled?: boolean }) => {
  const [profileId, setProfileId] = useState<string | null>(null);

  const {
    data: profiles,
    isLoading: profilesLoading,
    error: profilesError,
    refetch: refetchProfiles,
  } = useAdminProfilesQuery({
    enabled: options?.enabled !== false,
  });

  const effectiveProfileId = useMemo(() => {
    if (profileId) return profileId;
    const defaultProfile = profiles?.find((p) => p.isDefault);
    return defaultProfile?.id ?? profiles?.[0]?.id ?? null;
  }, [profileId, profiles]);

  const {
    data: catalog,
    isLoading: catalogLoading,
    error: catalogError,
    refetch: refetchCatalog,
  } = usePiiCatalogQuery({
    enabled: options?.enabled !== false,
  });

  const {
    data: policies,
    isLoading: policiesLoading,
    error: policiesError,
    refetch: refetchPolicies,
  } = usePiiPoliciesQuery(effectiveProfileId, {
    enabled: options?.enabled !== false && Boolean(effectiveProfileId),
  });

  const {
    data: dataProtection,
    isLoading: dataProtectionLoading,
    error: dataProtectionError,
    refetch: refetchDataProtection,
  } = useDataProtectionQuery(effectiveProfileId, {
    enabled: options?.enabled !== false && Boolean(effectiveProfileId),
  });

  const refetch = () => {
    refetchProfiles();
    refetchCatalog();
    refetchPolicies();
    refetchDataProtection();
  };

  const piiPoliciesByFieldKey = useMemo(() => {
    const map = new Map<string, NonNullable<typeof policies>[number]>();
    policies?.forEach((p) => map.set(p.fieldKey, p));
    return map;
  }, [policies]);

  const isLoading =
    profilesLoading || catalogLoading || policiesLoading || dataProtectionLoading;

  const profileOptions = profiles ?? [];

  const error =
    profilesError ??
    catalogError ??
    (effectiveProfileId ? policiesError ?? dataProtectionError : undefined);

  return {
    profileId: effectiveProfileId,
    setProfileId,
    profileOptions,
    catalog: catalog ?? [],
    policies: policies ?? [],
    piiPoliciesByFieldKey,
    dataProtection: dataProtection ?? {},
    isLoading,
    hasProfiles: (profiles?.length ?? 0) > 0,
    refetch,
    error,
  };
};
