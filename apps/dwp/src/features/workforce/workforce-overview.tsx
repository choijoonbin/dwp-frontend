import type { ReactNode } from 'react';

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  DatabaseZap,
  GitPullRequest,
  Network,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ActionButton,
  DatePickerField,
  DistributionBar,
  ErrorState,
  LiveStatus,
  LoadingState,
  OperationalContextBar,
  SignalMetric,
  foundationTokens,
  mergeFilterSearchParams,
} from '@dwp-frontend/design-system';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';
import {
  getOrganizationChart,
  listHrisSyncRuns,
  listOrganizationScenarios,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type {
  HrisSyncRun,
  OrganizationChart,
  OrganizationChartOrganization,
} from '@dwp-frontend/shared-utils';

import { GovernedSavedViewControl } from '../saved-views/governed-saved-view-control';

type PriorityTone = 'error' | 'warning' | 'info';

type PriorityAction = {
  id: string;
  title: string;
  detail: string;
  route: string;
  tone: PriorityTone;
  badge: string;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function isIsoDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/u.test(value));
}

function previousMonth(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const targetMonth = month === 1 ? 12 : month - 1;
  const targetYear = month === 1 ? year - 1 : year;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(
    Math.min(day, lastDay)
  ).padStart(2, '0')}`;
}

function previousYear(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year - 1, month, 0)).getUTCDate();
  return `${year - 1}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(
    2,
    '0'
  )}`;
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${formatNumber(value)}`;
}

function issueCount(data: OrganizationChart): number {
  return (
    data.analysis.missingManagerCount +
    data.analysis.missingGradeCount +
    data.analysis.orphanOrganizationCount
  );
}

