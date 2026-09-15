import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  CheckCircle2,
  CloudCog,
  FileStack,
  GitBranch,
  PenLine,
  RefreshCcw,
  ShieldCheck,
  TimerReset,
  TriangleAlert,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionIconButton,
  ErrorState,
  InlineFeedback,
  LoadingState,
  SignalMetric,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  getApprovalAdminOverview,
  productSurfaceServerNow,
  useProductSurfaceAuthority,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';

import {
  appendProductPageShortcutScope,
  PRODUCT_PAGE_SHORTCUT_TARGETS,
  resolveProductPageShortcutAccess,
} from '../../components/product-page-shortcut-access';
import { useProductSurfaceCanaryAuthority } from '../../components/product-surface-canary-runtime';
import {
  APPROVAL_OVERVIEW_FRESHNESS_MS,
  approvalOverviewExceptions,
  approvalOverviewSourceState,
  assessApprovalOverview,
} from './approval-management-model';
import { approvalManagementReadDenied } from './approval-management-source-state';
import { useApprovalManagementScopeReady } from './approval-management-scope';
import { ApprovalLinkRow, ApprovalSurface, approvalTone } from './approval-ui';
import { ApprovalAdminTrend } from './approval-admin-trend';
import { useApprovalManagementRequestScope } from './use-approval-experience';

import type { ApprovalAdminPulse } from '@dwp-frontend/shared-utils';
import type { ProductPageShortcutAccess } from '../../components/product-page-shortcut-access';

const PAGE_TARGETS = {
  overview: {
    productId: 'approvals',
    surfaceId: 'approvals.admin',
    routeContractKey: 'route.approvals.admin.overview.page',
  },
  workflows: PRODUCT_PAGE_SHORTCUT_TARGETS.approvalWorkflows,
  policies: PRODUCT_PAGE_SHORTCUT_TARGETS.approvalPolicies,
  operations: PRODUCT_PAGE_SHORTCUT_TARGETS.approvalOperations,
  signatures: PRODUCT_PAGE_SHORTCUT_TARGETS.approvalSignatures,
} as const;

type OverviewPage = keyof typeof PAGE_TARGETS;

