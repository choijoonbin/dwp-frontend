/**
 * 통합 관제 센터 (대시보드)
 * API: summary, top-risk-drivers, action-required, team-snapshot, agent-activity
 * mock 제거 + 클릭 동선/라우팅 완성
 */

import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { Label, Iconify } from '@dwp-frontend/design-system';
import {
  useCodes,
  buildAuditUrl,
  buildCasesUrl,
  buildActionsUrl,
  buildAnalyticsUrl,
  buildAnomaliesUrl,
  getDashboardTenantId,
  buildReconciliationUrl,
  dashboardSummaryQueryKey,
  useDashboardSummaryQuery,
  dashboardTeamSnapshotQueryKey,
  useDashboardTeamSnapshotQuery,
  dashboardAgentActivityQueryKey,
  useDashboardAgentActivityQuery,
  dashboardActionRequiredQueryKey,
  dashboardTopRiskDriversQueryKey,
  useDashboardActionRequiredQuery,
  useDashboardTopRiskDriversQuery,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

import { SYNAPSE_ROUTES } from '../../routes';
import { SeverityBadge } from '../../components/finance/severity-badge';
import { DashboardEmptyState } from './components/dashboard-empty-state';
import { ErrorStateWithRetry } from '../../components/ux/error-state-with-retry';
import {
  mapRiskDrivers,
  mapTeamSnapshot,
  type KpiUiModel,
  mapAgentActivity,
  mapSummaryToKpis,
  mapActionRequired,
  type RiskDriverUiItem,
  type TeamSnapshotUiItem,
  type AgentActivityUiItem,
  getAgentEventTypeLabelKey,
  type ActionRequiredUiItem,
} from './adapters/dashboard-adapter';

/** 백엔드 links 경로를 /synapse prefix가 있는 절대 경로로 변환 */
function normalizePath(path: string | null | undefined): string | null {
  if (!path || !String(path).trim()) return null;
  const p = String(path).trim();
  if (p.startsWith('/synapse')) return p;
  if (p.startsWith('/')) return `/synapse${p}`;
  return `/synapse/${p}`;
}

// ----------------------------------------------------------------------
// KPI 카드
// ----------------------------------------------------------------------

const KPICard = ({
  title,
  value,
  suffix,
  subValue,
  trend,
  trendLabel,
  icon,
  iconColor,
  iconBg,
  to,
}: {
  title: string;
  value: string | number;
  suffix?: string;
  subValue?: string;
  trend?: number | null;
  trendLabel?: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  to?: string;
}) => {
  const content = (
    <CardContent sx={{ p: 2 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
          <Stack direction="row" alignItems="baseline" spacing={0.5}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {value}
            </Typography>
            {suffix && (
              <Typography variant="body2" color="text.secondary">
                {suffix}
              </Typography>
            )}
          </Stack>
          {subValue && (
            <Typography variant="caption" color="text.secondary">
              {subValue}
            </Typography>
          )}
          {trend !== undefined && trend !== null && (
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ pt: 0.5 }}>
              <Iconify
                icon={trend > 0 ? 'solar:arrow-up-bold' : 'solar:arrow-down-bold'}
                width={16}
                sx={{ color: trend > 0 ? 'success.main' : 'error.main' }}
              />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  color: trend > 0 ? 'success.main' : 'error.main',
                }}
              >
                {trend > 0 ? '+' : ''}
                {trend}%
              </Typography>
              {trendLabel && (
                <Typography variant="caption" color="text.secondary">
                  {trendLabel}
                </Typography>
              )}
            </Stack>
          )}
          {trend === null && trendLabel && (
            <Typography variant="caption" color="text.secondary" sx={{ pt: 0.5 }}>
              {trendLabel} —
            </Typography>
          )}
        </Stack>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: iconBg,
            color: iconColor,
            flexShrink: 0,
          }}
        >
          <Iconify icon={icon} width={24} />
        </Box>
      </Stack>
    </CardContent>
  );
  const card = (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        ...(to && { cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }),
      }}
    >
      {content}
    </Card>
  );
  return to ? (
    <Link to={to} style={{ textDecoration: 'none', color: 'inherit', flex: '1 1 200px', minWidth: 240 }}>
      {card}
    </Link>
  ) : (
    card
  );
};

const KPICardSkeleton = () => (
  <Card variant="outlined" sx={{ height: '100%' }}>
    <CardContent sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" spacing={1}>
        <Stack spacing={0.5}>
          <Skeleton width={120} height={16} />
          <Skeleton width={60} height={32} />
        </Stack>
        <Skeleton variant="rounded" width={40} height={40} />
      </Stack>
    </CardContent>
  </Card>
);

// ----------------------------------------------------------------------
// 에이전트 활동 로그
// ----------------------------------------------------------------------

