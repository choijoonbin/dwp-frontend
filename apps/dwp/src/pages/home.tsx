import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock3 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getHomeExperience,
  getHomePreference,
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
  const { t } = useTranslation('home');
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
  const homeExperience = homeExperienceQuery.data;
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
    if (!editorOpen || editBaseVersion !== preferenceVersion) {
      setDraftAppLayout(appLayout);
      setDraftWidgets(widgetPreferences);
      if (editorOpen) setEditBaseVersion(preferenceVersion);
    }
  }, [appLayout, editBaseVersion, editorOpen, preferenceVersion, widgetPreferences]);

  const beginEditing = () => {
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

  return (
    <Box>
      <Box
        component="section"
        aria-label={t('page.personalWorkspace')}
        sx={{
          position: 'relative',
          minHeight: { xs: 560, md: 510 },
          py: { xs: 2, md: 3 },
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
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(1,8,24,0.08) 0%, rgba(1,8,24,0.02) 48%, rgba(1,8,24,0.34) 100%)',
            pointerEvents: 'none',
          },
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <AppLaunchpad
            apps={entitledApps}
            layout={activeAppLayout}
            editing={editorOpen}
            title={
              homeExperience?.headline ||
              (firstName ? t('page.welcomeName', { name: firstName }) : t('page.welcome'))
            }
            description={homeExperience?.subheadline || t('page.assignedDescription')}
            immersive
            customizationBusy={preferenceMutation.isPending}
            onStartEditing={beginEditing}
            onLayoutChange={setDraftAppLayout}
            onLaunch={(app) => navigate(app.route)}
            onBrowseAll={() => navigate('/apps')}
          />
        </Box>
      </Box>

      <PageCanvas>
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
            {t('page.dateUpdated', { date: currentDate, time: '09:10' })}
          </Typography>
        </Box>

        <HomeWidgetLayout
          widgets={activeWidgets}
          editing={editorOpen}
          busy={preferenceMutation.isPending}
          onChange={setDraftWidgets}
          renderWidget={(widgetKey) => <HomeWidget widgetKey={widgetKey} />}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 2 }}>
          <Clock3 size={15} aria-hidden="true" />
          <Typography variant="caption" color="text.secondary">
            {t('page.lastRefreshed', { time: '09:10' })}
          </Typography>
        </Box>
        {editorOpen && <Box aria-hidden="true" sx={{ height: 76 }} />}
      </PageCanvas>

      <HomeItemGallery
        open={galleryOpen}
        hiddenApps={hiddenApps}
        hiddenWidgetKeys={hiddenWidgetKeys}
        busy={preferenceMutation.isPending}
        onClose={() => setGalleryOpen(false)}
        onAddApp={(app) => setDraftAppLayout((current) => restoreLaunchpadApp(current, app))}
        onAddWidget={(widgetKey) =>
          setDraftWidgets((current) => setHomeWidgetVisibility(current, widgetKey, true))
        }
      />

      {editorOpen && (
        <HomeEditToolbar
          busy={preferenceMutation.isPending}
          onAdd={() => setGalleryOpen(true)}
          onReset={resetDraft}
          onCancel={cancelEditing}
          onDone={saveHome}
        />
      )}
    </Box>
  );
}
