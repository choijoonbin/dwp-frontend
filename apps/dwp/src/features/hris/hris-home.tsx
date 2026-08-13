import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Building2,
  CalendarClock,
  ContactRound,
  DatabaseZap,
  LayoutDashboard,
  Network,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  ActionIconButton,
  EmptyState,
  PageCanvas,
  SignalMetric,
} from '@dwp-frontend/design-system';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';
import {
  HttpError,
  getOrganizationChart,
  getHomeSurfacePreference,
  getWorkspaceWorkQueue,
  listHrisSyncRuns,
  updateHomeSurfacePreference,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { PersonAvatar } from '../people/directory/person-avatar';
import { isHrisWorkItem } from './hris-experience-model';
import { HRIS_HOME_WIDGET_REGISTRY } from './hris-home-widget-registry';
import { mapLegacyHrisPath } from './hris-navigation';
import { useHrisExperience } from './use-hris-experience';
import { WorkspaceComposerToolbar } from '../workspace-composer/workspace-composer-toolbar';
import {
  defaultWorkspaceWidgets,
  reconcileWorkspaceWidgets,
  setWorkspaceWidgetVisibility,
  visibleWorkspaceRegistry,
} from '../workspace-composer/workspace-composer-model';
import { WorkspaceWidgetCanvas } from '../workspace-composer/workspace-widget-canvas';
import { WorkspaceWidgetGallery } from '../workspace-composer/workspace-widget-gallery';

import type {
  HomePresentation,
  HomePreferenceLayout,
  HomeWidgetSize,
  PersonalHomeWidgetPreference,
} from '@dwp-frontend/shared-utils';
import type { HrisHomeWidgetKey } from './hris-home-widget-registry';

function greetingKey(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function SectionSurface({
  title,
  meta,
  action,
  children,
}: {
  title: string;
  meta?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Paper component="section" variant="outlined" sx={{ minWidth: 0, overflow: 'hidden' }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        sx={{ px: 2, py: 1.6, borderBottom: 1, borderColor: 'divider' }}
      >
        <Box minWidth={0}>
          <Typography component="h2" variant="subtitle1" fontWeight={760}>
            {title}
          </Typography>
          {meta && (
            <Typography variant="caption" color="text.secondary">
              {meta}
            </Typography>
          )}
        </Box>
        {action}
      </Stack>
      {children}
    </Paper>
  );
}

function Shortcut({
  icon: Icon,
  label,
  tone,
  onClick,
}: {
  icon: typeof ContactRound;
  label: string;
  tone: string;
  onClick: () => void;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-label={label}
      sx={{
        minHeight: 72,
        p: { xs: 1.25, sm: 1.5 },
        justifyContent: 'flex-start',
        gap: { xs: 0.9, sm: 1.25 },
        textAlign: 'left',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        '&:hover': { borderColor: tone, bgcolor: alpha(tone, 0.045) },
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 36,
          height: 36,
          flex: '0 0 36px',
          display: 'grid',
          placeItems: 'center',
          borderRadius: 1,
          color: tone,
          bgcolor: alpha(tone, 0.1),
        }}
      >
        <Icon size={19} strokeWidth={1.8} />
      </Box>
      <Typography variant="body2" fontWeight={700} sx={{ flex: 1, lineHeight: 1.35 }}>
        {label}
      </Typography>
      <Box component="span" sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
        <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
      </Box>
    </ButtonBase>
  );
}

export function HrisHome() {
  const { t } = useTranslation('hris');
  const auth = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const experience = useHrisExperience();
  const [editorOpen, setEditorOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [editBaseVersion, setEditBaseVersion] = useState<number | null>(null);
  const [draftPresentation, setDraftPresentation] = useState<HomePresentation>('balanced');
  const [draftWidgets, setDraftWidgets] = useState<
    PersonalHomeWidgetPreference<HrisHomeWidgetKey>[]
  >(() => defaultWorkspaceWidgets(HRIS_HOME_WIDGET_REGISTRY));
  const eligibleRegistry = useMemo(
    () =>
      visibleWorkspaceRegistry(HRIS_HOME_WIDGET_REGISTRY, {
        isManager: experience.isManager,
        canOperate: experience.canOperate,
      }),
    [experience.canOperate, experience.isManager]
  );
  const homePreference = useQuery({
    queryKey: ['home-preference', 'hris-home', auth.user?.tenantId, auth.user?.userId],
    queryFn: () => getHomeSurfacePreference<HrisHomeWidgetKey>('hris-home'),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const workQueue = useQuery({
    queryKey: ['workspace', 'work-queue'],
    queryFn: getWorkspaceWorkQueue,
    staleTime: 30_000,
    retry: 1,
  });
  const teamChart = useQuery({
    queryKey: ['hris', 'team-chart'],
    queryFn: () => getOrganizationChart({ depth: 12, surface: 'directory' }),
    enabled: experience.isManager && Boolean(experience.currentPerson),
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
  const workforceChart = useQuery({
    queryKey: ['hris', 'operations-pulse'],
    queryFn: () => getOrganizationChart({ depth: 12, surface: 'workforce' }),
    enabled: experience.canOperate,
    staleTime: 60_000,
    retry: 1,
  });
  const syncRuns = useQuery({
    queryKey: ['hris', 'operations-sync-runs'],
    queryFn: () => listHrisSyncRuns(10),
    enabled: experience.canOperate,
    staleTime: 60_000,
    retry: false,
  });

  const persistedWidgets = useMemo(
    () => reconcileWorkspaceWidgets(homePreference.data?.layout.widgets, HRIS_HOME_WIDGET_REGISTRY),
    [homePreference.data?.layout.widgets]
  );
  const persistedPresentation = homePreference.data?.layout.presentation ?? 'balanced';
  const activeWidgets = editorOpen ? draftWidgets : persistedWidgets;
  const activePresentation = editorOpen ? draftPresentation : persistedPresentation;
  const hiddenWidgetKeys = activeWidgets
    .filter(
      (widget) =>
        !widget.visible &&
        eligibleRegistry.some((definition) => definition.key === widget.widgetKey)
    )
    .map((widget) => widget.widgetKey);

  useEffect(() => {
    if (editorOpen) return;
    setDraftWidgets(persistedWidgets);
    setDraftPresentation(persistedPresentation);
  }, [editorOpen, persistedPresentation, persistedWidgets]);

  const closeEditor = () => {
    setGalleryOpen(false);
    setEditorOpen(false);
    setEditBaseVersion(null);
  };
  const beginEditing = () => {
    if (homePreference.isLoading) return;
    setDraftWidgets(persistedWidgets);
    setDraftPresentation(persistedPresentation);
    setEditBaseVersion(homePreference.data?.version ?? 0);
    setEditorOpen(true);
  };
  const cancelEditing = () => {
    setDraftWidgets(persistedWidgets);
    setDraftPresentation(persistedPresentation);
    closeEditor();
  };
  const preferenceMutation = useMutation({
    mutationFn: (layout: HomePreferenceLayout<HrisHomeWidgetKey>) =>
      updateHomeSurfacePreference(
        'hris-home',
        layout,
        editBaseVersion ?? homePreference.data?.version ?? 0
      ),
    onSuccess: async (next) => {
      queryClient.setQueryData(
        ['home-preference', 'hris-home', auth.user?.tenantId, auth.user?.userId],
        next
      );
      await queryClient.invalidateQueries({ queryKey: ['admin', 'audit-events'] });
      closeEditor();
      toast.success(t('home.saved'));
    },
    onError: async (error) => {
      if (error instanceof HttpError && error.status === 409) {
        await homePreference.refetch();
        closeEditor();
        toast.error(t('home.saveConflict'));
        return;
      }
      toast.error(t('home.saveError'));
    },
  });
  const customizationBusy = homePreference.isLoading || preferenceMutation.isPending;

  const activeHrItems = useMemo(
    () =>
      (workQueue.data?.items ?? [])
        .filter((item) => item.status !== 'completed' && isHrisWorkItem(item))
        .sort((left, right) => {
          const priority = { high: 0, medium: 1, low: 2 } as const;
          return (
            priority[left.priority] - priority[right.priority] ||
            new Date(left.dueAt ?? '9999-12-31').getTime() -
              new Date(right.dueAt ?? '9999-12-31').getTime()
          );
        }),
    [workQueue.data?.items]
  );
  const directReports = useMemo(
    () =>
      (teamChart.data?.people ?? []).filter(
        (person) => person.managerPersonId === experience.currentPerson?.personId
      ),
    [experience.currentPerson?.personId, teamChart.data?.people]
  );
  const latestRun = useMemo(
    () =>
      [...(syncRuns.data ?? [])].sort(
        (left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime()
      )[0],
    [syncRuns.data]
  );
  const firstName = auth.user?.displayName?.trim().split(/\s+/u)[0] || t('home.personFallback');
  const person = experience.currentPerson;
  const shortcuts = [
    { icon: ContactRound, label: t('home.shortcuts.myProfile'), route: '/hr/me', tone: '#2463D4' },
    {
      icon: UsersRound,
      label: t('home.shortcuts.directory'),
      route: '/hr/directory',
      tone: '#087A68',
    },
    {
      icon: Network,
      label: t('home.shortcuts.organization'),
      route: '/hr/organization',
      tone: '#7A4FC4',
    },
    ...(experience.isManager
      ? [
          {
            icon: UserRoundCheck,
            label: t('home.shortcuts.myTeam'),
            route: '/hr/team',
            tone: '#B05C00',
          },
        ]
      : []),
    ...(experience.canOperate
      ? [
          {
            icon: DatabaseZap,
            label: t('home.shortcuts.operations'),
            route: '/hr/operations',
            tone: '#A53A50',
          },
        ]
      : []),
  ];
  const currentDate = formatDate(new Date(), { dateStyle: 'full' });
  const organizationName =
    person?.organizationName || auth.user?.tenantName || auth.user?.tenantCode;
  const selfDisplayName = auth.user?.displayName || person?.displayName || firstName;
  const renderWidget = (widgetKey: HrisHomeWidgetKey, size: HomeWidgetSize) => {
    switch (widgetKey) {
      case 'quick-actions':
        return (
          <Box
            component="section"
            aria-label={t('home.shortcuts.label')}
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                sm: size === 'medium' ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, 1fr)',
                lg: `repeat(${Math.min(shortcuts.length, size === 'medium' ? 2 : 5)}, minmax(0, 1fr))`,
              },
              gap: 1,
            }}
          >
            {shortcuts.map((shortcut) => (
              <Shortcut
                key={shortcut.route}
                icon={shortcut.icon}
                label={shortcut.label}
                tone={shortcut.tone}
                onClick={() => navigate(shortcut.route)}
              />
            ))}
          </Box>
        );
      case 'people-signals':
        return (
          <Box
            component="section"
            aria-label={t('home.signals.label')}
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                xl: size === 'full' ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)',
              },
              gap: 1,
              height: '100%',
            }}
          >
            <SignalMetric
              label={t('home.signals.attention')}
              value={formatNumber(activeHrItems.length)}
              detail={t('home.signals.attentionDetail')}
              icon={<CalendarClock size={17} />}
              tone={activeHrItems.length ? 'warning' : 'success'}
              onClick={activeHrItems[0] ? () => navigate('/hr/home#attention') : undefined}
            />
            <SignalMetric
              label={t('home.signals.organization')}
              value={person?.organizationKey || t('home.signals.organizationValue')}
              detail={
                [person?.organizationName, person?.managerDisplayName]
                  .filter(Boolean)
                  .join(' · ') || t('home.signals.managerUnavailable')
              }
              icon={<Building2 size={17} />}
              tone="info"
              onClick={() => navigate('/hr/organization')}
            />
            <SignalMetric
              label={t('home.signals.team')}
              value={formatNumber(directReports.length || person?.directReportCount || 0)}
              detail={t(
                experience.isManager ? 'home.signals.teamDetailManager' : 'home.signals.teamDetail'
              )}
              icon={<UserRoundCheck size={17} />}
              tone="primary"
              onClick={experience.isManager ? () => navigate('/hr/team') : undefined}
            />
            <SignalMetric
              label={t('home.signals.profile')}
              value={person?.workerStatus || t('home.signals.connected')}
              detail={person?.locationName || person?.workEmail || t('home.signals.profileDetail')}
              icon={<ContactRound size={17} />}
              tone="neutral"
              onClick={() => navigate('/hr/me')}
            />
          </Box>
        );
      case 'attention':
        return (
          <SectionSurface
            title={t('home.attention.title')}
            meta={t('home.attention.meta', { count: activeHrItems.length })}
            action={
              activeHrItems.length ? (
                <ActionButton intent="quiet" size="small" onClick={() => navigate('/work')}>
                  {t('home.attention.allWork')}
                </ActionButton>
              ) : undefined
            }
          >
            <Box id="attention">
              {activeHrItems.length ? (
                activeHrItems.slice(0, size === 'medium' ? 3 : 5).map((item, index) => (
                  <Box key={item.workItemId}>
                    {index > 0 && <Divider />}
                    <ButtonBase
                      onClick={() =>
                        navigate(item.sourceRoute ? mapLegacyHrisPath(item.sourceRoute) : '/work')
                      }
                      sx={{ width: 1, px: 2, py: 1.4, textAlign: 'left' }}
                    >
                      <Stack direction="row" alignItems="center" gap={1.25} width={1} minWidth={0}>
                        <Box
                          aria-hidden="true"
                          sx={{
                            width: 8,
                            height: 8,
                            flex: '0 0 8px',
                            borderRadius: '50%',
                            bgcolor: item.priority === 'high' ? 'error.main' : 'warning.main',
                          }}
                        />
                        <Box minWidth={0} flex={1}>
                          <Typography variant="body2" fontWeight={720} noWrap>
                            {item.title}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                            display="block"
                          >
                            {[
                              item.sourceSystem,
                              item.dueAt ? formatDate(item.dueAt, { dateStyle: 'medium' }) : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={t(`home.states.${item.status}`)}
                        />
                        <ArrowRight size={16} aria-hidden="true" />
                      </Stack>
                    </ButtonBase>
                  </Box>
                ))
              ) : (
                <EmptyState
                  size="compact"
                  title={t('home.attention.clearTitle')}
                  description={t('home.attention.clearDescription')}
                />
              )}
            </Box>
          </SectionSurface>
        );
      case 'profile':
        return (
          <SectionSurface
            title={t('home.profile.title')}
            meta={t('home.profile.meta')}
            action={
              <ActionButton intent="quiet" size="small" onClick={() => navigate('/hr/me')}>
                {t('home.profile.open')}
              </ActionButton>
            }
          >
            <Stack gap={1.5} sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" gap={1.25}>
                <PersonAvatar name={selfDisplayName} size={44} />
                <Box minWidth={0}>
                  <Typography fontWeight={760} noWrap>
                    {selfDisplayName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {person?.businessTitle ||
                      auth.user?.jobTitle ||
                      t('home.profile.titleFallback')}
                  </Typography>
                </Box>
              </Stack>
              <Divider />
              {[
                [t('home.profile.organization'), person?.organizationName],
                [t('home.profile.manager'), person?.managerDisplayName],
                [t('home.profile.location'), person?.locationName],
                [t('home.profile.email'), person?.workEmail || auth.user?.email],
              ].map(([label, value]) => (
                <Stack key={label} direction="row" justifyContent="space-between" gap={2}>
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography variant="caption" fontWeight={700} textAlign="right" noWrap>
                    {value || '-'}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </SectionSurface>
        );
      case 'team':
        return (
          <SectionSurface
            title={t('home.team.title')}
            meta={t('home.team.meta', {
              count: directReports.length || person?.directReportCount || 0,
            })}
            action={
              <ActionButton intent="quiet" size="small" onClick={() => navigate('/hr/team')}>
                {t('home.team.open')}
              </ActionButton>
            }
          >
            {directReports.length ? (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    md: size === 'medium' ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                  },
                }}
              >
                {directReports.slice(0, size === 'medium' ? 4 : 6).map((report, index) => (
                  <Stack
                    key={report.personId}
                    direction="row"
                    alignItems="center"
                    gap={1.2}
                    sx={{
                      px: 2,
                      py: 1.35,
                      borderTop: {
                        xs: index ? 1 : 0,
                        md: size === 'medium' ? (index ? 1 : 0) : index > 1 ? 1 : 0,
                      },
                      borderLeft: {
                        xs: 0,
                        md: size === 'medium' ? 0 : index % 2 ? 1 : 0,
                      },
                      borderColor: 'divider',
                    }}
                  >
                    <PersonAvatar name={report.displayName} />
                    <Box minWidth={0} flex={1}>
                      <Typography variant="body2" fontWeight={720} noWrap>
                        {report.displayName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap display="block">
                        {[report.businessTitle || report.jobProfileName, report.locationName]
                          .filter(Boolean)
                          .join(' · ')}
                      </Typography>
                    </Box>
                  </Stack>
                ))}
              </Box>
            ) : (
              <EmptyState
                size="compact"
                title={t('home.team.emptyTitle')}
                description={t('home.team.emptyDescription')}
              />
            )}
          </SectionSurface>
        );
      case 'operations':
        return (
          <SectionSurface
            title={t('home.operations.title')}
            meta={t('home.operations.meta')}
            action={
              <ActionButton intent="quiet" size="small" onClick={() => navigate('/hr/operations')}>
                {t('home.operations.open')}
              </ActionButton>
            }
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, 1fr)',
                  xl: size === 'full' ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)',
                },
              }}
            >
              {[
                [
                  t('home.operations.activeWorkforce'),
                  workforceChart.data
                    ? formatNumber(workforceChart.data.metrics.activeHeadcount)
                    : '-',
                ],
                [
                  t('home.operations.dataQuality'),
                  workforceChart.data ? `${workforceChart.data.analysis.dataQualityScore}%` : '-',
                ],
                [
                  t('home.operations.openPositions'),
                  workforceChart.data
                    ? formatNumber(workforceChart.data.metrics.openPositionCount)
                    : '-',
                ],
                [
                  t('home.operations.latestSync'),
                  latestRun?.completedAt
                    ? formatDate(latestRun.completedAt, { dateStyle: 'medium' })
                    : t('home.operations.noSync'),
                ],
              ].map(([label, value], index) => (
                <Box
                  key={label}
                  sx={{
                    px: 2,
                    py: 1.75,
                    borderTop: { xs: index ? 1 : 0, sm: index > 1 ? 1 : 0 },
                    borderLeft: { xs: 0, sm: index % 2 ? 1 : 0 },
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography sx={{ mt: 0.35, fontSize: '1.35rem', fontWeight: 760 }}>
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </SectionSurface>
        );
    }
  };

  return (
    <PageCanvas>
      <Box
        component="header"
        sx={{
          minHeight: activePresentation === 'focused' ? 148 : 164,
          px: { xs: 2.25, md: 3 },
          py: { xs: 2.5, md: 3 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 3,
          borderRadius: 1,
          bgcolor:
            activePresentation === 'expressive'
              ? '#173D67'
              : activePresentation === 'focused'
                ? '#27323B'
                : '#123F48',
          color: '#FFFFFF',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.72)' }}>
            {currentDate}
          </Typography>
          <Typography component="h1" variant="h3" sx={{ mt: 0.6, color: 'inherit' }}>
            {t(`home.greeting.${greetingKey(new Date().getHours())}`, { name: firstName })}
          </Typography>
          <Typography sx={{ mt: 0.8, color: 'rgba(255,255,255,0.78)' }}>
            {[person?.businessTitle || auth.user?.jobTitle, organizationName]
              .filter(Boolean)
              .join(' · ')}
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1.5 }}>
            <Chip
              size="small"
              icon={<ShieldCheck size={14} />}
              label={t('home.context.personal')}
              sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: 'inherit' }}
            />
            {experience.isManager && (
              <Chip
                size="small"
                label={t('home.context.manager')}
                sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: 'inherit' }}
              />
            )}
            {experience.canOperate && (
              <Chip
                size="small"
                label={t('home.context.operator')}
                sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: 'inherit' }}
              />
            )}
          </Stack>
        </Box>
        <Stack alignItems="flex-end" justifyContent="space-between" alignSelf="stretch" gap={2}>
          {!editorOpen && (
            <>
              <ActionIconButton
                label={t('home.customizeLabel')}
                disabled={homePreference.isLoading}
                onClick={beginEditing}
                sx={{
                  display: { xs: 'inline-flex', sm: 'none' },
                  width: 44,
                  height: 44,
                  color: 'common.white',
                  border: '1px solid rgba(255,255,255,0.48)',
                  bgcolor: 'rgba(255,255,255,0.08)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.14)' },
                }}
              >
                <LayoutDashboard size={18} aria-hidden="true" />
              </ActionIconButton>
              <ActionButton
                intent="secondary"
                size="small"
                startIcon={<LayoutDashboard size={16} />}
                disabled={homePreference.isLoading}
                onClick={beginEditing}
                aria-label={t('home.customizeLabel')}
                sx={{
                  display: { xs: 'none', sm: 'inline-flex' },
                  color: 'common.white',
                  borderColor: 'rgba(255,255,255,0.48)',
                  bgcolor: 'rgba(255,255,255,0.08)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.14)' },
                }}
              >
                {t('home.customize')}
              </ActionButton>
            </>
          )}
          <Box
            aria-hidden="true"
            sx={{
              width: { xs: 64, md: 84 },
              height: { xs: 64, md: 84 },
              flex: '0 0 auto',
              display: { xs: 'none', sm: 'grid' },
              placeItems: 'center',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 1,
              bgcolor: 'rgba(255,255,255,0.08)',
            }}
          >
            <ContactRound size={38} strokeWidth={1.35} />
          </Box>
        </Stack>
      </Box>

      {editorOpen && (
        <WorkspaceComposerToolbar
          presentation={draftPresentation}
          busy={customizationBusy}
          onPresentationChange={setDraftPresentation}
          onAdd={() => setGalleryOpen(true)}
          onReset={() => {
            setDraftWidgets(defaultWorkspaceWidgets(HRIS_HOME_WIDGET_REGISTRY));
            setDraftPresentation('balanced');
          }}
          onCancel={cancelEditing}
          onDone={() =>
            preferenceMutation.mutate({
              appLayout: null,
              presentation: draftPresentation,
              widgets: draftWidgets,
            })
          }
        />
      )}

      <Box
        data-workspace-presentation={activePresentation}
        sx={{
          mt: 2,
          p: activePresentation === 'expressive' ? { xs: 1, md: 1.5 } : 0,
          bgcolor: activePresentation === 'expressive' ? '#F4F7FB' : 'transparent',
          borderRadius: 1,
          transition: 'background-color 180ms ease, padding 180ms ease',
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          ...(activePresentation === 'focused' && {
            '& [data-workspace-widget]': { filter: 'saturate(0.82)' },
          }),
          ...(activePresentation === 'expressive' && {
            '& [data-workspace-widget] > section': {
              boxShadow: '0 10px 30px rgba(15,23,42,0.08)',
            },
          }),
        }}
      >
        <WorkspaceWidgetCanvas
          registry={eligibleRegistry}
          widgets={activeWidgets}
          editing={editorOpen}
          busy={customizationBusy}
          getLabel={(widgetKey) => t(`home.widgets.${widgetKey}.label`)}
          onChange={setDraftWidgets}
          renderWidget={renderWidget}
        />
      </Box>

      <WorkspaceWidgetGallery
        open={galleryOpen}
        registry={eligibleRegistry}
        hiddenWidgetKeys={hiddenWidgetKeys}
        busy={customizationBusy}
        getLabel={(widgetKey) => t(`home.widgets.${widgetKey}.label`)}
        getDescription={(widgetKey) => t(`home.widgets.${widgetKey}.description`)}
        onClose={() => setGalleryOpen(false)}
        onAdd={(widgetKey) =>
          setDraftWidgets((current) =>
            setWorkspaceWidgetVisibility(current, eligibleRegistry, widgetKey, true)
          )
        }
      />
    </PageCanvas>
  );
}
