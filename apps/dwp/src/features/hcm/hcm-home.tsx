import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  CalendarDays,
  CircleCheckBig,
  Clock3,
  DatabaseZap,
  GraduationCap,
  HeartPulse,
  LayoutDashboard,
  LifeBuoy,
  ReceiptText,
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
} from '@dwp-frontend/design-system';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';
import {
  HttpError,
  getOrganizationChart,
  getHomeSurfacePreference,
  getHrHome,
  listHrisSyncRuns,
  updateHomeSurfacePreference,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { PersonAvatar } from '../../components/person-avatar';
import {
  HcmActionTile,
  HcmInsightCard,
  HcmProgressRing,
  HcmSectionSurface,
  HcmSegmentBar,
  hcmToneColor,
} from './hcm-home-visuals';
import { HCM_HOME_WIDGET_REGISTRY } from './hcm-home-widget-registry';
import { useHcmExperience } from './use-hcm-experience';
import { WorkspaceComposerToolbar } from '../../components/workspace-composer/workspace-composer-toolbar';
import {
  defaultWorkspaceWidgets,
  reconcileWorkspaceWidgets,
  setWorkspaceWidgetVisibility,
  visibleWorkspaceRegistry,
} from '../../components/workspace-composer/workspace-composer-model';
import { WorkspaceWidgetCanvas } from '../../components/workspace-composer/workspace-widget-canvas';
import { WorkspaceWidgetGallery } from '../../components/workspace-composer/workspace-widget-gallery';

import type {
  HomePresentation,
  HomePreferenceLayout,
  HomeWidgetSize,
  PersonalHomeWidgetPreference,
} from '@dwp-frontend/shared-utils';
import type { HcmHomeWidgetKey } from './hcm-home-widget-registry';

function greetingKey(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

export function HcmHome() {
  const { t } = useTranslation('hcm');
  const auth = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const experience = useHcmExperience();
  const [editorOpen, setEditorOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [editBaseVersion, setEditBaseVersion] = useState<number | null>(null);
  const [draftPresentation, setDraftPresentation] = useState<HomePresentation>('balanced');
  const [draftWidgets, setDraftWidgets] = useState<
    PersonalHomeWidgetPreference<HcmHomeWidgetKey>[]
  >(() => defaultWorkspaceWidgets(HCM_HOME_WIDGET_REGISTRY));
  const eligibleRegistry = useMemo(
    () =>
      visibleWorkspaceRegistry(HCM_HOME_WIDGET_REGISTRY, {
        isManager: experience.isManager,
        canOperate: experience.canOperate,
      }),
    [experience.canOperate, experience.isManager]
  );
  const homePreference = useQuery({
    queryKey: ['home-preference', 'hcm-home', auth.user?.tenantId, auth.user?.userId],
    queryFn: () => getHomeSurfacePreference<HcmHomeWidgetKey>('hcm-home'),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const hrOverview = useQuery({
    queryKey: ['hcm', 'home-overview', auth.user?.tenantId, auth.user?.userId],
    queryFn: getHrHome,
    staleTime: 30_000,
    retry: 1,
  });
  const teamChart = useQuery({
    queryKey: ['hcm', 'team-chart'],
    queryFn: () => getOrganizationChart({ depth: 12, surface: 'directory' }),
    enabled: experience.isManager && Boolean(experience.currentPerson),
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
  const workforceChart = useQuery({
    queryKey: ['hcm', 'operations-pulse'],
    queryFn: () => getOrganizationChart({ depth: 12, surface: 'workforce' }),
    enabled: experience.canOperate,
    staleTime: 60_000,
    retry: 1,
  });
  const syncRuns = useQuery({
    queryKey: ['hcm', 'operations-sync-runs'],
    queryFn: () => listHrisSyncRuns(10),
    enabled: experience.canOperate,
    staleTime: 60_000,
    retry: false,
  });

  const persistedWidgets = useMemo(
    () => reconcileWorkspaceWidgets(homePreference.data?.layout.widgets, HCM_HOME_WIDGET_REGISTRY),
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
    mutationFn: (layout: HomePreferenceLayout<HcmHomeWidgetKey>) =>
      updateHomeSurfacePreference(
        'hcm-home',
        layout,
        editBaseVersion ?? homePreference.data?.version ?? 0
      ),
    onSuccess: async (next) => {
      queryClient.setQueryData(
        ['home-preference', 'hcm-home', auth.user?.tenantId, auth.user?.userId],
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
  const recordedMinutes = hrOverview.data?.time?.recordedMinutes ?? 0;
  const scheduledMinutes = hrOverview.data?.time?.scheduledMinutes ?? 0;
  const recordedHours = Math.round((recordedMinutes / 60) * 10) / 10;
  const scheduledHours = Math.round((scheduledMinutes / 60) * 10) / 10;
  const timeProgress =
    scheduledMinutes > 0
      ? Math.min(100, Math.max(0, (recordedMinutes / scheduledMinutes) * 100))
      : 0;
  const primaryLeaveBalance = hrOverview.data?.leaveBalances[0];
  const availableLeaveDays = Math.round((primaryLeaveBalance?.availableMinutes ?? 0) / 480);
  const homeSummary = hrOverview.data?.time?.exceptionCount
    ? t('home.summary.timeException', {
        count: hrOverview.data.time.exceptionCount,
        leave: availableLeaveDays,
      })
    : t('home.summary.steady', {
        progress: Math.round(timeProgress),
        leave: availableLeaveDays,
      });
  const grantedLeaveMinutes = primaryLeaveBalance?.grantedMinutes ?? 0;
  const usedLeaveMinutes = primaryLeaveBalance?.usedMinutes ?? 0;
  const pendingLeaveMinutes = primaryLeaveBalance?.pendingMinutes ?? 0;
  const payReadinessCount = hrOverview.data?.pay
    ? [
        hrOverview.data.pay.timeValidated,
        hrOverview.data.pay.absenceValidated,
        hrOverview.data.pay.sourceConfirmed,
      ].filter(Boolean).length
    : 0;
  const payDaysRemaining = hrOverview.data?.pay?.payDate
    ? Math.max(
        0,
        Math.ceil((new Date(hrOverview.data.pay.payDate).getTime() - Date.now()) / 86_400_000)
      )
    : null;
  const growthActivityCount =
    (hrOverview.data?.activeGoalCount ?? 0) + (hrOverview.data?.requiredLearningCount ?? 0);
  const shortcuts = [
    {
      id: 'time',
      icon: Clock3,
      label: t('home.shortcuts.time'),
      description: t('home.shortcuts.descriptions.time'),
      route: '/hr/time',
      tone: 'blue' as const,
      featured: true,
    },
    {
      id: 'requestLeave',
      icon: CalendarDays,
      label: t('home.shortcuts.requestLeave'),
      description: t('home.shortcuts.descriptions.requestLeave'),
      route: '/hr/absence?request=open',
      tone: 'teal' as const,
      featured: true,
    },
    {
      id: 'pay',
      icon: ReceiptText,
      label: t('home.shortcuts.pay'),
      description: t('home.shortcuts.descriptions.pay'),
      route: '/hr/pay',
      tone: 'violet' as const,
      featured: false,
    },
    {
      id: 'services',
      icon: LifeBuoy,
      label: t('home.shortcuts.services'),
      description: t('home.shortcuts.descriptions.services'),
      route: '/hr/services',
      tone: 'teal' as const,
      featured: false,
    },
    {
      id: 'directory',
      icon: UsersRound,
      label: t('home.shortcuts.directory'),
      description: t('home.shortcuts.descriptions.directory'),
      route: '/hr/directory',
      tone: 'coral' as const,
      featured: false,
    },
    ...(experience.isManager
      ? [
          {
            id: 'myTeam',
            icon: UserRoundCheck,
            label: t('home.shortcuts.myTeam'),
            description: t('home.shortcuts.descriptions.myTeam'),
            route: '/hr/team',
            tone: 'amber' as const,
            featured: false,
          },
        ]
      : []),
    ...(experience.canOperate
      ? [
          {
            id: 'operations',
            icon: DatabaseZap,
            label: t('home.shortcuts.operations'),
            description: t('home.shortcuts.descriptions.operations'),
            route: '/hr/operations',
            tone: 'coral' as const,
            featured: false,
          },
        ]
      : []),
  ];
  const guidance = [
    ...(hrOverview.data?.time?.exceptionCount
      ? [
          {
            id: 'time-exception',
            icon: Clock3,
            tone: 'coral' as const,
            title: t('home.guidance.timeException.title'),
            description: t('home.guidance.timeException.description'),
            value: t('home.guidance.timeException.value', {
              count: hrOverview.data.time.exceptionCount,
            }),
            route: '/hr/time',
          },
        ]
      : []),
    ...(hrOverview.data?.openBenefitWindowCount
      ? [
          {
            id: 'benefit-window',
            icon: HeartPulse,
            tone: 'violet' as const,
            title: t('home.guidance.benefitWindow.title'),
            description: t('home.guidance.benefitWindow.description'),
            value: t('home.guidance.benefitWindow.value', {
              count: hrOverview.data.openBenefitWindowCount,
            }),
            route: '/hr/benefits',
          },
        ]
      : []),
    ...(hrOverview.data?.requiredLearningCount
      ? [
          {
            id: 'required-learning',
            icon: BookOpenCheck,
            tone: 'blue' as const,
            title: t('home.guidance.requiredLearning.title'),
            description: t('home.guidance.requiredLearning.description'),
            value: t('home.guidance.requiredLearning.value', {
              count: hrOverview.data.requiredLearningCount,
            }),
            route: '/hr/talent',
          },
        ]
      : []),
    ...(experience.isManager && (hrOverview.data?.teamPendingCount ?? 0) > 0
      ? [
          {
            id: 'team-approval',
            icon: UserRoundCheck,
            tone: 'amber' as const,
            title: t('home.guidance.teamApproval.title'),
            description: t('home.guidance.teamApproval.description'),
            value: t('home.guidance.teamApproval.value', {
              count: hrOverview.data?.teamPendingCount ?? 0,
            }),
            route: '/hr/team/time',
          },
        ]
      : []),
    ...(hrOverview.data?.pay && payReadinessCount < 3
      ? [
          {
            id: 'pay-readiness',
            icon: ReceiptText,
            tone: 'coral' as const,
            title: t('home.guidance.payReadiness.title'),
            description: t('home.guidance.payReadiness.description'),
            value: t('home.guidance.payReadiness.value', { value: payReadinessCount }),
            route: '/hr/pay',
          },
        ]
      : []),
  ];
  const currentDate = formatDate(new Date(), { dateStyle: 'full' });
  const organizationName =
    person?.organizationName || auth.user?.tenantName || auth.user?.tenantCode;
  const selfDisplayName = auth.user?.displayName || person?.displayName || firstName;
  const renderWidget = (widgetKey: HcmHomeWidgetKey, size: HomeWidgetSize) => {
    switch (widgetKey) {
      case 'quick-actions':
        return (
          <Box component="section" aria-label={t('home.shortcuts.label')}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
              justifyContent="space-between"
              gap={1}
              sx={{ mb: 1.35 }}
            >
              <Box>
                <Typography component="h2" variant="h6" fontWeight={780}>
                  {t('home.shortcuts.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {t('home.shortcuts.meta')}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {t('home.shortcuts.count', { count: shortcuts.length })}
              </Typography>
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  sm: size === 'medium' ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, 1fr)',
                  lg: `repeat(${Math.min(shortcuts.length, size === 'medium' ? 2 : shortcuts.length)}, minmax(0, 1fr))`,
                },
                gap: 1.15,
              }}
            >
              {shortcuts.map((shortcut) => (
                <HcmActionTile
                  key={shortcut.id}
                  icon={shortcut.icon}
                  label={shortcut.label}
                  description={shortcut.description}
                  tone={shortcut.tone}
                  featured={shortcut.featured}
                  onClick={() => navigate(shortcut.route)}
                />
              ))}
            </Box>
          </Box>
        );
      case 'people-signals':
        return (
          <Box component="section" aria-label={t('home.signals.label')}>
            <Box sx={{ mb: 1.35 }}>
              <Typography component="h2" variant="h6" fontWeight={780}>
                {t('home.signals.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {t('home.signals.meta')}
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  xl: size === 'full' ? 'repeat(4, minmax(0, 1fr))' : 'repeat(2, 1fr)',
                },
                gap: 1.25,
                height: '100%',
              }}
            >
              <HcmInsightCard
                icon={CalendarDays}
                label={t('home.signals.leaveBalance')}
                value={t('home.values.days', { value: availableLeaveDays })}
                detail={primaryLeaveBalance?.planName || t('home.signals.noLeavePlan')}
                tone="teal"
                visual={
                  <HcmProgressRing
                    size={72}
                    value={grantedLeaveMinutes ? (usedLeaveMinutes / grantedLeaveMinutes) * 100 : 0}
                    label={`${Math.round(
                      grantedLeaveMinutes ? (usedLeaveMinutes / grantedLeaveMinutes) * 100 : 0
                    )}%`}
                    caption={t('home.signals.leaveUsed')}
                    tone="teal"
                  />
                }
                footer={
                  <Box>
                    <HcmSegmentBar
                      label={t('home.signals.leaveBreakdown')}
                      segments={[
                        { value: usedLeaveMinutes, color: hcmToneColor.teal },
                        { value: pendingLeaveMinutes, color: hcmToneColor.amber },
                        {
                          value: primaryLeaveBalance?.availableMinutes ?? 0,
                          color: alpha(hcmToneColor.teal, 0.22),
                        },
                      ]}
                    />
                    <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.7 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t('home.signals.leaveUsedDays', {
                          value: Math.round(usedLeaveMinutes / 480),
                        })}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('home.signals.leavePendingDays', {
                          value: Math.round(pendingLeaveMinutes / 480),
                        })}
                      </Typography>
                    </Stack>
                  </Box>
                }
                onClick={() => navigate('/hr/absence')}
              />
              <HcmInsightCard
                icon={ReceiptText}
                label={t('home.signals.payDay')}
                value={
                  payDaysRemaining === null
                    ? '-'
                    : t('home.values.dDay', { value: payDaysRemaining })
                }
                detail={
                  hrOverview.data?.pay?.payDate
                    ? formatDate(hrOverview.data.pay.payDate, { dateStyle: 'medium' })
                    : t('home.signals.payUnavailable')
                }
                tone="blue"
                visual={
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: 64,
                      height: 64,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: 2,
                      color: hcmToneColor.blue,
                      bgcolor: alpha(hcmToneColor.blue, 0.1),
                    }}
                  >
                    <ReceiptText size={28} strokeWidth={1.7} />
                  </Box>
                }
                footer={
                  <Box>
                    <Stack direction="row" justifyContent="space-between" gap={1} sx={{ mb: 0.8 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t('home.signals.payReadiness')}
                      </Typography>
                      <Typography variant="caption" fontWeight={740}>
                        {t('home.signals.payReadinessValue', { value: payReadinessCount })}
                      </Typography>
                    </Stack>
                    <Stack direction="row" gap={0.55}>
                      {[0, 1, 2].map((index) => (
                        <Box
                          key={index}
                          sx={{
                            height: 7,
                            flex: 1,
                            borderRadius: 1,
                            bgcolor:
                              index < payReadinessCount
                                ? hcmToneColor.blue
                                : alpha(hcmToneColor.blue, 0.16),
                          }}
                        />
                      ))}
                    </Stack>
                  </Box>
                }
                onClick={() => navigate('/hr/pay')}
              />
              <HcmInsightCard
                icon={HeartPulse}
                label={t('home.signals.benefits')}
                value={t('home.values.count', {
                  value: hrOverview.data?.activeBenefitCount ?? 0,
                })}
                detail={t('home.signals.benefitsDetail')}
                tone="violet"
                visual={
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: 64,
                      height: 64,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: '50%',
                      color: '#FFFFFF',
                      bgcolor: hcmToneColor.violet,
                      boxShadow: `0 10px 24px ${alpha(hcmToneColor.violet, 0.24)}`,
                    }}
                  >
                    <HeartPulse size={27} strokeWidth={1.8} />
                  </Box>
                }
                footer={
                  <Stack direction="row" alignItems="center" gap={0.8}>
                    <BadgeCheck size={16} color={hcmToneColor.violet} aria-hidden="true" />
                    <Typography variant="caption" color="text.secondary">
                      {hrOverview.data?.openBenefitWindowCount
                        ? t('home.signals.benefitWindowOpen', {
                            count: hrOverview.data.openBenefitWindowCount,
                          })
                        : t('home.signals.benefitWindowClosed')}
                    </Typography>
                  </Stack>
                }
                onClick={() => navigate('/hr/benefits')}
              />
              <HcmInsightCard
                icon={GraduationCap}
                label={t('home.signals.growth')}
                value={t('home.values.count', { value: growthActivityCount })}
                detail={t('home.signals.growthDetail')}
                tone="amber"
                visual={
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: 64,
                      height: 64,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: 2,
                      color: hcmToneColor.amber,
                      bgcolor: alpha(hcmToneColor.amber, 0.12),
                    }}
                  >
                    <GraduationCap size={29} strokeWidth={1.7} />
                  </Box>
                }
                footer={
                  <Stack direction="row" gap={1.4} flexWrap="wrap">
                    <Typography variant="caption" color="text.secondary">
                      {t('home.signals.goalCount', {
                        count: hrOverview.data?.activeGoalCount ?? 0,
                      })}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('home.signals.learningCount', {
                        count: hrOverview.data?.requiredLearningCount ?? 0,
                      })}
                    </Typography>
                  </Stack>
                }
                onClick={() => navigate('/hr/talent')}
              />
            </Box>
          </Box>
        );
      case 'attention':
        return (
          <HcmSectionSurface
            eyebrow={t('home.guidance.eyebrow')}
            title={t('home.guidance.title')}
            meta={t('home.guidance.meta')}
          >
            <Box id="hr-guidance" sx={{ px: { xs: 1.25, md: 1.5 }, pb: 1.5 }}>
              {guidance.length ? (
                <Stack gap={0.7}>
                  {guidance.slice(0, size === 'medium' ? 3 : 5).map((item) => {
                    const Icon = item.icon;
                    const color = hcmToneColor[item.tone];
                    return (
                      <ButtonBase
                        key={item.id}
                        onClick={() => navigate(item.route)}
                        sx={(theme) => ({
                          width: 1,
                          minHeight: 72,
                          px: 1.3,
                          py: 1.1,
                          textAlign: 'left',
                          borderRadius: 1.5,
                          bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.14 : 0.045),
                          transition: theme.transitions.create(['transform', 'background-color']),
                          '&:hover': {
                            transform: 'translateX(3px)',
                            bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.22 : 0.09),
                          },
                          '@media (prefers-reduced-motion: reduce)': {
                            transition: 'none',
                            '&:hover': { transform: 'none' },
                          },
                        })}
                      >
                        <Stack
                          direction="row"
                          alignItems="center"
                          gap={1.25}
                          width={1}
                          minWidth={0}
                        >
                          <Box
                            aria-hidden="true"
                            sx={{
                              width: 40,
                              height: 40,
                              flex: '0 0 40px',
                              display: 'grid',
                              placeItems: 'center',
                              borderRadius: 1.5,
                              color,
                              bgcolor: alpha(color, 0.12),
                            }}
                          >
                            <Icon size={19} strokeWidth={1.9} />
                          </Box>
                          <Box minWidth={0} flex={1}>
                            <Typography variant="body2" fontWeight={750}>
                              {item.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {item.description}
                            </Typography>
                          </Box>
                          <Chip
                            size="small"
                            label={item.value}
                            sx={{
                              display: { xs: 'none', sm: 'inline-flex' },
                              color,
                              bgcolor: alpha(color, 0.08),
                              borderColor: alpha(color, 0.24),
                            }}
                            variant="outlined"
                          />
                          <ArrowRight size={16} aria-hidden="true" />
                        </Stack>
                      </ButtonBase>
                    );
                  })}
                </Stack>
              ) : (
                <EmptyState
                  size="compact"
                  icon={<CircleCheckBig size={28} />}
                  title={t('home.guidance.clearTitle')}
                  description={t('home.guidance.clearDescription')}
                />
              )}
            </Box>
          </HcmSectionSurface>
        );
      case 'profile':
        return (
          <HcmSectionSurface
            eyebrow={t('home.profile.eyebrow')}
            title={t('home.profile.title')}
            meta={t('home.profile.meta')}
            action={
              <ActionButton intent="quiet" size="small" onClick={() => navigate('/hr/me')}>
                {t('home.profile.open')}
              </ActionButton>
            }
          >
            <Stack gap={1.6} sx={{ px: { xs: 2, md: 2.4 }, pb: 2.2 }}>
              <Stack
                direction="row"
                alignItems="center"
                gap={1.4}
                sx={(theme) => ({
                  mx: { xs: -0.5, md: -0.9 },
                  p: 1.35,
                  borderRadius: 1.5,
                  bgcolor: alpha(hcmToneColor.teal, theme.palette.mode === 'dark' ? 0.14 : 0.055),
                })}
              >
                <PersonAvatar name={selfDisplayName} size={52} />
                <Box minWidth={0}>
                  <Typography fontWeight={790} noWrap>
                    {selfDisplayName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {person?.businessTitle ||
                      auth.user?.jobTitle ||
                      t('home.profile.titleFallback')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {person?.organizationName || organizationName || '-'}
                  </Typography>
                </Box>
              </Stack>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: size === 'medium' ? 'repeat(2, minmax(0, 1fr))' : '1fr',
                  gap: 1.15,
                }}
              >
                {[
                  [t('home.profile.manager'), person?.managerDisplayName],
                  [t('home.profile.location'), person?.locationName],
                  [t('home.profile.email'), person?.workEmail || auth.user?.email],
                ].map(([label, value]) => (
                  <Box key={label} minWidth={0}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {label}
                    </Typography>
                    <Typography variant="body2" fontWeight={700} noWrap sx={{ mt: 0.2 }}>
                      {value || '-'}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Stack>
          </HcmSectionSurface>
        );
      case 'team':
        return (
          <HcmSectionSurface
            eyebrow={t('home.team.eyebrow')}
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
                  gap: 0.75,
                  px: { xs: 1.25, md: 1.5 },
                  pb: 1.5,
                }}
              >
                {directReports.slice(0, size === 'medium' ? 4 : 6).map((report) => (
                  <Stack
                    key={report.personId}
                    direction="row"
                    alignItems="center"
                    gap={1.2}
                    sx={(theme) => ({
                      px: 1.25,
                      py: 1.1,
                      minWidth: 0,
                      borderRadius: 1.5,
                      bgcolor: alpha(
                        hcmToneColor.teal,
                        theme.palette.mode === 'dark' ? 0.11 : 0.035
                      ),
                    })}
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
          </HcmSectionSurface>
        );
      case 'operations':
        return (
          <HcmSectionSurface
            eyebrow={t('home.operations.eyebrow')}
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
                gap: 0.8,
                px: { xs: 1.25, md: 1.5 },
                pb: 1.5,
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
                  sx={(theme) => ({
                    px: 1.5,
                    py: 1.5,
                    borderRadius: 1.5,
                    bgcolor: alpha(
                      index % 2 ? hcmToneColor.blue : hcmToneColor.teal,
                      theme.palette.mode === 'dark' ? 0.13 : 0.045
                    ),
                  })}
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
          </HcmSectionSurface>
        );
    }
  };

  return (
    <PageCanvas>
      <Box
        component="header"
        data-testid="hcm-home-overview"
        sx={(theme) => ({
          minHeight: activePresentation === 'focused' ? 208 : 236,
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.65fr) minmax(300px, 0.8fr)' },
          border: '1px solid',
          borderColor: theme.palette.mode === 'dark' ? alpha('#FFFFFF', 0.12) : '#DCE7E4',
          borderRadius: 2,
          bgcolor: 'background.paper',
          boxShadow:
            theme.palette.mode === 'dark'
              ? '0 22px 54px rgba(0,0,0,0.24)'
              : '0 22px 54px rgba(29, 71, 63, 0.1)',
          color: 'text.primary',
          overflow: 'hidden',
          animation: 'hcmHomeEnter 420ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
          '@keyframes hcmHomeEnter': {
            from: { transform: 'translateY(8px)' },
            to: { transform: 'translateY(0)' },
          },
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        })}
      >
        <Box
          sx={{
            minWidth: 0,
            p: { xs: 2.25, sm: 2.75, lg: 3.25 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.8}>
            <Typography variant="caption" color="text.secondary" fontWeight={680}>
              {currentDate}
            </Typography>
            <Box
              component="span"
              sx={{
                px: 0.85,
                py: 0.3,
                borderRadius: 4,
                bgcolor: alpha(hcmToneColor.teal, 0.09),
                color: hcmToneColor.teal,
                fontSize: '0.69rem',
                lineHeight: 1.4,
                fontWeight: 760,
              }}
            >
              {t('home.header.snapshot')}
            </Box>
          </Stack>
          <Typography
            component="h1"
            variant="h3"
            sx={{
              mt: 1,
              maxWidth: 720,
              fontSize: { xs: '1.65rem', sm: '2rem', lg: '2.25rem' },
              lineHeight: 1.17,
              fontWeight: 820,
              wordBreak: 'keep-all',
              overflowWrap: 'break-word',
            }}
          >
            {t(`home.greeting.${greetingKey(new Date().getHours())}`, { name: firstName })}
          </Typography>
          <Typography
            sx={{ mt: 1, maxWidth: 700, fontSize: { xs: '0.9rem', md: '1rem' }, lineHeight: 1.6 }}
            color="text.secondary"
          >
            {homeSummary}
          </Typography>
          <Typography variant="caption" sx={{ mt: 1.15 }} color="text.secondary">
            {[person?.businessTitle || auth.user?.jobTitle, organizationName]
              .filter(Boolean)
              .join(' · ')}
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.65} sx={{ mt: 1.35 }}>
            <Chip
              size="small"
              icon={<ShieldCheck size={14} />}
              label={t('home.context.personal')}
              sx={{ bgcolor: alpha(hcmToneColor.teal, 0.06) }}
            />
            {experience.isManager && (
              <Chip
                size="small"
                label={t('home.context.manager')}
                sx={{ bgcolor: alpha(hcmToneColor.amber, 0.08) }}
              />
            )}
            {experience.canOperate && (
              <Chip
                size="small"
                label={t('home.context.operator')}
                sx={{ bgcolor: alpha(hcmToneColor.coral, 0.08) }}
              />
            )}
          </Stack>
          {!editorOpen && (
            <Box
              sx={{
                position: 'absolute',
                top: { xs: 14, sm: 18 },
                right: { xs: 14, sm: 18, md: 'calc(32% + 18px)' },
              }}
            >
              <ActionIconButton
                label={t('home.customizeLabel')}
                disabled={homePreference.isLoading}
                onClick={beginEditing}
                sx={{
                  display: { xs: 'inline-flex', sm: 'none' },
                  width: 40,
                  height: 40,
                  color: hcmToneColor.teal,
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
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
                sx={{ display: { xs: 'none', sm: 'inline-flex' }, bgcolor: 'background.paper' }}
              >
                {t('home.customize')}
              </ActionButton>
            </Box>
          )}
        </Box>
        <Box
          sx={{
            p: { xs: 2.25, sm: 2.75 },
            display: 'grid',
            gridTemplateColumns: { xs: 'auto 1fr', md: '1fr' },
            alignItems: 'center',
            justifyItems: { xs: 'start', md: 'center' },
            gap: { xs: 2, md: 1.5 },
            color: '#FFFFFF',
            bgcolor: '#124B47',
          }}
        >
          <HcmProgressRing
            value={timeProgress}
            label={`${Math.round(timeProgress)}%`}
            caption={t('home.header.weekProgress')}
            tone="teal"
            inverse
          />
          <Box
            sx={{
              width: 1,
              minWidth: 0,
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: '1fr' },
              gap: { xs: 1.25, md: 0.9 },
            }}
          >
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
                {t('home.signals.weekTime')}
              </Typography>
              <Typography component="p" variant="h6" fontWeight={790}>
                {t('home.header.timeValue', { recorded: recordedHours, target: scheduledHours })}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
                {t('home.signals.leaveBalance')}
              </Typography>
              <Typography component="p" variant="h6" fontWeight={790}>
                {t('home.values.days', { value: availableLeaveDays })}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {editorOpen && (
        <WorkspaceComposerToolbar
          presentation={draftPresentation}
          busy={customizationBusy}
          onPresentationChange={setDraftPresentation}
          onAdd={() => setGalleryOpen(true)}
          onReset={() => {
            setDraftWidgets(defaultWorkspaceWidgets(HCM_HOME_WIDGET_REGISTRY));
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
        sx={(theme) => ({
          mt: { xs: 2.25, md: 3 },
          transition: theme.transitions.create('filter', { duration: 180 }),
          ...(!editorOpen && {
            '& [data-workspace-widget]': {
              animation: 'hcmWidgetEnter 400ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
            },
            '& [data-workspace-widget]:nth-of-type(2)': { animationDelay: '45ms' },
            '& [data-workspace-widget]:nth-of-type(3)': { animationDelay: '90ms' },
            '& [data-workspace-widget]:nth-of-type(4)': { animationDelay: '135ms' },
            '& [data-workspace-widget]:nth-of-type(5)': { animationDelay: '180ms' },
            '@keyframes hcmWidgetEnter': {
              from: { transform: 'translateY(10px)' },
              to: { transform: 'translateY(0)' },
            },
          }),
          '@media (prefers-reduced-motion: reduce)': {
            transition: 'none',
            '& [data-workspace-widget]': { animation: 'none' },
          },
          ...(activePresentation === 'focused' && {
            '& [data-workspace-widget]': { filter: 'saturate(0.76)' },
          }),
          ...(activePresentation === 'expressive' && {
            '& [data-workspace-widget] > section, & [data-workspace-widget] > div > button': {
              boxShadow: '0 18px 42px rgba(25, 70, 61, 0.09)',
            },
          }),
        })}
      >
        <WorkspaceWidgetCanvas
          registry={eligibleRegistry}
          widgets={activeWidgets}
          editing={editorOpen}
          busy={customizationBusy}
          presentation={activePresentation}
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
