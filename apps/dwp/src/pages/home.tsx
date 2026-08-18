import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock3 } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getHomeExperience,
  getHomePreference,
  getHomeOverview,
  getWorkspaceApps,
  launchWorkspaceApp,
  readRegionalPreference,
  recordHomeRecommendationFeedback,
  resolveHomeBackgroundUrl,
  updateHomePreference,
  useAuth,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';
import { formatDate } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { AppLaunchpad } from '../features/home/app-launchpad';
import { AnnouncementsWidget } from '../features/home/announcements-widget';
import { HomeItemGallery } from '../features/home/home-item-gallery';
import { HomeDayRail } from '../features/home/home-day-rail';
import { CommandRailWidget } from '../features/home/command-rail-widget';
import { WorkspaceWidgetCanvas } from '../components/workspace-composer/workspace-widget-canvas';
import { WorkspaceComposerToolbar } from '../components/workspace-composer/workspace-composer-toolbar';
import {
  HOME_WIDGET_REGISTRY,
  HOME_WIDGET_KEYS,
  defaultHomeWidgets,
  reconcileHomeWidgets,
  setHomeWidgetVisibility,
} from '../features/home/home-widget-registry';
import {
  governedHomeZone,
  reconcileHomeCompositionPolicy,
} from '../features/home/home-composition-policy';
import {
  ActivityWidget,
  DailyBriefWidget,
  FocusWidget,
  ScheduleWidget,
} from '../features/home/home-widgets';
import type { HomeOverviewWidgetProps } from '../features/home/home-widgets';
import {
  createDefaultLaunchpadLayout,
  isAppEntitled,
  localizeHomeApps,
  reconcileLaunchpadLayout,
  resolveHomeLaunchpadCatalog,
  restoreLaunchpadApp,
} from '../components/workspace-composer/app-launchpad-model';
import { useSystemCodeOptions } from '../components/use-system-code-options';

import type {
  HomePreferenceLayout,
  HomePresentation,
  HomeRecommendation,
  HomeWidgetHeight,
  HomeWidgetKey,
  HomeWidgetPreference,
  HomeWidgetSize,
} from '@dwp-frontend/shared-utils';
import type { LaunchpadLayout } from '../components/workspace-composer/app-launchpad-model';

type PreferenceMutation = { layout: HomePreferenceLayout };

function HomeWidget({
  widgetKey,
  size,
  height,
  ...overviewProps
}: {
  widgetKey: HomeWidgetKey;
  size: HomeWidgetSize;
  height: HomeWidgetHeight;
} & HomeOverviewWidgetProps) {
  switch (widgetKey) {
    case 'command-rail':
      return <CommandRailWidget {...overviewProps} />;
    case 'daily-brief':
      return <DailyBriefWidget {...overviewProps} />;
    case 'focus':
      return <FocusWidget {...overviewProps} size={size} height={height} />;
    case 'schedule':
      return <ScheduleWidget {...overviewProps} size={size} height={height} />;
    case 'activity':
      return <ActivityWidget {...overviewProps} size={size} height={height} />;
  }
}

