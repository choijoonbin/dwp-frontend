import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getPersonalPreference,
  patchPersonalPreference,
  resetPersonalPreference,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import { useAppearance } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import type {
  PersonalPreference,
  PersonalPreferencePatch,
  PersonalPreferenceValues,
} from '@dwp-frontend/shared-utils';
import type { UserAppearancePreference } from '@dwp-frontend/design-system';

type PersonalPreferenceContextValue = {
  preference: PersonalPreference | null;
  isSaving: boolean;
  loadFailed: boolean;
  update: (patch: PersonalPreferencePatch) => void;
  reset: () => void;
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
  const [hydratedIdentity, setHydratedIdentity] = useState<string | null>(null);
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
      setHydratedIdentity(null);
      return;
    }
    if (preferenceQuery.data && !preferenceQuery.isFetching) {
      replaceAppearancePreference(
        toAppearance(preferenceQuery.data.preferences, appearanceDefaults)
      );
      setHydratedIdentity(identity);
      return;
    }
    if (preferenceQuery.isError) {
      if (preferenceQuery.data) {
        replaceAppearancePreference(
          toAppearance(preferenceQuery.data.preferences, appearanceDefaults)
        );
      }
      setHydratedIdentity(identity);
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

  const value = useMemo<PersonalPreferenceContextValue>(
    () => ({
      preference: preferenceQuery.data ?? null,
      isSaving: mutation.isPending,
      loadFailed: preferenceQuery.isError,
      update,
      reset,
    }),
    [mutation.isPending, preferenceQuery.data, preferenceQuery.isError, reset, update]
  );

  const isHydrating = Boolean(auth.user) && hydratedIdentity !== identity;
  if (isHydrating) {
    return (
      <Box
        role="status"
        aria-live="polite"
        sx={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'background.default',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CircularProgress size={24} />
          <Typography color="text.secondary">{t('personalPreferences.loading')}</Typography>
        </Box>
      </Box>
    );
  }

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
