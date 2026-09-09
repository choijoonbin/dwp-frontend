import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  ChevronDown,
  ClipboardList,
  Copy,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import {
  foundationTokens,
  ActionButton,
  ActionIconButton,
  GuidedEmptyState,
  InlineFeedback,
  LoadingState,
  LocalErrorState,
  SectionHeader,
} from '@dwp-frontend/design-system';
import { formatDate, resolveDisplayCodeWithFallback } from '@dwp-frontend/shared-i18n';
import {
  getActivityEvent,
  getWorkspaceActivityAuditEvidence,
  HttpError,
  useAuth,
  usePermissions,
} from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, type Theme } from '@mui/material/styles';

import { ActivityIntegrityEvidence } from '../../components/activity/activity-integrity-evidence';
import { ActivityRunObservability } from '../../components/activity/activity-run-observability';
import {
  activityEventDetailModel,
  activityQueryKeys,
  selectedActivityEvent,
} from '../../components/activity/activity-detail-model';

import type {
  DwaionUserRun,
  WorkspaceActivityEvent,
  WorkspaceActivityEvidence,
} from '@dwp-frontend/shared-utils';

export function DwaionActivitySelection({
  runId,
  run,
  runLoading = false,
  locale,
  refreshing = false,
  accessDenied = false,
  onRefresh,
  onClose,
}: {
  runId: string;
  run?: DwaionUserRun;
  runLoading?: boolean;
  locale: 'ko' | 'en';
  refreshing?: boolean;
  accessDenied?: boolean;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('work');
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { isLoaded, hasPermission } = usePermissions();
  const [copied, setCopied] = useState(false);
  const canAsk = !accessDenied && isLoaded && hasPermission('APP.ASK', 'VIEW');
  const canInspectCommonActivity = canAsk && hasPermission('APP.ACTIVITY', 'VIEW');
  const sampleRun = run?.dataProvenance === 'SAMPLE';
  const canQueryCommonActivity = canInspectCommonActivity && Boolean(run) && !sampleRun;
  const eventId = `dwaion:${runId}`;
  const identity = [
    user?.tenantId ?? '',
    user?.userId ?? '',
    canAsk,
    canInspectCommonActivity,
  ].join(':');
  const detail = useQuery({
    queryKey: activityQueryKeys.detail(identity, eventId),
    queryFn: ({ signal }) => getActivityEvent(eventId, signal),
    enabled:
      Boolean(runId) && Boolean(user) && isAuthenticated && isLoaded && canQueryCommonActivity,
    staleTime: 15_000,
    refetchInterval: 60_000,
    retry: (count, error) =>
      !(error instanceof HttpError && [400, 401, 403, 404].includes(error.status)) && count < 1,
    meta: { accessSensitive: true },
  });
  const auditRecordId = detail.data?.auditRecordId ?? run?.auditEvidence?.auditRecordId ?? null;
  const evidence = useQuery({
    queryKey: [...activityQueryKeys.detail(identity, eventId), 'evidence', auditRecordId],
    queryFn: ({ signal }) => getWorkspaceActivityAuditEvidence(auditRecordId!, runId, signal),
    enabled: canQueryCommonActivity && Boolean(auditRecordId),
    staleTime: 15_000,
    refetchInterval: 60_000,
    retry: (count, error) =>
      !(error instanceof HttpError && [400, 401, 403, 404].includes(error.status)) && count < 1,
    meta: { accessSensitive: true },
  });
  const agentName = run
    ? t(`dwaionActivity.agents.${run.agentKey}`, { defaultValue: run.agentKey })
    : undefined;
  const runStatus = run ? (
    <Chip
      size="small"
      variant="outlined"
      color={runStateColor(run.runState)}
      label={t(`dwaionActivity.states.${run.runState}`)}
      sx={{ color: 'text.primary' }}
    />
  ) : undefined;
  const refreshSelection = () => {
    onRefresh();
    if (canQueryCommonActivity) void detail.refetch();
    if (canQueryCommonActivity && auditRecordId) void evidence.refetch();
  };
  const copyRunId = async () => {
    try {
      await navigator.clipboard.writeText(runId);
      setCopied(true);
      globalThis.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setCopied(false);
    }
  };

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    globalThis.addEventListener('keydown', closeOnEscape);
    return () => globalThis.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <Box
      component="aside"
      aria-label={t('dwaionActivity.details.title')}
      data-testid="dwaion-run-inspector"
      sx={{
        minWidth: 0,
        overflow: 'hidden',
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: (theme) => ({
          xs: Number(theme.shape.borderRadius) * 2 + 'px',
          lg: Number(theme.shape.borderRadius) * 1.5 + 'px',
        }),
        boxShadow: (theme) => `0 8px 24px ${alpha(theme.palette.text.primary, 0.08)}`,
      }}
    >
      <Box sx={{ p: { xs: 1.25, sm: 1.5 }, bgcolor: 'var(--dwp-product-soft)' }}>
        <Stack direction="row" alignItems="center" gap={0.75}>
          <ShieldAlert size={17} color="var(--dwp-product-accent)" aria-hidden="true" />
          <Typography
            variant="overline"
            color="primary.main"
            fontWeight="fontWeightBold"
            sx={{ flex: 1 }}
          >
            {t('dwaionActivity.details.inspectorLabel')}
          </Typography>
          {run?.attempt !== undefined && (
            <Chip
              size="small"
              variant="outlined"
              label={t('dwaionActivity.observability.attempt', { count: run.attempt })}
            />
          )}
          <ActionIconButton
            label={t('dwaionActivity.refresh')}
            tooltip={t('dwaionActivity.refresh')}
            disabled={refreshing}
            onClick={refreshSelection}
          >
            <RefreshCw size={16} aria-hidden="true" />
          </ActionIconButton>
          <ActionIconButton
            label={t('activityFoundation.closeSelectedRun')}
            tooltip={t('activityFoundation.closeSelectedRun')}
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </ActionIconButton>
        </Stack>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', sm: 'flex-start' }}
          gap={1}
          sx={{ mt: 0.75 }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography component="h2" variant="h6" fontWeight="fontWeightBold">
              {run?.activityTitle ??
                agentName ??
                t('dwaionActivity.details.deepLink', { id: runId.slice(0, 8) })}
            </Typography>
            <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 0.35, minWidth: 0 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                title={runId}
                sx={{
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontFamily: foundationTokens.font.mono,
                }}
              >
                {runId}
              </Typography>
              <ActionIconButton
                label={t('dwaionActivity.details.copyRunId')}
                tooltip={t('dwaionActivity.details.copyRunId')}
                size="small"
                onClick={() => void copyRunId()}
              >
                <Copy size={14} aria-hidden="true" />
              </ActionIconButton>
            </Stack>
            {copied && (
              <Typography role="status" variant="caption" color="success.main">
                {t('dwaionActivity.details.copiedRunId')}
              </Typography>
            )}
          </Box>
          <Stack alignItems={{ xs: 'flex-start', sm: 'flex-end' }} gap={0.4}>
            {runStatus}
            {run && (
              <Typography variant="caption" color="text.secondary">
                {t('dwaionActivity.details.inspectorMeta', {
                  agent: agentName,
                  revision: run.agentRevision,
                  latency: run.latencyMs,
                })}
              </Typography>
            )}
          </Stack>
        </Stack>
      </Box>

      <Stack gap={{ xs: 1.25, md: 1.5 }} sx={{ p: { xs: 1.25, sm: 1.5 } }}>
        {run ? (
          <>
            <RunBoundary run={run} />
            <ActivityRunObservability run={run} locale={locale} density="compact" />
          </>
        ) : runLoading ? (
          <LoadingState label={t('dwaionActivity.details.runLoading')} size="compact" />
        ) : (
          <GuidedEmptyState
            kind="no-results"
            title={t('dwaionActivity.details.runUnavailableTitle')}
            description={t('dwaionActivity.details.runUnavailableDescription')}
            size="compact"
          />
        )}

        {!accessDenied && run && <Divider />}
        {accessDenied ? null : sampleRun ? (
          <InlineFeedback
            severity="info"
            title={t('dwaionActivity.details.sampleCommonActivityTitle')}
          >
            {t('dwaionActivity.details.sampleCommonActivityDescription')}
          </InlineFeedback>
        ) : !isLoaded ? (
          <LoadingState label={t('dwaionActivity.details.permissionLoading')} size="compact" />
        ) : !canInspectCommonActivity ? (
          <GuidedEmptyState
            kind="permission"
            title={t('dwaionActivity.details.permissionTitle')}
            description={t('dwaionActivity.details.permissionDescription')}
            size="compact"
          />
        ) : (
          <CommonActivityEvidence
            eventId={eventId}
            query={detail}
            evidenceQuery={auditRecordId ? evidence : undefined}
            locale={locale}
          />
        )}

        {run && <RunReceipt run={run} locale={locale} collapsed />}

        {run?.conversationId && (
          <ActionButton
            intent="primary"
            fullWidth
            endIcon={<ExternalLink size={16} aria-hidden="true" />}
            onClick={() => navigate(`/dwaion/conversations/${run.conversationId}`)}
            sx={{ minHeight: 44 }}
          >
            {t('dwaionActivity.openConversation')}
          </ActionButton>
        )}
      </Stack>
    </Box>
  );
}

function RunBoundary({ run }: { run: DwaionUserRun }) {
  const { t } = useTranslation('work');
  const state =
    run.policyOutcome === 'DENY'
      ? 'denied'
      : run.runState === 'FAILED'
        ? 'failed'
        : run.runState === 'RUNNING'
          ? 'running'
          : 'completed';
  return (
    <InlineFeedback
      severity={
        state === 'denied' || state === 'failed'
          ? 'warning'
          : state === 'running'
            ? 'info'
            : 'success'
      }
      title={t(`dwaionActivity.details.boundary.${state}.title`)}
      sx={{ border: 0, bgcolor: 'var(--dwp-product-soft)' }}
    >
      {t(`dwaionActivity.details.boundary.${state}.description`, {
        stage: run.currentStage
          ? t(`dwaionActivity.observability.stageKeys.${run.currentStage}`)
          : t('dwaionActivity.details.notRecorded'),
        progress:
          run.progressPercent === null || run.progressPercent === undefined
            ? t('dwaionActivity.details.notRecorded')
            : `${run.progressPercent}%`,
      })}
    </InlineFeedback>
  );
}

function CommonActivityEvidence({
  eventId,
  query,
  evidenceQuery,
  locale,
}: {
  eventId: string;
  query: UseQueryResult<WorkspaceActivityEvent, Error>;
  evidenceQuery?: UseQueryResult<WorkspaceActivityEvidence, Error>;
  locale: 'ko' | 'en';
}) {
  const { t } = useTranslation('work');
  const { t: displayT } = useTranslation('display');
  const selected = query.isError ? undefined : selectedActivityEvent(eventId, query.data);
  const model = selected ? activityEventDetailModel(selected) : null;

  return (
    <Box
      component="aside"
      aria-label={t('activityPage.detailTitle')}
      sx={{
        minWidth: 0,
        p: 1,
        borderRadius: (theme) => Number(theme.shape.borderRadius) * 1.5 + 'px',
        bgcolor: 'action.hover',
      }}
    >
      {query.isLoading ? (
        <LoadingState label={t('activityPage.loading')} size="compact" />
      ) : query.isError || !selected || !model ? (
        <LocalErrorState
          title={t('activityFoundation.unavailableTitle')}
          description={t('activityFoundation.unavailableDescription')}
          retryLabel={t('activityPage.retry')}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
          size="compact"
        />
      ) : (
        <Stack gap={0.85}>
          <Box>
            <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
              <Typography
                component="h3"
                variant="subtitle1"
                fontWeight="fontWeightBold"
                sx={{ flex: 1 }}
              >
                {selected.title}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                label={t(`activityFoundation.detail.kind.${model.kind}.label`)}
              />
              <Chip
                size="small"
                variant="outlined"
                label={resolveDisplayCodeWithFallback(
                  displayT,
                  'objectTypes',
                  selected.objectType,
                  selected.objectType
                )}
              />
            </Stack>
            {selected.summary && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 0.35, display: 'block' }}
              >
                {selected.summary}
              </Typography>
            )}
          </Box>

          <Accordion
            disableGutters
            elevation={0}
            sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}
          >
            <AccordionSummary
              expandIcon={<ChevronDown size={16} aria-hidden="true" />}
              sx={{ px: 0, minHeight: 40 }}
            >
              <Typography variant="caption" fontWeight="fontWeightBold">
                {t('dwaionActivity.details.eventEvidence')}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0, pt: 0 }}>
              <Box component="dl" sx={{ m: 0, display: 'grid', gap: 0.5 }}>
                <EvidenceRow
                  label={t('activityFoundation.detail.fields.occurredAt')}
                  value={displayTime(selected.occurredAt, locale)}
                />
                <EvidenceRow
                  label={t('activityFoundation.detail.fields.source')}
                  value={selected.source}
                />
                {selected.objectLabel && (
                  <EvidenceRow
                    label={t('activityFoundation.detail.fields.objectLabel')}
                    value={selected.objectLabel}
                  />
                )}
                {selected.auditRecordId && (
                  <EvidenceRow
                    label={t('activityFoundation.detail.fields.auditRecordId')}
                    value={selected.auditRecordId}
                  />
                )}
              </Box>
            </AccordionDetails>
          </Accordion>

          {evidenceQuery && (
            <Box>
              <Typography component="h4" variant="subtitle2" sx={{ mb: 0.65 }}>
                {t('activityFoundation.detail.integrity.title')}
              </Typography>
              <ActivityIntegrityEvidence query={evidenceQuery} density="compact" />
            </Box>
          )}
        </Stack>
      )}
    </Box>
  );
}

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" gap={1.5} sx={{ minWidth: 0 }}>
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        component="dd"
        variant="caption"
        fontWeight="fontWeightBold"
        sx={{ m: 0, minWidth: 0, textAlign: 'end', overflowWrap: 'anywhere' }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

function RunReceipt({
  run,
  locale,
  collapsed = false,
}: {
  run: DwaionUserRun;
  locale: 'ko' | 'en';
  collapsed?: boolean;
}) {
  const { t } = useTranslation('work');
  const values = [
    ['runId', run.runId],
    ['agent', `${run.agentKey} · r${run.agentRevision}`],
    ['policyOutcome', t(`dwaionActivity.outcomes.${run.policyOutcome}`)],
    [
      'answerState',
      run.answerState
        ? t(`dwaionActivity.answerStates.${run.answerState}`)
        : t('dwaionActivity.details.notRecorded'),
    ],
    ['sourceCount', t('dwaionActivity.details.sourceCountValue', { count: run.sourceCount })],
    ['latency', t('dwaionActivity.details.latencyValue', { count: run.latencyMs })],
  ] as const;
  const additionalValues = [
    ['runState', t(`dwaionActivity.states.${run.runState}`)],
    ['riskTier', run.riskTier],
    ['createdAt', displayTime(run.createdAt, locale)],
    ...(run.completedAt ? ([['completedAt', displayTime(run.completedAt, locale)]] as const) : []),
    ...(run.statusCode ? ([['statusCode', run.statusCode]] as const) : []),
  ] as const;
  if (collapsed) {
    return (
      <Box component="section" aria-labelledby="dwaion-run-receipt-title">
        <SectionHeader
          id="dwaion-run-receipt-title"
          icon={ClipboardList}
          title={t('dwaionActivity.details.receiptTitle')}
          headingComponent="h3"
          density="compact"
        />
        <Accordion
          disableGutters
          elevation={0}
          sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}
        >
          <AccordionSummary
            expandIcon={<ChevronDown size={17} aria-hidden="true" />}
            sx={{ px: 0, minHeight: 40 }}
          >
            <Typography variant="body2" fontWeight="subtitle2.fontWeight">
              {t('dwaionActivity.details.additionalMetadata')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 0, pt: 0 }}>
            <ReceiptFields values={[...values, ...additionalValues]} />
          </AccordionDetails>
        </Accordion>
      </Box>
    );
  }
  return (
    <Box component="section" aria-labelledby="dwaion-run-receipt-title">
      <SectionHeader
        id="dwaion-run-receipt-title"
        icon={ClipboardList}
        title={t('dwaionActivity.details.receiptTitle')}
        headingComponent="h3"
        density="compact"
      />
      <Typography
        variant="caption"
        color="text.secondary"
        component="p"
        sx={{ mt: 0.5, display: { xs: 'none', lg: 'block' } }}
      >
        {t('dwaionActivity.details.receiptDescription')}
      </Typography>
      <Box
        sx={(theme) => ({
          mt: 0.75,
          p: 1,
          bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.06),
          borderRadius: (surfaceTheme: Theme) => `${surfaceTheme.shape.borderRadius}px`,
        })}
      >
        <ReceiptFields values={values} />
      </Box>
      <Accordion
        disableGutters
        elevation={0}
        sx={{ mt: 1, bgcolor: 'transparent', '&:before': { display: 'none' } }}
      >
        <AccordionSummary
          expandIcon={<ChevronDown size={17} aria-hidden="true" />}
          sx={{ px: 0, minHeight: 40 }}
        >
          <Typography variant="body2" fontWeight="subtitle2.fontWeight">
            {t('dwaionActivity.details.additionalMetadata')}
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0, pt: 0 }}>
          <ReceiptFields values={additionalValues} />
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}

