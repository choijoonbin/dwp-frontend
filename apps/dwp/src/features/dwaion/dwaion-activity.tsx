import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bot, CheckCircle2, CircleAlert, Clock3, ExternalLink, ShieldCheck } from 'lucide-react';
import {
  ActionButton,
  GuidedEmptyState,
  LiveStatus,
  LoadingState,
  LocalErrorState,
  OperationalKpiStrip,
  PageCanvas,
  ResourcePageHeader,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  getDwaionUserRuns,
  type DwaionRunState,
  type DwaionUserRun,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

type RunFilter = 'ALL' | DwaionRunState;

export function DwaionActivity() {
  const { t, i18n } = useTranslation('work');
  const navigate = useNavigate();
  const [filter, setFilter] = useState<RunFilter>('ALL');
  const runs = useQuery({
    queryKey: ['dwaion', 'user-runs', filter],
    queryFn: () => getDwaionUserRuns(filter === 'ALL' ? undefined : filter, 100),
    staleTime: 15_000,
    refetchInterval: 60_000,
    retry: 1,
  });
  const metrics = useMemo(() => summarize(runs.data ?? []), [runs.data]);
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const header = (
    <ResourcePageHeader
      eyebrow={t('dwaionActivity.eyebrow')}
      title={t('dwaionActivity.title')}
      description={t('dwaionActivity.description')}
      scope={
        <Stack direction="row" spacing={0.65} alignItems="center">
          <ShieldCheck size={15} color="var(--dwp-product-secondary)" aria-hidden="true" />
          <Typography variant="caption" color="text.secondary">
            {t('dwaionActivity.privacy')}
          </Typography>
        </Stack>
      }
      status={
        <LiveStatus
          state={runs.isError ? 'degraded' : runs.isFetching ? 'syncing' : 'live'}
          label={t(runs.isError ? 'dwaionActivity.status.degraded' : 'dwaionActivity.status.live')}
          refreshLabel={t('dwaionActivity.refresh')}
          refreshing={runs.isFetching}
          onRefresh={() => void runs.refetch()}
        />
      }
    />
  );

  if (runs.isLoading)
    return (
      <PageCanvas>
        {header}
        <LoadingState label={t('dwaionActivity.loading')} variant="skeleton" size="page" />
      </PageCanvas>
    );

  if (runs.isError)
    return (
      <PageCanvas>
        {header}
        <LocalErrorState
          title={t('dwaionActivity.errorTitle')}
          description={t('dwaionActivity.errorDescription')}
          retryLabel={t('dwaionActivity.refresh')}
          onRetry={() => void runs.refetch()}
          retrying={runs.isFetching}
          size="page"
        />
      </PageCanvas>
    );

  return (
    <PageCanvas>
      {header}
      <Box sx={{ mt: 3 }}>
        <OperationalKpiStrip
          ariaLabel={t('dwaionActivity.summaryLabel')}
          items={[
            {
              key: 'total',
              value: metrics.total,
              label: t('dwaionActivity.metrics.total'),
              detail: t('dwaionActivity.metrics.totalDetail'),
            },
            {
              key: 'running',
              value: metrics.running,
              label: t('dwaionActivity.metrics.running'),
              detail: t('dwaionActivity.metrics.runningDetail'),
              tone: 'info',
            },
            {
              key: 'grounded',
              value: metrics.grounded,
              label: t('dwaionActivity.metrics.grounded'),
              detail: t('dwaionActivity.metrics.groundedDetail'),
              tone: 'success',
            },
            {
              key: 'attention',
              value: metrics.attention,
              label: t('dwaionActivity.metrics.attention'),
              detail: t('dwaionActivity.metrics.attentionDetail'),
              tone: metrics.attention ? 'warning' : 'neutral',
            },
          ]}
        />
      </Box>

      <Box component="section" aria-labelledby="dwaion-activity-list" sx={{ mt: 3.5 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ sm: 'center' }}
          gap={1.5}
        >
          <Box>
            <Typography id="dwaion-activity-list" component="h2" variant="h6">
              {t('dwaionActivity.listTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              {t('dwaionActivity.listDescription')}
            </Typography>
          </Box>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={filter}
            onChange={(_, value: RunFilter | null) => value && setFilter(value)}
            aria-label={t('dwaionActivity.filterLabel')}
          >
            {(['ALL', 'RUNNING', 'COMPLETED', 'FAILED'] as const).map((state) => (
              <ToggleButton key={state} value={state}>
                {t(`dwaionActivity.filters.${state}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>

        {(runs.data ?? []).length ? (
          <Box sx={{ mt: 2, borderBlock: 1, borderColor: 'divider' }}>
            {(runs.data ?? []).map((run, index) => (
              <Box key={run.runId}>
                {index > 0 && <Divider />}
                <RunRow
                  run={run}
                  locale={locale}
                  onOpenConversation={
                    run.conversationId
                      ? () => navigate(`/dwaion/conversations/${run.conversationId}`)
                      : undefined
                  }
                />
              </Box>
            ))}
          </Box>
        ) : (
          <Box sx={{ mt: 2 }}>
            <GuidedEmptyState
              kind="empty"
              title={t('dwaionActivity.emptyTitle')}
              description={t('dwaionActivity.emptyDescription')}
              actionLabel={filter === 'ALL' ? t('dwaionActivity.start') : undefined}
              onAction={filter === 'ALL' ? () => navigate('/dwaion/new') : undefined}
            />
          </Box>
        )}
      </Box>
    </PageCanvas>
  );
}

function RunRow({
  run,
  locale,
  onOpenConversation,
}: {
  run: DwaionUserRun;
  locale: 'ko' | 'en';
  onOpenConversation?: () => void;
}) {
  const { t } = useTranslation('work');
  const Icon =
    run.runState === 'RUNNING' ? Clock3 : run.runState === 'COMPLETED' ? CheckCircle2 : CircleAlert;
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      alignItems={{ md: 'center' }}
      justifyContent="space-between"
      gap={1.5}
      sx={{ py: 1.6 }}
    >
      <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ minWidth: 0 }}>
        <Box
          aria-hidden="true"
          sx={{
            width: 38,
            height: 38,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 1,
            bgcolor: 'var(--dwp-product-soft)',
            color: run.runState === 'FAILED' ? 'error.main' : 'var(--dwp-product-accent)',
            flex: '0 0 auto',
          }}
        >
          <Icon size={18} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
            <Typography variant="body2" fontWeight={800}>
              {t(`dwaionActivity.agents.${run.agentKey}`, { defaultValue: run.agentKey })}
            </Typography>
            <Chip
              size="small"
              variant="outlined"
              color={
                run.runState === 'FAILED'
                  ? 'error'
                  : run.runState === 'RUNNING'
                    ? 'info'
                    : 'success'
              }
              label={t(`dwaionActivity.states.${run.runState}`)}
              sx={{ height: 23 }}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.3 }}>
            {t('dwaionActivity.runMeta', {
              risk: run.riskTier,
              sources: run.sourceCount,
              latency: run.latencyMs,
            })}
          </Typography>
          <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 0.4 }}>
            <Bot size={13} aria-hidden="true" />
            <Typography variant="caption" color="text.secondary">
              {t(`dwaionActivity.outcomes.${run.policyOutcome}`)}
            </Typography>
          </Stack>
        </Box>
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ pl: { xs: 6.25, md: 0 } }}>
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          {formatDate(
            run.completedAt ?? run.createdAt,
            { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
            locale
          )}
        </Typography>
        {onOpenConversation && (
          <ActionButton
            intent="quiet"
            size="small"
            endIcon={<ExternalLink size={14} aria-hidden="true" />}
            onClick={onOpenConversation}
          >
            {t('dwaionActivity.openConversation')}
          </ActionButton>
        )}
      </Stack>
    </Stack>
  );
}

function summarize(runs: DwaionUserRun[]) {
  return {
    total: runs.length,
    running: runs.filter((run) => run.runState === 'RUNNING').length,
    grounded: runs.filter((run) => run.runState === 'COMPLETED' && run.answerState === 'COMPLETED')
      .length,
    attention: runs.filter(
      (run) => run.runState === 'FAILED' || run.answerState === 'CONFIGURATION_REQUIRED'
    ).length,
  };
}
