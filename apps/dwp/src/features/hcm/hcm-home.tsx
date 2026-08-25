import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown,
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  HeartPulse,
  LayoutDashboard,
  LifeBuoy,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
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
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  HttpError,
  getHomeSurfacePreference,
  getHrHome,
  getOrganizationChart,
  updateHcmHomePreference,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { PersonAvatar } from '../../components/person-avatar';
import { WorkspaceComposerToolbar } from '../../components/workspace-composer/workspace-composer-toolbar';
import {
  defaultWorkspaceWidgets,
  reconcileWorkspaceWidgets,
  setWorkspaceWidgetVisibility,
  visibleWorkspaceRegistry,
} from '../../components/workspace-composer/workspace-composer-model';
import { WorkspaceWidgetCanvas } from '../../components/workspace-composer/workspace-widget-canvas';
import { WorkspaceWidgetGallery } from '../../components/workspace-composer/workspace-widget-gallery';
import {
  HcmAttentionItem,
  HcmSectionSurface,
  HcmStageRail,
  HcmToolLink,
  hcmToneColor,
} from './hcm-home-visuals';
import { HcmRhythmMetric } from './hcm-rhythm-metric';
import { HCM_HOME_WIDGET_REGISTRY } from './hcm-home-widget-registry';
import { useHcmExperience } from './use-hcm-experience';
import { useProductActionMutation } from '../../components/use-product-action-mutation';

import type { LucideIcon } from 'lucide-react';
import type {
  HomePresentation,
  HomePreferenceLayout,
  HomeWidgetSize,
  HrHomeOverview,
  PersonalHomeWidgetPreference,
} from '@dwp-frontend/shared-utils';
import type { HcmHomeWidgetKey } from './hcm-home-widget-registry';

type HomeMode = 'personal' | 'team';
type AttentionPriority = 'critical' | 'attention' | 'routine';

type AttentionSignal = {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  value: string;
  actionLabel: string;
  route: string;
  priority: AttentionPriority;
};

type ToolLink = {
  id: string;
  icon: LucideIcon;
  label: string;
  description: string;
  route: string;
  badge?: string;
};

