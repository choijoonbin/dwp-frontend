import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ErrorState, LoadingState, PageCanvas } from '@dwp-frontend/design-system';
import {
  HOME_CONTRACT_CAPABILITIES,
  getHomeExperience,
  getHomeOverview,
  getHomePreference,
  hasHomeContractCapability,
  updateHomeCurrentMode,
} from '@dwp-frontend/shared-utils';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  HomePersonalizationStudio,
  type ActiveHomeStudioSection,
} from '../../features/home-personalization/home-personalization-studio';
import { defaultHomeWidgets } from '../../features/home/home-widget-registry';
import { useHomeWidgetRegistryRuntime } from '../../features/home/runtime/use-home-widget-registry';
import { HOME_APPS } from '../../components/workspace-composer/app-launchpad-model';
import { reconcileHomeCompositionPolicy } from '../../features/home/home-composition-policy';
import { HOME_V2_QUERY_ROOT } from '../../features/home/runtime/use-home-v2-runtime';
import { resolveHomePreferenceStore } from '../../features/home-personalization/home-personalization-studio-model';

import type { HomeExperienceVariant } from '@dwp-frontend/shared-utils';

export const ACCOUNT_HOME_SECTIONS = [
  'overview',
  'views',
  'layout',
  'appearance',
  'devices',
  'templates',
  'suggestions',
  'history',
] as const;

export type AccountHomeSection = (typeof ACCOUNT_HOME_SECTIONS)[number];

const routeToStudioSection: Record<AccountHomeSection, ActiveHomeStudioSection> = {
  overview: 'overview',
  views: 'profiles',
  layout: 'layout',
  appearance: 'appearance',
  devices: 'device',
  templates: 'templates',
  suggestions: 'ai',
  history: 'history',
};

const studioSectionToRoute: Partial<Record<ActiveHomeStudioSection, AccountHomeSection>> = {
  overview: 'overview',
  profiles: 'views',
  layout: 'layout',
  appearance: 'appearance',
  device: 'devices',
  templates: 'templates',
  ai: 'suggestions',
  history: 'history',
};

export function isAccountHomeSection(value: string | undefined): value is AccountHomeSection {
  return ACCOUNT_HOME_SECTIONS.includes(value as AccountHomeSection);
}

function effectiveMode(
  experience: Awaited<ReturnType<typeof getHomeExperience>>
): HomeExperienceVariant {
  if (experience.effectiveExperienceVariant) return experience.effectiveExperienceVariant;
  const policy = experience.compositionPolicy;
  if (
    policy &&
    typeof policy === 'object' &&
    'experienceVariant' in policy &&
    (policy.experienceVariant === 'CLASSIC' ||
      policy.experienceVariant === 'FLOW_V1' ||
      policy.experienceVariant === 'MZ_V1')
  ) {
    return policy.experienceVariant;
  }
  return 'CLASSIC';
}

