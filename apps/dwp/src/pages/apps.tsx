import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Grid3X3,
  LockKeyhole,
  Pin,
  PinOff,
  Send,
  ShieldCheck,
  TriangleAlert,
  X,
} from 'lucide-react';
import {
  cancelWorkspaceAppAccessRequest,
  getWorkspaceApps,
  launchWorkspaceApp,
  requestWorkspaceAppAccess,
  setWorkspaceAppPinned,
  useToast,
} from '@dwp-frontend/shared-utils';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  ActionIconButton,
  EmptyState,
  FilterBar,
  FormDialog,
  FormField,
  GuidedEmptyState,
  LiveStatus,
  LocalErrorState,
  LoadingState,
  mergeFilterSearchParams,
  PageCanvas,
  ResourcePageHeader,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import ButtonBase from '@mui/material/ButtonBase';
import ToggleButton from '@mui/material/ToggleButton';
import Typography from '@mui/material/Typography';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { SectionHeading } from '../components/workspace-ui';
import { HOME_APPS } from '../components/workspace-composer/app-launchpad-model';
import { AppGlyph } from '../features/home/app-glyph';
import { GovernedSavedViewControl } from '../components/governed-saved-view-control';

import type { WorkspaceApp } from '@dwp-frontend/shared-utils';

type AppFilter = 'all' | 'available' | 'requestable' | 'pending' | 'pinned' | 'connected';

const homeAppById = new Map(HOME_APPS.map((app) => [app.id, app]));
const fallbackAppVisual = { iconKey: 'legacy', tone: '#4B5663' } as const;
const emptyApps: WorkspaceApp[] = [];
const APP_FILTERS: AppFilter[] = [
  'all',
  'available',
  'requestable',
  'pending',
  'pinned',
  'connected',
];

function isAppFilter(value: string | null): value is AppFilter {
  return Boolean(value && APP_FILTERS.includes(value as AppFilter));
}

function appVisual(app: WorkspaceApp) {
  return homeAppById.get(app.id) ?? fallbackAppVisual;
}

function HealthIcon({ health }: { health: WorkspaceApp['health'] }) {
  if (health === 'healthy') return <CheckCircle2 size={15} strokeWidth={1.8} />;
  if (health === 'attention') return <TriangleAlert size={15} strokeWidth={1.8} />;
  if (health === 'configuration-required') {
    return <TriangleAlert size={15} strokeWidth={1.8} />;
  }
  return <ShieldCheck size={15} strokeWidth={1.8} />;
}

function AppIcon({ app, size = 46 }: { app: WorkspaceApp; size?: number }) {
  return <AppGlyph app={appVisual(app)} size={size} />;
}

function AccessRequestDialog({
  app,
  busy,
  onClose,
  onSubmit,
}: {
  app: WorkspaceApp | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (justification: string, requestedUntil?: string) => Promise<void>;
}) {
  const { t } = useTranslation('work');
  const [justification, setJustification] = useState('');
  const [duration, setDuration] = useState<'30' | '90' | 'NONE'>('30');
  const valid = justification.trim().length >= 10;
  const requestedUntil =
    duration === 'NONE'
      ? undefined
      : new Date(Date.now() + Number(duration) * 24 * 60 * 60 * 1000).toISOString();

  return (
    <FormDialog
      open={Boolean(app)}
      title={t('appsPage.access.dialogTitle', { app: app?.name ?? '' })}
      description={t('appsPage.access.dialogDescription')}
      cancelLabel={t('appsPage.access.cancel')}
      submitLabel={t('appsPage.access.submit')}
      submittingLabel={t('appsPage.access.submitting')}
      busy={busy}
      submitDisabled={!valid}
      onClose={onClose}
      onSubmit={() => onSubmit(justification.trim(), requestedUntil)}
      maxWidth="sm"
    >
      <Stack gap={2}>
        <FormField
          label={t('appsPage.access.resource')}
          size="small"
          value={app?.resourceKey ?? ''}
          disabled
        />
        <FormField
          select
          size="small"
          label={t('appsPage.access.duration')}
          required
          value={duration}
          onChange={(event) => setDuration(event.target.value as typeof duration)}
        >
          {(['30', '90', 'NONE'] as const).map((value) => (
            <MenuItem key={value} value={value}>
              {t(`appsPage.access.durations.${value}`)}
            </MenuItem>
          ))}
        </FormField>
        <FormField
          label={t('appsPage.access.justification')}
          required
          multiline
          minRows={3}
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
          supportingText={t('appsPage.access.justificationHelp')}
          slotProps={{ htmlInput: { maxLength: 1000 } }}
        />
      </Stack>
    </FormDialog>
  );
}

