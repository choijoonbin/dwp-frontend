import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Bot,
  ChevronRight,
  Clock3,
  DatabaseZap,
  FileClock,
  ShieldAlert,
  ShieldCheck,
  ThumbsUp,
  UsersRound,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import {
  ActionButton,
  ErrorState,
  FormField,
  foundationTokens,
  InlineFeedback,
  LoadingState,
  PageCanvas,
  SignalMetric,
} from '@dwp-frontend/design-system';
import { formatDate, formatNumber, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { getDwaionOperationsOverview, usePermissions } from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { verifiedPercentage, verifiedPercentageLabel } from './dwaion-admin-metrics';
import { DwaionAdminPageHeader } from './dwaion-admin-ui';

const MANAGEMENT_DESTINATIONS = [
  ['agents', 'ADMIN.DWAION_AGENTS', Bot],
  ['sources', 'ADMIN.DWAION_SOURCES', DatabaseZap],
  ['actions', 'ADMIN.DWAION_ACTIONS', Workflow],
  ['safety', 'ADMIN.DWAION_SAFETY', ShieldAlert],
  ['evaluation', 'ADMIN.DWAION_EVALUATION', Activity],
  ['gates', 'ADMIN.DWAION_GATES', ShieldCheck],
  ['audit', 'ADMIN.DWAION_AUDIT', FileClock],
] as const;

export function DwaionAdminOverview() {
  const { t, i18n } = useTranslation('work');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const { hasPermission } = usePermissions();
  const [params, setParams] = useSearchParams();
  const parsedDays = Number(params.get('days'));
  const days =
    Number.isInteger(parsedDays) && parsedDays >= 1 && parsedDays <= 90 ? parsedDays : 30;
  const query = useQuery({
    queryKey: ['dwaion', 'admin', 'overview', days],
    queryFn: () => getDwaionOperationsOverview(days),
    staleTime: 30_000,
  });
  const data = query.data;
  const completionPercent = verifiedPercentage(data?.completedRunCount, data?.runCount);
  const feedbackTotal = data ? data.feedbackUpCount + data.feedbackDownCount : undefined;
  const positiveFeedbackPercent = verifiedPercentage(data?.feedbackUpCount, feedbackTotal);

  if (query.isError) {
    return (
      <PageCanvas topInset="compact">
        <DwaionAdminPageHeader
          eyebrow={t('dwaionAdmin.overview.eyebrow')}
          title={t('dwaionAdmin.overview.title')}
          description={t('dwaionAdmin.overview.description')}
        />
        <Box sx={{ mt: 3 }}>
          <ErrorState
            size="page"
            title={t('dwaionAdmin.overview.loadError')}
            description={t('dwaionAdmin.overview.unavailableDescription')}
            retryLabel={t('dwaionAdmin.shared.retry')}
            retrying={query.isFetching}
            onRetry={() => void query.refetch()}
          />
        </Box>
      </PageCanvas>
    );
  }

  return (
    <PageCanvas topInset="compact">
      <DwaionAdminPageHeader
        eyebrow={t('dwaionAdmin.overview.eyebrow')}
        title={t('dwaionAdmin.overview.title')}
        description={t('dwaionAdmin.overview.description')}
        actions={
          <Chip
            size="small"
            variant="outlined"
            icon={<ShieldCheck size={15} aria-hidden="true" />}
            label={t('dwaionAdmin.overview.aggregateScope')}
            sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
          />
        }
      />

      <Box
        component="section"
        aria-label={t('dwaionAdmin.overview.scopeControls')}
        sx={{
          mt: 2,
          p: { xs: 1.5, md: 2 },
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '15rem minmax(0, 1fr) auto' },
          gap: 2,
          alignItems: 'center',
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: foundationTokens.radius.surface + 'px',
        }}
      >
        <FormField
          select
          label={t('dwaionAdmin.overview.periodLabel')}
          value={String(days)}
          sx={{ minWidth: 0 }}
          onChange={(event) =>
            setParams((previous) => {
              const next = new URLSearchParams(previous);
              next.set('days', event.target.value);
              return next;
            })
          }
        >
          {[...new Set([1, 7, 30, 90, days])]
            .sort((a, b) => a - b)
            .map((value) => (
              <MenuItem key={value} value={String(value)}>
                {t('dwaionAdmin.overview.period', { count: value })}
              </MenuItem>
            ))}
        </FormField>
        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">
            {t('dwaionAdmin.overview.freshness')}
          </Typography>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {data
              ? t('dwaionAdmin.overview.generatedAt', {
                  at: formatDate(
                    data.generatedAt,
                    { dateStyle: 'medium', timeStyle: 'short' },
                    locale
                  ),
                })
              : t('dwaionAdmin.overview.loading')}
          </Typography>
        </Stack>
        <ActionButton
          intent="secondary"
          loading={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {t('dwaionAdmin.overview.refresh')}
        </ActionButton>
      </Box>

      {data && (data.failedRunCount > 0 || data.configurationRequiredCount > 0) && (
        <InlineFeedback severity="warning" sx={{ mt: 2 }}>
          {t('dwaionAdmin.overview.attentionNotice', {
            failed: data.failedRunCount,
            configuration: data.configurationRequiredCount,
          })}
        </InlineFeedback>
      )}

      <Box
        component="section"
        aria-label={t('dwaionAdmin.overview.summaryLabel')}
        sx={{
          mt: 2,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' },
          gap: 1.5,
        }}
      >
        {query.isLoading ? (
          [0, 1, 2, 3].map((index) => (
            <Box key={index} sx={{ minHeight: 170 }}>
              <LoadingState label={t('dwaionAdmin.overview.loading')} variant="skeleton" embedded />
            </Box>
          ))
        ) : (
          <>
            <SignalMetric
              icon={<Activity size={18} aria-hidden="true" />}
              label={t('dwaionAdmin.overview.runs')}
              value={formatNumber(data?.runCount ?? 0, undefined, locale)}
              detail={t('dwaionAdmin.overview.completedSample', {
                completed: data?.completedRunCount ?? 0,
                total: data?.runCount ?? 0,
                failed: data?.failedRunCount ?? 0,
              })}
              progress={completionPercent ?? undefined}
            />
            <SignalMetric
              icon={<ShieldAlert size={18} aria-hidden="true" />}
              label={t('dwaionAdmin.overview.policyExceptions')}
              value={formatNumber(data?.deniedRunCount ?? 0, undefined, locale)}
              detail={t('dwaionAdmin.overview.policyExceptionDetail', {
                handedOff: data?.handedOffRunCount ?? 0,
                failed: data?.failedRunCount ?? 0,
              })}
              tone="warning"
            />
            <SignalMetric
              icon={<UsersRound size={18} aria-hidden="true" />}
              label={t('dwaionAdmin.overview.activeUsers')}
              value={formatNumber(data?.activeUserCount ?? 0, undefined, locale)}
              detail={t('dwaionAdmin.overview.activeUserDetail', {
                conversations: data?.conversationCount ?? 0,
              })}
            />
            <SignalMetric
              icon={<ThumbsUp size={18} aria-hidden="true" />}
              label={t('dwaionAdmin.overview.feedback.title')}
              value={verifiedPercentageLabel(data?.feedbackUpCount, feedbackTotal)}
              detail={t('dwaionAdmin.overview.feedback.sample', {
                positive: data?.feedbackUpCount ?? 0,
                negative: data?.feedbackDownCount ?? 0,
              })}
              progress={positiveFeedbackPercent ?? undefined}
              tone="success"
            />
          </>
        )}
      </Box>

      {data && (
        <Box
          sx={{
            mt: 2,
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              lg: 'minmax(0, 7fr) minmax(19rem, 5fr)',
            },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <Stack spacing={2} sx={{ minWidth: 0 }}>
            <OperationalPanel
              title={t('dwaionAdmin.overview.operations.title')}
              description={t('dwaionAdmin.overview.operations.description')}
              badge={t('dwaionAdmin.overview.period', { count: data.periodDays })}
            >
              <SignalRow
                icon={Activity}
                title={t('dwaionAdmin.overview.operations.execution')}
                detail={t('dwaionAdmin.overview.completedSample', {
                  completed: data.completedRunCount,
                  total: data.runCount,
                  failed: data.failedRunCount,
                })}
                values={[
                  t('dwaionAdmin.overview.operations.completion', {
                    value: verifiedPercentageLabel(data.completedRunCount, data.runCount),
                  }),
                  t('dwaionAdmin.overview.performance.latencyValue', {
                    value: data.runCount
                      ? formatNumber(data.averageLatencyMs, undefined, locale)
                      : '—',
                  }),
                ]}
              />
              <SignalRow
                icon={ShieldCheck}
                title={t('dwaionAdmin.overview.policy.title')}
                detail={t('dwaionAdmin.overview.policy.description')}
                values={[
                  t('dwaionAdmin.overview.operations.allowed', { count: data.allowedRunCount }),
                  t('dwaionAdmin.overview.operations.handedOff', {
                    count: data.handedOffRunCount,
                  }),
                  t('dwaionAdmin.overview.operations.denied', { count: data.deniedRunCount }),
                ]}
              />
              <SignalRow
                icon={Bot}
                title={t('dwaionAdmin.overview.answer.title')}
                detail={t('dwaionAdmin.overview.answer.description')}
                values={[
                  t('dwaionAdmin.overview.operations.grounded', {
                    count: data.groundedAnswerCount,
                  }),
                  t('dwaionAdmin.overview.operations.abstained', {
                    count: data.abstainedAnswerCount,
                  }),
                  t('dwaionAdmin.overview.operations.configuration', {
                    count: data.configurationRequiredCount,
                  }),
                ]}
              />
              <SignalRow
                icon={Clock3}
                title={t('dwaionAdmin.overview.performance.title')}
                detail={t('dwaionAdmin.overview.performance.description')}
                values={[
                  t('dwaionAdmin.overview.performance.latencyValue', {
                    value: data.runCount
                      ? formatNumber(data.averageLatencyMs, undefined, locale)
                      : '—',
                  }),
                  t('dwaionAdmin.overview.performance.tokenValue', {
                    value: formatNumber(data.totalTokens, undefined, locale),
                  }),
                ]}
              />
            </OperationalPanel>
            <OperationalPanel
              title={t('dwaionAdmin.overview.coverage.title')}
              description={t('dwaionAdmin.overview.coverage.description')}
            >
              {(['runtime', 'connectors', 'alerts', 'audit'] as const).map((key) => (
                <SignalValue
                  key={key}
                  label={t(`dwaionAdmin.overview.coverage.${key}`)}
                  value={t('dwaionAdmin.overview.coverage.unavailable')}
                  muted
                />
              ))}
            </OperationalPanel>
          </Stack>

          <Stack spacing={2} sx={{ minWidth: 0 }}>
            <OperationalPanel
              title={t('dwaionAdmin.overview.management.title')}
              description={t('dwaionAdmin.overview.management.description')}
            >
              <Stack component="nav" aria-label={t('dwaionAdmin.overview.investigate')}>
                {MANAGEMENT_DESTINATIONS.filter(([destination, resource]) =>
                  destination === 'audit'
                    ? hasPermission(resource, 'VIEW') ||
                      hasPermission('ADMIN.DWAION_RETENTION', 'VIEW')
                    : hasPermission(resource, 'VIEW')
                ).map(([destination, , Icon], index) => (
                  <Box key={destination}>
                    {index > 0 && <Divider />}
                    <ButtonBase
                      component={RouterLink}
                      to={`/dwaion/admin/${destination}`}
                      sx={{
                        width: 1,
                        minHeight: 48,
                        py: 1,
                        px: 0.5,
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        borderRadius: foundationTokens.radius.control + 'px',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <Icon size={17} color="var(--dwp-product-accent)" aria-hidden="true" />
                      <Typography
                        variant="body2"
                        fontWeight="fontWeightBold"
                        sx={{ ml: 1, flex: 1 }}
                      >
                        {t(`dwaionAdmin.${destination}.title`)}
                      </Typography>
                      <ChevronRight size={16} aria-hidden="true" />
                    </ButtonBase>
                  </Box>
                ))}
              </Stack>
            </OperationalPanel>
            <OperationalPanel
              title={t('dwaionAdmin.overview.retention.title')}
              description={t('dwaionAdmin.overview.retention.description')}
              badge={t('dwaionAdmin.shared.version', { version: data.retention.policyVersion })}
            >
              <SignalValue
                label={t('dwaionAdmin.overview.retention.days')}
                value={t('dwaionAdmin.overview.retention.dayValue', {
                  count: data.retention.retentionDays,
                })}
              />
              <SignalValue
                label={t('dwaionAdmin.overview.retention.legalHold')}
                value={t(
                  data.retention.legalHold
                    ? 'dwaionAdmin.overview.retention.legalHoldOn'
                    : 'dwaionAdmin.overview.retention.legalHoldOff'
                )}
              />
            </OperationalPanel>
          </Stack>
        </Box>
      )}

      <InlineFeedback severity="info" sx={{ mt: 2 }}>
        {t('dwaionAdmin.overview.scopeNotice')}
      </InlineFeedback>
    </PageCanvas>
  );
}

function OperationalPanel({
  title,
  description,
  badge,
  children,
}: {
  title: string;
  description: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      component="section"
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.radius.surface + 'px',
        p: 2,
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
        <Box>
          <Typography component="h2" variant="h6">
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.25 }}>
            {description}
          </Typography>
        </Box>
        {badge && <Chip label={badge} size="small" variant="outlined" />}
      </Stack>
      <Box sx={{ mt: 1.5 }}>{children}</Box>
    </Box>
  );
}

function SignalRow({
  icon: Icon,
  title,
  detail,
  values,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  values: string[];
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      gap={1.25}
      alignItems={{ xs: 'stretch', sm: 'center' }}
      sx={{ py: 1.5, borderTop: 1, borderColor: 'divider' }}
    >
      <Box sx={{ display: 'grid', placeItems: 'center', width: 32, height: 32, flex: '0 0 auto' }}>
        <Icon size={18} color="var(--dwp-product-accent)" aria-hidden="true" />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="subtitle2">{title}</Typography>
        <Typography variant="caption" color="text.secondary" component="p">
          {detail}
        </Typography>
      </Box>
      <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ flex: '0 1 auto' }}>
        {values.map((value) => (
          <Chip key={value} size="small" variant="outlined" label={value} />
        ))}
      </Stack>
    </Stack>
  );
}

function SignalValue({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      gap={0.5}
      sx={{ py: 1, borderTop: 1, borderColor: 'divider' }}
    >
      <Typography variant="body2">{label}</Typography>
      <Typography variant="caption" color={muted ? 'text.secondary' : 'text.primary'}>
        {value}
      </Typography>
    </Stack>
  );
}