function greetingKey(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function daysUntilDate(value: string | null | undefined, asOf: string) {
  if (!value) return null;
  const target = new Date(`${value.slice(0, 10)}T00:00:00Z`).getTime();
  const reference = new Date(`${asOf.slice(0, 10)}T00:00:00Z`).getTime();
  return Math.max(0, Math.ceil((target - reference) / 86_400_000));
}

function daysUntilInstant(value: string | null | undefined, generatedAt: string | null) {
  if (!value) return null;
  const reference = generatedAt ? new Date(generatedAt).getTime() : Date.now();
  return Math.max(0, Math.ceil((new Date(value).getTime() - reference) / 86_400_000));
}

export function HcmHome() {
  const { t } = useTranslation('hcm');
  const auth = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const experience = useHcmExperience();
  const [homeMode, setHomeMode] = useState<HomeMode>('personal');
  const [editorOpen, setEditorOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [editBaseVersion, setEditBaseVersion] = useState<number | null>(null);
  const [draftPresentation, setDraftPresentation] = useState<HomePresentation>('balanced');
  const [draftWidgets, setDraftWidgets] = useState<
    PersonalHomeWidgetPreference<HcmHomeWidgetKey>[]
  >(() => defaultWorkspaceWidgets(HCM_HOME_WIDGET_REGISTRY));
  const hrOverview = useQuery({
    queryKey: ['hcm', 'home-overview', auth.user?.tenantId, auth.user?.userId],
    queryFn: getHrHome,
    staleTime: 30_000,
    retry: 1,
  });
  const resolvedIsManager =
    experience.isManager || (hrOverview.data?.employee.directReportCount ?? 0) > 0;

  useEffect(() => {
    if (homeMode === 'team' && !resolvedIsManager) setHomeMode('personal');
  }, [homeMode, resolvedIsManager]);

  const roleRegistry = useMemo(
    () =>
      visibleWorkspaceRegistry(HCM_HOME_WIDGET_REGISTRY, {
        isManager: resolvedIsManager,
        canOperate: false,
      }),
    [resolvedIsManager]
  );
  const eligibleRegistry = useMemo(
    () =>
      roleRegistry.filter((definition) => {
        if (homeMode === 'personal') return definition.key !== 'team';
        return definition.key !== 'profile';
      }),
    [homeMode, roleRegistry]
  );

  const homePreference = useQuery({
    queryKey: ['home-preference', 'hcm-home', auth.user?.tenantId, auth.user?.userId],
    queryFn: () => getHomeSurfacePreference<HcmHomeWidgetKey>('hcm-home'),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const teamChart = useQuery({
    queryKey: ['hcm', 'team-chart'],
    queryFn: () => getOrganizationChart({ depth: 12, surface: 'directory' }),
    enabled: homeMode === 'team' && resolvedIsManager,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
  const persistedWidgets = useMemo(() => {
    const reconciled = reconcileWorkspaceWidgets(
      homePreference.data?.layout.widgets,
      HCM_HOME_WIDGET_REGISTRY
    );
    if (homePreference.data?.customized) return reconciled;
    const defaultOrder = new Map(
      HCM_HOME_WIDGET_REGISTRY.map((definition, index) => [definition.key, index])
    );
    return [...reconciled].sort(
      (left, right) =>
        (defaultOrder.get(left.widgetKey) ?? Number.MAX_SAFE_INTEGER) -
        (defaultOrder.get(right.widgetKey) ?? Number.MAX_SAFE_INTEGER)
    );
  }, [homePreference.data?.customized, homePreference.data?.layout.widgets]);
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
  const updatePreference = useProductActionMutation(
    'route.hcm.personal.home-preference-update.action'
  );
  const preferenceMutation = useMutation({
    mutationFn: (layout: HomePreferenceLayout<HcmHomeWidgetKey>) =>
      updatePreference((authority) =>
        updateHcmHomePreference(
          layout,
          editBaseVersion ?? homePreference.data?.version ?? 0,
          authority
        )
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

  const directReports = useMemo(() => {
    const managerPersonId =
      hrOverview.data?.employee.personId || experience.currentPerson?.personId;
    if (!managerPersonId) return [];
    return (teamChart.data?.people ?? []).filter(
      (person) => person.managerPersonId === managerPersonId
    );
  }, [
    experience.currentPerson?.personId,
    hrOverview.data?.employee.personId,
    teamChart.data?.people,
  ]);
  if (hrOverview.isLoading) {
    return (
      <PageCanvas>
        <Typography component="h1" variant="h4" sx={{ mb: 2 }}>
          {t('navigation.items.hcm.home.label')}
        </Typography>
        <Stack
          data-testid="hcm-home-loading"
          gap={2}
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label={t('domains.loading')}
        >
          <Skeleton variant="rounded" height={112} />
          <Skeleton variant="rounded" height={184} />
          <Skeleton variant="rounded" height={300} />
        </Stack>
      </PageCanvas>
    );
  }

  if (hrOverview.isError || !hrOverview.data) {
    return (
      <PageCanvas>
        <Typography component="h1" variant="h4" sx={{ mb: 2 }}>
          {t('navigation.items.hcm.home.label')}
        </Typography>
        <Box sx={{ minHeight: 360, display: 'grid', placeItems: 'center' }}>
          <Stack alignItems="center" gap={1.5} role="alert">
            <EmptyState
              icon={<ShieldAlert size={30} />}
              title={t('domains.loadError')}
              description={t('home.error.description')}
            />
            <ActionButton
              intent="secondary"
              startIcon={<RefreshCw size={16} />}
              onClick={() => void hrOverview.refetch()}
            >
              {t('common.retry')}
            </ActionButton>
          </Stack>
        </Box>
      </PageCanvas>
    );
  }

  const overview: HrHomeOverview = hrOverview.data ?? {
    asOf: new Date().toISOString().slice(0, 10),
    generatedAt: null,
    timeZone: 'UTC',
    standardDayMinutes: null,
    employee: {
      personId: auth.user?.personPublicId ?? '',
      displayName: auth.user?.displayName ?? t('home.personFallback'),
      businessTitle: auth.user?.jobTitle,
      organizationName: auth.user?.tenantName ?? auth.user?.tenantCode,
      managerDisplayName: null,
      directReportCount: 0,
    },
    time: null,
    leaveBalances: [],
    pay: null,
    enrollmentWindows: [],
    journeys: [],
    activeBenefitCount: 0,
    openBenefitWindowCount: 0,
    activeGoalCount: 0,
    requiredLearningCount: 0,
    teamPendingCount: 0,
    teamTimePendingCount: null,
    teamAbsencePendingCount: null,
    domainStates: {},
    referenceDataPresent: false,
  };
  const directoryPerson = experience.currentPerson;
  const domainAvailable = (domain: keyof typeof overview.domainStates) =>
    overview.domainStates[domain]?.availability !== 'UNAVAILABLE';
  const currentTime = domainAvailable('TIME') ? overview.time : null;
  const selfDisplayName =
    overview.employee.displayName || auth.user?.displayName || t('home.personFallback');
  const firstName = selfDisplayName.trim().split(/\s+/u)[0] || t('home.personFallback');
  const organizationName =
    overview.employee.organizationName || auth.user?.tenantName || auth.user?.tenantCode || '-';
  const recordedMinutes = currentTime?.recordedMinutes ?? 0;
  const scheduledMinutes = currentTime?.scheduledMinutes ?? 0;
  const remainingMinutes = Math.max(0, scheduledMinutes - recordedMinutes);
  const recordedHours = Math.round((recordedMinutes / 60) * 10) / 10;
  const scheduledHours = Math.round((scheduledMinutes / 60) * 10) / 10;
  const primaryLeaveBalance = [...overview.leaveBalances].sort((left, right) => {
    const leftAnnual = /ANNUAL/u.test(left.planKey) ? 1 : 0;
    const rightAnnual = /ANNUAL/u.test(right.planKey) ? 1 : 0;
    return rightAnnual - leftAnnual || right.grantedMinutes - left.grantedMinutes;
  })[0];
  const standardDayMinutes = overview.standardDayMinutes;
  const availableLeaveDays =
    primaryLeaveBalance && standardDayMinutes
      ? Math.round((primaryLeaveBalance.availableMinutes / standardDayMinutes) * 10) / 10
      : null;
  const usedLeaveDays =
    primaryLeaveBalance && standardDayMinutes
      ? Math.round((primaryLeaveBalance.usedMinutes / standardDayMinutes) * 10) / 10
      : null;
  const payDaysRemaining = daysUntilDate(overview.pay?.payDate, overview.asOf);
  const openBenefitWindows = [...overview.enrollmentWindows]
    .filter((window) => window.lifecycleState === 'OPEN')
    .sort((left, right) => new Date(left.closesAt).getTime() - new Date(right.closesAt).getTime());
  const nearestBenefitWindow = openBenefitWindows[0];
  const activeJourney = [...overview.journeys]
    .filter((journey) => !['COMPLETED', 'CANCELLED'].includes(journey.status))
    .sort((left, right) =>
      (left.targetDate ?? '9999').localeCompare(right.targetDate ?? '9999')
    )[0];
  const journeyTargetDays = daysUntilDate(activeJourney?.targetDate, overview.asOf);
  const currentDate = formatDate(overview.asOf, { dateStyle: 'full' });
  const freshness = overview.generatedAt
    ? formatDate(overview.generatedAt, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : t('home.states.unavailable');
  const hasSplitTeamPendingCounts =
    typeof overview.teamTimePendingCount === 'number' &&
    typeof overview.teamAbsencePendingCount === 'number';
  const teamTimePendingCount = overview.teamTimePendingCount;
  const teamAbsencePendingCount = overview.teamAbsencePendingCount;
  const personalAttention: AttentionSignal[] = [
    ...(currentTime?.exceptionCount
      ? [
          {
            id: 'time-exception',
            icon: ShieldAlert,
            title: t('home.needsAttention.timeException.title'),
            description: t('home.needsAttention.timeException.description'),
            value: t('home.needsAttention.timeException.value', {
              count: currentTime.exceptionCount,
            }),
            actionLabel: t('home.needsAttention.resolveTime'),
            route: '/hr/time',
            priority: 'critical' as const,
          },
        ]
      : currentTime && currentTime.status === 'OPEN' && remainingMinutes > 0
        ? [
            {
              id: 'time-remaining',
              icon: Clock3,
              title: t('home.needsAttention.timeRemaining.title'),
              description: t('home.needsAttention.timeRemaining.description', {
                end: formatDate(currentTime.periodEnd, { dateStyle: 'medium' }),
              }),
              value: t('home.needsAttention.timeRemaining.value', {
                value: Math.round((remainingMinutes / 60) * 10) / 10,
              }),
              actionLabel: t('home.needsAttention.finishTime'),
              route: '/hr/time',
              priority: 'attention' as const,
            },
          ]
        : []),
    ...(domainAvailable('BENEFITS') && nearestBenefitWindow
      ? [
          {
            id: 'benefit-window',
            icon: HeartPulse,
            title: t('home.needsAttention.benefitWindow.title'),
            description: t('home.needsAttention.benefitWindow.description', {
              name: nearestBenefitWindow.name,
            }),
            value: t('home.values.dDay', {
              value: daysUntilInstant(nearestBenefitWindow.closesAt, overview.generatedAt) ?? 0,
            }),
            actionLabel: t('home.needsAttention.reviewEnrollment'),
            route: '/hr/benefits',
            priority: 'attention' as const,
          },
        ]
      : []),
    ...(domainAvailable('TALENT') && overview.requiredLearningCount > 0
      ? [
          {
            id: 'required-learning',
            icon: BookOpenCheck,
            title: t('home.needsAttention.requiredLearning.title'),
            description: t('home.needsAttention.requiredLearning.description'),
            value: t('home.needsAttention.requiredLearning.value', {
              count: overview.requiredLearningCount,
            }),
            actionLabel: t('home.needsAttention.continueLearning'),
            route: '/hr/talent',
            priority: 'routine' as const,
          },
        ]
      : []),
  ];
  const teamAttention: AttentionSignal[] = [
    ...(domainAvailable('TEAM') && (teamTimePendingCount ?? 0) > 0
      ? [
          {
            id: 'team-time',
            icon: Clock3,
            title: t('home.needsAttention.teamTime.title'),
            description: t('home.needsAttention.teamTime.description'),
            value: t('home.needsAttention.teamTime.value', {
              count: teamTimePendingCount,
            }),
            actionLabel: t('home.needsAttention.reviewTime'),
            route: '/hr/team/time',
            priority: 'attention' as const,
          },
        ]
      : []),
    ...(domainAvailable('TEAM') && (teamAbsencePendingCount ?? 0) > 0
      ? [
          {
            id: 'team-absence',
            icon: CalendarDays,
            title: t('home.needsAttention.teamAbsence.title'),
            description: t('home.needsAttention.teamAbsence.description'),
            value: t('home.needsAttention.teamAbsence.value', {
              count: teamAbsencePendingCount,
            }),
            actionLabel: t('home.needsAttention.reviewLeave'),
            route: '/hr/team/absence',
            priority: 'attention' as const,
          },
        ]
      : []),
    ...(domainAvailable('TEAM') && !hasSplitTeamPendingCounts && overview.teamPendingCount > 0
      ? [
          {
            id: 'team-legacy',
            icon: UsersRound,
            title: t('home.guidance.teamApproval.title'),
            description: t('home.guidance.teamApproval.description'),
            value: t('home.guidance.teamApproval.value', {
              count: overview.teamPendingCount,
            }),
            actionLabel: t('home.needsAttention.decide'),
            route: '/hr/team',
            priority: 'attention' as const,
          },
        ]
      : []),
  ];
  const attentionSignals = homeMode === 'team' ? teamAttention : personalAttention;
  const attentionUnavailable =
    homeMode === 'team'
      ? !domainAvailable('TEAM')
      : !domainAvailable('TIME') || !domainAvailable('BENEFITS') || !domainAvailable('TALENT');
  const personalTools: ToolLink[] = [
    {
      id: 'time',
      icon: Clock3,
      label: t('home.tools.time'),
      description: t('home.tools.descriptions.time'),
      route: '/hr/time',
    },
    {
      id: 'leave',
      icon: CalendarDays,
      label: t('home.tools.requestLeave'),
      description: t('home.tools.descriptions.requestLeave'),
      route: '/hr/absence?request=open',
    },
    {
      id: 'pay',
      icon: ReceiptText,
      label: t('home.tools.pay'),
      description: t('home.tools.descriptions.pay'),
      route: '/hr/pay',
    },
    {
      id: 'services',
      icon: LifeBuoy,
      label: t('home.tools.services'),
      description: t('home.tools.descriptions.services'),
      route: '/hr/services',
    },
    {
      id: 'directory',
      icon: UsersRound,
      label: t('home.tools.directory'),
      description: t('home.tools.descriptions.directory'),
      route: '/hr/directory',
    },
  ];
  const teamTools: ToolLink[] = [
    {
      id: 'team',
      icon: UsersRound,
      label: t('home.tools.myTeam'),
      description: t('home.tools.descriptions.myTeam'),
      route: '/hr/team',
    },
    {
      id: 'team-time',
      icon: Clock3,
      label: t('home.tools.teamTime'),
      description: t('home.tools.descriptions.teamTime'),
      route: '/hr/team/time',
      badge: teamTimePendingCount ? String(teamTimePendingCount) : undefined,
    },
    {
      id: 'team-absence',
      icon: CalendarDays,
      label: t('home.tools.teamAbsence'),
      description: t('home.tools.descriptions.teamAbsence'),
      route: '/hr/team/absence',
      badge: teamAbsencePendingCount ? String(teamAbsencePendingCount) : undefined,
    },
    personalTools[4],
  ];
  const tools = homeMode === 'team' ? teamTools : personalTools;

  const timeStatus = currentTime?.status ?? 'UNAVAILABLE';
  const timeStages: Array<{
    label: string;
    detail: string;
    state: 'completed' | 'current' | 'upcoming';
  }> = [
    {
      label: t('home.rhythm.time.record'),
      detail: currentTime
        ? t('home.rhythm.time.recordValue', { recorded: recordedHours, target: scheduledHours })
        : t('home.states.unavailable'),
      state: !currentTime
        ? 'upcoming'
        : recordedMinutes >= scheduledMinutes && scheduledMinutes > 0
          ? 'completed'
          : 'current',
    },
    {
      label: t('home.rhythm.time.validate'),
      detail: currentTime
        ? currentTime.exceptionCount
          ? t('home.rhythm.time.exceptionValue', { count: currentTime.exceptionCount })
          : t('home.rhythm.time.validated')
        : t('home.states.unavailable'),
      state: currentTime?.exceptionCount
        ? 'current'
        : recordedMinutes >= scheduledMinutes && scheduledMinutes > 0
          ? 'completed'
          : 'upcoming',
    },
    {
      label: t('home.rhythm.time.submit'),
      detail: t(`domains.status.${timeStatus}`, { defaultValue: timeStatus }),
      state: ['SUBMITTED', 'APPROVED', 'LOCKED'].includes(timeStatus)
        ? 'completed'
        : currentTime && recordedMinutes >= scheduledMinutes && !currentTime.exceptionCount
          ? 'current'
          : 'upcoming',
    },
  ];

  const modeSummary =
    homeMode === 'team'
      ? domainAvailable('TEAM')
        ? t('home.header.teamSummary', { count: overview.teamPendingCount })
        : t('home.header.teamUnavailableSummary')
      : currentTime?.exceptionCount
        ? t('home.header.personalExceptionSummary', { count: currentTime.exceptionCount })
        : t('home.header.personalSummary');

  const openRhythm = () => {
    const target = document.getElementById('hcm-rhythm');
    if (!target) return;
    target.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
    target.focus({ preventScroll: true });
  };
  const attentionUnavailableStatus = (
    <Stack
      direction="row"
      alignItems="center"
      gap={1.1}
      role="status"
      aria-live="polite"
      sx={{ minHeight: 72, px: 1.5, py: 1.2, borderTop: 1, borderColor: 'divider' }}
    >
      <ShieldAlert size={22} color={hcmToneColor.amber} aria-hidden="true" />
      <Box>
        <Typography variant="body2" fontWeight={780}>
          {t('home.needsAttention.unavailableTitle')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t(`home.needsAttention.${homeMode}Unavailable`)}
        </Typography>
      </Box>
    </Stack>
  );

  const renderWidget = (widgetKey: HcmHomeWidgetKey, size: HomeWidgetSize) => {
    switch (widgetKey) {
      case 'quick-actions':
        return (
          <Box component="section" aria-labelledby="hcm-tools-title">
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
              justifyContent="space-between"
              gap={1}
              sx={{ mb: 1.25 }}
            >
              <Box>
                <Typography id="hcm-tools-title" component="h2" variant="h6" fontWeight={800}>
                  {t('home.tools.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.2 }}>
                  {t('home.tools.meta')}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {t('home.tools.count', { count: tools.length })}
              </Typography>
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  lg: size === 'medium' ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, 1fr)',
                },
                gap: 0.8,
              }}
            >
              {tools.map((tool) => (
                <HcmToolLink
                  key={tool.id}
                  icon={tool.icon}
                  label={tool.label}
                  description={tool.description}
                  badge={tool.badge}
                  onClick={() => navigate(tool.route)}
                />
              ))}
            </Box>
          </Box>
        );
      case 'people-signals':
        return (
          <Box id="hcm-rhythm" tabIndex={-1} sx={{ scrollMarginTop: 16 }}>
            <HcmSectionSurface
              eyebrow={t(`home.rhythm.${homeMode}.eyebrow`)}
              title={t(`home.rhythm.${homeMode}.title`)}
              meta={t(`home.rhythm.${homeMode}.meta`)}
            >
              <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 2 }}>
                {homeMode === 'personal' && (
                  <Stack gap={1.5}>
                    <Box
                      sx={(theme) => ({
                        p: { xs: 1.4, sm: 1.75 },
                        borderRadius: 1,
                        bgcolor: alpha(
                          hcmToneColor.teal,
                          theme.palette.mode === 'dark' ? 0.1 : 0.035
                        ),
                      })}
                    >
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        alignItems={{ xs: 'flex-start', sm: 'center' }}
                        justifyContent="space-between"
                        gap={1.25}
                        sx={{ mb: 1.5 }}
                      >
                        <Box>
                          <Typography variant="body2" fontWeight={800}>
                            {t('home.rhythm.time.title')}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {currentTime
                              ? t('home.rhythm.time.period', {
                                  start: formatDate(currentTime.periodStart, {
                                    dateStyle: 'medium',
                                  }),
                                  end: formatDate(currentTime.periodEnd, { dateStyle: 'medium' }),
                                })
                              : t('home.rhythm.time.noCard')}
                          </Typography>
                        </Box>
                        <ActionButton
                          intent="quiet"
                          size="small"
                          endIcon={<ArrowRight size={15} />}
                          onClick={() => navigate('/hr/time')}
                        >
                          {t('home.rhythm.time.open')}
                        </ActionButton>
                      </Stack>
                      <HcmStageRail label={t('home.rhythm.time.title')} stages={timeStages} />
                    </Box>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                          xs: '1fr',
                          sm: 'repeat(2, minmax(0, 1fr))',
                          xl: size === 'full' ? 'repeat(4, minmax(0, 1fr))' : 'repeat(2, 1fr)',
                        },
                        gap: 0.8,
                      }}
                    >
                      <HcmRhythmMetric
                        icon={CalendarDays}
                        label={t('home.rhythm.leave.label')}
                        value={
                          !domainAvailable('ABSENCE') || availableLeaveDays === null
                            ? t('home.states.unavailable')
                            : t('home.values.days', { value: availableLeaveDays })
                        }
                        detail={
                          domainAvailable('ABSENCE') && primaryLeaveBalance
                            ? t('home.rhythm.leave.detail', {
                                used: usedLeaveDays,
                                pending:
                                  standardDayMinutes === null
                                    ? t('home.states.unavailable')
                                    : Math.round(
                                        (primaryLeaveBalance.pendingMinutes / standardDayMinutes) *
                                          10
                                      ) / 10,
                              })
                            : t('home.rhythm.leave.noPlan')
                        }
                        progress={
                          domainAvailable('ABSENCE') && primaryLeaveBalance?.grantedMinutes
                            ? (primaryLeaveBalance.usedMinutes /
                                primaryLeaveBalance.grantedMinutes) *
                              100
                            : undefined
                        }
                        onClick={() => navigate('/hr/absence')}
                      />
                      <HcmRhythmMetric
                        icon={ReceiptText}
                        label={t('home.rhythm.pay.label')}
                        value={
                          !domainAvailable('PAY') || payDaysRemaining === null
                            ? t('home.states.unavailable')
                            : t('home.values.dDay', { value: payDaysRemaining })
                        }
                        detail={
                          domainAvailable('PAY') && overview.pay
                            ? t('home.rhythm.pay.scheduleDetail')
                            : t('home.rhythm.pay.noCycle')
                        }
                        onClick={() => navigate('/hr/pay')}
                      />
                      <HcmRhythmMetric
                        icon={HeartPulse}
                        label={t('home.rhythm.benefits.label')}
                        value={
                          domainAvailable('BENEFITS')
                            ? t('home.values.count', { value: overview.activeBenefitCount })
                            : t('home.states.unavailable')
                        }
                        detail={
                          !domainAvailable('BENEFITS')
                            ? t('home.states.unavailable')
                            : nearestBenefitWindow
                              ? t('home.rhythm.benefits.window', {
                                  days:
                                    daysUntilInstant(
                                      nearestBenefitWindow.closesAt,
                                      overview.generatedAt
                                    ) ?? 0,
                                })
                              : t('home.rhythm.benefits.steady')
                        }
                        onClick={() => navigate('/hr/benefits')}
                      />
                      <HcmRhythmMetric
                        icon={GraduationCap}
                        label={t('home.rhythm.journey.label')}
                        value={
                          !domainAvailable('TALENT')
                            ? t('home.states.unavailable')
                            : activeJourney
                              ? `${activeJourney.progressPercent}%`
                              : t('home.rhythm.journey.emptyValue')
                        }
                        detail={
                          !domainAvailable('TALENT')
                            ? t('home.states.unavailable')
                            : activeJourney
                              ? t('home.rhythm.journey.detail', {
                                  name: activeJourney.name,
                                  days: journeyTargetDays ?? '-',
                                })
                              : t('home.rhythm.journey.empty')
                        }
                        progress={
                          domainAvailable('TALENT') ? activeJourney?.progressPercent : undefined
                        }
                        onClick={() => navigate('/hr/talent')}
                      />
                    </Box>
                  </Stack>
                )}
                {homeMode === 'team' && (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                      gap: 0.8,
                    }}
                  >
                    <HcmRhythmMetric
                      icon={Clock3}
                      label={t('home.rhythm.team.time')}
                      value={
                        !domainAvailable('TEAM') || teamTimePendingCount === null
                          ? t('home.states.unavailable')
                          : t('home.values.count', { value: teamTimePendingCount })
                      }
                      detail={t('home.rhythm.team.timeDetail')}
                      onClick={() => navigate('/hr/team/time')}
                    />
                    <HcmRhythmMetric
                      icon={CalendarDays}
                      label={t('home.rhythm.team.absence')}
                      value={
                        !domainAvailable('TEAM') || teamAbsencePendingCount === null
                          ? t('home.states.unavailable')
                          : t('home.values.count', { value: teamAbsencePendingCount })
                      }
                      detail={t('home.rhythm.team.absenceDetail')}
                      onClick={() => navigate('/hr/team/absence')}
                    />
                    <HcmRhythmMetric
                      icon={UsersRound}
                      label={t('home.rhythm.team.people')}
                      value={t('home.values.people', {
                        value: overview.employee.directReportCount,
                      })}
                      detail={t('home.rhythm.team.peopleDetail')}
                      onClick={() => navigate('/hr/team')}
                    />
                  </Box>
                )}
              </Box>
            </HcmSectionSurface>
          </Box>
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
            <Stack gap={1.5} sx={{ px: { xs: 1.5, md: 2 }, pb: 2 }}>
              <Stack direction="row" alignItems="center" gap={1.25}>
                <PersonAvatar name={selfDisplayName} size={48} />
                <Box minWidth={0}>
                  <Typography fontWeight={800}>{selfDisplayName}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {overview.employee.businessTitle ||
                      directoryPerson?.businessTitle ||
                      auth.user?.jobTitle ||
                      t('home.profile.titleFallback')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {organizationName}
                  </Typography>
                </Box>
              </Stack>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: size === 'medium' ? 'repeat(2, minmax(0, 1fr))' : '1fr',
                  gap: 1,
                }}
              >
                {[
                  [
                    t('home.profile.manager'),
                    overview.employee.managerDisplayName || directoryPerson?.managerDisplayName,
                  ],
                  [t('home.profile.location'), directoryPerson?.locationName],
                  [t('home.profile.email'), directoryPerson?.workEmail || auth.user?.email],
                ].map(([label, value]) => (
                  <Box key={label} minWidth={0}>
                    <Typography variant="caption" color="text.secondary">
                      {label}
                    </Typography>
                    <Typography variant="body2" fontWeight={720} sx={{ mt: 0.15 }}>
                      {value || t('home.states.unavailable')}
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
              count: overview.employee.directReportCount,
            })}
            action={
              <ActionButton intent="quiet" size="small" onClick={() => navigate('/hr/team')}>
                {t('home.team.open')}
              </ActionButton>
            }
          >
            {teamChart.isLoading ? (
              <Stack
                gap={0.8}
                role="status"
                aria-live="polite"
                aria-label={t('domains.loading')}
                sx={{ px: { xs: 1.5, md: 2 }, pb: 2 }}
              >
                <Skeleton variant="rounded" height={52} />
                <Skeleton variant="rounded" height={52} />
              </Stack>
            ) : teamChart.isError ? (
              <Stack alignItems="center" gap={1} role="alert" sx={{ pb: 2 }}>
                <EmptyState
                  size="compact"
                  title={t('home.team.loadErrorTitle')}
                  description={t('home.team.loadErrorDescription')}
                />
                <ActionButton
                  intent="secondary"
                  size="small"
                  startIcon={<RefreshCw size={15} />}
                  onClick={() => void teamChart.refetch()}
                >
                  {t('common.retry')}
                </ActionButton>
              </Stack>
            ) : directReports.length ? (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    md: size === 'medium' ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                  },
                  gap: 0.7,
                  px: { xs: 1.5, md: 2 },
                  pb: 2,
                }}
              >
                {directReports.slice(0, size === 'medium' ? 4 : 6).map((report) => (
                  <Stack
                    key={report.personId}
                    direction="row"
                    alignItems="center"
                    gap={1}
                    sx={{ px: 1, py: 0.9, minWidth: 0, borderBottom: 1, borderColor: 'divider' }}
                  >
                    <PersonAvatar name={report.displayName} size={36} />
                    <Box minWidth={0}>
                      <Typography
                        variant="body2"
                        fontWeight={760}
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {report.displayName}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {report.businessTitle || t('home.profile.titleFallback')}
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
    }
  };

  return (
    <PageCanvas>
      <Box
        component="header"
        data-testid="hcm-home-overview"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) auto' },
          alignItems: 'end',
          gap: 2,
          pb: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box minWidth={0}>
          <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.75}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              {currentDate}
            </Typography>
            <Chip
              size="small"
              label={
                overview.generatedAt
                  ? t('home.header.updated', { value: freshness })
                  : t('home.header.generatedUnavailable')
              }
              color={overview.generatedAt ? 'default' : 'warning'}
              variant={overview.generatedAt ? 'filled' : 'outlined'}
              sx={{
                height: 'auto',
                minHeight: 22,
                fontSize: '0.68rem',
                '& .MuiChip-label': { py: 0.25, whiteSpace: 'normal' },
              }}
            />
            {overview.referenceDataPresent && (
              <Chip
                size="small"
                icon={<ShieldAlert size={13} />}
                label={t('home.header.reference')}
                color="warning"
                variant="outlined"
                sx={{
                  height: 'auto',
                  minHeight: 22,
                  fontSize: '0.68rem',
                  '& .MuiChip-label': { py: 0.25, whiteSpace: 'normal' },
                }}
              />
            )}
          </Stack>
          <Typography
            component="h1"
            sx={{
              mt: 0.7,
              fontSize: { xs: '1.45rem', sm: '1.7rem' },
              lineHeight: 1.25,
              fontWeight: 840,
              wordBreak: 'keep-all',
            }}
          >
            {t(`home.greeting.${greetingKey(new Date().getHours())}`, { name: firstName })}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.45, maxWidth: 760, lineHeight: 1.55, wordBreak: 'keep-all' }}
          >
            {modeSummary}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.65, display: 'block' }}>
            {[
              overview.employee.businessTitle ||
                directoryPerson?.businessTitle ||
                auth.user?.jobTitle,
              organizationName,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Typography>
        </Box>
        <Stack direction="row" alignItems="center" justifyContent="flex-end" gap={0.8}>
          {hrOverview.data && resolvedIsManager && (
            <ToggleButtonGroup
              exclusive
              size="small"
              value={homeMode}
              onChange={(_event, next: HomeMode | null) => next && setHomeMode(next)}
              aria-label={t('home.mode.label')}
              sx={{ '& .MuiToggleButton-root': { minHeight: 34, px: 1.25, textTransform: 'none' } }}
            >
              {hrOverview.data && (
                <ToggleButton value="personal">{t('home.mode.personal')}</ToggleButton>
              )}
              {hrOverview.data && resolvedIsManager && (
                <ToggleButton value="team">{t('home.mode.team')}</ToggleButton>
              )}
            </ToggleButtonGroup>
          )}
          {!editorOpen && (
            <ActionIconButton
              label={t('home.customizeLabel')}
              disabled={homePreference.isLoading}
              onClick={beginEditing}
              sx={{ width: 36, height: 36 }}
            >
              <LayoutDashboard size={17} aria-hidden="true" />
            </ActionIconButton>
          )}
        </Stack>
      </Box>

      <Box component="section" aria-labelledby="hcm-needs-attention-title" sx={{ mt: 2.25 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
          justifyContent="space-between"
          gap={1}
          sx={{ mb: 1.15 }}
        >
          <Box>
            <Typography id="hcm-needs-attention-title" component="h2" variant="h6" fontWeight={820}>
              {t('home.needsAttention.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.2 }}>
              {t(`home.needsAttention.${homeMode}Meta`)}
            </Typography>
          </Box>
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Typography variant="caption" color="text.secondary">
              {attentionUnavailable && attentionSignals.length
                ? t('home.needsAttention.countPartial', { count: attentionSignals.length })
                : attentionUnavailable
                  ? t('home.needsAttention.countUnavailable')
                  : t('home.needsAttention.count', { count: attentionSignals.length })}
            </Typography>
            <ActionButton
              intent="quiet"
              size="small"
              endIcon={<ArrowDown size={14} />}
              onClick={openRhythm}
            >
              {t('home.needsAttention.openRhythm')}
            </ActionButton>
          </Stack>
        </Stack>
        {attentionSignals.length ? (
          <Stack gap={0.8}>
            <Box
              component="ul"
              sx={{
                m: 0,
                p: 0,
                listStyle: 'none',
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'repeat(2, minmax(0, 1fr))',
                  lg: 'repeat(3, minmax(0, 1fr))',
                },
                gap: 0.8,
              }}
            >
              {attentionSignals.slice(0, 3).map((signal) => (
                <Box component="li" key={signal.id} sx={{ minWidth: 0 }}>
                  <HcmAttentionItem
                    icon={signal.icon}
                    title={signal.title}
                    description={signal.description}
                    value={signal.value}
                    actionLabel={signal.actionLabel}
                    priority={signal.priority}
                    onClick={() => navigate(signal.route)}
                  />
                </Box>
              ))}
            </Box>
            {attentionUnavailable && attentionUnavailableStatus}
          </Stack>
        ) : attentionUnavailable ? (
          attentionUnavailableStatus
        ) : (
          <Stack
            direction="row"
            alignItems="center"
            gap={1.1}
            sx={(theme) => ({
              minHeight: 72,
              px: 1.5,
              py: 1.2,
              border: 1,
              borderColor: alpha(hcmToneColor.teal, 0.2),
              borderRadius: 1,
              bgcolor: alpha(hcmToneColor.teal, theme.palette.mode === 'dark' ? 0.08 : 0.025),
            })}
          >
            <CheckCircle2 size={22} color={hcmToneColor.teal} aria-hidden="true" />
            <Box>
              <Typography variant="body2" fontWeight={780}>
                {t('home.needsAttention.clearTitle')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t(`home.needsAttention.${homeMode}Clear`)}
              </Typography>
            </Box>
          </Stack>
        )}
      </Box>

      {editorOpen && (
        <Box sx={{ mt: 2 }}>
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
        </Box>
      )}

      <Box
        sx={(theme) => ({
          mt: 2.25,
          transition: theme.transitions.create('filter', { duration: 160 }),
          ...(!editorOpen && {
            '& [data-workspace-widget]': {
              animation: 'hcmWidgetEnter 280ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
            },
            '& [data-workspace-widget]:nth-of-type(2)': { animationDelay: '35ms' },
            '& [data-workspace-widget]:nth-of-type(3)': { animationDelay: '70ms' },
            '@keyframes hcmWidgetEnter': {
              from: { transform: 'translateY(6px)' },
              to: { transform: 'translateY(0)' },
            },
          }),
          '@media (prefers-reduced-motion: reduce)': {
            transition: 'none',
            '& [data-workspace-widget]': { animation: 'none' },
          },
          ...(activePresentation === 'focused' && {
            '& [data-workspace-widget]': { filter: 'saturate(0.82)' },
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
