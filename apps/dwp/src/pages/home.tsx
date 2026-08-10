import { useMemo, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getHomeExperience,
  getHomePreference,
  resetHomePreference,
  resolveHomeBackgroundUrl,
  updateHomePreference,
  useAuth,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';
import { PageCanvas } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { AppLaunchpad } from '../features/home/app-launchpad';
import { AnnouncementsWidget } from '../features/home/announcements-widget';
import { HomeWidgetEditor } from '../features/home/home-widget-editor';
import { reconcileHomeWidgets } from '../features/home/home-widget-registry';
import {
  ActivityWidget,
  DailyBriefWidget,
  FocusWidget,
  ScheduleWidget,
} from '../features/home/home-widgets';
import {
  HOME_APPS,
  isAppEntitled,
  launchpadStorageKey,
} from '../features/home/app-launchpad-model';

import type {
  HomePreferenceLayout,
  HomeWidgetKey,
  HomeWidgetPreference,
} from '@dwp-frontend/shared-utils';
import type { LaunchpadLayout } from '../features/home/app-launchpad-model';

type PreferenceMutation =
  | { kind: 'save'; layout: HomePreferenceLayout; message: string }
  | { kind: 'reset'; message: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The home preference could not be saved.';
}

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
  const auth = useAuth();
  const toast = useToast();
  const { permissions } = usePermissions();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(searchParams.get('edit') === 'home');
  const closeEditor = () => {
    setEditorOpen(false);
    if (searchParams.get('edit') === 'home') {
      const next = new URLSearchParams(searchParams);
      next.delete('edit');
      setSearchParams(next, { replace: true });
    }
  };
  const firstName = auth.user?.displayName?.split(' ')[0] || 'there';
  const entitledApps = useMemo(
    () => HOME_APPS.filter((app) => isAppEntitled(app, auth.user?.roles ?? [], permissions)),
    [auth.user?.roles, permissions]
  );
  const personalLayoutKey = launchpadStorageKey(auth.user?.tenantId ?? 0, auth.user?.userId ?? 0);
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
    () => reconcileHomeWidgets(homePreference?.layout.widgets),
    [homePreference?.layout.widgets]
  );
  const visibleWidgets = widgetPreferences.filter((widget) => widget.visible);
  const preferenceVersion = homePreference?.version ?? 0;

  const preferenceMutation = useMutation({
    mutationFn: (request: PreferenceMutation) =>
      request.kind === 'reset'
        ? resetHomePreference(preferenceVersion)
        : updateHomePreference(request.layout, preferenceVersion),
    onSuccess: async (next, request) => {
      queryClient.setQueryData(['home-preference', auth.user?.tenantId, auth.user?.userId], next);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'audit-events'] });
      closeEditor();
      toast.success(request.message);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const saveWidgets = (widgets: HomeWidgetPreference[]) => {
    preferenceMutation.mutate({
      kind: 'save',
      layout: { appLayout: homePreference?.layout.appLayout ?? null, widgets },
      message: 'Home view saved.',
    });
  };

  const saveAppLayout = (appLayout: LaunchpadLayout) => {
    preferenceMutation.mutate({
      kind: 'save',
      layout: { appLayout, widgets: widgetPreferences },
      message: 'App layout saved.',
    });
  };

  const resetPreference = () => {
    if (!homePreference?.customized) {
      closeEditor();
      return;
    }
    preferenceMutation.mutate({ kind: 'reset', message: 'Default home view restored.' });
  };

  const backgroundUrl = resolveHomeBackgroundUrl(homeExperience);
  const backgroundPosition = homeExperience?.backgroundUrl
    ? `${homeExperience.backgroundPosition.toLowerCase()} center`
    : 'right center';
  const backgroundSize = homeExperience?.backgroundUrl ? 'cover' : { xs: 'cover', md: '195% auto' };
  const overlayOpacity = (homeExperience?.overlayOpacity ?? 18) / 100;
  const currentDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'full' }).format(new Date());

  return (
    <Box>
      <Box
        component="section"
        aria-label="Personal app workspace"
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
            key={`${personalLayoutKey}:${homePreference?.version ?? 'local'}`}
            apps={entitledApps}
            storageKey={personalLayoutKey}
            initialLayout={homePreference ? homePreference.layout.appLayout : undefined}
            title={homeExperience?.headline || `Welcome back, ${firstName}`}
            description={
              homeExperience?.subheadline || 'Your assigned apps and services, ready to launch.'
            }
            immersive
            customizationBusy={preferenceMutation.isPending}
            onEditHome={() => setEditorOpen(true)}
            onLayoutCommit={saveAppLayout}
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
            Today
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {currentDate} / Updated 09:10
          </Typography>
        </Box>

        <Box
          sx={{
            mt: 1,
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(12, minmax(0, 1fr))' },
            columnGap: { xs: 0, lg: 3 },
            rowGap: 3,
            '& > section:not([aria-labelledby="brief-heading"]):not([aria-labelledby="announcements-heading"])':
              {
                borderTop: 1,
                borderBottom: 1,
                borderColor: 'divider',
              },
          }}
        >
          {visibleWidgets.map((widget) => (
            <HomeWidget key={widget.widgetKey} widgetKey={widget.widgetKey} />
          ))}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 2 }}>
          <Clock3 size={15} aria-hidden="true" />
          <Typography variant="caption" color="text.secondary">
            Last refreshed 09:10 / Reference data only
          </Typography>
        </Box>
      </PageCanvas>

      <HomeWidgetEditor
        open={editorOpen}
        value={widgetPreferences}
        busy={preferenceMutation.isPending}
        onClose={closeEditor}
        onSave={saveWidgets}
        onReset={resetPreference}
      />
    </Box>
  );
}
