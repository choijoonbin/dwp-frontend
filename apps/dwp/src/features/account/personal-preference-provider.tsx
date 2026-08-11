import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getPersonalPreference,
  patchPersonalPreference,
  resetPersonalPreference,
  type PersonalPreference,
  type PersonalPreferencePatch,
  type PersonalPreferenceValues,
} from '@dwp-frontend/shared-utils/api/personal-preference-api';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { useToast } from '@dwp-frontend/shared-utils/toast/toast-store';
import { useAppearance } from '@dwp-frontend/design-system/appearance';

import type { UserAppearancePreference } from '@dwp-frontend/design-system/appearance';

type PersonalPreferenceContextValue = {
  preference: PersonalPreference | null;
  isLoading: boolean;
  isSaving: boolean;
  loadFailed: boolean;
  update: (patch: PersonalPreferencePatch) => void;
  reset: () => void;
  retry: () => void;
};

type MutationRequest =
  | { kind: 'patch'; patch: PersonalPreferencePatch; current: PersonalPreference }
  | { kind: 'reset'; current: PersonalPreference };

type MutationContext = {
  previous: PersonalPreference;
  previousAppearance: UserAppearancePreference;
};

const PersonalPreferenceContext = createContext<PersonalPreferenceContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergePatch(target: unknown, patch: unknown): unknown {
  if (!isRecord(patch)) return patch;
  const result: Record<string, unknown> = isRecord(target) ? { ...target } : {};
  Object.entries(patch).forEach(([key, value]) => {
    if (value === null) {
      delete result[key];
    } else {
      result[key] = mergePatch(result[key], value);
    }
  });
  return result;
}

function toAppearance(
  values: PersonalPreferenceValues,
  defaults: UserAppearancePreference
): UserAppearancePreference {
  return {
    mode: values.appearance?.mode ?? defaults.mode,
    density: values.appearance?.density ?? defaults.density,
    highContrast: values.accessibility?.highContrast ?? defaults.highContrast,
    reduceMotion: values.accessibility?.reduceMotion ?? defaults.reduceMotion,
  };
}

function optimisticPreference(
  current: PersonalPreference,
  patch: PersonalPreferencePatch
): PersonalPreference {
  return {
    ...current,
    customized: true,
    preferences: mergePatch(current.preferences, patch) as PersonalPreferenceValues,
  };
}

export function PersonalPreferenceProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const appearance = useAppearance();
  const appearanceDefaults = appearance.policy.defaults;
  const appearancePreference = appearance.preference;
  const replaceAppearancePreference = appearance.replacePreference;
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation('account');
  const appliedIdentity = useRef<string | null>(null);
  const identity = auth.user ? `${auth.user.tenantId}:${auth.user.userId}` : null;
  const queryKey = useMemo(
    () => ['personal-preference', auth.user?.tenantId, auth.user?.userId] as const,
    [auth.user?.tenantId, auth.user?.userId]
  );
  const preferenceQuery = useQuery({
    queryKey,
    queryFn: getPersonalPreference,
    enabled: Boolean(auth.user),
    staleTime: 0,
    retry: 1,
    refetchOnMount: 'always',
  });

  useEffect(() => {
    if (!identity) {
      appliedIdentity.current = null;
      return;
    }
    if (appliedIdentity.current !== identity) {
      appliedIdentity.current = identity;
      replaceAppearancePreference(appearanceDefaults);
    }
    if (preferenceQuery.data && !preferenceQuery.isFetching) {
      replaceAppearancePreference(
        toAppearance(preferenceQuery.data.preferences, appearanceDefaults)
      );
      return;
    }
    if (preferenceQuery.isError) {
      if (preferenceQuery.data) {
        replaceAppearancePreference(
          toAppearance(preferenceQuery.data.preferences, appearanceDefaults)
        );
      }
    }
  }, [
    appearanceDefaults,
    identity,
    preferenceQuery.data,
    preferenceQuery.isError,
    preferenceQuery.isFetching,
    replaceAppearancePreference,
  ]);

  const mutation = useMutation<PersonalPreference, unknown, MutationRequest, MutationContext>({
    mutationFn: (request) =>
      request.kind === 'reset'
        ? resetPersonalPreference(request.current.version)
        : patchPersonalPreference(request.patch, request.current.version),
    onMutate: async (request) => {
      await queryClient.cancelQueries({ queryKey });
      const previousAppearance = appearancePreference;
      const next =
        request.kind === 'reset'
          ? {
              ...request.current,
              customized: false,
              preferences: {
                appearance: {
                  mode: appearanceDefaults.mode,
                  density: appearanceDefaults.density,
                },
                accessibility: {
                  highContrast: appearanceDefaults.highContrast,
                  reduceMotion: appearanceDefaults.reduceMotion,
                },
              },
              version: 0,
              updatedAt: null,
            }
          : optimisticPreference(request.current, request.patch);
      queryClient.setQueryData(queryKey, next);
      replaceAppearancePreference(toAppearance(next.preferences, appearanceDefaults));
      return { previous: request.current, previousAppearance };
    },
    onSuccess: (next) => {
      queryClient.setQueryData(queryKey, next);
      replaceAppearancePreference(toAppearance(next.preferences, appearanceDefaults));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'audit-events'] });
    },
    onError: (_error, _request, context) => {
      if (context) {
        queryClient.setQueryData(queryKey, context.previous);
        replaceAppearancePreference(context.previousAppearance);
      }
      toast.error(t('personalPreferences.saveError'));
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const update = useCallback(
    (patch: PersonalPreferencePatch) => {
      if (!preferenceQuery.data || mutation.isPending) return;
      mutation.mutate({ kind: 'patch', patch, current: preferenceQuery.data });
    },
    [mutation, preferenceQuery.data]
  );

  const reset = useCallback(() => {
    if (!preferenceQuery.data || mutation.isPending) return;
    mutation.mutate({ kind: 'reset', current: preferenceQuery.data });
  }, [mutation, preferenceQuery.data]);

  const retry = useCallback(() => {
    void preferenceQuery.refetch();
  }, [preferenceQuery]);

  const value = useMemo<PersonalPreferenceContextValue>(
    () => ({
      preference: preferenceQuery.data ?? null,
      isLoading: preferenceQuery.isPending,
      isSaving: mutation.isPending,
      loadFailed: preferenceQuery.isError,
      update,
      reset,
      retry,
    }),
    [
      mutation.isPending,
      preferenceQuery.data,
      preferenceQuery.isError,
      preferenceQuery.isPending,
      reset,
      retry,
      update,
    ]
  );

  return (
    <PersonalPreferenceContext.Provider value={value}>
      {children}
    </PersonalPreferenceContext.Provider>
  );
}

export function usePersonalPreference(): PersonalPreferenceContextValue {
  const value = useContext(PersonalPreferenceContext);
  if (!value) {
    throw new Error('usePersonalPreference must be used within PersonalPreferenceProvider');
  }
  return value;
}