function ReceiptFields({ values }: { values: readonly (readonly [string, string])[] }) {
  const { t } = useTranslation('work');
  return (
    <Box
      component="dl"
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: { xs: 0.65, sm: 1 },
        m: 0,
      }}
    >
      {values.map(([key, value]) => (
        <Box
          key={key}
          sx={{
            minWidth: 0,
            display: 'block',
            gridColumn: key === 'runId' ? '1 / -1' : undefined,
          }}
        >
          <Typography component="dt" variant="caption" color="text.secondary">
            {t(`dwaionActivity.details.fields.${key}`)}
          </Typography>
          <Typography
            component="dd"
            variant="body2"
            sx={{
              m: 0,
              mt: 0.25,
              overflowWrap: 'anywhere',
              fontVariantNumeric: 'tabular-nums',
              ...(key === 'runId' || key === 'agent' || key === 'statusCode'
                ? { fontFamily: foundationTokens.font.mono, fontSize: 'caption.fontSize' }
                : {}),
            }}
          >
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function displayTime(value: string, locale: 'ko' | 'en') {
  return formatDate(value, { dateStyle: 'medium', timeStyle: 'short' }, locale);
}

function runStateColor(state: DwaionUserRun['runState']): 'info' | 'success' | 'error' {
  if (state === 'RUNNING') return 'info';
  if (state === 'COMPLETED') return 'success';
  return 'error';
}
