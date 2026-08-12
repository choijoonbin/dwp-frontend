import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ListChecks,
  TimerReset,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getHomeExperience,
  getHomePreference,
  getWorkspaceApps,
  getWorkspaceWorkQueue,
  launchWorkspaceApp,
  resolveHomeBackgroundUrl,
  updateHomePreference,
  useAuth,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';
import { ActionButton, PageCanvas } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AppLaunchpad } from '../features/home/app-launchpad';
import { AnnouncementsWidget } from '../features/home/announcements-widget';
import { HomeEditToolbar } from '../features/home/home-edit-toolbar';
import { HomeItemGallery } from '../features/home/home-item-gallery';
import { HomeWidgetLayout } from '../features/home/home-widget-layout';
import {
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
import {
  createDefaultLaunchpadLayout,
  isAppEntitled,
  localizeHomeApps,
  reconcileLaunchpadLayout,
  restoreLaunchpadApp,
} from '../features/home/app-launchpad-model';
import { useSystemCodeOptions } from '../components/use-system-code-options';

import type {
  HomePreferenceLayout,
  HomeWidgetKey,
  HomeWidgetPreference,
} from '@dwp-frontend/shared-utils';
import type { LaunchpadLayout } from '../features/home/app-launchpad-model';

type PreferenceMutation = { layout: HomePreferenceLayout };

function HomeWidget({ widgetKey }: { widgetKey: HomeWidgetKey }) {
  switch (widgetKey) {
    case 'announcements':
      return <AnnouncementsWidget />;
    case 'daily-brief':
      return <DailyBriefWidget />;
    case 'focus':
      return <FocusWidget />;
    case 'schedule':
      return <ScheduleWidget />;
    case 'activity':
      return <ActivityWidget />;
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
  const entitledApps = useMemo(
    () =>
      localizeHomeApps(t).filter((app) => isAppEntitled(app, auth.user?.roles ?? [], permissions)),
    [auth.user?.roles, permissions, t]
  );
  const [draftAppLayout, setDraftAppLayout] = useState<LaunchpadLayout>(() =>
    createDefaultLaunchpadLayout(entitledApps)
  );
  const [draftWidgets, setDraftWidgets] = useState<HomeWidgetPreference[]>(() =>
    defaultHomeWidgets(registeredWidgetKeys)
  );
  const homeExperienceQuery = useQuery({
    queryKey: ['home-experience', auth.user?.tenantId],
    queryFn: getHomeExperience,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
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
  const workQueueQuery = useQuery({
    queryKey: ['workspace', 'work-queue'],
    queryFn: getWorkspaceWorkQueue,
    staleTime: 30_000,
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
  const widgetPreferences = useMemo(
    () => reconcileHomeWidgets(homePreference?.layout.widgets, registeredWidgetKeys),
    [homePreference?.layout.widgets, registeredWidgetKeys]
  );
  const appLayout = useMemo(
    () => reconcileLaunchpadLayout(homePreference?.layout.appLayout, entitledApps),
    [entitledApps, homePreference?.layout.appLayout]
  );
  const preferenceVersion = homePreference?.version ?? 0;
  const activeAppLayout = editorOpen ? draftAppLayout : appLayout;
  const activeWidgets = editorOpen ? draftWidgets : widgetPreferences;
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
      return;
    }
    if (editBaseVersion === null && !homePreferenceQuery.isLoading) {
      setDraftAppLayout(appLayout);
      setDraftWidgets(widgetPreferences);
      setEditBaseVersion(preferenceVersion);
    }
  }, [
    appLayout,
    editBaseVersion,
    editorOpen,
    homePreferenceQuery.isLoading,
    preferenceVersion,
    widgetPreferences,
  ]);

  const beginEditing = () => {
    if (homePreferenceQuery.isLoading) return;
    setDraftAppLayout(appLayout);
    setDraftWidgets(widgetPreferences);
    setEditBaseVersion(preferenceVersion);
    setEditorOpen(true);
  };

  const cancelEditing = () => {
    setDraftAppLayout(appLayout);
    setDraftWidgets(widgetPreferences);
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
  const customizationBusy = homePreferenceQuery.isLoading || preferenceMutation.isPending;

  const saveHome = () => {
    preferenceMutation.mutate({
      layout: { appLayout: draftAppLayout, widgets: draftWidgets },
    });
  };

  const resetDraft = () => {
    setDraftAppLayout(createDefaultLaunchpadLayout(entitledApps));
    setDraftWidgets(defaultHomeWidgets(registeredWidgetKeys));
  };

  const backgroundUrl = resolveHomeBackgroundUrl(homeExperience);
  const backgroundPosition = homeExperience?.backgroundUrl
    ? `${homeExperience.backgroundPosition.toLowerCase()} center`
    : 'right center';
  const backgroundSize = homeExperience?.backgroundUrl ? 'cover' : { xs: 'cover', md: '195% auto' };
  const overlayOpacity = (homeExperience?.overlayOpacity ?? 18) / 100;
  const currentDate = formatDate(new Date(), { dateStyle: 'full' });
  const workspaceUpdatedAt = workQueueQuery.data?.generatedAt
    ? formatDate(new Date(workQueueQuery.data.generatedAt), {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';
  const runtimeAppById = new Map((workspaceAppsQuery.data ?? []).map((app) => [app.id, app]));
  const activeWorkItems = useMemo(
    () =>
      [...(workQueueQuery.data?.items ?? [])]
        .filter((item) => item.status !== 'completed')
        .sort((left, right) => {
          const statusOrder = { 'due-soon': 0, 'in-progress': 1, waiting: 2, completed: 3 };
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return (
            statusOrder[left.status] - statusOrder[right.status] ||
            priorityOrder[left.priority] - priorityOrder[right.priority] ||
            new Date(left.dueAt ?? '9999-12-31').getTime() -
              new Date(right.dueAt ?? '9999-12-31').getTime()
          );
        }),
    [workQueueQuery.data?.items]
  );
  const topPriority = activeWorkItems[0];
  const workSummary = workQueueQuery.data?.summary;
  const commandSignals = [
    {
      key: 'open',
      value: Math.max(0, (workSummary?.total ?? 0) - (workSummary?.completed ?? 0)),
      icon: ListChecks,
      color: '#7DB7FF',
    },
    { key: 'dueSoon', value: workSummary?.dueSoon ?? 0, icon: TimerReset, color: '#F8C15C' },
    { key: 'inProgress', value: workSummary?.inProgress ?? 0, icon: Clock3, color: '#6FE0C1' },
    { key: 'waiting', value: workSummary?.waiting ?? 0, icon: CircleAlert, color: '#FF9A8B' },
  ] as const;
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
      <Box
        component="section"
        aria-label={t('page.personalWorkspace')}
        data-testid="home-command-center"
        sx={{
          position: 'relative',
          py: { xs: 3, md: 4 },
          overflow: 'hidden',
          isolation: 'isolate',
          bgcolor: '#07163D',
          backgroundImage: `url(${backgroundUrl})`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition,
          backgroundSize,
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            bgcolor: `rgba(2, 10, 34, ${overlayOpacity})`,
            pointerEvents: 'none',
          },
        }}
      >
        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            width: 'calc(100% - 32px)',
            maxWidth: 1600,
            mx: 'auto',
            px: { xs: 0, md: 2 },
            color: 'common.white',
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ xs: 'stretch', md: 'flex-end' }}
            justifyContent="space-between"
            gap={2}
          >
            <Box minWidth={0}>
              <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.74)' }}>
                {currentDate}
              </Typography>
              <Typography component="h1" variant="h4" sx={{ mt: 0.25, color: 'common.white' }}>
                {localizedHomeCopy?.headline ||
                  homeExperience?.headline ||
                  (firstName ? t('page.welcomeName', { name: firstName }) : t('page.welcome'))}
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 0.75, maxWidth: 720, color: 'rgba(255,255,255,0.78)' }}
              >
                {localizedHomeCopy?.subheadline ||
                  homeExperience?.subheadline ||
                  t('page.commandDescription')}
              </Typography>
            </Box>
            <Chip
              size="small"
              variant="outlined"
              label={t('page.updatedAt', { time: workspaceUpdatedAt })}
              sx={{
                alignSelf: { xs: 'flex-start', md: 'flex-end' },
                color: 'common.white',
                borderColor: 'rgba(255,255,255,0.42)',
                bgcolor: 'rgba(2,10,34,0.28)',
              }}
            />
          </Stack>

          <Box
            sx={{
              mt: { xs: 2.5, md: 3 },
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 7fr) minmax(420px, 5fr)' },
              borderTop: '1px solid rgba(255,255,255,0.26)',
              borderBottom: '1px solid rgba(255,255,255,0.26)',
              bgcolor: 'rgba(2,10,34,0.36)',
            }}
          >
            <Box sx={{ p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.68)' }}>
                {t('page.nextPriority')}
              </Typography>
              {workQueueQuery.isLoading ? (
                <Typography variant="body2" sx={{ mt: 1.25, color: 'rgba(255,255,255,0.78)' }}>
                  {t('page.loadingPriorities')}
                </Typography>
              ) : workQueueQuery.isError ? (
                <Stack alignItems="flex-start" gap={1} sx={{ mt: 1 }}>
                  <Typography variant="body2" sx={{ color: '#FFD5CE' }}>
                    {t('page.priorityLoadError')}
                  </Typography>
                  <ActionButton
                    size="small"
                    intent="secondary"
                    onClick={() => void workQueueQuery.refetch()}
                    sx={{ color: 'common.white', borderColor: 'rgba(255,255,255,0.52)' }}
                  >
                    {t('page.retry')}
                  </ActionButton>
                </Stack>
              ) : topPriority ? (
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  gap={2}
                  sx={{ mt: 0.75 }}
                >
                  <Box minWidth={0} flex={1}>
                    <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                      <Chip
                        size="small"
                        label={topPriority.type}
                        sx={{ color: '#07163D', bgcolor: '#E7F0FF' }}
                      />
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t(`page.priority.${topPriority.priority}`)}
                        sx={{ color: 'common.white', borderColor: 'rgba(255,255,255,0.42)' }}
                      />
                      {topPriority.dueAt && (
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                          {formatDate(topPriority.dueAt, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </Typography>
                      )}
                    </Stack>
                    <Typography component="h2" variant="h6" sx={{ mt: 1, color: 'common.white' }}>
                      {topPriority.title}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.35, color: 'rgba(255,255,255,0.76)' }}>
                      {topPriority.reason ?? topPriority.summary}
                    </Typography>
                  </Box>
                  <ActionButton
                    intent="primary"
                    endIcon={<ArrowRight size={17} aria-hidden="true" />}
                    onClick={() => navigate(`/work?item=${encodeURIComponent(topPriority.id)}`)}
                    sx={{ flexShrink: 0, alignSelf: { xs: 'flex-start', sm: 'center' } }}
                  >
                    {t('page.openPriority')}
                  </ActionButton>
                </Stack>
              ) : (
                <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 1 }}>
                  <CheckCircle2 size={20} color="#6FE0C1" aria-hidden="true" />
                  <Box>
                    <Typography variant="body2" fontWeight={700} color="common.white">
                      {t('page.clearTitle')}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                      {t('page.clearDescription')}
                    </Typography>
                  </Box>
                </Stack>
              )}
            </Box>

            <Box
              component="section"
              aria-label={t('page.commandSignals')}
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                borderTop: { xs: '1px solid rgba(255,255,255,0.22)', lg: 0 },
                borderLeft: { lg: '1px solid rgba(255,255,255,0.22)' },
              }}
            >
              {commandSignals.map(({ key, value, icon: SignalIcon, color }, index) => (
                <Stack
                  key={key}
                  direction="row"
                  alignItems="center"
                  gap={1}
                  sx={{
                    minWidth: 0,
                    p: { xs: 1.5, md: 2 },
                    borderRight: index % 2 === 0 ? '1px solid rgba(255,255,255,0.18)' : undefined,
                    borderBottom: index < 2 ? '1px solid rgba(255,255,255,0.18)' : undefined,
                  }}
                >
                  <SignalIcon size={18} color={color} aria-hidden="true" />
                  <Box minWidth={0}>
                    <Typography
                      component="p"
                      variant="h6"
                      sx={{ color: 'common.white', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {value}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.68)' }}>
                      {t(`page.signals.${key}`)}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>

      <PageCanvas>
        <AppLaunchpad
          apps={entitledApps}
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

        <HomeWidgetLayout
          widgets={activeWidgets}
          editing={editorOpen}
          busy={customizationBusy}
          onChange={setDraftWidgets}
          renderWidget={(widgetKey) => <HomeWidget widgetKey={widgetKey} />}
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
        <HomeEditToolbar
          busy={customizationBusy}
          onAdd={() => setGalleryOpen(true)}
          onReset={resetDraft}
          onCancel={cancelEditing}
          onDone={saveHome}
        />
      )}
    </Box>
  );
}
