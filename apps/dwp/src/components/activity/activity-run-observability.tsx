import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  Clock3,
  DatabaseZap,
  Route,
  ShieldCheck,
} from 'lucide-react';
import { InlineFeedback, ProgressMeter, SectionHeader } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type {
  DwaionRunSourceHealth,
  DwaionRunStage,
  DwaionUserRun,
} from '@dwp-frontend/shared-utils';

export function ActivityRunObservability({
  run,
  locale,
}: {
  run: DwaionUserRun;
  locale: 'ko' | 'en';
}) {
  const { t } = useTranslation('work');
  const hasExecutionEvidence =
    run.attempt !== undefined ||
    run.lease !== undefined ||
    run.measurementStatus !== undefined ||
    run.stages !== undefined ||
    run.progressPercent !== undefined;
  return (
    <Stack gap={2.5} data-run-provenance={run.dataProvenance}>
      {run.dataProvenance === 'SAMPLE' && (
        <InlineFeedback severity="warning" title={t('dwaionActivity.observability.sample.title')}>
          {t('dwaionActivity.observability.sample.description')}
        </InlineFeedback>
      )}
      {hasExecutionEvidence && <RunMeasurement run={run} locale={locale} />}
      {run.sourceHealth !== undefined && (
        <RunSourceHealth sources={run.sourceHealth} locale={locale} />
      )}
      {run.auditEvidence !== undefined && <RunAuditLinkage run={run} />}
    </Stack>
  );
}

