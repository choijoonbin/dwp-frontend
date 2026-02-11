/**
 * Integrated Control Center (ICC) — Phase 5
 * Metrics (analytics_kpi_daily/summary), Autonomous Pulse (radar), Live Intelligence Feed (agent_activity_log),
 * Critical HITL Summary (recon_result FAIL). Glassmorphism + responsive 375px.
 */

import type { Theme } from '@mui/material/styles';

import { useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { animate, useMotionValue } from 'framer-motion';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { Label, Iconify } from '@dwp-frontend/design-system';
import {
  buildAuditUrl,
  buildCasesUrl,
  buildActionsUrl,
  buildAnalyticsUrl,
  useReconRunsQuery,
  getDashboardTenantId,
  useRagDocumentsQuery,
  buildReconciliationUrl,
  useReconRunDetailQuery,
  dashboardTeamSnapshotQueryKey,
  useDashboardTeamSnapshotQuery,
  dashboardAgentActivityQueryKey,
  useDashboardAgentActivityQuery,
  dashboardActionRequiredQueryKey,
  dashboardTopRiskDriversQueryKey,
  synapseDashboardSummaryQueryKey,
  useDashboardActionRequiredQuery,
  useDashboardTopRiskDriversQuery,
  useSynapseDashboardSummaryQuery,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

import { SYNAPSE_ROUTES } from '../../routes';
import { RadarPulse } from './components/radar-pulse';
import { DashboardEmptyState } from './components/dashboard-empty-state';
import { ErrorStateWithRetry } from '../../components/ux/error-state-with-retry';
import {
  mapAgentActivity,
  mapKpiDailyToCards,
  type AgentActivityUiItem,
} from './adapters/dashboard-adapter';

// ----------------------------------------------------------------------
// Glassmorphism — Dark: surface rgba(30,41,59,0.4), blur 16px, sharp border, subtle SK Red glow
// Light: blur 20px, rgba(255,255,255,0.7)
// ----------------------------------------------------------------------

const getGlassCardSx = (theme: Theme): Record<string, unknown> => {
  const isDark = theme.palette.mode === 'dark';
  return {
    backdropFilter: isDark ? 'blur(16px)' : 'blur(20px)',
    WebkitBackdropFilter: isDark ? 'blur(16px)' : 'blur(20px)',
    ...(isDark
      ? {
          backgroundColor: 'rgba(30, 41, 59, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 0 15px rgba(225, 33, 39, 0.2)',
        }
      : {
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
        }),
  };
};

/** KPI cards only: same as getGlassCardSx + subtle gradient for depth (dark mode) */
const getKpiGlassCardSx = (theme: Theme): Record<string, unknown> => {
  const base = getGlassCardSx(theme) as Record<string, unknown>;
  if (theme.palette.mode !== 'dark') return base;
  return {
    ...base,
    backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 50%)',
  };
};

/** 숫자 KPI 값 카운터 애니메이션 — 오도미터(굴러가는 숫자) 효과 */
const ODOMETER_DURATION_MS = 500;

function getDigits(n: number): number[] {
  if (!Number.isFinite(n) || n < 0) return [0];
  if (n === 0) return [0];
  const out: number[] = [];
  let x = Math.floor(n);
  while (x > 0) {
    out.unshift(x % 10);
    x = Math.floor(x / 10);
  }
  return out;
}

/** Single digit column: 0–9 strip, translateY로 해당 숫자만 보이게 하고 애니메이션 */
const OdometerDigit = ({
  digit,
  prevDigit,
  sx,
}: {
  digit: number;
  prevDigit: number;
  sx?: Record<string, unknown>;
}) => {
  const [displayVal, setDisplayVal] = useState(prevDigit);
  const prevRef = useRef(prevDigit);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);

  useEffect(() => {
    if (digit === prevRef.current) return () => {};
    const start = prevRef.current;
    prevRef.current = digit;
    const startTime = performance.now();
    startRef.current = startTime;

    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const t = Math.min(elapsed / ODOMETER_DURATION_MS, 1);
      const easeOut = 1 - (1 - t) * (1 - t);
      setDisplayVal(start + (digit - start) * easeOut);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [digit]);

  const digitHeight = 28;
  const translateY = -displayVal * digitHeight;

  return (
    <Box
      sx={{
        height: digitHeight,
        overflow: 'hidden',
        display: 'inline-flex',
        flexDirection: 'column',
        ...sx,
      }}
    >
      <Box
    sx={{
      transform: `translateY(${translateY}px)`,
      transition: 'none',
      willChange: 'transform',
    }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <Typography
            key={d}
            variant="h5"
            sx={{
              height: digitHeight,
              display: 'flex',
              alignItems: 'center',
              fontWeight: 700,
              color: 'text.primary',
              letterSpacing: -0.5,
            }}
          >
            {d}
          </Typography>
        ))}
      </Box>
    </Box>
  );
};

