import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock3 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { PageCanvas } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { AppLaunchpad } from '../features/home/app-launchpad';
import { AnnouncementsWidget } from '../features/home/announcements-widget';
import { HomeItemGallery } from '../features/home/home-item-gallery';
import { HomeDayRail } from '../features/home/home-day-rail';
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
} from '../features/home/app-launchpad-model';
import { useSystemCodeOptions } from '../components/use-system-code-options';

import type {
  HomePreferenceLayout,
  HomePresentation,
  HomeRecommendation,
  HomeWidgetKey,
  HomeWidgetPreference,
  HomeWidgetSize,
} from '@dwp-frontend/shared-utils';
import type { LaunchpadLayout } from '../features/home/app-launchpad-model';

type PreferenceMutation = { layout: HomePreferenceLayout };

function HomeWidget({
  widgetKey,
  size,
  ...overviewProps
}: { widgetKey: HomeWidgetKey; size: HomeWidgetSize } & HomeOverviewWidgetProps) {
  switch (widgetKey) {
    case 'announcements':
      return <AnnouncementsWidget {...overviewProps} />;
    case 'daily-brief':
      return <DailyBriefWidget {...overviewProps} />;
    case 'focus':
      return <FocusWidget {...overviewProps} />;
    case 'schedule':
      return <ScheduleWidget {...overviewProps} />;
    case 'activity':
      return <ActivityWidget {...overviewProps} size={size} />;
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
  const closeEditor = () => {
    setGalleryOpen(false);
    setEditorOpen(false);
    setEditBaseVersion(null);
    if (searchParams.get('edit') === 'home') {
      const next = new URLSearchParams(searchParams);
      next.delete('edit');
      setSearchParams(next, { replace: true });
    }
  };
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
  const [draftAppLayout, setDraftAppLayout] = useState<LaunchpadLayout>(() =>
    createDefaultLaunchpadLayout(entitledApps, launchpadCatalog.groups)
  );
  const [draftWidgets, setDraftWidgets] = useState<HomeWidgetPreference[]>(() =>
    defaultHomeWidgets(registeredWidgetKeys)
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
  const hiddenApps = useMemo(
    () =>
      activeAppLayout.hiddenAppIds
        .map((appId) => entitledApps.find((app) => app.id === appId))
        .filter((app): app is (typeof entitledApps)[number] => Boolean(app)),
    [activeAppLayout.hiddenAppIds, entitledApps]
  );
  const hiddenWidgetKeys = activeWidgets
    .filter((widget) => !widget.visible)
    .map((widget) => widget.widgetKey);

  useEffect(() => {
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
    appLayout,
    editBaseVersion,
    editorOpen,
    homePreferenceQuery.isLoading,
    homePreference?.layout.presentation,
    preferenceVersion,
    widgetPreferences,
  ]);

  const beginEditing = () => {
    if (homePreferenceQuery.isLoading) return;
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
              recommendations: current.recommendations.filter(
                (candidate) => candidate.key !== recommendation.key
              ),
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

  return (
    <Box>
      <HomeDayRail
        overview={homeOverviewQuery.data}
        loading={homeOverviewQuery.isLoading}
        fetching={homeOverviewQuery.isFetching}
        requestFailed={homeOverviewQuery.isError}
        currentDate={currentDate}
        updatedAt={workspaceUpdatedAt}
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
        onRetry={() => void homeOverviewQuery.refetch()}
        feedbackBusy={recommendationFeedbackMutation.isPending}
        onRecommendationFeedback={(recommendation) =>
          recommendationFeedbackMutation.mutate(recommendation)
        }
      />

      <PageCanvas topInset="compact">
        <AppLaunchpad
          apps={entitledApps}
          groups={launchpadCatalog.groups}
          layout={activeAppLayout}
          editing={editorOpen}
          title={t('page.appsTitle')}
          description={t('page.appsDescription')}
          customizationBusy={customizationBusy}
          onStartEditing={beginEditing}
          onLayoutChange={setDraftAppLayout}
          onLaunch={launchApp}
          onBrowseAll={() => navigate('/apps')}
        />

        <Box
          sx={{
            mt: 4,
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Typography component="p" variant="overline" color="primary.main">
            {t('page.today')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('page.dateUpdated', { date: currentDate, time: workspaceUpdatedAt })}
          </Typography>
        </Box>

        <WorkspaceWidgetCanvas
          registry={HOME_WIDGET_REGISTRY}
          widgets={activeWidgets}
          editing={editorOpen}
          busy={customizationBusy}
          presentation={activePresentation}
          getLabel={(widgetKey) => t(`widgets.registry.${widgetKey}.label`)}
          onChange={setDraftWidgets}
          renderWidget={(widgetKey, size) => (
            <HomeWidget
              widgetKey={widgetKey}
              size={size}
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

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 2 }}>
          <Clock3 size={15} aria-hidden="true" />
          <Typography variant="caption" color="text.secondary">
            {t('page.lastRefreshed', { time: workspaceUpdatedAt })}
          </Typography>
        </Box>
        {editorOpen && <Box aria-hidden="true" sx={{ height: 76 }} />}
      </PageCanvas>

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

      {editorOpen && (
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