export default function AppsPage() {
  const { t } = useTranslation('work');
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = searchParams.get('type');
  const filter: AppFilter = isAppFilter(filterParam) ? filterParam : 'all';
  const query = searchParams.get('q') ?? '';
  const selectedAppId = searchParams.get('app');
  const [requestingApp, setRequestingApp] = useState<WorkspaceApp | null>(null);
  const appsQuery = useQuery({
    queryKey: ['workspace', 'apps'],
    queryFn: getWorkspaceApps,
    staleTime: 60_000,
    retry: 1,
  });
  const apps = appsQuery.data ?? emptyApps;
  const pinnedApps = apps.filter((app) => app.pinned && app.accessState === 'AVAILABLE');

  const visibleApps = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return apps.filter((app) => {
      const filterMatch =
        filter === 'all' ||
        (filter === 'pinned' && app.pinned) ||
        (filter === 'available' && app.accessState === 'AVAILABLE') ||
        (filter === 'requestable' && app.accessState === 'REQUESTABLE') ||
        (filter === 'pending' && ['PENDING', 'APPROVED_PENDING_SYNC'].includes(app.accessState)) ||
        (filter === 'connected' && app.launchMode !== 'Native');
      const queryMatch =
        !normalized ||
        [app.name, app.description, app.owner].some((value) =>
          value.toLowerCase().includes(normalized)
        );
      return filterMatch && queryMatch;
    });
  }, [apps, filter, query]);

  const selectFilter = (value: AppFilter) => {
    setSearchParams(
      mergeFilterSearchParams(searchParams, { type: value === 'all' ? null : value }),
      { replace: true }
    );
  };
  const changeFilter = (_event: React.MouseEvent<HTMLElement>, value: AppFilter | null) => {
    if (value) selectFilter(value);
  };

  const pinMutation = useMutation({
    mutationFn: (app: WorkspaceApp) => setWorkspaceAppPinned(app.id, !app.pinned, app.version),
    onSuccess: (updated) => {
      queryClient.setQueryData<WorkspaceApp[]>(['workspace', 'apps'], (current = []) =>
        current.map((app) => (app.id === updated.id ? updated : app))
      );
      toast.success(
        updated.pinned
          ? t('appsPage.pinSuccess', { app: updated.name })
          : t('appsPage.unpinSuccess', { app: updated.name })
      );
    },
    onError: () => toast.error(t('appsPage.pinError')),
  });
  const launchMutation = useMutation({
    mutationFn: launchWorkspaceApp,
    onSuccess: async (launch) => {
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'apps'] });
      if (launch.launchMode === 'NATIVE') {
        navigate(launch.launchTarget);
      } else {
        window.open(launch.launchTarget, '_blank', 'noopener,noreferrer');
      }
    },
    onError: () => toast.error(t('appsPage.launchError')),
  });
  const requestMutation = useMutation({
    mutationFn: ({
      app,
      justification,
      requestedUntil,
    }: {
      app: WorkspaceApp;
      justification: string;
      requestedUntil?: string;
    }) => requestWorkspaceAppAccess(app.id, { justification, requestedUntil }),
    onSuccess: async () => {
      setRequestingApp(null);
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'apps'] });
      toast.success(t('appsPage.access.requested'));
    },
    onError: () => toast.error(t('appsPage.access.requestError')),
  });
  const cancelRequestMutation = useMutation({
    mutationFn: (app: WorkspaceApp) =>
      cancelWorkspaceAppAccessRequest(app.accessRequestId!, app.accessRequestVersion!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'apps'] });
      toast.success(t('appsPage.access.cancelled'));
    },
    onError: () => toast.error(t('appsPage.access.cancelError')),
  });

  const launch = (app: WorkspaceApp) => {
    if (app.accessState === 'REQUESTABLE') {
      setRequestingApp(app);
      return;
    }
    if (app.accessState === 'PENDING') {
      toast.warning(t('appsPage.access.pendingMessage', { app: app.name }));
      return;
    }
    if (
      app.accessState === 'APPROVED_PENDING_SYNC' ||
      app.accessState === 'APPROVED_REFRESHING' ||
      app.accessState === 'APPROVED_SYNC_FAILED'
    ) {
      toast.warning(t('appsPage.access.syncMessage', { app: app.name }));
      return;
    }
    if (app.health === 'configuration-required') {
      toast.warning(t('appsPage.configurationRequired', { app: app.name }));
      return;
    }
    launchMutation.mutate(app.id);
  };

  const header = (
    <ResourcePageHeader
      eyebrow={t('appsPage.header.eyebrow')}
      title={t('appsPage.header.title')}
      description={t('appsPage.header.description')}
      status={
        <LiveStatus
          state={appsQuery.isFetching ? 'syncing' : 'live'}
          label={t('appsPage.liveCatalog')}
          refreshLabel={t('appsPage.retry')}
          refreshing={appsQuery.isFetching}
          onRefresh={() => void appsQuery.refetch()}
        />
      }
    />
  );
  if (appsQuery.isLoading) {
    return (
      <PageCanvas>
        {header}
        <LoadingState label={t('appsPage.loading')} variant="skeleton" size="page" />
      </PageCanvas>
    );
  }
  if (appsQuery.isError) {
    return (
      <PageCanvas>
        {header}
        <LocalErrorState
          title={t('appsPage.loadErrorTitle')}
          description={t('appsPage.loadErrorDescription')}
          retryLabel={t('appsPage.retry')}
          onRetry={() => void appsQuery.refetch()}
          retrying={appsQuery.isFetching}
          size="page"
        />
      </PageCanvas>
    );
  }
  if (apps.length === 0) {
    return (
      <PageCanvas>
        {header}
        <EmptyState
          title={t('appsPage.emptyTitle')}
          description={t('appsPage.emptyDescription')}
          size="page"
        />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas>
      {header}

      <Box component="section" aria-labelledby="launchpad-heading" sx={{ mt: 4 }}>
        <SectionHeading
          id="launchpad-heading"
          icon={Grid3X3}
          title={t('appsPage.launchpad')}
          meta={
            <Typography variant="body2" color="text.secondary">
              {t('appsPage.pinnedCount', { count: pinnedApps.length })}
            </Typography>
          }
        />
        <Box
          component="ul"
          sx={{
            p: 0,
            mt: 2,
            mb: 0,
            listStyle: 'none',
            display: 'grid',
            gridTemplateColumns: { xs: 'none', sm: 'repeat(3, minmax(0, 1fr))' },
            gridAutoFlow: { xs: 'column', sm: 'row' },
            gridAutoColumns: { xs: 'minmax(270px, 82vw)', sm: 'auto' },
            gap: 1.5,
            overflowX: { xs: 'auto', sm: 'visible' },
            scrollSnapType: { xs: 'x mandatory', sm: 'none' },
            pb: { xs: 1, sm: 0 },
          }}
        >
          {pinnedApps.map((app) => (
            <Box
              component="li"
              key={app.id}
              sx={{ minWidth: 0, scrollSnapAlign: 'start', position: 'relative' }}
            >
              <ButtonBase
                onClick={() => launch(app)}
                sx={{
                  width: 1,
                  minHeight: 166,
                  p: 2.5,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  justifyContent: 'space-between',
                  gap: 2,
                  textAlign: 'left',
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  borderTop: 3,
                  borderTopColor: appVisual(app).tone,
                  borderRadius: 1,
                  transition: (theme) =>
                    theme.transitions.create(['border-color', 'box-shadow', 'transform']),
                  '&:hover': {
                    borderColor: appVisual(app).tone,
                    transform: 'translateY(-2px)',
                    boxShadow: '0 12px 28px rgba(15, 21, 29, 0.09)',
                  },
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 2,
                  }}
                >
                  <AppIcon app={app} size={50} />
                  <Box sx={{ width: 32 }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography component="h3" variant="subtitle1">
                    {app.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3 }}>
                    {app.description}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 1 }}
                  >
                    {t('appsPage.lastUsed', {
                      value: app.lastUsedAt
                        ? formatDate(new Date(app.lastUsedAt), {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : t('appsPage.neverUsed'),
                    })}
                  </Typography>
                </Box>
              </ButtonBase>
              <ActionIconButton
                label={t('appsPage.unpinApp', { app: app.name })}
                tooltip={t('appsPage.unpin')}
                disabled={pinMutation.isPending}
                onClick={() => pinMutation.mutate(app)}
                sx={{ position: 'absolute', top: 12, right: 12 }}
              >
                <PinOff size={17} strokeWidth={1.8} />
              </ActionIconButton>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ mt: 5 }}>
        <FilterBar
          ariaLabel={t('appsPage.filterLabel')}
          searchLabel={t('appsPage.searchLabel')}
          searchValue={query}
          searchPlaceholder={t('appsPage.searchPlaceholder')}
          onSearchChange={(value) =>
            setSearchParams(mergeFilterSearchParams(searchParams, { q: value || null }), {
              replace: true,
            })
          }
          filters={
            <ToggleButtonGroup
              exclusive
              size="small"
              value={filter}
              onChange={changeFilter}
              aria-label={t('appsPage.filterLabel')}
            >
              {APP_FILTERS.map((value) => (
                <ToggleButton key={value} value={value}>
                  {t(`appsPage.filters.${value}`)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          }
          savedViews={
            <GovernedSavedViewControl
              surfaceKey="workspace.apps"
              currentConfiguration={{ q: query, type: filter }}
              selectedBuiltInViewId={!query ? `builtin-${filter}` : null}
              builtInViews={APP_FILTERS.map((value) => ({
                id: `builtin-${value}`,
                name: t(`appsPage.filters.${value}`),
                configuration: { q: '', type: value },
                isDefault: value === 'all',
              }))}
              onApply={(configuration) => {
                const nextType =
                  typeof configuration.type === 'string' && isAppFilter(configuration.type)
                    ? configuration.type
                    : 'all';
                const nextQuery = typeof configuration.q === 'string' ? configuration.q : '';
                setSearchParams(
                  mergeFilterSearchParams(searchParams, {
                    q: nextQuery || null,
                    type: nextType === 'all' ? null : nextType,
                    app: null,
                  }),
                  { replace: true }
                );
              }}
            />
          }
          activeFilters={
            filter === 'all'
              ? []
              : [
                  {
                    key: 'type',
                    label: t(`appsPage.filters.${filter}`),
                    onRemove: () => selectFilter('all'),
                  },
                ]
          }
          resetLabel={t('appsPage.resetFilters')}
          onReset={() =>
            setSearchParams(mergeFilterSearchParams(searchParams, { q: null, type: null }), {
              replace: true,
            })
          }
          resultLabel={t('appsPage.appCount', { count: visibleApps.length })}
        />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mt: 3 }}>
        <Typography component="h2" variant="h6">
          {t('appsPage.available')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('appsPage.appCount', { count: visibleApps.length })}
        </Typography>
      </Box>

      {visibleApps.length > 0 ? (
        <Box
          component="ul"
          sx={{
            p: 0,
            mt: 1.5,
            mb: 0,
            listStyle: 'none',
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
            borderTop: 1,
            borderLeft: { xs: 0, lg: 1 },
            borderColor: 'divider',
          }}
        >
          {visibleApps.map((app) => {
            const selected = selectedAppId === app.id;
            const healthColor =
              app.health === 'healthy'
                ? 'success.main'
                : app.health === 'attention'
                  ? 'warning.main'
                  : app.health === 'configuration-required'
                    ? 'warning.main'
                    : 'info.main';
            return (
              <Box
                component="li"
                key={app.id}
                sx={{
                  minWidth: 0,
                  position: 'relative',
                  borderRight: { xs: 0, lg: 1 },
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <ButtonBase
                  onClick={() => launch(app)}
                  sx={{
                    width: 1,
                    minHeight: 116,
                    p: 2,
                    display: 'grid',
                    gridTemplateColumns: '46px minmax(0, 1fr) auto',
                    alignItems: 'start',
                    gap: 1.75,
                    textAlign: 'left',
                    bgcolor: selected ? 'action.selected' : 'transparent',
                    transition: (theme) => theme.transitions.create('background-color'),
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <AppIcon app={app} />
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography component="h3" variant="subtitle2">
                        {app.name}
                      </Typography>
                      {app.pinned && (
                        <Chip label={t('appsPage.pinned')} size="small" color="info" />
                      )}
                      <Chip
                        label={t(`appsPage.access.states.${app.accessState}`)}
                        size="small"
                        color={
                          app.accessState === 'AVAILABLE'
                            ? 'success'
                            : app.accessState === 'REQUESTABLE'
                              ? 'info'
                              : 'warning'
                        }
                        variant="outlined"
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.2 }}>
                      {app.description}
                    </Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        flexWrap: 'wrap',
                        mt: 1,
                      }}
                    >
                      <Chip
                        label={t(`appsPage.launchMode.${app.launchMode}`)}
                        size="small"
                        variant="outlined"
                      />
                      <Box
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          color: healthColor,
                        }}
                      >
                        <HealthIcon health={app.health} />
                        <Typography variant="caption" color="inherit" fontWeight={700}>
                          {t(`appsPage.health.${app.health}`)}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {app.owner}
                      </Typography>
                    </Box>
                  </Box>
                  {app.accessState === 'AVAILABLE' ? (
                    <ArrowRight size={17} strokeWidth={1.8} aria-hidden="true" />
                  ) : app.accessState === 'REQUESTABLE' ? (
                    <LockKeyhole size={17} strokeWidth={1.8} aria-hidden="true" />
                  ) : app.accessState === 'PENDING' ? (
                    <Clock3 size={17} strokeWidth={1.8} aria-hidden="true" />
                  ) : (
                    <Send size={17} strokeWidth={1.8} aria-hidden="true" />
                  )}
                </ButtonBase>
                {app.accessState === 'AVAILABLE' ? (
                  <ActionIconButton
                    label={
                      app.pinned
                        ? t('appsPage.unpinApp', { app: app.name })
                        : t('appsPage.pinApp', { app: app.name })
                    }
                    tooltip={app.pinned ? t('appsPage.unpin') : t('appsPage.pin')}
                    disabled={pinMutation.isPending}
                    onClick={() => pinMutation.mutate(app)}
                    sx={{ position: 'absolute', right: 8, bottom: 8 }}
                  >
                    {app.pinned ? (
                      <PinOff size={16} strokeWidth={1.8} />
                    ) : (
                      <Pin size={16} strokeWidth={1.8} />
                    )}
                  </ActionIconButton>
                ) : app.accessState === 'PENDING' && app.accessRequestId ? (
                  <ActionIconButton
                    label={t('appsPage.access.cancelRequestFor', { app: app.name })}
                    tooltip={t('appsPage.access.cancelRequest')}
                    disabled={cancelRequestMutation.isPending}
                    onClick={() => cancelRequestMutation.mutate(app)}
                    sx={{ position: 'absolute', right: 8, bottom: 8 }}
                  >
                    <X size={16} strokeWidth={1.8} />
                  </ActionIconButton>
                ) : null}
              </Box>
            );
          })}
        </Box>
      ) : (
        <GuidedEmptyState
          kind="no-results"
          title={t('appsPage.noMatches')}
          description={t('appsPage.noMatchesDescription')}
          actionLabel={t('appsPage.resetFilters')}
          onAction={() =>
            setSearchParams(mergeFilterSearchParams(searchParams, { q: null, type: null }), {
              replace: true,
            })
          }
        />
      )}
      <AccessRequestDialog
        app={requestingApp}
        busy={requestMutation.isPending}
        onClose={() => setRequestingApp(null)}
        onSubmit={async (justification, requestedUntil) => {
          if (!requestingApp) return;
          await requestMutation.mutateAsync({
            app: requestingApp,
            justification,
            requestedUntil,
          });
        }}
      />
    </PageCanvas>
  );
}