export function ApprovalAdminOverview() {
  const { t, i18n } = useTranslation('approvals');
  const queryClient = useQueryClient();
  const canary = useProductSurfaceCanaryAuthority();
  const authority = useProductSurfaceAuthority();
  const requestScope = useApprovalManagementRequestScope();
  const scopeReady = useApprovalManagementScopeReady(requestScope);
  const identity = JSON.stringify(requestScope.cacheKey);
  const [committedIdentity, setCommittedIdentity] = useState<string>();
  const live = useRef({
    identity,
    epoch: 0,
    denied: false,
    scopeReady,
    requestScope,
    canary,
    authority,
  });
  if (live.current.identity !== identity) {
    live.current.denied = false;
    live.current.epoch += 1;
  }
  Object.assign(live.current, { identity, scopeReady, requestScope, canary, authority });
  const epoch = live.current.epoch;
  const [, expireSource] = useState(0);
  // Let StrictMode finish its probe before a stable authority identity starts the first read.
  useEffect(() => {
    const timer = window.setTimeout(() => setCommittedIdentity(identity), 0);
    return () => window.clearTimeout(timer);
  }, [identity]);
  const identityCommitted = committedIdentity === identity;
  const queryKey = ['approvals', 'admin', 'overview', ...requestScope.cacheKey];
  const cachedSource = queryClient.getQueryState<ApprovalAdminPulse>(queryKey);
  // A failed cache remains explicit-retry only, including after a child remount.
  const cachedFailure = Boolean(
    cachedSource?.status === 'error' ||
    cachedSource?.fetchFailureCount ||
    cachedSource?.fetchFailureReason != null
  );
  if (
    approvalManagementReadDenied(cachedSource?.error) ||
    approvalManagementReadDenied(cachedSource?.fetchFailureReason)
  ) {
    live.current.denied = true;
  }
  const accessFor = (page: OverviewPage) => {
    const current = live.current;
    return resolveProductPageShortcutAccess(
      {
        ...current.canary,
        serverNowMs: current.authority.snapshot
          ? productSurfaceServerNow(current.authority.snapshot)
          : Date.now(),
      },
      PAGE_TARGETS[page]
    );
  };
  const canReadCurrent = () => {
    const current = live.current;
    const access = accessFor('overview');
    return (
      current.identity === identity &&
      current.epoch === epoch &&
      current.scopeReady &&
      access.disclosed &&
      access.contextScopeKey === current.requestScope.contextScopeKey
    );
  };
  const overview = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      if (!canReadCurrent()) throw new Error('approval-overview-source-changed');
      try {
        const value = await getApprovalAdminOverview(requestScope.contextScopeKey, signal);
        if (!canReadCurrent()) throw new Error('approval-overview-source-changed');
        live.current.denied = false;
        return value;
      } catch (error) {
        if (
          live.current.identity === identity &&
          live.current.epoch === epoch &&
          approvalManagementReadDenied(error)
        ) {
          live.current.denied = true;
        }
        throw error;
      }
    },
    enabled: identityCommitted && canReadCurrent() && !cachedFailure,
    staleTime: APPROVAL_OVERVIEW_FRESHNESS_MS,
    retry: false,
    retryOnMount: false,
    notifyOnChangeProps: 'all',
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    refetchInterval: (query) =>
      identityCommitted &&
      canReadCurrent() &&
      !live.current.denied &&
      query.state.status === 'success' &&
      query.state.error == null &&
      query.state.fetchFailureReason == null &&
      query.state.fetchFailureCount === 0
        ? APPROVAL_OVERVIEW_FRESHNESS_MS
        : false,
  });
  const currentSourceState = () => {
    const state = queryClient.getQueryState<ApprovalAdminPulse>(queryKey);
    if (
      approvalManagementReadDenied(state?.error) ||
      approvalManagementReadDenied(state?.fetchFailureReason)
    ) {
      live.current.denied = true;
    }
    return approvalOverviewSourceState(
      state
        ? {
            data: state.data,
            dataUpdatedAt: state.dataUpdatedAt,
            error: state.error,
            failureReason: state.fetchFailureReason,
            failureCount: state.fetchFailureCount,
            status: state.status,
            fetchStatus: state.fetchStatus,
          }
        : undefined,
      Date.now(),
      live.current.denied
    );
  };
  const sourceState = currentSourceState();
  const sourceReady = canReadCurrent() && sourceState === 'READY';
  const refresh = () => {
    if (!identityCommitted || !canReadCurrent()) return;
    const state = queryClient.getQueryState(queryKey);
    if (state?.fetchStatus === 'idle') void overview.refetch();
  };
  // Cache and PAGE authority are checked again before an already-rendered row can navigate.
  const guardNavigation = (
    event: SyntheticEvent,
    page: OverviewPage,
    expected: ProductPageShortcutAccess
  ) => {
    const actual = accessFor(page);
    if (
      !canReadCurrent() ||
      currentSourceState() !== 'READY' ||
      !actual.disclosed ||
      actual.contextScopeKey !== expected.contextScopeKey ||
      queryClient.getQueryData(queryKey) !== overview.data
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  useEffect(() => {
    if (!overview.dataUpdatedAt) return undefined;
    const timer = window.setTimeout(
      () => expireSource((value) => value + 1),
      Math.max(0, overview.dataUpdatedAt + APPROVAL_OVERVIEW_FRESHNESS_MS - Date.now())
    );
    return () => window.clearTimeout(timer);
  }, [overview.dataUpdatedAt, identity]);
  const data = overview.data;
  const exceptions = approvalOverviewExceptions(data);
  const assessment = assessApprovalOverview(data);
  const lastReceived = overview.dataUpdatedAt
    ? formatDate(
        overview.dataUpdatedAt,
        { dateStyle: 'medium', timeStyle: 'short' },
        resolveSupportedLocale(i18n.resolvedLanguage, i18n.language)
      )
    : undefined;
  const metrics = [
    {
      label: t('admin.publishedWorkflows'),
      value: data?.publishedWorkflows,
      icon: <GitBranch size={17} />,
      tone: 'primary' as const,
    },
    {
      label: t('admin.draftWorkflows'),
      value: data?.draftWorkflows,
      icon: <FileStack size={17} />,
      tone: 'info' as const,
    },
    {
      label: t('admin.activeRequests'),
      value: data?.activeRequests,
      icon: <Activity size={17} />,
      tone: 'success' as const,
    },
    {
      label: t('admin.overdueTasks'),
      value: data?.overdueTasks,
      icon: <TimerReset size={17} />,
      tone: 'warning' as const,
    },
    {
      label: t('admin.failedIntegrations'),
      value: data?.failedIntegrations,
      icon: <CloudCog size={17} />,
      tone: 'error' as const,
    },
  ];
  const quickLinks = [
    {
      page: 'workflows',
      route: '/approvals/admin/workflows',
      icon: GitBranch,
      tone: approvalTone.primary,
    },
    {
      page: 'policies',
      route: '/approvals/admin/policies',
      icon: ShieldCheck,
      tone: approvalTone.amber,
    },
    {
      page: 'operations',
      route: '/approvals/admin/operations',
      icon: Activity,
      tone: approvalTone.primary,
    },
    {
      page: 'signatures',
      route: '/approvals/admin/signatures',
      icon: PenLine,
      tone: approvalTone.primary,
    },
  ] as const;

  if (!canReadCurrent()) {
    return (
      <ErrorState
        title={t('admin.loadError')}
        description={t('pages.admin-overview.description')}
        size="compact"
      />
    );
  }

  if (sourceState === 'LOADING') {
    return (
      <LoadingState
        label={t('pages.admin-overview.title')}
        description={t('pages.admin-overview.description')}
        variant="skeleton"
        skeletonRows={4}
        size="compact"
      />
    );
  }

  if (sourceState === 'DENIED' || sourceState === 'UNAVAILABLE') {
    return (
      <ErrorState
        title={t('admin.loadError')}
        retryLabel={t('actions.retry')}
        retrying={overview.isFetching}
        onRetry={refresh}
        size="compact"
      />
    );
  }

  return (
    <Stack gap={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        gap={1}
        sx={{ minHeight: 36 }}
      >
        <Box
          component="span"
          sx={{ typography: 'caption', color: 'text.secondary' }}
          aria-live="polite"
        >
          {lastReceived
            ? t('admin.overview.lastReceived', { time: lastReceived })
            : t('admin.metricDetail')}
        </Box>
        <ActionIconButton
          label={t('actions.refresh')}
          size="small"
          loading={overview.isFetching}
          onClick={refresh}
          tooltipDisablePortal
        >
          <RefreshCcw size={16} />
        </ActionIconButton>
      </Stack>

      {!sourceReady ? (
        <InlineFeedback severity="warning">
          <Stack gap={0.5}>
            <Box>{t('admin.overview.historical')}</Box>
            <Box>
              {t(
                sourceState === 'CHECKING'
                  ? 'admin.overview.sourceChecking'
                  : sourceState === 'EXPIRED'
                    ? 'admin.overview.sourceExpired'
                    : 'admin.overview.sourceStale'
              )}
            </Box>
          </Stack>
        </InlineFeedback>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(5, 1fr)' },
          gap: 1.25,
        }}
      >
        {metrics.map((metric) => (
          <SignalMetric
            key={metric.label}
            label={metric.label}
            value={metric.value === undefined ? '—' : String(metric.value)}
            detail={
              sourceReady
                ? (lastReceived ?? t('admin.metricDetail'))
                : t('admin.overview.historical')
            }
            icon={metric.icon}
            tone={sourceReady ? metric.tone : 'neutral'}
          />
        ))}
      </Box>

      {sourceReady && data && assessment.health === 'HEALTHY' ? (
        <InlineFeedback severity="success" icon={<CheckCircle2 size={18} />}>
          {t('admin.overview.aggregateEnforced')}
        </InlineFeedback>
      ) : null}

      {sourceReady &&
      data &&
      (assessment.health === 'INCOMPLETE' ||
        (assessment.health === 'ATTENTION' && exceptions.length === 0)) ? (
        <InlineFeedback severity="warning" icon={<TriangleAlert size={18} />}>
          {assessment.health === 'INCOMPLETE'
            ? `${t('admin.assurance.meta')} · ${t('status.ATTENTION')}`
            : t('admin.assurance.states.attention', { count: 0 })}
        </InlineFeedback>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            lg: 'minmax(0, 2fr) minmax(18rem, 1fr)',
          },
          alignItems: 'start',
          gap: 2,
        }}
      >
        <Stack gap={2} sx={{ minWidth: 0 }}>
          {sourceReady && exceptions.some((exception) => accessFor(exception.target).disclosed) ? (
            <ApprovalSurface title={t('admin.breached.title')} meta={t('admin.breached.meta')}>
              {exceptions.map((exception, index) => {
                const access = accessFor(exception.target);
                if (!access.disclosed) return null;
                const assuranceKey = ['identity', 'segregation', 'evidence', 'delivery'].includes(
                  exception.key
                )
                  ? exception.key
                  : null;
                const title =
                  exception.key === 'overdue'
                    ? t('admin.overdueTasks')
                    : exception.key === 'failedIntegrations'
                      ? t('admin.failedIntegrations')
                      : t(`admin.assurance.${assuranceKey}.title`);
                const detail = assuranceKey
                  ? t(`admin.assurance.${assuranceKey}.detail`)
                  : t('admin.metricDetail');
                return (
                  <Box
                    key={`${exception.key}-${index}`}
                    onClickCapture={(event) => guardNavigation(event, exception.target, access)}
                  >
                    <ApprovalLinkRow
                      title={title}
                      detail={detail}
                      route={appendProductPageShortcutScope(exception.route, access)}
                      icon={exception.severity === 'error' ? TriangleAlert : TimerReset}
                      tone={exception.severity === 'error' ? approvalTone.red : approvalTone.amber}
                      trailing={
                        <Chip
                          size="small"
                          color={exception.severity}
                          variant="outlined"
                          label={exception.count}
                        />
                      }
                    />
                  </Box>
                );
              })}
            </ApprovalSurface>
          ) : null}

          <ApprovalSurface
            title={t('admin.controlModel.title')}
            meta={t('admin.overview.roleReference')}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2,minmax(0,1fr))' },
                gap: 2,
                p: 2,
              }}
            >
              {(['designer', 'publisher', 'operator', 'auditor'] as const).map((role) => (
                <Box key={role} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  <Box sx={{ typography: 'body2', fontWeight: 'fontWeightBold' }}>
                    {t(`admin.controlModel.${role}.title`)}
                  </Box>
                  <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                    {t(`admin.controlModel.${role}.detail`)}
                  </Box>
                </Box>
              ))}
            </Box>
          </ApprovalSurface>

          {sourceReady && data ? <ApprovalAdminTrend trend={data.trend} /> : null}
        </Stack>

        <Stack gap={2} sx={{ minWidth: 0 }}>
          <ApprovalSurface title={t('admin.assurance.title')} meta={t('admin.assurance.meta')}>
            {assessment.assurance.map((signal) => {
              const attention = signal.state === 'ATTENTION' || signal.exceptions > 0;
              const SignalIcon = !sourceReady || attention ? TriangleAlert : CheckCircle2;
              return (
                <Stack
                  key={signal.key}
                  direction={{ xs: 'column', sm: 'row', lg: 'column', xl: 'row' }}
                  alignItems={{ sm: 'flex-start' }}
                  gap={1.25}
                  sx={{ px: 2, py: 1.6, borderBottom: 1, borderColor: 'divider' }}
                >
                  <SignalIcon
                    size={18}
                    color={!sourceReady || attention ? approvalTone.amber : approvalTone.teal}
                  />
                  <Box sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                    <Box sx={{ typography: 'body2', fontWeight: 'fontWeightBold' }}>
                      {t(`admin.assurance.${signal.key}.title`)}
                    </Box>
                    <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                      {t(`admin.assurance.${signal.key}.detail`)}
                    </Box>
                  </Box>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={!sourceReady || attention ? 'warning' : 'success'}
                    sx={{
                      alignSelf: 'flex-start',
                      maxWidth: 1,
                      height: 'auto',
                      '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5 },
                    }}
                    label={
                      !sourceReady
                        ? t('status.UNKNOWN')
                        : attention
                          ? t('admin.assurance.states.attention', { count: signal.exceptions })
                          : t('admin.assurance.states.enforced')
                    }
                  />
                </Stack>
              );
            })}
          </ApprovalSurface>

          {sourceReady && quickLinks.some(({ page }) => accessFor(page).disclosed) ? (
            <ApprovalSurface title={t('admin.overview.quickAccess')}>
              {quickLinks.map(({ page, route, icon: Icon, tone }) => {
                const shortcut = accessFor(page);
                if (!shortcut.disclosed) return null;
                return (
                  <Box
                    key={page}
                    onClickCapture={(event) => guardNavigation(event, page, shortcut)}
                  >
                    <ApprovalLinkRow
                      title={t(`pages.${page}.title`)}
                      route={appendProductPageShortcutScope(route, shortcut)}
                      icon={Icon}
                      tone={tone}
                    />
                  </Box>
                );
              })}
            </ApprovalSurface>
          ) : null}
        </Stack>
      </Box>
    </Stack>
  );
}