function RunMeasurement({ run, locale }: { run: DwaionUserRun; locale: 'ko' | 'en' }) {
  const { t } = useTranslation('work');
  const stages = [...(run.stages ?? [])].sort((left, right) => left.sequence - right.sequence);
  const measuredStages = stages.filter(
    (stage): stage is DwaionRunStage & { durationMs: number } => stage.durationMs !== null
  );
  const measuredTotal = measuredStages.reduce((total, stage) => total + stage.durationMs, 0);
  const evidenceUnavailable = run.measurementStatus === 'NOT_AVAILABLE';
  const evidencePartial = run.measurementStatus === 'PARTIAL';
  return (
    <Box component="section" aria-labelledby="dwaion-run-stages-title">
      <SectionHeader
        id="dwaion-run-stages-title"
        icon={Route}
        title={t('dwaionActivity.observability.stages.title')}
        headingComponent="h3"
        density="compact"
      />
      <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1 }}>
        {run.measurementStatus && (
          <Chip
            size="small"
            variant="outlined"
            color={evidencePartial ? 'warning' : evidenceUnavailable ? 'default' : 'info'}
            label={t(`dwaionActivity.observability.measurement.${run.measurementStatus}`)}
            sx={{ color: 'text.primary' }}
          />
        )}
        {run.currentStage && (
          <Chip
            size="small"
            label={t('dwaionActivity.observability.currentStage', {
              stage: t(`dwaionActivity.observability.stageKeys.${run.currentStage}`),
            })}
            sx={{ color: 'text.primary' }}
          />
        )}
        {run.attempt !== undefined && (
          <Chip
            size="small"
            variant="outlined"
            label={t('dwaionActivity.observability.attempt', { count: run.attempt })}
            sx={{ color: 'text.primary' }}
          />
        )}
        {run.lease && (
          <Chip
            size="small"
            variant="outlined"
            color={run.lease.status === 'EXPIRED' ? 'warning' : 'default'}
            label={t(`dwaionActivity.observability.lease.${run.lease.status}`)}
            sx={{ color: 'text.primary' }}
          />
        )}
      </Stack>

      {run.lease?.expiresAt && (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.75 }}>
          {t('dwaionActivity.observability.leaseExpires', {
            at: displayTime(run.lease.expiresAt, locale),
          })}
        </Typography>
      )}

      {run.progressPercent !== null && run.progressPercent !== undefined && (
        <ProgressMeter
          label={t('dwaionActivity.observability.progress')}
          value={run.progressPercent}
          valueLabel={t('dwaionActivity.observability.progressValue', {
            count: run.progressPercent,
          })}
          sx={{ mt: 1.5 }}
        />
      )}

      {evidenceUnavailable ? (
        <InlineFeedback
          severity="info"
          title={t('dwaionActivity.observability.stages.unavailableTitle')}
          sx={{ mt: 1.5 }}
        >
          {t('dwaionActivity.observability.stages.unavailableDescription')}
        </InlineFeedback>
      ) : stages.length === 0 ? (
        <Typography variant="body2" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
          {t('dwaionActivity.observability.stages.empty')}
        </Typography>
      ) : (
        <>
          {measuredTotal > 0 && (
            <StageLatencyDistribution stages={measuredStages} total={measuredTotal} />
          )}
          {evidencePartial && (
            <Typography role="status" variant="caption" color="text.secondary" component="p">
              {t('dwaionActivity.observability.stages.partial')}
            </Typography>
          )}
          <Box
            component="ol"
            aria-label={t('dwaionActivity.observability.stages.listLabel')}
            sx={{ listStyle: 'none', p: 0, m: 0, mt: 1.5, display: 'grid', gap: 0.75 }}
          >
            {stages.map((stage) => (
              <StageRow key={`${stage.sequence}:${stage.key}`} stage={stage} locale={locale} />
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}

function StageLatencyDistribution({
  stages,
  total,
}: {
  stages: Array<DwaionRunStage & { durationMs: number }>;
  total: number;
}) {
  const { t } = useTranslation('work');
  return (
    <Box
      role="img"
      aria-label={t('dwaionActivity.observability.stages.latencyLabel', { count: total })}
      sx={{ mt: 1.5, mb: 1 }}
    >
      <Stack direction="row" justifyContent="space-between" gap={1}>
        <Typography variant="caption" color="text.secondary">
          {t('dwaionActivity.observability.stages.latencyTitle')}
        </Typography>
        <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {t('dwaionActivity.details.latencyValue', { count: total })}
        </Typography>
      </Stack>
      <Box
        aria-hidden="true"
        sx={{ mt: 0.75, height: 8, display: 'flex', gap: '2px', overflow: 'hidden' }}
      >
        {stages.map((stage, index) => (
          <Box
            key={`${stage.sequence}:${stage.key}`}
            sx={(theme) => ({
              flexBasis: `${(stage.durationMs / total) * 100}%`,
              minWidth: stage.durationMs > 0 ? 2 : 0,
              bgcolor: alpha(theme.palette.primary.main, Math.max(0.28, 0.95 - index * 0.11)),
            })}
          />
        ))}
      </Box>
    </Box>
  );
}

function StageRow({ stage, locale }: { stage: DwaionRunStage; locale: 'ko' | 'en' }) {
  const { t } = useTranslation('work');
  const Icon =
    stage.state === 'COMPLETED'
      ? CheckCircle2
      : stage.state === 'FAILED'
        ? CircleAlert
        : CircleDashed;
  return (
    <Box
      component="li"
      data-stage-key={stage.key}
      data-stage-duration-ms={stage.durationMs ?? undefined}
      sx={{
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 1,
        p: 1,
        bgcolor: 'action.hover',
        borderRadius: (theme) => `${theme.shape.borderRadius}px`,
      }}
    >
      <Icon size={16} aria-hidden="true" />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" fontWeight="fontWeightMedium">
          {stage.sequence}. {t(`dwaionActivity.observability.stageKeys.${stage.key}`)}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="p">
          {displayTime(stage.startedAt, locale)}
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right', minWidth: 0 }}>
        <Typography variant="caption" component="p">
          {t(`dwaionActivity.observability.stageStates.${stage.state}`)}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="p">
          {stage.durationMs === null
            ? t('dwaionActivity.details.notRecorded')
            : t('dwaionActivity.details.latencyValue', { count: stage.durationMs })}
        </Typography>
      </Box>
    </Box>
  );
}

function RunSourceHealth({
  sources,
  locale,
}: {
  sources: DwaionRunSourceHealth[];
  locale: 'ko' | 'en';
}) {
  const { t } = useTranslation('work');
  return (
    <Box component="section" aria-labelledby="dwaion-run-sources-title">
      <SectionHeader
        id="dwaion-run-sources-title"
        icon={DatabaseZap}
        title={t('dwaionActivity.observability.sources.title')}
        headingComponent="h3"
        density="compact"
      />
      {sources.length === 0 ? (
        <Typography variant="body2" color="text.secondary" component="p" sx={{ mt: 1 }}>
          {t('dwaionActivity.observability.sources.empty')}
        </Typography>
      ) : (
        <Stack gap={0.75} sx={{ mt: 1 }}>
          {sources.map((source) => (
            <Box
              key={source.sourceType}
              sx={{
                p: 1.25,
                bgcolor: 'action.hover',
                borderRadius: (theme) => `${theme.shape.borderRadius}px`,
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                <Typography
                  variant="body2"
                  fontWeight="fontWeightMedium"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {source.sourceType}
                </Typography>
                <Chip
                  size="small"
                  variant="outlined"
                  color={
                    source.status === 'SUCCESS'
                      ? 'success'
                      : source.status === 'UNAVAILABLE'
                        ? 'warning'
                        : 'default'
                  }
                  label={t(`dwaionActivity.observability.sourceStates.${source.status}`)}
                  sx={{ color: 'text.primary' }}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
                {t('dwaionActivity.observability.sources.attempt', {
                  at: displayTime(source.lastAttemptAt, locale),
                  latency:
                    source.latencyMs === null
                      ? t('dwaionActivity.details.notRecorded')
                      : t('dwaionActivity.details.latencyValue', { count: source.latencyMs }),
                })}
              </Typography>
              <Typography variant="caption" color="text.secondary" component="p">
                {source.lastSuccessAt
                  ? t('dwaionActivity.observability.sources.lastSuccess', {
                      at: displayTime(source.lastSuccessAt, locale),
                    })
                  : t('dwaionActivity.observability.sources.noSuccess')}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}

function RunAuditLinkage({ run }: { run: DwaionUserRun }) {
  const { t } = useTranslation('work');
  const evidence = run.auditEvidence!;
  const Icon = evidence.status === 'LINKED' ? ShieldCheck : Clock3;
  return (
    <Box component="section" aria-labelledby="dwaion-run-audit-title">
      <SectionHeader
        id="dwaion-run-audit-title"
        icon={Icon}
        title={t('dwaionActivity.observability.audit.title')}
        headingComponent="h3"
        density="compact"
      />
      <InlineFeedback
        severity={evidence.status === 'LINKED' ? 'info' : 'warning'}
        title={t(`dwaionActivity.observability.audit.states.${evidence.status}.title`)}
        sx={{ mt: 1 }}
      >
        {t(`dwaionActivity.observability.audit.states.${evidence.status}.description`)}
      </InlineFeedback>
      {(evidence.auditId || evidence.auditRecordId) && (
        <Box component="dl" sx={{ m: 0, mt: 1, display: 'grid', gap: 0.75 }}>
          {evidence.auditId && (
            <EvidenceIdentifier
              label={t('dwaionActivity.observability.audit.auditId')}
              value={evidence.auditId}
            />
          )}
          {evidence.auditRecordId && (
            <EvidenceIdentifier
              label={t('dwaionActivity.observability.audit.recordId')}
              value={evidence.auditRecordId}
            />
          )}
        </Box>
      )}
    </Box>
  );
}

function EvidenceIdentifier({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography component="dd" variant="caption" sx={{ m: 0, overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Box>
  );
}

function displayTime(value: string, locale: 'ko' | 'en') {
  return formatDate(value, { dateStyle: 'medium', timeStyle: 'short' }, locale);
}