function latestSyncRun(runs: HrisSyncRun[] | undefined): HrisSyncRun | undefined {
  return [...(runs ?? [])].sort(
    (left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime()
  )[0];
}

function SectionSurface({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Paper component="section" variant="outlined" sx={{ minWidth: 0, overflow: 'hidden' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={1.25}
        sx={{ px: 2, py: 1.75, borderBottom: 1, borderColor: 'divider' }}
      >
        <Box minWidth={0}>
          <Typography component="h2" variant="subtitle1" fontWeight={760}>
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {description}
          </Typography>
        </Box>
        {action}
      </Stack>
      {children}
    </Paper>
  );
}

function LegendItem({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <Stack direction="row" alignItems="center" gap={0.65}>
      <Box aria-hidden="true" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: color }} />
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="caption" fontWeight={750}>
        {formatNumber(value)}
      </Typography>
    </Stack>
  );
}

function RiskOrganizationRow({
  organization,
  onOpen,
}: {
  organization: OrganizationChartOrganization;
  onOpen: () => void;
}) {
  const { t } = useTranslation('workforce');
  const tone = organization.healthStatus === 'CRITICAL' ? 'error' : 'warning';
  return (
    <ButtonBase
      onClick={onOpen}
      aria-label={t('overview.risk.openOrganization', { name: organization.name })}
      sx={{
        width: 1,
        px: 2,
        py: 1.25,
        justifyContent: 'stretch',
        textAlign: 'left',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Stack direction="row" alignItems="center" gap={1.25} width={1} minWidth={0}>
        <Box
          aria-hidden="true"
          sx={{
            width: 8,
            height: 8,
            flex: '0 0 8px',
            borderRadius: '50%',
            bgcolor: `${tone}.main`,
          }}
        />
        <Box minWidth={0} flex={1}>
          <Typography variant="body2" fontWeight={700} noWrap>
            {organization.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap display="block">
            {t('overview.risk.organizationDetail', {
              headcount: organization.totalHeadcount,
              span: formatNumber(organization.averageManagerSpan, { maximumFractionDigits: 1 }),
              vacancies: organization.openPositionCount,
            })}
          </Typography>
        </Box>
        <Chip
          size="small"
          variant="outlined"
          color={tone}
          label={t(`overview.risk.states.${organization.healthStatus}`)}
        />
        <ArrowRight size={15} aria-hidden="true" />
      </Stack>
    </ButtonBase>
  );
}

export function WorkforceOverview() {
  const { t } = useTranslation('workforce');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentDate = today();
  const asOfParam = searchParams.get('asOf');
  const asOf = isIsoDate(asOfParam) ? asOfParam : currentDate;
  const compareToParam = searchParams.get('compareTo');
  const compareTo = isIsoDate(compareToParam) ? compareToParam : previousMonth(asOf);
  const updatePeriod = useCallback(
    (values: Record<string, string | null>) =>
      setSearchParams(mergeFilterSearchParams(searchParams, values), { replace: true }),
    [searchParams, setSearchParams]
  );
  const builtInViews = useMemo(
    () => [
      {
        id: 'current-month',
        name: t('overview.savedViews.currentMonth'),
        configuration: { asOf: currentDate, compareTo: previousMonth(currentDate) },
        isDefault: true,
      },
      {
        id: 'annual-baseline',
        name: t('overview.savedViews.annualBaseline'),
        configuration: { asOf: currentDate, compareTo: previousYear(currentDate) },
      },
    ],
    [currentDate, t]
  );
  const selectedBuiltInViewId =
    asOf === currentDate && compareTo === previousMonth(currentDate)
      ? 'current-month'
      : asOf === currentDate && compareTo === previousYear(currentDate)
        ? 'annual-baseline'
        : null;
  const applySavedView = useCallback(
    (configuration: Record<string, unknown>) => {
      const nextAsOf = isIsoDate(String(configuration.asOf ?? ''))
        ? String(configuration.asOf)
        : currentDate;
      const nextCompareTo = isIsoDate(String(configuration.compareTo ?? ''))
        ? String(configuration.compareTo)
        : previousMonth(nextAsOf);
      updatePeriod({
        asOf: nextAsOf === currentDate ? null : nextAsOf,
        compareTo: nextCompareTo,
      });
    },
    [currentDate, updatePeriod]
  );

  const chart = useQuery({
    queryKey: ['workforce', 'overview', 'chart', asOf],
    queryFn: () => getOrganizationChart({ asOf, depth: 12, surface: 'workforce' }),
  });
  const comparison = useQuery({
    queryKey: ['workforce', 'overview', 'comparison', compareTo],
    queryFn: () => getOrganizationChart({ asOf: compareTo, depth: 12, surface: 'workforce' }),
    retry: false,
  });
  const scenarios = useQuery({
    queryKey: ['workforce', 'overview', 'scenarios'],
    queryFn: listOrganizationScenarios,
    retry: false,
  });
  const runs = useQuery({
    queryKey: ['workforce', 'overview', 'sync-runs'],
    queryFn: () => listHrisSyncRuns(20),
    retry: false,
  });

  const latestRun = useMemo(() => latestSyncRun(runs.data), [runs.data]);

  if (chart.isLoading) {
    return <LoadingState label={t('overview.loading')} size="page" />;
  }
  if (chart.isError || !chart.data) {
    return (
      <ErrorState
        title={t('common.loadError')}
        description={t('overview.loadError')}
        size="standard"
        retryLabel={t('common.actions.retry')}
        onRetry={() => void chart.refetch()}
        retrying={chart.isFetching}
      />
    );
  }

  const data = chart.data;
  const previous = comparison.data;
  const draftScenarios = (scenarios.data ?? []).filter((item) => item.lifecycleState === 'DRAFT');
  const qualityIssues = issueCount(data);
  const criticalOrganizations = data.organizations.filter(
    (organization) => organization.healthStatus === 'CRITICAL'
  );
  const attentionOrganizations = data.organizations.filter(
    (organization) => organization.healthStatus === 'ATTENTION'
  );
  const healthyOrganizations = data.organizations.filter(
    (organization) => organization.healthStatus === 'HEALTHY'
  );
  const riskOrganizations = [...criticalOrganizations, ...attentionOrganizations]
    .sort((left, right) => {
      if (left.healthStatus !== right.healthStatus) {
        return left.healthStatus === 'CRITICAL' ? -1 : 1;
      }
      return right.totalHeadcount - left.totalHeadcount;
    })
    .slice(0, 5);
  const criticalVacancies = data.openPositions.filter((position) =>
    ['CRITICAL', 'HIGH'].includes(position.criticality)
  );
  const totalPositions = Math.max(data.positions.length, data.metrics.openPositionCount);
  const vacancyRatio = totalPositions ? (data.metrics.openPositionCount / totalPositions) * 100 : 0;
  const employeeHeadcount = Math.max(
    0,
    data.metrics.activeHeadcount - data.metrics.contingentHeadcount
  );
  const optionalFailure = comparison.isError || scenarios.isError || runs.isError;
  const failedSync = latestRun?.lifecycleState === 'FAILED';
  const pulseState =
    failedSync || criticalOrganizations.length > 0 || data.analysis.dataQualityScore < 80
      ? 'CRITICAL'
      : attentionOrganizations.length > 0 ||
          criticalVacancies.length > 0 ||
          qualityIssues > 0 ||
          (latestRun?.rejectedCount ?? 0) > 0
        ? 'ATTENTION'
        : 'HEALTHY';
  const pulseTone =
    pulseState === 'CRITICAL' ? 'error' : pulseState === 'ATTENTION' ? 'warning' : 'success';
  const liveState =
    chart.isFetching || comparison.isFetching || scenarios.isFetching || runs.isFetching
      ? 'syncing'
      : failedSync || optionalFailure
        ? 'degraded'
        : asOf !== currentDate
          ? 'stale'
          : 'live';
  const comparisonDetail = (current: number, baseline?: number) =>
    comparison.isLoading
      ? t('overview.comparison.loading')
      : comparison.isError || baseline === undefined
        ? t('overview.comparison.unavailable')
        : t('overview.comparison.delta', {
            delta: signed(current - baseline),
            date: formatDate(compareTo, { dateStyle: 'medium' }),
          });

  const priorities: PriorityAction[] = [];
  if (failedSync && latestRun) {
    priorities.push({
      id: `sync-${latestRun.syncRunId}`,
      title: t('overview.actions.syncFailed'),
      detail: t('overview.actions.syncFailedDetail', {
        source: latestRun.sourceKey,
        code: latestRun.failureCode ?? t('overview.actions.unknownFailure'),
      }),
      route: '/workforce/data-operations',
      tone: 'error',
      badge: t('overview.actions.immediate'),
    });
  }
  if (qualityIssues > 0) {
    priorities.push({
      id: 'data-quality',
      title: t('overview.actions.dataQuality', { count: qualityIssues }),
      detail: t('overview.actions.dataQualityDetail', {
        managers: data.analysis.missingManagerCount,
        grades: data.analysis.missingGradeCount,
        organizations: data.analysis.orphanOrganizationCount,
      }),
      route: `/workforce/organization?mode=insights&insight=quality&asOf=${asOf}`,
      tone: data.analysis.dataQualityScore < 80 ? 'error' : 'warning',
      badge: `${data.analysis.dataQualityScore}%`,
    });
  }
  for (const organization of riskOrganizations.slice(0, 3)) {
    priorities.push({
      id: `organization-${organization.organizationId}`,
      title: t('overview.actions.organizationRisk', { name: organization.name }),
      detail: t('overview.actions.organizationRiskDetail', {
        signals: organization.healthSignals.length,
        headcount: organization.totalHeadcount,
        vacancies: organization.openPositionCount,
      }),
      route: `/workforce/organization?organization=${encodeURIComponent(
        organization.organizationId
      )}&asOf=${asOf}`,
      tone: organization.healthStatus === 'CRITICAL' ? 'error' : 'warning',
      badge: t(`overview.risk.states.${organization.healthStatus}`),
    });
  }
  if (criticalVacancies.length > 0) {
    priorities.push({
      id: 'critical-vacancies',
      title: t('overview.actions.criticalVacancies', { count: criticalVacancies.length }),
      detail: t('overview.actions.criticalVacanciesDetail', {
        total: data.metrics.openPositionCount,
      }),
      route: `/workforce/organization?mode=positions&asOf=${asOf}`,
      tone: 'warning',
      badge: t('overview.actions.staffing'),
    });
  }
  if ((latestRun?.rejectedCount ?? 0) > 0 && !failedSync) {
    priorities.push({
      id: `rejected-${latestRun?.syncRunId}`,
      title: t('overview.actions.rejectedRecords', { count: latestRun?.rejectedCount }),
      detail: t('overview.actions.rejectedRecordsDetail', { source: latestRun?.sourceKey }),
      route: '/workforce/data-operations',
      tone: 'warning',
      badge: t('overview.actions.reconcile'),
    });
  }
  if (draftScenarios.length > 0) {
    priorities.push({
      id: 'draft-scenarios',
      title: t('overview.actions.draftScenarios', { count: draftScenarios.length }),
      detail: t('overview.actions.draftScenariosDetail'),
      route: `/workforce/organization?asOf=${asOf}`,
      tone: 'info',
      badge: t('overview.actions.plan'),
    });
  }
  const priorityOrder: Record<PriorityTone, number> = { error: 0, warning: 1, info: 2 };
  const visiblePriorities = priorities
    .sort((left, right) => priorityOrder[left.tone] - priorityOrder[right.tone])
    .slice(0, 6);
  const primaryAction = visiblePriorities[0];

  const refresh = () => {
    void chart.refetch();
    void comparison.refetch();
    void scenarios.refetch();
    void runs.refetch();
  };
  return (
    <Stack data-testid="workforce-overview" gap={2} sx={{ maxWidth: 1600, mx: 'auto' }}>
      <OperationalContextBar
        label={t('overview.context.label')}
        items={[
          {
            label: t('overview.context.scope'),
            value: data.company.name,
            icon: <Building2 size={16} />,
          },
          {
            label: t('overview.context.model'),
            value: t('overview.context.effectiveWorkforce'),
            icon: <Network size={16} />,
          },
        ]}
        status={
          <LiveStatus
            state={liveState}
            label={t(`overview.live.${liveState}`)}
            detail={
              latestRun
                ? t('overview.live.latestSync', {
                    time: formatDate(latestRun.startedAt, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }),
                  })
                : t('overview.live.snapshot', { date: data.asOf })
            }
            refreshLabel={t('common.actions.refresh')}
            refreshing={chart.isFetching || comparison.isFetching || runs.isFetching}
            onRefresh={refresh}
          />
        }
        actions={
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            gap={1}
            width={{ xs: 1, sm: 'auto' }}
          >
            <GovernedSavedViewControl
              surfaceKey="workforce.operations-overview"
              currentConfiguration={{ asOf, compareTo }}
              builtInViews={builtInViews}
              selectedBuiltInViewId={selectedBuiltInViewId}
              onApply={applySavedView}
            />
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 1,
              }}
            >
              <DatePickerField
                size="small"
                label={t('overview.context.asOf')}
                value={asOf}
                onValueChange={(value) =>
                  value && updatePeriod({ asOf: value === currentDate ? null : value })
                }
                sx={{ width: { xs: 1, sm: 154 }, minWidth: 0 }}
              />
              <DatePickerField
                size="small"
                label={t('overview.context.compareTo')}
                value={compareTo}
                onValueChange={(value) => value && updatePeriod({ compareTo: value })}
                sx={{ width: { xs: 1, sm: 154 }, minWidth: 0 }}
              />
            </Box>
          </Stack>
        }
      />

      <Paper
        component="section"
        variant="outlined"
        sx={(theme) => {
          const color = theme.palette[pulseTone].main;
          return {
            position: 'relative',
            overflow: 'hidden',
            px: { xs: 2, md: 2.5 },
            py: { xs: 2, md: 2.25 },
            bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.12 : 0.055),
            borderColor: alpha(color, 0.35),
            '&::before': {
              position: 'absolute',
              inset: '0 auto 0 0',
              width: 4,
              bgcolor: color,
              content: '""',
            },
          };
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
          gap={2}
        >
          <Stack direction="row" alignItems="flex-start" gap={1.25} minWidth={0}>
            <Box
              aria-hidden="true"
              sx={{
                width: 38,
                height: 38,
                flex: '0 0 38px',
                display: 'grid',
                placeItems: 'center',
                borderRadius: 1,
                color: `${pulseTone}.main`,
                bgcolor: 'background.paper',
              }}
            >
              {pulseState === 'HEALTHY' ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
            </Box>
            <Box minWidth={0}>
              <Typography component="h2" variant="h5">
                {t(`overview.pulse.title.${pulseState}`)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                {t(`overview.pulse.detail.${pulseState}`, {
                  actions: visiblePriorities.length,
                  organizations: criticalOrganizations.length + attentionOrganizations.length,
                })}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1.25 }}>
                <Chip
                  size="small"
                  variant="outlined"
                  color={data.metrics.onLeaveHeadcount ? 'info' : 'success'}
                  label={t('overview.pulse.leave', { count: data.metrics.onLeaveHeadcount })}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  color={criticalVacancies.length ? 'warning' : 'success'}
                  label={t('overview.pulse.criticalVacancies', {
                    count: criticalVacancies.length,
                  })}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  color={qualityIssues ? 'warning' : 'success'}
                  label={t('overview.pulse.dataIssues', { count: qualityIssues })}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  color={draftScenarios.length ? 'info' : 'default'}
                  label={t('overview.pulse.scenarios', { count: draftScenarios.length })}
                />
              </Stack>
            </Box>
          </Stack>
          {primaryAction && (
            <ActionButton
              intent={primaryAction.tone === 'error' ? 'danger' : 'primary'}
              endIcon={<ArrowRight size={17} />}
              onClick={() => navigate(primaryAction.route)}
              sx={{ alignSelf: { xs: 'flex-start', md: 'center' }, flexShrink: 0 }}
            >
              {t('overview.pulse.openPriority')}
            </ActionButton>
          )}
        </Stack>
      </Paper>

      <Box
        component="section"
        aria-label={t('overview.metrics.label')}
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(4, minmax(0, 1fr))',
          },
          gap: 1.5,
        }}
      >
        <SignalMetric
          label={t('overview.metrics.activeWorkforce')}
          value={formatNumber(data.metrics.activeHeadcount)}
          detail={comparisonDetail(data.metrics.activeHeadcount, previous?.metrics.activeHeadcount)}
          icon={<UsersRound size={18} />}
          tone="primary"
          actionLabel={t('overview.metrics.openPeople')}
          onClick={() => navigate(`/workforce/people?status=ACTIVE&asOf=${asOf}`)}
        />
        <SignalMetric
          label={t('overview.metrics.openPositions')}
          value={formatNumber(data.metrics.openPositionCount)}
          detail={comparisonDetail(
            data.metrics.openPositionCount,
            previous?.metrics.openPositionCount
          )}
          icon={<BriefcaseBusiness size={18} />}
          tone={criticalVacancies.length ? 'warning' : 'info'}
          progress={Math.min(100, vacancyRatio)}
          progressLabel={t('overview.metrics.vacancyRatio', {
            value: formatNumber(vacancyRatio, { maximumFractionDigits: 1 }),
          })}
          actionLabel={t('overview.metrics.openPositionsAction')}
          onClick={() => navigate(`/workforce/organization?mode=positions&asOf=${asOf}`)}
        />
        <SignalMetric
          label={t('overview.metrics.organizationRisk')}
          value={formatNumber(criticalOrganizations.length + attentionOrganizations.length)}
          detail={t('overview.metrics.organizationRiskDetail', {
            critical: criticalOrganizations.length,
            attention: attentionOrganizations.length,
          })}
          icon={<Building2 size={18} />}
          tone={
            criticalOrganizations.length
              ? 'error'
              : attentionOrganizations.length
                ? 'warning'
                : 'success'
          }
          progress={
            data.organizations.length
              ? (healthyOrganizations.length / data.organizations.length) * 100
              : 100
          }
          progressLabel={t('overview.metrics.healthyOrganizations', {
            count: healthyOrganizations.length,
            total: data.organizations.length,
          })}
          actionLabel={t('overview.metrics.openHealth')}
          onClick={() => navigate(`/workforce/organization?mode=insights&asOf=${asOf}`)}
        />
        <SignalMetric
          label={t('overview.metrics.dataQuality')}
          value={`${data.analysis.dataQualityScore}%`}
          detail={comparisonDetail(
            data.analysis.dataQualityScore,
            previous?.analysis.dataQualityScore
          )}
          icon={<ShieldCheck size={18} />}
          tone={
            data.analysis.dataQualityScore < 80
              ? 'error'
              : data.analysis.dataQualityScore < 95
                ? 'warning'
                : 'success'
          }
          progress={data.analysis.dataQualityScore}
          progressLabel={t('overview.metrics.issuesDetail', { count: qualityIssues })}
          actionLabel={t('overview.metrics.openQuality')}
          onClick={() =>
            navigate(`/workforce/organization?mode=insights&insight=quality&asOf=${asOf}`)
          }
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 7fr) minmax(340px, 5fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <SectionSurface
          title={t('overview.queue.title')}
          description={t('overview.queue.description')}
          action={
            <Chip
              size="small"
              variant="outlined"
              color={visiblePriorities.length ? 'warning' : 'success'}
              label={t('overview.queue.count', { count: visiblePriorities.length })}
            />
          }
        >
          {visiblePriorities.length ? (
            <Stack component="ol" sx={{ p: 0, m: 0, listStyle: 'none' }}>
              {visiblePriorities.map((item, index) => (
                <Box
                  component="li"
                  key={item.id}
                  sx={{ '&:not(:last-of-type)': { borderBottom: 1, borderColor: 'divider' } }}
                >
                  <ButtonBase
                    onClick={() => navigate(item.route)}
                    sx={{
                      width: 1,
                      px: 2,
                      py: 1.35,
                      justifyContent: 'stretch',
                      textAlign: 'left',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Stack direction="row" alignItems="center" gap={1.25} width={1} minWidth={0}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ width: 20, flex: '0 0 20px' }}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </Typography>
                      <Box
                        aria-hidden="true"
                        sx={{
                          width: 8,
                          height: 8,
                          flex: '0 0 8px',
                          borderRadius: '50%',
                          bgcolor: `${item.tone}.main`,
                        }}
                      />
                      <Box minWidth={0} flex={1}>
                        <Typography variant="body2" fontWeight={700}>
                          {item.title}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                          sx={{ mt: 0.2 }}
                        >
                          {item.detail}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={item.tone}
                        label={item.badge}
                        sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                      />
                      <ArrowRight size={16} aria-hidden="true" />
                    </Stack>
                  </ButtonBase>
                </Box>
              ))}
            </Stack>
          ) : (
            <Stack direction="row" alignItems="center" gap={1.25} sx={{ p: 2.5 }}>
              <CheckCircle2 size={20} color={foundationTokens.color.status.success} />
              <Box>
                <Typography variant="body2" fontWeight={700}>
                  {t('overview.queue.clearTitle')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('overview.queue.clearDescription')}
                </Typography>
              </Box>
            </Stack>
          )}
        </SectionSurface>

        <SectionSurface
          title={t('overview.composition.title')}
          description={t('overview.composition.description')}
          action={
            <ActionButton
              intent="quiet"
              size="small"
              endIcon={<ArrowRight size={15} />}
              onClick={() => navigate(`/workforce/people?asOf=${asOf}`)}
            >
              {t('overview.composition.openPeople')}
            </ActionButton>
          }
        >
          <Stack gap={2} sx={{ p: 2 }}>
            <DistributionBar
              label={t('overview.composition.summary', {
                active: employeeHeadcount,
                leave: data.metrics.onLeaveHeadcount,
                contingent: data.metrics.contingentHeadcount,
              })}
              segments={[
                {
                  key: 'active',
                  value: employeeHeadcount,
                  color: foundationTokens.color.data.cobalt,
                },
                {
                  key: 'leave',
                  value: data.metrics.onLeaveHeadcount,
                  color: foundationTokens.color.data.saffron,
                },
                {
                  key: 'contingent',
                  value: data.metrics.contingentHeadcount,
                  color: foundationTokens.color.data.cyan,
                },
              ]}
              height={9}
            />
            <Stack direction="row" gap={1.5} flexWrap="wrap">
              <LegendItem
                color={foundationTokens.color.data.cobalt}
                label={t('overview.composition.active')}
                value={employeeHeadcount}
              />
              <LegendItem
                color={foundationTokens.color.data.saffron}
                label={t('overview.composition.leave')}
                value={data.metrics.onLeaveHeadcount}
              />
              <LegendItem
                color={foundationTokens.color.data.cyan}
                label={t('overview.composition.contingent')}
                value={data.metrics.contingentHeadcount}
              />
            </Stack>
            <Divider />
            <Stack gap={1.15}>
              <Stack direction="row" justifyContent="space-between" gap={2}>
                <Typography variant="body2" color="text.secondary">
                  {t('overview.composition.plannedFte')}
                </Typography>
                <Typography variant="body2" fontWeight={750}>
                  {formatNumber(data.metrics.plannedFte, { maximumFractionDigits: 1 })}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" gap={2}>
                <Typography variant="body2" color="text.secondary">
                  {t('overview.composition.managerRatio')}
                </Typography>
                <Typography variant="body2" fontWeight={750}>
                  {formatNumber(data.analysis.managerRatioPercent, { maximumFractionDigits: 1 })}%
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" gap={2}>
                <Typography variant="body2" color="text.secondary">
                  {t('overview.composition.contingentRatio')}
                </Typography>
                <Typography variant="body2" fontWeight={750}>
                  {formatNumber(data.analysis.contingentRatioPercent, {
                    maximumFractionDigits: 1,
                  })}
                  %
                </Typography>
              </Stack>
            </Stack>
          </Stack>
        </SectionSurface>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 7fr) minmax(340px, 5fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <SectionSurface
          title={t('overview.risk.title')}
          description={t('overview.risk.description')}
          action={
            <ActionButton
              intent="quiet"
              size="small"
              endIcon={<ArrowRight size={15} />}
              onClick={() => navigate(`/workforce/organization?mode=insights&asOf=${asOf}`)}
            >
              {t('overview.risk.openInsights')}
            </ActionButton>
          }
        >
          <Box
            sx={{ p: 2, borderBottom: riskOrganizations.length ? 1 : 0, borderColor: 'divider' }}
          >
            <DistributionBar
              label={t('overview.risk.summary', {
                healthy: healthyOrganizations.length,
                attention: attentionOrganizations.length,
                critical: criticalOrganizations.length,
              })}
              segments={[
                {
                  key: 'healthy',
                  value: healthyOrganizations.length,
                  color: foundationTokens.color.data.teal,
                },
                {
                  key: 'attention',
                  value: attentionOrganizations.length,
                  color: foundationTokens.color.data.saffron,
                },
                {
                  key: 'critical',
                  value: criticalOrganizations.length,
                  color: foundationTokens.color.data.coral,
                },
              ]}
              height={9}
            />
            <Stack direction="row" gap={1.5} flexWrap="wrap" sx={{ mt: 1.25 }}>
              <LegendItem
                color={foundationTokens.color.data.teal}
                label={t('overview.risk.states.HEALTHY')}
                value={healthyOrganizations.length}
              />
              <LegendItem
                color={foundationTokens.color.data.saffron}
                label={t('overview.risk.states.ATTENTION')}
                value={attentionOrganizations.length}
              />
              <LegendItem
                color={foundationTokens.color.data.coral}
                label={t('overview.risk.states.CRITICAL')}
                value={criticalOrganizations.length}
              />
            </Stack>
          </Box>
          {riskOrganizations.length ? (
            <Stack divider={<Divider flexItem />}>
              {riskOrganizations.map((organization) => (
                <RiskOrganizationRow
                  key={organization.organizationId}
                  organization={organization}
                  onOpen={() =>
                    navigate(
                      `/workforce/organization?organization=${encodeURIComponent(
                        organization.organizationId
                      )}&asOf=${asOf}`
                    )
                  }
                />
              ))}
            </Stack>
          ) : (
            <Stack direction="row" alignItems="center" gap={1.25} sx={{ px: 2, py: 2.5 }}>
              <CheckCircle2 size={19} color={foundationTokens.color.status.success} />
              <Typography variant="body2">{t('overview.risk.clear')}</Typography>
            </Stack>
          )}
        </SectionSurface>

        <SectionSurface
          title={t('overview.control.title')}
          description={t('overview.control.description')}
        >
          <Stack divider={<Divider flexItem />}>
            <Box sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                <Stack direction="row" alignItems="center" gap={1} minWidth={0}>
                  <DatabaseZap size={17} aria-hidden="true" />
                  <Box minWidth={0}>
                    <Typography variant="body2" fontWeight={700}>
                      {t('overview.control.latestSync')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" noWrap>
                      {runs.isError
                        ? t('overview.control.unavailable')
                        : latestRun
                          ? `${latestRun.sourceKey} · ${formatDate(latestRun.startedAt, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}`
                          : t('overview.control.never')}
                    </Typography>
                  </Box>
                </Stack>
                <Chip
                  size="small"
                  variant="outlined"
                  color={
                    runs.isError || latestRun?.lifecycleState === 'FAILED'
                      ? 'error'
                      : latestRun?.lifecycleState === 'SUCCEEDED'
                        ? 'success'
                        : 'default'
                  }
                  label={
                    runs.isError
                      ? t('overview.control.partial')
                      : latestRun
                        ? t(`overview.syncStates.${latestRun.lifecycleState}`, {
                            defaultValue: latestRun.lifecycleState,
                          })
                        : t('overview.freshness.never')
                  }
                />
              </Stack>
              {latestRun && !runs.isError && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 1, display: 'block' }}
                >
                  {t('overview.freshness.runSummary', {
                    read: latestRun.readCount,
                    changed: latestRun.createdCount + latestRun.updatedCount,
                    rejected: latestRun.rejectedCount,
                  })}
                </Typography>
              )}
            </Box>
            <ButtonBase
              onClick={() => navigate('/workforce/data-operations')}
              sx={{ width: 1, p: 2, justifyContent: 'stretch', textAlign: 'left' }}
            >
              <Stack direction="row" alignItems="center" gap={1} width={1}>
                <UserRoundCheck size={17} aria-hidden="true" />
                <Box minWidth={0} flex={1}>
                  <Typography variant="body2" fontWeight={700}>
                    {t('overview.control.reconciliation')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('overview.control.reconciliationDetail', {
                      count: latestRun?.rejectedCount ?? 0,
                    })}
                  </Typography>
                </Box>
                <ArrowRight size={16} aria-hidden="true" />
              </Stack>
            </ButtonBase>
            <ButtonBase
              onClick={() => navigate(`/workforce/organization?asOf=${asOf}`)}
              sx={{ width: 1, p: 2, justifyContent: 'stretch', textAlign: 'left' }}
            >
              <Stack direction="row" alignItems="center" gap={1} width={1}>
                <GitPullRequest size={17} aria-hidden="true" />
                <Box minWidth={0} flex={1}>
                  <Typography variant="body2" fontWeight={700}>
                    {t('overview.control.scenarios')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {scenarios.isError
                      ? t('overview.control.unavailable')
                      : t('overview.control.scenarioDetail', { count: draftScenarios.length })}
                  </Typography>
                </Box>
                <ArrowRight size={16} aria-hidden="true" />
              </Stack>
            </ButtonBase>
            {comparison.isError && (
              <Stack direction="row" alignItems="flex-start" gap={1} sx={{ p: 2 }}>
                <AlertTriangle size={17} color={foundationTokens.color.status.warning} />
                <Box>
                  <Typography variant="body2" fontWeight={700}>
                    {t('overview.control.comparisonUnavailable')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('overview.control.comparisonUnavailableDetail')}
                  </Typography>
                </Box>
              </Stack>
            )}
          </Stack>
        </SectionSurface>
      </Box>
    </Stack>
  );
}