const ActivityLogItem = ({
  activity,
  actionLabel,
  onClick,
}: {
  activity: AgentActivityUiItem;
  /** eventType 읽기 쉬운 라벨 (매핑된 경우) */
  actionLabel?: string;
  onClick?: () => void;
}) => {
  const isClickable = Boolean(
    activity.caseId ||
      activity.caseKey ||
      activity.actionId ||
      activity.traceId ||
      activity.resourceId ||
      activity.resourceType === 'INTEGRATION'
  );
  const time = new Date(activity.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const actionColors: Record<string, string> = {
    SCAN: 'info.main',
    DETECT: 'warning.main',
    EXECUTE: 'success.main',
    SIMULATE: 'primary.main',
    ANALYZE: 'info.main',
    MATCH: 'primary.main',
  };
  const statusColors: Record<string, string> = {
    complete: 'text.secondary',
    success: 'success.main',
    alert: 'warning.main',
    error: 'error.main',
  };
  const actionColor = actionColors[activity.action] ?? 'text.primary';
  const statusColor = statusColors[activity.status] ?? 'text.primary';

  return (
    <Stack
      direction="row"
      alignItems="flex-start"
      spacing={1}
      sx={{
        flexWrap: 'wrap',
        gap: 0.5,
        ...(isClickable && {
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
        }),
        borderRadius: 0.5,
        px: 0.5,
        py: 0.25,
      }}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable && onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
        {time}
      </Typography>
      <Typography variant="caption" sx={{ color: actionColor, flexShrink: 0 }}>
        [{actionLabel ?? activity.action}]
      </Typography>
      {activity.caseId && (
        <Typography
          component={Link}
          to={SYNAPSE_ROUTES.CASE_DETAIL.replace(':id', activity.caseId)}
          variant="caption"
          onClick={(e) => e.stopPropagation()}
          sx={{ color: 'primary.main', flexShrink: 0, '&:hover': { textDecoration: 'underline' } }}
        >
          {activity.caseKey ?? activity.caseId}
        </Typography>
      )}
      <Typography variant="caption" sx={{ color: statusColor, flex: 1 }}>
        {activity.message}
      </Typography>
    </Stack>
  );
};

// ----------------------------------------------------------------------
// 포맷 유틸
// ----------------------------------------------------------------------

function formatPreventedLoss(amount: number, currency: string): string {
  if (amount === 0) return `$0`;
  const sym = currency === 'USD' ? '$' : currency;
  if (amount >= 1_000_000) return `${sym}${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `${sym}${(amount / 1_000).toFixed(0)}K`;
  return `${sym}${amount.toFixed(0)}`;
}

function formatRiskAmount(amount: number): string {
  if (amount === 0) return '—';
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

// ----------------------------------------------------------------------
// 대시보드 페이지
// ----------------------------------------------------------------------

const AGENT_STREAM_RANGE = '6h';
const AGENT_STREAM_PREVIEW_COUNT = 5;

/** 마지막 성공 시각 포맷 HH:mm:ss */
function formatLastUpdated(ms: number): string {
  return new Date(ms).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export const DashboardPage = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = getDashboardTenantId();
  const { getLabel: getCaseTypeLabel } = useCodes('CASE_TYPE');

  const summaryQuery = useDashboardSummaryQuery();
  const riskDriversQuery = useDashboardTopRiskDriversQuery('24h');
  const actionRequiredQuery = useDashboardActionRequiredQuery('HIGH,CRITICAL');
  const teamSnapshotQuery = useDashboardTeamSnapshotQuery('7d');
  const agentActivityQuery = useDashboardAgentActivityQuery(AGENT_STREAM_RANGE, 50);

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: dashboardSummaryQueryKey(tenantId) });
    void queryClient.invalidateQueries({
      queryKey: dashboardTopRiskDriversQueryKey(tenantId, '24h'),
    });
    void queryClient.invalidateQueries({
      queryKey: dashboardActionRequiredQueryKey(tenantId, 'HIGH,CRITICAL'),
    });
    void queryClient.invalidateQueries({
      queryKey: dashboardTeamSnapshotQueryKey(tenantId, '7d'),
    });
    void queryClient.invalidateQueries({
      queryKey: dashboardAgentActivityQueryKey(tenantId, AGENT_STREAM_RANGE),
    });
  };

  const kpis: KpiUiModel = mapSummaryToKpis(summaryQuery.data ?? null);
  const pendingActions: ActionRequiredUiItem[] = mapActionRequired(actionRequiredQuery.data ?? []);
  const riskDrivers: RiskDriverUiItem[] = mapRiskDrivers(
    riskDriversQuery.data ?? [],
    getCaseTypeLabel
  );
  const teamSnapshot: TeamSnapshotUiItem[] = mapTeamSnapshot(teamSnapshotQuery.data ?? []);
  const agentActivities: AgentActivityUiItem[] = mapAgentActivity(agentActivityQuery.data ?? []);

  const handleReviewClick = (action: ActionRequiredUiItem) => {
    const path = normalizePath(action.reviewPath);
    if (path) {
      navigate(path);
    } else if (action.caseId && action.caseId.trim()) {
      navigate(SYNAPSE_ROUTES.CASE_DETAIL.replace(':id', action.caseId));
    } else if (action.caseNumber && /^CS-\d{4}-\d+$/i.test(action.caseNumber)) {
      navigate(buildCasesUrl({ caseKey: action.caseNumber }));
    } else {
      navigate(buildCasesUrl({ ids: action.caseId }));
    }
  };

  /** 표준: caseId 우선 → /cases/{caseId} */
  const handleActionRequiredRowClick = (action: ActionRequiredUiItem) => {
    if (action.caseId && action.caseId.trim()) {
      navigate(SYNAPSE_ROUTES.CASE_DETAIL.replace(':id', action.caseId));
    } else if (action.caseNumber && /^CS-\d{4}-\d+$/i.test(action.caseNumber)) {
      navigate(buildCasesUrl({ caseKey: action.caseNumber }));
    } else {
      navigate(buildCasesUrl({ ids: action.caseId }));
    }
  };

  const handleTeamSnapshotRowClick = (member: TeamSnapshotUiItem, cell: 'analyst' | 'openCases' | 'pendingApprovals') => {
    if (cell === 'pendingApprovals') {
      const path = normalizePath(member.actionsPath);
      if (path) {
        navigate(path);
      } else {
        const userId = member.analystUserId || member.id;
        navigate(buildActionsUrl({ assignee: userId, status: 'PENDING_APPROVAL' }));
      }
      return;
    }
    const path = normalizePath(member.casesPath);
    if (path) {
      navigate(path);
      return;
    }
    const userId = member.analystUserId || member.id;
    navigate(buildCasesUrl({ assigneeUserId: userId, status: ['OPEN', 'TRIAGE'], range: '7d' }));
  };

  const handleAgentActivityClick = (item: AgentActivityUiItem) => {
    if (item.casePath) {
      navigate(normalizePath(item.casePath) ?? buildCasesUrl({}));
      return;
    }
    if (item.auditPath) {
      navigate(normalizePath(item.auditPath) ?? buildAuditUrl({ range: '24h', eventCategory: 'AGENT' }));
      return;
    }
    if (item.caseId && item.caseId.trim()) {
      navigate(SYNAPSE_ROUTES.CASE_DETAIL.replace(':id', item.caseId));
    } else if (item.caseKey && /^CS-\d{4}-\d+$/i.test(item.caseKey)) {
      navigate(buildCasesUrl({ caseKey: item.caseKey }));
    } else if (item.traceId || item.resourceId) {
      const q = item.traceId ?? item.resourceId ?? '';
      navigate(buildAuditUrl({ q, range: '24h' }));
    } else if (item.actionId) {
      navigate(buildActionsUrl({ focus: item.actionId }));
    } else if (item.resourceType === 'INTEGRATION') {
      navigate(buildAuditUrl({ range: '24h', category: ['INTEGRATION', 'ACTION'] }));
    } else {
      navigate(buildAuditUrl({ range: '24h', category: ['INTEGRATION', 'ACTION'] }));
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, width: '100%' }}>
      <Stack spacing={3}>
        {/* Page Header */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {t('dashboard.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {t('dashboard.subtitle')}
            </Typography>
          </Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Iconify icon="solar:refresh-bold" width={18} />}
              sx={{ bgcolor: 'transparent' }}
              onClick={handleRefresh}
            >
              <Typography component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                {t('dashboard.refresh')}
              </Typography>
            </Button>
            <Button
              component={Link}
              to={SYNAPSE_ROUTES.CASES}
              variant="contained"
              size="small"
              startIcon={<Iconify icon="solar:eye-bold" width={18} />}
            >
              <Typography component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                {t('dashboard.viewCases')}
              </Typography>
            </Button>
          </Stack>
        </Stack>

        {/* P0-1: 자동 갱신 상태 + 마지막 업데이트 / 실패 시 경고 */}
        {agentActivityQuery.isError && (
          <Box
            sx={{
              py: 1,
              px: 2,
              borderRadius: 1,
              bgcolor: 'warning.lighter',
              border: 1,
              borderColor: 'warning.light',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1,
            }}
          >
            <Typography variant="body2" color="warning.dark">
              {t('dashboard.loadFailedRetrying')}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              color="warning"
              startIcon={<Iconify icon="solar:refresh-bold" width={16} />}
              onClick={() => void agentActivityQuery.refetch()}
            >
              {t('dashboard.refresh')}
            </Button>
          </Box>
        )}
        <Stack
          direction="row"
          alignItems="center"
          spacing={1.5}
          sx={{ mt: agentActivityQuery.isError ? 0 : -1, mb: 0.5 }}
          flexWrap="wrap"
        >
          <Label color="info" variant="soft" sx={{ fontSize: '0.75rem' }}>
            {t('dashboard.autoRefreshBadge')}
          </Label>
          {!agentActivityQuery.isError && agentActivityQuery.dataUpdatedAt > 0 && (
            <Typography variant="caption" color="text.secondary">
              {t('dashboard.lastUpdated', { time: formatLastUpdated(agentActivityQuery.dataUpdatedAt) })}
            </Typography>
          )}
        </Stack>

        {/* KPI Cards */}
        <Stack
          direction="row"
          flexWrap="wrap"
          useFlexGap
          spacing={2}
          sx={{ '& > *': { minWidth: 240, flex: '1 1 200px' } }}
        >
          {summaryQuery.isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <KPICardSkeleton key={i} />)
          ) : summaryQuery.isError ? (
            <Box sx={{ width: '100%' }}>
              <ErrorStateWithRetry
                title={t('error.errorState.failedToLoadKpi')}
                message={summaryQuery.error?.message ?? t('dashboard.summaryLoadFailed')}
                onRetry={() => void summaryQuery.refetch()}
              />
            </Box>
          ) : (
            <>
              <KPICard
                title={t('dashboard.kpi.financialHealthIndex')}
                value={kpis.financialHealthIndex}
                suffix="/100"
                trend={kpis.financialHealthTrend}
                trendLabel={t('dashboard.trendLabels.vsPreviousMonth')}
                icon="solar:heart-bold-duotone"
                iconColor="success.main"
                iconBg="success.lighter"
                to={buildReconciliationUrl({ range: '24h' })}
              />
              <KPICard
                title={t('dashboard.kpi.openCasesBySeverity')}
                value={kpis.openCasesBySeverity.critical + kpis.openCasesBySeverity.high}
                suffix={t('dashboard.severitySuffix.urgentHigh')}
                subValue={`${kpis.openCasesBySeverity.medium + kpis.openCasesBySeverity.low}${t('dashboard.severitySuffix.mediumLow')}`}
                icon="solar:danger-triangle-bold-duotone"
                iconColor="warning.main"
                iconBg="warning.lighter"
                to={
                  normalizePath(kpis.links?.casesPath) ??
                  buildCasesUrl({ status: ['OPEN', 'TRIAGE'], severity: ['CRITICAL', 'HIGH'], range: '24h' })
                }
              />
              <KPICard
                title={t('dashboard.kpi.aiActionSuccessRate')}
                value={kpis.aiActionSuccessRate ?? '—'}
                suffix={kpis.aiActionSuccessRate != null ? '%' : ''}
                trend={kpis.aiActionSuccessTrend}
                trendLabel={t('dashboard.trendLabels.vsPreviousWeek')}
                icon="solar:bolt-bold-duotone"
                iconColor="primary.main"
                iconBg="primary.lighter"
                to={
                  normalizePath(kpis.links?.actionsPath) ??
                  buildActionsUrl({ status: ['EXECUTED', 'FAILED'], range: '7d' })
                }
              />
              <KPICard
                title={t('dashboard.kpi.expectedLossPrevention')}
                value={formatPreventedLoss(kpis.estimatedPreventedLoss, kpis.preventedLossCurrency)}
                trend={kpis.preventedLossTrend}
                trendLabel={t('dashboard.trendLabels.thisQuarter')}
                icon="solar:wallet-money-bold-duotone"
                iconColor="success.main"
                iconBg="success.lighter"
                to={buildAnalyticsUrl({ range: '30d' })}
              />
            </>
          )}
        </Stack>

        {/* Main Content: 2열 그리드. 좌측 row1+2 = 조치필요+리스크, row3 = 팀현황. 우측 row1-2 = 에이전트스트림(동일 높이), row3 = 주요지표(팀현황과 수평) */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
            gridTemplateRows: { xs: 'auto', lg: 'auto auto auto' },
            gap: 3,
            alignItems: 'stretch',
            width: '100%',
          }}
        >
            {/* Action Required — 좌측 1행 */}
            <Card variant="outlined" sx={{ gridColumn: { xs: 1, lg: 1 }, gridRow: { xs: 'auto', lg: 1 }, minWidth: 0 }}>
              <CardContent sx={{ pb: 2 }}>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ mb: 2 }}
                >
                  <Stack direction="row" alignItems="flex-start" spacing={1}>
                    <Iconify
                      icon="solar:clock-circle-bold-duotone"
                      width={20}
                      sx={{ color: 'warning.main', mt: 0.25, flexShrink: 0 }}
                    />
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {t('dashboard.actionsRequired.title')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('dashboard.actionsRequired.subtitle')}
                      </Typography>
                    </Box>
                  </Stack>
                  {!actionRequiredQuery.isLoading && !actionRequiredQuery.isError && (
                    <Label color="warning" variant="soft">
                      {t('dashboard.actionsRequired.pendingCount', { count: pendingActions.length })}
                    </Label>
                  )}
                </Stack>
                {actionRequiredQuery.isLoading ? (
                  <Stack spacing={1.5}>
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} variant="rounded" height={72} />
                    ))}
                  </Stack>
                ) : actionRequiredQuery.isError ? (
                  <ErrorStateWithRetry
                    title={t('error.errorState.failedToLoadActionsList')}
                    message={actionRequiredQuery.error?.message ?? t('error.errorState.failedToLoadData')}
                    onRetry={() => void actionRequiredQuery.refetch()}
                  />
                ) : pendingActions.length === 0 ? (
                  <DashboardEmptyState
                    icon="solar:check-circle-bold-duotone"
                    title={t('dashboard.actionsRequired.emptyTitle')}
                    description={t('dashboard.actionsRequired.emptyDesc')}
                    actions={[
                      {
                        label: t('dashboard.actionsRequired.ctaActionCenter'),
                        to: SYNAPSE_ROUTES.ACTIONS,
                        variant: 'primary',
                      },
                    ]}
                    compact
                  />
                ) : (
                  <>
                    <Stack spacing={1.5}>
                      {pendingActions.slice(0, 3).map((action) => (
                        <Stack
                          key={action.id}
                          direction="row"
                          alignItems="center"
                          justifyContent="space-between"
                          spacing={2}
                          sx={{
                            p: 1.5,
                            borderRadius: 1,
                            border: 1,
                            borderColor: 'divider',
                            bgcolor: 'background.neutral',
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.hover' },
                          }}
                          onClick={() => handleActionRequiredRowClick(action)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleActionRequiredRowClick(action);
                            }
                          }}
                        >
                          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
                            <Box
                              sx={{
                                width: 40,
                                height: 40,
                                borderRadius: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                bgcolor:
                                  action.riskLevel === 'critical'
                                    ? 'error.lighter'
                                    : action.riskLevel === 'high'
                                      ? 'warning.lighter'
                                      : 'info.lighter',
                              }}
                            >
                              <Iconify
                                icon="solar:bolt-bold-duotone"
                                width={20}
                                sx={{
                                  color:
                                    action.riskLevel === 'critical'
                                      ? 'error.main'
                                      : action.riskLevel === 'high'
                                        ? 'warning.main'
                                        : 'info.main',
                                }}
                              />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                                {action.description}
                              </Typography>
                              <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.25 }}>
                                <Typography variant="caption" color="text.secondary">
                                  {action.caseNumber ?? action.caseId}
                                </Typography>
                                <SeverityBadge severity={action.riskLevel} size="sm" showIcon={false} />
                              </Stack>
                            </Box>
                          </Stack>
                          <Button
                            variant="contained"
                            size="small"
                            endIcon={<Iconify icon="solar:arrow-right-bold" width={16} />}
                            onClick={() => handleReviewClick(action)}
                          >
                            {t('dashboard.actionsRequired.review')}
                          </Button>
                        </Stack>
                      ))}
                    </Stack>
                    <Button
                      component={Link}
                      to={buildActionsUrl({ status: 'PENDING', requiresApproval: true, range: '24h' })}
                      variant="text"
                      fullWidth
                      sx={{ mt: 1.5, color: 'text.secondary' }}
                      startIcon={<Iconify icon="solar:arrow-right-bold" width={16} />}
                    >
                      {t('dashboard.actionsRequired.viewAll')}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Top Risk Drivers — 좌측 2행 */}
            <Card variant="outlined" sx={{ gridColumn: { xs: 1, lg: 1 }, gridRow: { xs: 'auto', lg: 2 }, minWidth: 0 }}>
              <CardContent sx={{ pb: 2 }}>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ mb: 2 }}
                >
                  <Stack direction="row" alignItems="flex-start" spacing={1}>
                    <Iconify
                      icon="solar:chart-2-bold-duotone"
                      width={20}
                      sx={{ color: 'primary.main', mt: 0.25, flexShrink: 0 }}
                    />
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {t('dashboard.riskDrivers.title')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('dashboard.riskDrivers.subtitle')}
                      </Typography>
                    </Box>
                  </Stack>
                  <Button
                    component={Link}
                    to={buildAnalyticsUrl({ range: '30d', breakdown: 'driverType' })}
                    variant="outlined"
                    size="small"
                  >
                    {t('dashboard.riskDrivers.viewAnalysis')}
                  </Button>
                </Stack>
                {riskDriversQuery.isLoading ? (
                  <Stack spacing={2}>
                    {[1, 2, 3, 4].map((i) => (
                      <Box key={i}>
                        <Skeleton width="80%" height={20} />
                        <Skeleton variant="rounded" height={8} sx={{ mt: 0.5 }} />
                      </Box>
                    ))}
                  </Stack>
                ) : riskDriversQuery.isError ? (
                  <ErrorStateWithRetry
                    title={t('error.errorState.failedToLoadRiskDrivers')}
                    message={riskDriversQuery.error?.message ?? t('error.errorState.failedToLoadData')}
                    onRetry={() => void riskDriversQuery.refetch()}
                  />
                ) : riskDrivers.length === 0 ? (
                  <DashboardEmptyState
                    icon="solar:chart-2-bold-duotone"
                    title={t('dashboard.riskDrivers.emptyTitle')}
                    description={t('dashboard.riskDrivers.emptyDesc')}
                    actions={[
                      {
                        label: t('dashboard.riskDrivers.ctaRiskEvents'),
                        to: buildAuditUrl({ range: '24h', category: ['RISK', 'EVENT'] }),
                        variant: 'primary',
                      },
                      {
                        label: t('dashboard.riskDrivers.ctaDetectionCriteria'),
                        to: SYNAPSE_ROUTES.POLICIES,
                        variant: 'secondary',
                      },
                    ]}
                    compact
                  />
                ) : (
                  <Stack spacing={2}>
                    {riskDrivers.map((driver) => (
                      <Box
                        key={driver.id}
                        onClick={() => {
                          const path = normalizePath(driver.anomaliesPath) ?? normalizePath(driver.casesPath);
                          if (path) {
                            navigate(path);
                          } else {
                            const typeKey = driver.riskTypeKey.toUpperCase().replace(/-/g, '_');
                            navigate(buildAnomaliesUrl({ type: typeKey, range: '24h' }));
                          }
                        }}
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' },
                          borderRadius: 1,
                          p: 0.5,
                          mx: -0.5,
                        }}
                      >
                        <Stack
                          direction="row"
                          alignItems="center"
                          justifyContent="space-between"
                          sx={{ mb: 0.5 }}
                        >
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {driver.label}
                            </Typography>
                            <Label color="default" variant="soft" sx={{ fontSize: '0.75rem' }}>
                              {driver.count}{t('dashboard.countUnit')}
                            </Label>
                            {driver.trend === 'up' && (
                              <Iconify
                                icon="solar:arrow-up-bold"
                                width={14}
                                sx={{ color: 'error.main' }}
                              />
                            )}
                            {driver.trend === 'down' && (
                              <Iconify
                                icon="solar:arrow-down-bold"
                                width={14}
                                sx={{ color: 'success.main' }}
                              />
                            )}
                          </Stack>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {formatRiskAmount(driver.amount)}
                          </Typography>
                        </Stack>
                        <Box
                          sx={{
                            height: 8,
                            borderRadius: 1,
                            bgcolor: 'action.hover',
                            overflow: 'hidden',
                          }}
                        >
                          <Box
                            sx={{
                              height: '100%',
                              width: `${Math.min(100, (driver.amount / 500_000) * 100)}%`,
                              borderRadius: 1,
                              bgcolor:
                                driver.type === 'duplicate_invoice'
                                  ? 'error.main'
                                  : driver.type === 'bank_change'
                                    ? 'warning.main'
                                    : driver.type === 'policy_violation'
                                      ? 'info.main'
                                      : 'primary.main',
                            }}
                          />
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>

            {/* Team Snapshot — 좌측 3행 (우측 주요지표와 동일 행/높이) */}
            <Card variant="outlined" sx={{ gridColumn: { xs: 1, lg: 1 }, gridRow: { xs: 'auto', lg: 3 }, minWidth: 0 }}>
              <CardContent sx={{ pb: 2 }}>
                <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mb: 2 }}>
                  <Iconify
                    icon="solar:users-group-rounded-bold-duotone"
                    width={20}
                    sx={{ color: 'primary.main', mt: 0.25, flexShrink: 0 }}
                  />
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {t('dashboard.teamSnapshot.title')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('dashboard.teamSnapshot.subtitle')}
                    </Typography>
                  </Box>
                </Stack>
                {teamSnapshotQuery.isLoading ? (
                  <Stack spacing={1}>
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} variant="rounded" height={40} />
                    ))}
                  </Stack>
                ) : teamSnapshotQuery.isError ? (
                  <ErrorStateWithRetry
                    title={t('error.errorState.failedToLoadTeamSnapshot')}
                    message={teamSnapshotQuery.error?.message ?? t('error.errorState.failedToLoadData')}
                    onRetry={() => void teamSnapshotQuery.refetch()}
                  />
                ) : teamSnapshot.length === 0 ? (
                  <DashboardEmptyState
                    icon="solar:users-group-rounded-bold-duotone"
                    title={t('dashboard.teamSnapshot.emptyTitle')}
                    description={t('dashboard.teamSnapshot.emptyDesc')}
                    actions={[
                      {
                        label: t('dashboard.teamSnapshot.ctaTeamSettings'),
                        to: SYNAPSE_ROUTES.ADMIN,
                        variant: 'primary',
                      },
                      {
                        label: t('dashboard.teamSnapshot.ctaChangeRange'),
                        to: buildAuditUrl({ range: '24h' }),
                        variant: 'secondary',
                      },
                    ]}
                    compact
                  />
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>
                          {t('dashboard.teamSnapshot.analyst')}
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                          {t('dashboard.teamSnapshot.openCases')}
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                          {t('dashboard.teamSnapshot.pendingApproval')}
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                          {t('dashboard.teamSnapshot.slaRisk')}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                          {t('dashboard.teamSnapshot.avgLeadTime')}
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {teamSnapshot.map((member) => (
                        <TableRow
                          key={member.id}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => handleTeamSnapshotRowClick(member, 'analyst')}
                        >
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {member.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {member.role}
                            </Typography>
                          </TableCell>
                          <TableCell
                            align="center"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTeamSnapshotRowClick(member, 'openCases');
                            }}
                            sx={{ cursor: 'pointer' }}
                          >
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {member.openCases}
                            </Typography>
                          </TableCell>
                          <TableCell
                            align="center"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTeamSnapshotRowClick(member, 'pendingApprovals');
                            }}
                            sx={{ cursor: 'pointer' }}
                          >
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {member.pendingApprovals}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            {member.slaRisk === 'AT_RISK' ? (
                              <Label color="error" variant="soft" sx={{ fontSize: '0.75rem' }}>
                                {member.slaRiskCount > 0
                                  ? t('dashboard.teamSnapshot.riskCount', { count: member.slaRiskCount })
                                  : t('dashboard.teamSnapshot.risk')}
                              </Label>
                            ) : (
                              <Label color="success" variant="soft" sx={{ fontSize: '0.75rem' }}>
                                {t('dashboard.teamSnapshot.normal')}
                              </Label>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {member.avgLeadTime}h
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

          {/* 에이전트 실행 스트림 — 우측 1~2행 (조치필요+주요리스크 합친 높이), 내부 스크롤 */}
            <Card
              variant="outlined"
              sx={{
                gridColumn: { xs: 1, lg: 2 },
                gridRow: { xs: 'auto', lg: '1 / 3' },
                minWidth: 0,
                minHeight: 0,
                height: { lg: '100%' },
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <CardContent sx={{ pb: 2, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ mb: 2 }}
                >
                  <Stack direction="row" alignItems="flex-start" spacing={1}>
                    <Iconify
                      icon="solar:bot-bold-duotone"
                      width={20}
                      sx={{ color: 'primary.main', mt: 0.25, flexShrink: 0 }}
                    />
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {t('dashboard.agentStream.title')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('dashboard.agentStream.subtitle')}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: 'success.main',
                        animation: 'ping 1.5s ease-in-out infinite',
                        '@keyframes ping': {
                          '75%, 100%': { transform: 'scale(1.5)', opacity: 0 },
                        },
                      }}
                    />
                    <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>
                      {t('dashboard.agentStream.realtime')}
                    </Typography>
                  </Stack>
                </Stack>
                <Box
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 1,
                    border: 1,
                    borderColor: 'divider',
                    bgcolor: 'background.neutral',
                    overflow: 'hidden',
                  }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{
                      flexShrink: 0,
                      px: 1,
                      py: 0.75,
                      borderBottom: 1,
                      borderColor: 'divider',
                      bgcolor: 'action.hover',
                    }}
                  >
                    <Stack direction="row" spacing={0.25}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'error.main', opacity: 0.6 }} />
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'warning.main', opacity: 0.6 }} />
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'success.main', opacity: 0.6 }} />
                    </Stack>
                    <Typography variant="caption" fontFamily="monospace" color="text.secondary">
                      agent-stream.log
                    </Typography>
                  </Stack>
                  {agentActivityQuery.isLoading ? (
                    <Stack spacing={1} sx={{ p: 1.5 }}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} variant="rounded" height={24} />
                      ))}
                    </Stack>
                  ) : agentActivityQuery.isError ? (
                    <Box sx={{ p: 2 }}>
                      <ErrorStateWithRetry
                        title={t('error.errorState.failedToLoadAgentActivity')}
                        message={agentActivityQuery.error?.message ?? t('error.errorState.failedToLoadData')}
                        onRetry={() => void agentActivityQuery.refetch()}
                      />
                    </Box>
                  ) : agentActivities.length === 0 ? (
                    <DashboardEmptyState
                      icon="solar:bot-bold-duotone"
                      title={t('dashboard.agentStream.emptyTitle')}
                      description={t('dashboard.agentStream.emptyDesc')}
                      actions={[
                        {
                          label: t('dashboard.agentStream.ctaAuditLog'),
                          to: buildAuditUrl({ range: AGENT_STREAM_RANGE, category: ['CASE'] }),
                          variant: 'primary',
                        },
                        {
                          label: t('dashboard.agentStream.ctaExtendRange'),
                          to: buildAuditUrl({ range: '24h', category: ['CASE'] }),
                          variant: 'secondary',
                        },
                      ]}
                      compact
                    />
                  ) : (
                    <Stack spacing={1} sx={{ p: 1.5, flex: 1, minHeight: 0, overflow: 'auto', overflowY: 'auto' }}>
                      {agentActivities.slice(0, AGENT_STREAM_PREVIEW_COUNT).map((activity) => (
                        <ActivityLogItem
                          key={activity.id}
                          activity={activity}
                          actionLabel={
                            (() => {
                              const key = getAgentEventTypeLabelKey(activity.action);
                              const translated = t(`dashboard.agentStream.eventType.${key}`);
                              return translated !== `dashboard.agentStream.eventType.${key}` ? translated : activity.action;
                            })()
                          }
                          onClick={() => handleAgentActivityClick(activity)}
                        />
                      ))}
                    </Stack>
                  )}
                </Box>
                <Button
                  component={Link}
                  to={buildAuditUrl({ range: AGENT_STREAM_RANGE, category: ['CASE'] })}
                  variant="text"
                  fullWidth
                  size="small"
                  sx={{ flexShrink: 0, mt: 1.5, color: 'text.secondary' }}
                  startIcon={<Iconify icon="solar:arrow-right-bold" width={14} />}
                >
                  {t('dashboard.agentStream.viewFullAudit')}
                </Button>
              </CardContent>
            </Card>

            {/* 주요 지표 — 우측 3행 (팀 현황과 동일 행/높이) */}
            <Card
              variant="outlined"
              sx={{
                gridColumn: { xs: 1, lg: 2 },
                gridRow: { xs: 'auto', lg: 3 },
                minWidth: 0,
                overflow: 'hidden',
              }}
            >
              <CardContent sx={{ pb: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                  <Iconify
                    icon="solar:shield-check-bold-duotone"
                    width={20}
                    sx={{ color: 'primary.main' }}
                  />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {t('dashboard.quickStats.title')}
                  </Typography>
                </Stack>
                {summaryQuery.isLoading ? (
                  <Stack spacing={2}>
                    {[1, 2, 3, 4].map((i) => (
                      <Stack key={i} direction="row" justifyContent="space-between" alignItems="center">
                        <Skeleton width={80} height={20} />
                        <Skeleton width={40} height={24} />
                      </Stack>
                    ))}
                  </Stack>
                ) : summaryQuery.isError ? (
                  <Typography variant="body2" color="text.secondary">
                    {t('dashboard.summaryLoadFailed')}
                  </Typography>
                ) : (
                  <Stack spacing={2}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      component={Link}
                      to={
                        normalizePath(kpis.links?.actionsPath) ??
                        buildActionsUrl({ status: 'PENDING', requiresApproval: true, range: '24h' })
                      }
                      sx={{
                        textDecoration: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        borderRadius: 1,
                        px: 1,
                        py: 0.5,
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        {t('dashboard.quickStats.pendingApproval')}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {kpis.pendingApprovals}
                      </Typography>
                    </Stack>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      component={Link}
                      to={(() => {
                        const base = normalizePath(kpis.links?.casesPath);
                        if (base) {
                          return base.includes('?') ? `${base}&slaRisk=AT_RISK` : `${base}?slaRisk=AT_RISK`;
                        }
                        return buildCasesUrl({ status: ['OPEN', 'TRIAGE'], slaRisk: 'AT_RISK', range: '24h' });
                      })()}
                      sx={{
                        textDecoration: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        borderRadius: 1,
                        px: 1,
                        py: 0.5,
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        {t('dashboard.quickStats.slaRisk')}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: 'warning.main' }}>
                        {kpis.slaAtRisk}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="text.secondary">
                        {t('dashboard.quickStats.avgLeadTime')}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {kpis.avgLeadTime}h
                      </Typography>
                    </Stack>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      component={Link}
                      to={
                        normalizePath(kpis.links?.casesPath) ??
                        buildCasesUrl({ status: ['OPEN', 'TRIAGE'], range: '24h' })
                      }
                      sx={{
                        textDecoration: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        borderRadius: 1,
                        px: 1,
                        py: 0.5,
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        {t('dashboard.quickStats.unprocessed')}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {kpis.backlogCount}
                      </Typography>
                    </Stack>
                  </Stack>
                )}
              </CardContent>
            </Card>
        </Box>
      </Stack>
    </Box>
  );
};
