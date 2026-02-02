import { useMemo, useState } from 'react';
import {
  useTenantScopeQuery,
  useAdminProfilesQuery,
  usePatchSodRuleMutation,
  useAddCurrenciesMutation,
  usePatchCurrencyMutation,
  useAddCompanyCodesMutation,
  usePatchCompanyCodeMutation,
} from '@dwp-frontend/shared-utils';

/**
 * Tenant Scope 탭용 통합 훅.
 * profileId: 선택된 Policy Profile. 없으면 테넌트 기본 프로파일(is_default=true) 사용.
 */
export const useTenantScope = () => {
  const [profileId, setProfileId] = useState<string | null>(null);

  const { data: profiles } = useAdminProfilesQuery({ enabled: true });
  const effectiveProfileId = useMemo(() => {
    if (profileId) return profileId;
    const defaultProfile = profiles?.find((p) => p.isDefault);
    return defaultProfile?.id ?? profiles?.[0]?.id ?? null;
  }, [profileId, profiles]);

  const { data, isLoading, error, refetch } = useTenantScopeQuery({
    profileId: effectiveProfileId,
    enabled: true,
  });

  const patchCompanyCode = usePatchCompanyCodeMutation(effectiveProfileId);
  const patchCurrency = usePatchCurrencyMutation(effectiveProfileId);
  const patchSodRule = usePatchSodRuleMutation(effectiveProfileId);
  const addCompanyCodes = useAddCompanyCodesMutation(effectiveProfileId);
  const addCurrencies = useAddCurrenciesMutation(effectiveProfileId);

  const companyCodes = useMemo(() => data?.companyCodes ?? [], [data?.companyCodes]);
  const currencies = useMemo(() => data?.currencies ?? [], [data?.currencies]);
  const sodRules = useMemo(() => data?.sodRules ?? [], [data?.sodRules]);
  const meta = data?.meta;

  return {
    data,
    companyCodes,
    currencies,
    sodRules,
    meta,
    isLoading,
    error,
    refetch,
    profileId: effectiveProfileId,
    setProfileId,
    profileOptions: profiles ?? [],
    hasProfiles: (profiles?.length ?? 0) > 0,
    patchCompanyCode,
    patchCurrency,
    patchSodRule,
    addCompanyCodes,
    addCurrencies,
  };
};