/** 오도미터 스타일 숫자 (자릿수별 굴러가는 애니메이션) */
const OdometerValue = ({ value, sx }: { value: number; sx?: Record<string, unknown> }) => {
  const digits = getDigits(value);
  const prevDigitsRef = useRef<number[]>(digits);

  const alignedPrev = (() => {
    const prev = prevDigitsRef.current;
    if (prev.length === digits.length) return prev;
    if (digits.length > prev.length) {
      return [...Array(digits.length - prev.length).fill(0), ...prev];
    }
    return prev.slice(prev.length - digits.length);
  })();

  useEffect(() => {
    prevDigitsRef.current = [...digits];
  }, [value]);

  return (
    <Stack direction="row" alignItems="center" spacing={0.25} sx={{ ...sx }}>
      {digits.map((d, i) => (
        <OdometerDigit
          key={`${i}-${digits.length}`}
          digit={d}
          prevDigit={alignedPrev[i] ?? 0}
          sx={{ minWidth: 18 }}
        />
      ))}
    </Stack>
  );
};

/** 백엔드 links 경로를 /synapse prefix가 있는 절대 경로로 변환 */
function normalizePath(path: string | null | undefined): string | null {
  if (!path || !String(path).trim()) return null;
  const p = String(path).trim();
  if (p.startsWith('/synapse')) return p;
  if (p.startsWith('/')) return `/synapse${p}`;
  return `/synapse/${p}`;
}

/** KPI 숫자 부드럽게 카운팅 — framer-motion */
const KPI_COUNT_DURATION = 0.5;

