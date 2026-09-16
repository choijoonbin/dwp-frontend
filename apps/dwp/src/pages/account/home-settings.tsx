import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ErrorState, LoadingState, PageCanvas } from '@dwp-frontend/design-system';
import {
  HOME_CONTRACT_CAPABILITIES,
  getHomeExperience,
  getHomeOverview,
  hasHomeContractCapability,
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
    (policy.experienceVariant === 'CLASSIC' || policy.experienceVariant === 'FLOW_V1')
  ) {
    return policy.experienceVariant;
  }
  return 'CLASSIC';
}

export default function AccountHomeSettingsPage() {
  const { t } = useTranslation(['account', 'homeStudio']);
  const { homeSection } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const widgetRegistry = useHomeWidgetRegistryRuntime(
    auth.user?.tenantId ?? undefined,
    auth.user?.userId ?? undefined
  );
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
  const seedLayout = useMemo(
    () => ({ appLayout: null, presentation: 'balanced' as const, widgets: defaultHomeWidgets() }),
    []
  );

  if (!isAccountHomeSection(homeSection)) {
    return <Navigate to="/account/settings/home/overview" replace />;
  }
  if (experienceQuery.isLoading) {
    return <LoadingState label={t('common.loading', { ns: 'homeStudio' })} size="page" />;
  }
  if (experienceQuery.isError || !experienceQuery.data) {
    return (
      <ErrorState
        title={t('common.unavailable', { ns: 'homeStudio' })}
        retryLabel={t('common.retry', { ns: 'homeStudio' })}
        retrying={experienceQuery.isFetching}
        onRetry={() => void experienceQuery.refetch()}
        size="page"
      />
    );
  }

  const experience = experienceQuery.data;
  const modeKey = effectiveMode(experience);
  const modeScopedViews = hasHomeContractCapability(
    experience,
    HOME_CONTRACT_CAPABILITIES.modeScopedViews
  );
  const fourDeviceLayoutsSupported = hasHomeContractCapability(
    experience,
    HOME_CONTRACT_CAPABILITIES.fourDeviceLayouts
  );

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