export default function HomePage() {
  const { t, i18n } = useTranslation('home');
  const auth = useAuth();
  const toast = useToast();
  const { permissions } = usePermissions();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(searchParams.get('edit') === 'home');
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [editBaseVersion, setEditBaseVersion] = useState<number | null>(null);
  const registeredWidgetKeys = useSystemCodeOptions('PLATFORM.HOME_WIDGET', HOME_WIDGET_KEYS);
  const closeEditor = useCallback(() => {
    setGalleryOpen(false);
    setEditorOpen(false);
    setEditBaseVersion(null);
    if (searchParams.get('edit') === 'home') {
      const next = new URLSearchParams(searchParams);
      next.delete('edit');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const firstName = auth.user?.displayName?.split(' ')[0];
  const timeZone = useMemo(() => {
    const preference = readRegionalPreference().timeZone;
    return preference === 'system'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul'
      : preference;
  }, []);
  const homeOverviewQueryKey = [
    'home-overview',
    auth.user?.tenantId,
    auth.user?.userId,
    timeZone,
  ] as const;
  const homeOverviewQuery = useQuery({
    queryKey: homeOverviewQueryKey,
    queryFn: () => getHomeOverview(timeZone),
    staleTime: 30_000,
    retry: 1,
  });
  const homeExperienceQuery = useQuery({
    queryKey: ['home-experience', auth.user?.tenantId],
    queryFn: getHomeExperience,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const launchpadCatalog = useMemo(
    () =>
      resolveHomeLaunchpadCatalog(
        localizeHomeApps(t),
        homeExperienceQuery.data?.launchpadConfiguration,
        i18n.resolvedLanguage || i18n.language || 'en',
        t
      ),
    [homeExperienceQuery.data?.launchpadConfiguration, i18n.language, i18n.resolvedLanguage, t]
  );
  const entitledApps = useMemo(
    () =>
      launchpadCatalog.apps
        .map((app) =>
          app.id === 'dwp-communications' &&
          (homeOverviewQuery.data?.communications.data?.summary.unread ?? 0) > 0
            ? {
                ...app,
                badge: String(
                  Math.min(99, homeOverviewQuery.data?.communications.data?.summary.unread ?? 0)
                ),
              }
            : app
        )
        .filter((app) => isAppEntitled(app, auth.user?.roles ?? [], permissions)),
    [
      auth.user?.roles,
      homeOverviewQuery.data?.communications.data?.summary.unread,
      launchpadCatalog.apps,
      permissions,
    ]
  );
  const [draftWidgets, setDraftWidgets] = useState<HomeWidgetPreference[]>(() =>
    defaultHomeWidgets(registeredWidgetKeys)
  );
  const [draftAppLayout, setDraftAppLayout] = useState<LaunchpadLayout>(() =>
    createDefaultLaunchpadLayout(entitledApps, launchpadCatalog.groups)
  );
  const [draftPresentation, setDraftPresentation] = useState<HomePresentation>('balanced');
  const homePreferenceQuery = useQuery({
    queryKey: ['home-preference', auth.user?.tenantId, auth.user?.userId],
    queryFn: getHomePreference,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const workspaceAppsQuery = useQuery({
    queryKey: ['workspace', 'apps'],
    queryFn: getWorkspaceApps,
    staleTime: 60_000,
    retry: 1,
  });
  const homeExperience = homeExperienceQuery.data;
  const compositionPolicy = useMemo(
    () => reconcileHomeCompositionPolicy(homeExperience?.compositionPolicy),
    [homeExperience?.compositionPolicy]
  );
  const announcementsZone = governedHomeZone(compositionPolicy, 'announcements');
  const personalCustomizationEnabled =
    homeExperienceQuery.isSuccess && compositionPolicy.personalCustomizationEnabled;
  const localizedHomeCopy = useMemo(() => {
    if (!homeExperience) return undefined;
    const locale = (i18n.resolvedLanguage || i18n.language || '').toLowerCase();
    const language = locale.split('-')[0];
    return (
      homeExperience.localizedContent?.[locale] ||
      homeExperience.localizedContent?.[language] ||
      homeExperience.localizedContent?.[homeExperience.defaultLocale] ||
      undefined
    );
  }, [homeExperience, i18n.language, i18n.resolvedLanguage]);
  const homePreference = homePreferenceQuery.data;
  const audienceProfile = homeOverviewQuery.data?.audience.profile ?? 'MEMBER';
  const widgetPreferences = useMemo(
    () =>
      homePreference?.customized
        ? reconcileHomeWidgets(homePreference.layout.widgets, registeredWidgetKeys, audienceProfile)
        : defaultHomeWidgets(registeredWidgetKeys, audienceProfile),
    [
      audienceProfile,
      homePreference?.customized,
      homePreference?.layout.widgets,
      registeredWidgetKeys,
    ]
  );
  const appLayout = useMemo(
    () =>
      reconcileLaunchpadLayout(
        homePreference?.layout.appLayout,
        entitledApps,
        launchpadCatalog.groups
      ),
    [entitledApps, homePreference?.layout.appLayout, launchpadCatalog.groups]
  );
  const preferenceVersion = homePreference?.version ?? 0;
  const activeAppLayout = editorOpen ? draftAppLayout : appLayout;
  const activeWidgets = editorOpen ? draftWidgets : widgetPreferences;
  const activePresentation = editorOpen
    ? draftPresentation
    : (homePreference?.layout.presentation ?? 'balanced');
  const hiddenWidgetKeys = activeWidgets
    .filter((widget) => !widget.visible)
    .map((widget) => widget.widgetKey);
  const hiddenApps = entitledApps.filter((app) => activeAppLayout.hiddenAppIds.includes(app.id));

  useEffect(() => {
    if (!personalCustomizationEnabled && editorOpen) {
      closeEditor();
      return;
    }
    if (!editorOpen) {
      setDraftAppLayout(appLayout);
      setDraftWidgets(widgetPreferences);
      setDraftPresentation(homePreference?.layout.presentation ?? 'balanced');
      return;
    }
    if (editBaseVersion === null && !homePreferenceQuery.isLoading) {
      setDraftAppLayout(appLayout);
      setDraftWidgets(widgetPreferences);
      setDraftPresentation(homePreference?.layout.presentation ?? 'balanced');
      setEditBaseVersion(preferenceVersion);
    }
  }, [
    closeEditor,
    appLayout,
    editBaseVersion,
    editorOpen,
    homePreferenceQuery.isLoading,
    homePreference?.layout.presentation,
    personalCustomizationEnabled,
    preferenceVersion,
    widgetPreferences,
  ]);

  const beginEditing = () => {
    if (homePreferenceQuery.isLoading || !personalCustomizationEnabled) return;
    setDraftAppLayout(appLayout);
    setDraftWidgets(widgetPreferences);
    setDraftPresentation(homePreference?.layout.presentation ?? 'balanced');
    setEditBaseVersion(preferenceVersion);
    setEditorOpen(true);
  };

  const cancelEditing = () => {
    setDraftAppLayout(appLayout);
    setDraftWidgets(widgetPreferences);
    setDraftPresentation(homePreference?.layout.presentation ?? 'balanced');
    closeEditor();
  };

  const preferenceMutation = useMutation({
    mutationFn: (request: PreferenceMutation) =>
      updateHomePreference(request.layout, editBaseVersion ?? preferenceVersion),
    onSuccess: async (next) => {
      queryClient.setQueryData(['home-preference', auth.user?.tenantId, auth.user?.userId], next);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'audit-events'] });
      closeEditor();
      toast.success(t('page.homeSaved'));
    },
    onError: () => toast.error(t('page.saveError')),
  });
  const appLaunchMutation = useMutation({
    mutationFn: launchWorkspaceApp,
    onSuccess: async (launch) => {
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'apps'] });
      if (launch.launchMode === 'NATIVE') navigate(launch.launchTarget);
      else window.open(launch.launchTarget, '_blank', 'noopener,noreferrer');
    },
    onError: () => toast.error(t('page.appLaunchError')),
  });
  const recommendationFeedbackMutation = useMutation({
    mutationFn: (recommendation: HomeRecommendation) =>
      recordHomeRecommendationFeedback(recommendation.key, 'NOT_RELEVANT'),
    onSuccess: async (_, recommendation) => {
      queryClient.setQueryData<typeof homeOverviewQuery.data>(homeOverviewQueryKey, (current) =>
        current
          ? {
              ...current,
              recommendations: {
                ...current.recommendations,
                data: (current.recommendations.data ?? []).filter(
                  (candidate) => candidate.key !== recommendation.key
                ),
              },
            }
          : current
      );
      await queryClient.invalidateQueries({ queryKey: ['admin', 'audit-events'] });
      toast.success(t('page.recommendationHidden'));
    },
    onError: () => toast.error(t('page.recommendationFeedbackError')),
  });
  const customizationBusy = homePreferenceQuery.isLoading || preferenceMutation.isPending;

  const saveHome = () => {
    preferenceMutation.mutate({
      layout: {
        appLayout: draftAppLayout,
        presentation: draftPresentation,
        widgets: draftWidgets,
      },
    });
  };

  const resetDraft = () => {
    setDraftAppLayout(createDefaultLaunchpadLayout(entitledApps, launchpadCatalog.groups));
    setDraftWidgets(defaultHomeWidgets(registeredWidgetKeys, audienceProfile));
    setDraftPresentation('balanced');
  };

  const backgroundUrl = resolveHomeBackgroundUrl(homeExperience);
  const currentDate = formatDate(new Date(), { dateStyle: 'full' });
  const workQueue = homeOverviewQuery.data?.work.data;
  const workspaceUpdatedAt =
    workQueue?.generatedAt || homeOverviewQuery.data?.generatedAt
      ? formatDate(new Date(workQueue?.generatedAt || homeOverviewQuery.data!.generatedAt), {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '-';
  const runtimeAppById = new Map((workspaceAppsQuery.data ?? []).map((app) => [app.id, app]));
  const launchApp = (app: (typeof entitledApps)[number]) => {
    const runtimeApp = runtimeAppById.get(app.id);
    if (!runtimeApp) {
      navigate(app.route);
      return;
    }
    if (runtimeApp.health === 'configuration-required') {
      navigate(`/apps?app=${encodeURIComponent(runtimeApp.id)}`);
      return;
    }
    appLaunchMutation.mutate(runtimeApp.id);
  };
  const governedCanvasWidgets = announcementsZone.visible
    ? [
        {
          widgetKey: announcementsZone.zoneKey,
          label: t('widgets.registry.announcements.label'),
          size: announcementsZone.size,
          height: announcementsZone.height,
          surface: 'plain' as const,
          content: (
            <AnnouncementsWidget
              overview={homeOverviewQuery.data}
              loading={homeOverviewQuery.isLoading}
              fetching={homeOverviewQuery.isFetching}
              requestFailed={homeOverviewQuery.isError}
              onRetry={() => void homeOverviewQuery.refetch()}
            />
          ),
        },
      ]
    : [];

  return (
    <Box>
      <HomeDayRail
        audience={audienceProfile}
        currentDate={currentDate}
        headline={
          localizedHomeCopy?.headline ||
          homeExperience?.headline ||
          (firstName ? t('page.welcomeName', { name: firstName }) : t('page.welcome'))
        }
        subheadline={
          localizedHomeCopy?.subheadline ||
          homeExperience?.subheadline ||
          t('page.commandDescription')
        }
        backgroundUrl={backgroundUrl}
        usesDefaultBackground={!homeExperience?.backgroundUrl}
        backgroundPosition={homeExperience?.backgroundPosition ?? 'RIGHT'}
        overlayOpacity={homeExperience?.overlayOpacity ?? 18}
        assignedAppCount={entitledApps.length}
        onBrowseAll={() => navigate('/apps')}
        onStartEditing={personalCustomizationEnabled && !editorOpen ? beginEditing : undefined}
        workspaceTools={
          <AppLaunchpad
            apps={entitledApps}
            groups={launchpadCatalog.groups}
            layout={activeAppLayout}
            editing={editorOpen}
            reorderable={personalCustomizationEnabled}
            title={t('page.appsTitle')}
            customizationBusy={customizationBusy}
            onImageBackground
            onLayoutChange={setDraftAppLayout}
            onLaunch={launchApp}
            onStartEditing={personalCustomizationEnabled && !editorOpen ? beginEditing : undefined}
          />
        }
        personalizationBusy={homePreferenceQuery.isLoading || customizationBusy}
      />

      <Box
        sx={{
          width: 1,
          maxWidth: 2240,
          mx: 'auto',
          px: { xs: 2, md: '50px' },
          py: { xs: 3, md: 4 },
          display: 'block',
        }}
      >
        <Box
          data-testid="home-workspace-grid"
          sx={{
            mt: 0,
            '& [data-workspace-widget-surface="card"] [data-workspace-widget-content] > section': {
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: 0.5,
              overflow: 'hidden',
              px: { xs: 1.75, md: 2 },
              py: { xs: 1.75, md: 2 },
            },
          }}
        >
          <WorkspaceWidgetCanvas
            registry={HOME_WIDGET_REGISTRY}
            widgets={activeWidgets}
            governedWidgets={governedCanvasWidgets}
            editing={editorOpen && personalCustomizationEnabled}
            busy={customizationBusy}
            presentation={activePresentation}
            getLabel={(widgetKey) => t(`widgets.registry.${widgetKey}.label`)}
            onChange={setDraftWidgets}
            renderWidget={(widgetKey, size, height) => (
              <HomeWidget
                widgetKey={widgetKey}
                size={size}
                height={height}
                overview={homeOverviewQuery.data}
                loading={homeOverviewQuery.isLoading}
                fetching={homeOverviewQuery.isFetching}
                requestFailed={homeOverviewQuery.isError}
                onRetry={() => void homeOverviewQuery.refetch()}
                feedbackBusy={recommendationFeedbackMutation.isPending}
                onRecommendationFeedback={(recommendation) =>
                  recommendationFeedbackMutation.mutate(recommendation)
                }
              />
            )}
          />
        </Box>

        {editorOpen && <Box aria-hidden="true" sx={{ height: 76 }} />}
      </Box>

      <Box
        component="footer"
        sx={{
          minHeight: { xs: 120, md: 64 },
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Box
          sx={{
            width: 1,
            maxWidth: 2240,
            minHeight: 'inherit',
            mx: 'auto',
            px: { xs: 2, md: '50px' },
            py: { xs: 2, md: 1.5 },
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
            <Clock3 size={15} aria-hidden="true" />
            <Typography variant="caption" color="text.secondary">
              {t('page.lastRefreshed', { time: workspaceUpdatedAt })}
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              maxWidth: '100%',
              columnGap: { xs: 2.5, md: 4 },
              rowGap: 1,
            }}
          >
            {[
              ['privacy', '/account/settings?view=privacy'],
              ['terms', '/account/settings?view=terms'],
              ['help', '/services'],
              ['status', '/status'],
            ].map(([label, to], index) => (
              <Typography
                key={label}
                component={Link}
                to={to}
                variant="caption"
                color="text.primary"
                sx={{
                  display: index === 3 ? { xs: 'none', md: 'inline' } : 'inline',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                {t(`footer.${label}`)}
              </Typography>
            ))}
          </Box>
        </Box>
      </Box>

      <HomeItemGallery
        open={galleryOpen}
        hiddenApps={hiddenApps}
        hiddenWidgetKeys={hiddenWidgetKeys}
        busy={customizationBusy}
        onClose={() => setGalleryOpen(false)}
        onAddApp={(app) => setDraftAppLayout((current) => restoreLaunchpadApp(current, app))}
        onAddWidget={(widgetKey) =>
          setDraftWidgets((current) => setHomeWidgetVisibility(current, widgetKey, true))
        }
      />

      {editorOpen && personalCustomizationEnabled && (
        <WorkspaceComposerToolbar
          placement="floating"
          presentation={draftPresentation}
          busy={customizationBusy}
          onPresentationChange={setDraftPresentation}
          onAdd={() => setGalleryOpen(true)}
          onReset={resetDraft}
          onCancel={cancelEditing}
          onDone={saveHome}
        />
      )}
    </Box>
  );
}