export default function AccountHomeSettingsPage() {
  const { t } = useTranslation(['account', 'homeStudio']);
  const { homeSection } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const experienceQuery = useQuery({
    queryKey: ['home-experience'],
    queryFn: getHomeExperience,
    staleTime: 30_000,
    retry: 1,
  });
  const overviewQuery = useQuery({
    queryKey: ['home-overview', 'account-settings'],
    queryFn: () => getHomeOverview(),
    staleTime: 30_000,
    retry: 1,
  });
  const preferenceQuery = useQuery({
    queryKey: ['home-preference', auth.user?.tenantId, auth.user?.userId],
    queryFn: getHomePreference,
    staleTime: 30_000,
    retry: 1,
  });
  const registryPolicy = reconcileHomeCompositionPolicy(experienceQuery.data?.compositionPolicy);
  const preferredRegistryMode = preferenceQuery.data?.currentMode;
  const registryMode =
    preferredRegistryMode && registryPolicy.allowedModes.includes(preferredRegistryMode)
      ? preferredRegistryMode
      : experienceQuery.data
        ? effectiveMode(experienceQuery.data)
        : registryPolicy.defaultMode;
  const widgetRegistry = useHomeWidgetRegistryRuntime(
    auth.user?.tenantId ?? undefined,
    auth.user?.userId ?? undefined,
    registryMode
  );
  const modeMutation = useMutation({
    mutationFn: async (mode: HomeExperienceVariant) => {
      if (!preferenceQuery.data) throw new Error('Home preference is unavailable.');
      const enabledModes =
        preferenceQuery.data.enabledModes ??
        preferenceQuery.data.allowedModes ??
        registryPolicy.allowedModes;
      if (!enabledModes.includes(mode)) {
        throw new Error('The requested Home mode is disabled by organization rollout policy.');
      }
      return updateHomeCurrentMode(preferenceQuery.data, mode);
    },
    onSuccess: async (preference) => {
      queryClient.setQueryData(
        ['home-preference', auth.user?.tenantId, auth.user?.userId],
        preference
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['home-preference'] }),
        queryClient.invalidateQueries({ queryKey: HOME_V2_QUERY_ROOT }),
        queryClient.invalidateQueries({ queryKey: ['home-experience'] }),
        queryClient.invalidateQueries({ queryKey: ['home-view'] }),
        queryClient.invalidateQueries({ queryKey: ['home-personalization'] }),
      ]);
    },
  });
  const seedLayout = useMemo(
    () => ({ appLayout: null, presentation: 'balanced' as const, widgets: defaultHomeWidgets() }),
    []
  );

  if (!isAccountHomeSection(homeSection)) {
    return <Navigate to="/account/settings/home/overview" replace />;
  }
  if (experienceQuery.isLoading || preferenceQuery.isLoading) {
    return <LoadingState label={t('common.loading', { ns: 'homeStudio' })} size="page" />;
  }
  if (
    experienceQuery.isError ||
    !experienceQuery.data ||
    preferenceQuery.isError ||
    !preferenceQuery.data
  ) {
    return (
      <ErrorState
        title={t('common.unavailable', { ns: 'homeStudio' })}
        retryLabel={t('common.retry', { ns: 'homeStudio' })}
        retrying={experienceQuery.isFetching || preferenceQuery.isFetching}
        onRetry={() => void Promise.all([experienceQuery.refetch(), preferenceQuery.refetch()])}
        size="page"
      />
    );
  }

  const experience = experienceQuery.data;
  const policy = reconcileHomeCompositionPolicy(experience.compositionPolicy);
  const preferenceMode = preferenceQuery.data?.currentMode;
  const modeKey =
    preferenceMode && policy.allowedModes.includes(preferenceMode)
      ? preferenceMode
      : effectiveMode(experience);
  const modeScopedViews = hasHomeContractCapability(
    experience,
    HOME_CONTRACT_CAPABILITIES.modeScopedViews
  );
  const fourDeviceLayoutsSupported = hasHomeContractCapability(
    experience,
    HOME_CONTRACT_CAPABILITIES.fourDeviceLayouts
  );
  const preferenceStore = resolveHomePreferenceStore(experience.homePreferenceStore);

  return (
    <PageCanvas>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        justifyContent="space-between"
        gap={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography component="p" variant="overline" color="primary.main">
            {t('homeSettings.eyebrow')}
          </Typography>
          <Typography component="h1" variant="h4">
            {t('homeSettings.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 760 }}>
            {t('homeSettings.description')}
          </Typography>
        </Box>
        <Chip
          size="small"
          variant="outlined"
          color="info"
          label={t(`homeSettings.mode.${modeKey}`)}
        />
      </Stack>

      <HomePersonalizationStudio
        open
        presentation="page"
        initialSection={routeToStudioSection[homeSection]}
        composerEnabled={experience.composerEnabled === true}
        modeKey={modeKey}
        modeScopedViews={modeScopedViews}
        preferenceStore={preferenceStore}
        legacyPreference={preferenceStore === 'LEGACY' ? preferenceQuery.data : undefined}
        fourDeviceLayoutsSupported={fourDeviceLayoutsSupported}
        tenantId={auth.user?.tenantId}
        userId={auth.user?.userId}
        seedLayout={seedLayout}
        overview={overviewQuery.data}
        overviewLoading={overviewQuery.isLoading}
        overviewFetching={overviewQuery.isFetching}
        overviewFailed={overviewQuery.isError}
        widgetRuntimeDecisions={widgetRegistry.decisions}
        effectiveWidgetCatalog={widgetRegistry.effectiveCatalog}
        feedbackBusy={false}
        modePreset={
          preferenceQuery.data
            ? {
                currentMode: modeKey,
                initialSelectedMode: modeKey,
                allowedModes: preferenceQuery.data.allowedModes ?? policy.allowedModes,
                enabledModes:
                  preferenceQuery.data.enabledModes ??
                  preferenceQuery.data.allowedModes ??
                  policy.allowedModes,
                disabledModeReasons: preferenceQuery.data.disabledModeReasons,
                defaultMode: preferenceQuery.data.defaultMode ?? policy.defaultMode,
                sharedAppOrder: HOME_APPS.map((app) => ({ id: app.id, label: app.name })),
                disabled: preferenceQuery.isFetching || modeMutation.isPending,
                applying: modeMutation.isPending,
                onApply: async (mode) => {
                  await modeMutation.mutateAsync(mode);
                },
              }
            : undefined
        }
        onRetryOverview={() => void overviewQuery.refetch()}
        onClose={() => undefined}
        onEditView={() => navigate('/account/settings/home/layout')}
        onSectionChange={(section) => {
          const route = studioSectionToRoute[section];
          if (route && route !== homeSection) navigate(`/account/settings/home/${route}`);
        }}
      />
    </PageCanvas>
  );
}