const AnimatedKpiNumber = ({ value, sx }: { value: number; sx?: Record<string, unknown> }) => {
  const motionValue = useMotionValue(value);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const stop = motionValue.on('change', (latest) => setDisplay(Math.round(latest)));
    return () => stop();
  }, [motionValue]);

  useEffect(() => {
    const controls = animate(motionValue.get(), value, {
      duration: KPI_COUNT_DURATION,
      ease: 'easeOut',
      onUpdate: (latest) => motionValue.set(latest),
    });
    return () => controls.stop();
  }, [value, motionValue]);

  return (
    <Typography
      variant="h5"
      component="span"
      sx={{
        fontWeight: 700,
        color: 'text.primary',
        letterSpacing: -0.5,
        ...sx,
      }}
    >
      {display}
    </Typography>
  );
};

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
  cardSx,
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
  cardSx?: Record<string, unknown>;
}) => {
  const isNumeric = typeof value === 'number' && Number.isFinite(value);
  const numericValue = isNumeric ? (value as number) : 0;

  const content = (
    <CardContent sx={{ p: 2 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
          <Stack direction="row" alignItems="baseline" spacing={0.5}>
            {isNumeric ? (
              <AnimatedKpiNumber value={numericValue} />
            ) : (
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  color: 'text.primary',
                  letterSpacing: -0.5,
                }}
              >
                {value}
              </Typography>
            )}
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
        ...cardSx,
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
// 포맷 유틸
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
// 대시보드 페이지
// ----------------------------------------------------------------------

const AGENT_STREAM_RANGE = '6h';

/** 마지막 성공 시각 포맷 HH:mm:ss */
function formatLastUpdated(ms: number): string {
  return new Date(ms).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

const LIVE_FEED_COUNT = 10;
const HITL_FAIL_LIMIT = 5;

export const DashboardPage = () => {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = getDashboardTenantId();

  const summaryQuery = useSynapseDashboardSummaryQuery();
  useDashboardTopRiskDriversQuery('24h');
  useDashboardActionRequiredQuery('HIGH,CRITICAL');
  useDashboardTeamSnapshotQuery('7d');
  const agentActivityQuery = useDashboardAgentActivityQuery(AGENT_STREAM_RANGE, 50);

  const reconRunsQuery = useReconRunsQuery();
  const latestRunId = reconRunsQuery.data?.[0]?.runId;
  const reconDetailQuery = useReconRunDetailQuery(latestRunId);
  const reconFailItems = (reconDetailQuery.data?.results ?? []).filter((r) => r.status === 'FAIL').slice(0, HITL_FAIL_LIMIT);

  const ragDocsQuery = useRagDocumentsQuery();
  const ragItems = ragDocsQuery.data?.items ?? [];
  const hasVectorizing = ragItems.some((d) => d.status === 'indexing');

  const kpiCards = mapKpiDailyToCards(summaryQuery.data?.kpiDaily);

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: synapseDashboardSummaryQueryKey(tenantId) });
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

  const agentActivities: AgentActivityUiItem[] = mapAgentActivity(agentActivityQuery.data ?? []);

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
        {/* E2E: RAG 벡터화 진행 중일 때 상단 알림 배너 */}
        {hasVectorizing && (
          <Alert severity="info" icon={<Iconify icon="solar:clock-circle-bold" width={22} />}>
            {t('dashboard.vectorizingBanner')}
          </Alert>
        )}

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

        {/* Metrics Layer (Top): analytics_kpi_daily → 수치 4카드 + glass. 펄스는 아래 Autonomous Pulse. */}
        <Grid container spacing={2} sx={{ width: '100%' }}>
          {summaryQuery.isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
                <KPICardSkeleton />
              </Grid>
            ))
          ) : summaryQuery.isError ? (
            <Grid size={12}>
              <ErrorStateWithRetry
                title={t('error.errorState.failedToLoadKpi')}
                message={summaryQuery.error?.message ?? t('dashboard.summaryLoadFailed')}
                onRetry={() => void summaryQuery.refetch()}
              />
            </Grid>
          ) : kpiCards.length > 0 ? (
            kpiCards.map((card, i) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={card.titleKey + i}>
                <KPICard
                  cardSx={getKpiGlassCardSx(theme)}
                  icon={card.icon}
                  iconBg={card.iconBg}
                  iconColor={card.iconColor}
                  title={t(card.titleKey)}
                  value={card.value}
                  suffix={card.suffix}
                  to={
                    [buildReconciliationUrl({ range: '24h' }), buildCasesUrl({ status: ['OPEN', 'TRIAGE'], range: '24h' }), buildActionsUrl({ range: '7d' }), buildAnalyticsUrl({ range: '30d' })][i]
                  }
                />
              </Grid>
            ))
          ) : (
            [
              { titleKey: 'dashboard.kpi.financialHealthIndex', to: buildReconciliationUrl({ range: '24h' }) },
              { titleKey: 'dashboard.kpi.openCasesBySeverity', to: buildCasesUrl({ status: ['OPEN', 'TRIAGE'], range: '24h' }) },
              { titleKey: 'dashboard.kpi.aiActionSuccessRate', to: buildActionsUrl({ range: '7d' }) },
              { titleKey: 'dashboard.kpi.expectedLossPrevention', to: buildAnalyticsUrl({ range: '30d' }) },
            ].map((slot, i) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={slot.titleKey}>
                <KPICard
                  cardSx={getKpiGlassCardSx(theme)}
                  icon="solar:chart-2-bold-duotone"
                  iconBg="action.hover"
                  iconColor="text.secondary"
                  title={t(slot.titleKey)}
                  value="—"
                  to={slot.to}
                />
              </Grid>
            ))
          )}
        </Grid>

        {/* Middle: Autonomous Pulse (Left) | Live Intelligence Feed (Right) — 375px: 1-col stack */}
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={3}
          sx={{ width: '100%', minWidth: 0 }}
        >
          {/* Autonomous Pulse Center (Middle-Left) */}
          <Card
            variant="outlined"
            sx={{
              minWidth: 0,
              flex: { xs: 'none', lg: '0 0 320px' },
              ...getGlassCardSx(theme),
            }}
          >
            <CardContent sx={{ pb: 2 }}>
              <RadarPulse />
            </CardContent>
          </Card>
          {/* Live Intelligence Feed (Right) — agent_activity_log last 10, title/reasoning/status */}
          <Card
            variant="outlined"
            sx={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              ...getGlassCardSx(theme),
            }}
          >
            <CardContent sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', pb: 2 }}>
              <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mb: 2 }}>
                <Iconify icon="solar:chat-round-dots-bold-duotone" width={20} sx={{ color: 'primary.main', mt: 0.25, flexShrink: 0 }} />
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {t('dashboard.icc.liveFeedTitle')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('dashboard.icc.liveFeedSubtitle')}
                  </Typography>
                </Box>
              </Stack>
              <Box
                sx={{
                  flex: 1,
                  minHeight: 0,
                  overflow: 'auto',
                  ...(theme.palette.mode === 'dark' && {
                    '& .MuiTypography-body2': { fontSize: '0.8125rem', lineHeight: 1.65 },
                    '& .MuiTypography-caption': { fontSize: '0.75rem', lineHeight: 1.55 },
                  }),
                }}
              >
                {agentActivityQuery.isLoading ? (
                  <Stack spacing={1}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} variant="rounded" height={48} />
                    ))}
                  </Stack>
                ) : agentActivities.length === 0 ? (
                  <DashboardEmptyState
                    icon="solar:bot-bold-duotone"
                    title={t('dashboard.agentStream.emptyTitle')}
                    description={t('dashboard.agentStream.emptyDesc')}
                    compact
                  />
                ) : (
                  <Stack spacing={1.5} component="ul" sx={{ listStyle: 'none', pl: 0, m: 0 }}>
                    {agentActivities.slice(0, LIVE_FEED_COUNT).map((activity) => (
                      <Stack
                        key={activity.id}
                        component="li"
                        direction="row"
                        alignItems="flex-start"
                        spacing={1}
                        sx={{
                          py: 1,
                          borderBottom: 1,
                          borderColor: 'divider',
                          '&:last-of-type': { borderBottom: 0 },
                          ...(activity.caseId && {
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.hover' },
                          }),
                        }}
                        onClick={
                          activity.caseId
                            ? () => handleAgentActivityClick(activity)
                            : undefined
                        }
                        role={activity.caseId ? 'button' : undefined}
                      >
                        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                          {new Date(activity.timestamp).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </Typography>
                        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {activity.action || t('dashboard.agentStream.eventType.analyze')}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {activity.message}
                          </Typography>
                          <Label
                            color={
                              activity.status === 'success' || activity.status === 'complete'
                                ? 'success'
                                : activity.status === 'error'
                                  ? 'error'
                                  : 'warning'
                            }
                            variant="soft"
                            sx={{ fontSize: '0.7rem', alignSelf: 'flex-start' }}
                          >
                            {activity.status}
                          </Label>
                        </Stack>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Box>
            </CardContent>
          </Card>
        </Stack>

        {/* Critical HITL Summary (Bottom) — recon_result FAIL latest 5 */}
        <Card
          variant="outlined"
          sx={{ width: '100%', minWidth: 0, ...getGlassCardSx(theme) }}
        >
          <CardContent sx={{ pb: 2 }}>
            <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mb: 2 }}>
              <Iconify icon="solar:danger-triangle-bold-duotone" width={20} sx={{ color: 'error.main', mt: 0.25, flexShrink: 0 }} />
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {t('dashboard.icc.hitlSummaryTitle')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('dashboard.icc.hitlSummarySubtitle')}
                </Typography>
              </Box>
            </Stack>
            {reconDetailQuery.isLoading || reconRunsQuery.isLoading ? (
              <Stack spacing={1}>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} variant="rounded" height={40} />
                ))}
              </Stack>
            ) : reconFailItems.length === 0 ? (
              <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                <Typography variant="body2" color="text.secondary">
                  {t('dashboard.icc.hitlEmpty')}
                </Typography>
                <Button
                  component={Link}
                  to={SYNAPSE_ROUTES.RECONCILIATION}
                  size="small"
                  variant="outlined"
                  endIcon={<Iconify icon="solar:arrow-right-up-linear" width={14} />}
                >
                  {t('dashboard.icc.viewRecon')}
                </Button>
              </Stack>
            ) : (
              <Stack spacing={1.5}>
                {reconFailItems.map((r) => (
                  <Stack
                    key={r.resultId}
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    spacing={2}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      border: 1,
                      borderColor: 'divider',
                      bgcolor: 'error.lighter',
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                        {r.resourceKey || r.resourceType}
                      </Typography>
                      <Label color="error" variant="soft" sx={{ fontSize: '0.75rem' }}>
                        {r.status}
                      </Label>
                    </Stack>
                    <Button
                      component={Link}
                      to={SYNAPSE_ROUTES.RECONCILIATION}
                      size="small"
                      variant="outlined"
                      endIcon={<Iconify icon="solar:arrow-right-up-linear" width={14} />}
                    >
                      {t('dashboard.icc.viewRecon')}
                    </Button>
                  </Stack>
                ))}
                <Button
                  component={Link}
                  to={SYNAPSE_ROUTES.RECONCILIATION}
                  variant="text"
                  size="small"
                  fullWidth
                  sx={{ color: 'text.secondary' }}
                  startIcon={<Iconify icon="solar:arrow-right-bold" width={14} />}
                >
                  {t('dashboard.icc.viewRecon')}
                </Button>
              </Stack>
            )}
          </CardContent>
        </Card>

      </Stack>
    </Box>
  );
};
