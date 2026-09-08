import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Bot,
  Captions,
  CircleAlert,
  CircleCheck,
  Clock3,
  Download,
  Network,
  Radio,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import {
  ActionButton,
  ErrorState,
  LoadingState,
  PageCanvas,
  foundationTokens,
} from '@dwp-frontend/design-system';
import { useAuth } from '@dwp-frontend/shared-utils';
import { getVideoMeetingAdminOverview } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import { getVideoMeetingAdminIntelligenceReadiness } from '@dwp-frontend/shared-utils/api/video-meeting-admin-intelligence-api';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { formatMeetingDateTime, MeetingSectionHeading } from './meeting-components';
import { meetingShape } from './meeting-visual-system';
import {
  createUnavailableMeetingAdminIntelligenceReadiness,
  formatMeetingAdminQualityScore,
  projectMeetingAdminIntelligenceReadiness,
  type MeetingAdminReadinessSignal,
} from './meeting-admin-model';
import {
  AdminMetric,
  AdminPageHeading,
  AdminPanel,
  AdminUnavailableAction,
  adminInset,
  adminPanel,
} from './meeting-admin-presentation';

export function MeetingAdminOperations() {
  const { t, i18n } = useTranslation('meetings');
  const { user, isAuthenticated } = useAuth();
  const identityScope = JSON.stringify([
    isAuthenticated,
    user?.identityPlane ?? null,
    user?.tenantId ?? null,
    user?.userId ?? null,
  ]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const query = useQuery({
    queryKey: ['meetings', 'admin', 'overview', identityScope],
    queryFn: getVideoMeetingAdminOverview,
    staleTime: 20_000,
    refetchInterval: 30_000,
    retry: 1,
    gcTime: 0,
    meta: { accessSensitive: true },
  });
  const readinessQuery = useQuery({
    queryKey: ['meetings', 'admin', 'intelligence', 'readiness', identityScope],
    queryFn: getVideoMeetingAdminIntelligenceReadiness,
    staleTime: 20_000,
    refetchInterval: 30_000,
    retry: 1,
    gcTime: 0,
    meta: { accessSensitive: true },
  });
  const readiness = readinessQuery.data
    ? projectMeetingAdminIntelligenceReadiness(readinessQuery.data)
    : createUnavailableMeetingAdminIntelligenceReadiness();
  const signals: ReadonlyArray<{
    key: 'media' | 'recording' | 'transcript' | 'aiNotes';
    icon: LucideIcon;
    signal: MeetingAdminReadinessSignal;
  }> = [
    {
      key: 'media',
      icon: Network,
      signal:
        query.data?.capabilities.video && query.data.capabilities.screenShare
          ? { state: 'READY' }
          : { state: 'BLOCKED', reason: 'MEDIA_CAPABILITY_UNAVAILABLE' },
    },
    { key: 'recording', icon: Radio, signal: readiness.capabilities.recording },
    { key: 'transcript', icon: Captions, signal: readiness.capabilities.transcript },
    { key: 'aiNotes', icon: Bot, signal: readiness.capabilities.aiNotes },
  ];
  const exceptions = [
    ...(query.data?.failedJoinAttempts
      ? [
          {
            key: 'failed-joins',
            label: t('admin.operations.failedJoinException'),
            reason: t('admin.operations.failedJoinExceptionDetail', {
              count: query.data.failedJoinAttempts,
            }),
          },
        ]
      : []),
    ...signals
      .filter(({ signal }) => signal.state !== 'READY')
      .map(({ key, signal }) => ({
        key,
        label: t(`admin.operations.services.${key}`),
        reason: signal.reason
          ? t(`admin.intelligence.reasons.${signal.reason}`, { defaultValue: signal.reason })
          : t(`admin.operations.states.${signal.state}`),
      })),
  ];
  const selected = exceptions.find(({ key }) => key === selectedKey) ?? exceptions[0] ?? null;
  const observedAt = readiness.observedAt
    ? formatMeetingDateTime(readiness.observedAt, i18n.language)
    : t('admin.operations.observedUnavailable');
  const refresh = () => Promise.all([query.refetch(), readinessQuery.refetch()]);
  const measured = t('admin.design.notMeasured');
  return (
    <PageCanvas mode="workspace" topInset="compact">
      <AdminPageHeading
        eyebrow={t('admin.eyebrow')}
        title={t('admin.operations.title')}
        description={t('admin.operations.description')}
      />
      {query.isLoading ? (
        <LoadingState label={t('admin.operations.loading')} variant="skeleton" skeletonRows={5} />
      ) : query.isError || !query.data ? (
        <ErrorState
          title={t('errors.loadTitle')}
          description={t('errors.loadDescription')}
          retryLabel={t('actions.retry')}
          onRetry={() => query.refetch()}
        />
      ) : (
        <Stack gap={2.5}>
          <Box
            data-testid="meeting-admin-control-context"
            sx={(theme) => ({ ...adminPanel(theme), p: { xs: 1.5, md: 2 } })}
          >
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1.5}>
              <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                <Chip
                  size="small"
                  icon={<ShieldCheck size={14} aria-hidden="true" />}
                  label={t('admin.design.tenantScope')}
                />
                <Typography variant="caption" color="text.secondary">
                  {observedAt}
                </Typography>
              </Stack>
              <Stack direction="row" gap={1} flexWrap="wrap">
                <ActionButton
                  intent="secondary"
                  size="small"
                  startIcon={<RefreshCw size={15} aria-hidden="true" />}
                  loading={query.isFetching || readinessQuery.isFetching}
                  onClick={refresh}
                >
                  {t('actions.refresh')}
                </ActionButton>
                <ActionButton
                  intent="quiet"
                  size="small"
                  disabled
                  startIcon={<Download size={15} aria-hidden="true" />}
                >
                  {t('admin.design.exportReport')}
                </ActionButton>
              </Stack>
            </Stack>
            <Box
              data-testid="meeting-admin-impact-primary"
              sx={{
                display: { xs: 'none', md: 'grid' },
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  md: 'repeat(4, minmax(0, 1fr))',
                },
                gap: 1,
                mt: 1.5,
              }}
            >
              <AdminMetric
                compact
                label={t('admin.operations.live')}
                value={query.data.liveMeetings}
              />
              <AdminMetric
                compact
                label={t('admin.operations.waiting')}
                value={query.data.waitingParticipants}
              />
              <AdminMetric
                compact
                label={t('admin.operations.failedJoins')}
                value={query.data.failedJoinAttempts}
              />
              <AdminMetric
                compact
                label={t('admin.operations.quality')}
                value={formatMeetingAdminQualityScore(query.data.averageQualityScore)}
                detail={
                  query.data.averageQualityScore == null
                    ? measured
                    : t('admin.design.currentSnapshot')
                }
              />
            </Box>
          </Box>

          <Box
            data-testid="meeting-admin-mobile-signal"
            sx={{
              display: { xs: 'block', md: 'none' },
              p: 2,
              borderRadius: meetingShape.card,
              color: 'common.white',
              bgcolor: foundationTokens.color.product.primary,
            }}
          >
            <Typography variant="caption">{t('admin.operations.impactTitle')}</Typography>
            <Typography variant="h5" fontWeight="fontWeightBold" sx={{ my: 0.75 }}>
              {query.data.liveMeetings}{' '}
              <Box
                component="span"
                sx={{ fontSize: 'body2.fontSize', fontWeight: 'fontWeightMedium' }}
              >
                {t('admin.operations.live')}
              </Box>
            </Typography>
            <Typography variant="body2">
              {t('admin.design.serviceSummary', {
                ready: signals.filter(({ signal }) => signal.state === 'READY').length,
                total: signals.length,
              })}
            </Typography>
          </Box>

          <Box
            component="section"
            aria-labelledby="meeting-service-title"
            data-testid="meeting-admin-service-readiness"
          >
            <MeetingSectionHeading
              id="meeting-service-title"
              title={t('admin.operations.serviceTitle')}
              description={t('admin.design.serviceMatrixDescription')}
            />
            <Box
              role="list"
              tabIndex={0}
              aria-label={t('admin.operations.serviceTitle')}
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(4, minmax(168px, 1fr))',
                  md: 'repeat(4, minmax(0, 1fr))',
                },
                gap: 1.5,
                overflowX: { xs: 'auto', md: 'visible' },
                pb: 0.5,
                scrollSnapType: 'x mandatory',
                '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 2 },
              }}
            >
              {signals
                .filter(({ signal }) => !attentionOnly || signal.state !== 'READY')
                .map(({ key, signal, icon: Icon }) => (
                  <Box
                    key={key}
                    role="listitem"
                    data-testid={`meeting-admin-service-${key}`}
                    sx={(theme) => ({
                      ...adminPanel(theme),
                      display: 'flex',
                      flexDirection: 'column',
                      minHeight: { xs: 182, md: 228 },
                      p: 1.75,
                      borderTop: 3,
                      borderTopColor: signal.state === 'READY' ? 'success.main' : 'warning.main',
                      scrollSnapAlign: 'start',
                    })}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      gap={1}
                    >
                      <Icon size={19} aria-hidden="true" />
                      <Typography
                        variant="caption"
                        color={signal.state === 'READY' ? 'success.main' : 'warning.main'}
                      >
                        {t(`admin.operations.states.${signal.state}`)}
                      </Typography>
                    </Stack>
                    <Typography
                      component="h3"
                      variant="subtitle1"
                      fontWeight="fontWeightBold"
                      sx={{ mt: 1.5 }}
                    >
                      {t(`admin.operations.services.${key}`)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, flex: 1 }}>
                      {signal.reason
                        ? t(`admin.intelligence.reasons.${signal.reason}`, {
                            defaultValue: signal.reason,
                          })
                        : t('admin.design.capabilityConfirmed')}
                    </Typography>
                    <Box sx={(theme) => ({ ...adminInset(theme), p: 1, mt: 1.5 })}>
                      <Typography variant="caption" display="block" color="text.secondary">
                        {t(`admin.design.serviceMetrics.${key}`)}
                      </Typography>
                      <Typography variant="body2" fontWeight="fontWeightMedium">
                        {measured}
                      </Typography>
                    </Box>
                  </Box>
                ))}
            </Box>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 7fr) minmax(0, 5fr)' },
              gap: 2,
              alignItems: 'start',
            }}
          >
            <Box component="section" aria-labelledby="meeting-exceptions-title">
              <MeetingSectionHeading
                id="meeting-exceptions-title"
                title={t('admin.operations.exceptionsTitle')}
                description={t('admin.operations.exceptionsDescription')}
              />
              <ActionButton
                intent={attentionOnly ? 'secondary' : 'quiet'}
                size="small"
                startIcon={<SlidersHorizontal size={14} aria-hidden="true" />}
                aria-pressed={attentionOnly}
                onClick={() => setAttentionOnly(!attentionOnly)}
                sx={{ mb: 1.25 }}
              >
                {t(attentionOnly ? 'admin.design.showAllServices' : 'admin.design.attentionOnly')}
              </ActionButton>
              <Stack component="ul" gap={1.25} sx={{ listStyle: 'none', m: 0, p: 0 }}>
                {exceptions.length === 0 ? (
                  <Box component="li" sx={(theme) => ({ ...adminPanel(theme), p: 2 })}>
                    <CircleCheck size={18} aria-hidden="true" />
                    <Typography variant="body2">{t('admin.operations.exceptionsEmpty')}</Typography>
                  </Box>
                ) : (
                  exceptions.map((exception) => (
                    <Box component="li" key={exception.key}>
                      <Box
                        component="button"
                        type="button"
                        aria-pressed={selected?.key === exception.key}
                        onClick={() => setSelectedKey(exception.key)}
                        sx={(theme) => ({
                          ...adminPanel(theme),
                          p: 2,
                          width: '100%',
                          font: 'inherit',
                          color: 'text.primary',
                          textAlign: 'left',
                          cursor: 'pointer',
                          borderLeft: 3,
                          borderLeftColor:
                            selected?.key === exception.key ? 'primary.main' : 'warning.main',
                          '&:hover': { bgcolor: 'action.hover' },
                          '&:focus-visible': {
                            outline: 3,
                            outlineColor: 'primary.main',
                            outlineOffset: 2,
                          },
                        })}
                      >
                        <Stack
                          direction="row"
                          alignItems="center"
                          justifyContent="space-between"
                          gap={1}
                        >
                          <Chip
                            size="small"
                            icon={<CircleAlert size={14} aria-hidden="true" />}
                            label={t('admin.design.needsAttention')}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {t('admin.design.currentSnapshot')}
                          </Typography>
                        </Stack>
                        <Typography
                          component="h3"
                          variant="subtitle1"
                          fontWeight="fontWeightBold"
                          sx={{ mt: 1 }}
                        >
                          {exception.label}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                          {exception.reason}
                        </Typography>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          sx={(theme) => ({
                            ...adminInset(theme),
                            px: 1.25,
                            py: 1,
                            mt: 1.5,
                            color: 'primary.main',
                          })}
                        >
                          <Typography variant="caption">
                            {t('admin.operations.inspectorTitle')}
                          </Typography>
                          <ArrowRight size={16} aria-hidden="true" />
                        </Stack>
                      </Box>
                    </Box>
                  ))
                )}
              </Stack>
              <Box
                data-testid="meeting-admin-impact-support"
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 1,
                  mt: 1.5,
                }}
              >
                <AdminMetric
                  label={t('admin.operations.scheduled')}
                  value={query.data.scheduledToday}
                />
                <AdminMetric
                  label={t('admin.operations.lastSevenDays')}
                  value={query.data.meetingsLastSevenDays}
                />
              </Box>
            </Box>
            <AdminPanel
              title={t('admin.operations.inspectorTitle')}
              icon={ShieldCheck}
              testId="meeting-admin-telemetry-inspector"
            >
              <Box sx={(theme) => ({ ...adminInset(theme), p: 1.5 })}>
                <Typography variant="body2" fontWeight="fontWeightMedium">
                  {t('admin.design.metadataOnly')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('admin.operations.privacy')}
                </Typography>
              </Box>
              <Box sx={{ my: 2 }}>
                <Typography component="h3" variant="subtitle2">
                  {selected?.label ?? t('admin.operations.inspectorEmpty')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  {selected?.reason ?? t('admin.operations.inspectorBoundary')}
                </Typography>
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: 0.75,
                }}
              >
                {['latency', 'packetLoss', 'jitter'].map((key) => (
                  <Box key={key} sx={(theme) => ({ ...adminInset(theme), p: 1 })}>
                    <Typography variant="caption" color="text.secondary">
                      {t(`admin.design.${key}`)}
                    </Typography>
                    <Typography variant="body2" fontWeight="fontWeightMedium" sx={{ mt: 1 }}>
                      {measured}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                {t('admin.design.telemetryConnection')}
              </Typography>
              <Stack gap={1.5} sx={{ mt: 2 }}>
                <ActionButton
                  intent="secondary"
                  startIcon={<RefreshCw size={15} aria-hidden="true" />}
                  onClick={refresh}
                >
                  {t('admin.design.recheckDiagnostics')}
                </ActionButton>
                <AdminUnavailableAction label={t('admin.design.failover')} danger />
                <AdminUnavailableAction label={t('admin.design.auditTicket')} />
              </Stack>
              <Stack direction="row" gap={1} sx={{ mt: 2, color: 'text.secondary' }}>
                <Clock3 size={15} aria-hidden="true" />
                <Typography variant="caption">{t('admin.operations.inspectorBoundary')}</Typography>
              </Stack>
            </AdminPanel>
          </Box>
        </Stack>
      )}
    </PageCanvas>
  );
}
