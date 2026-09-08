import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ClipboardList, ExternalLink, RefreshCw } from 'lucide-react';
import {
  foundationTokens,
  ActionButton,
  ActionIconButton,
  DetailInspector,
  GuidedEmptyState,
  InlineFeedback,
  LoadingState,
  SectionHeader,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
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

import { ActivityEventDetail } from '../../components/activity/activity-event-detail';
import { ActivityRunObservability } from '../../components/activity/activity-run-observability';
import { activityQueryKeys } from '../../components/activity/activity-detail-model';

import type { DwaionUserRun } from '@dwp-frontend/shared-utils';

export function DwaionActivitySelection({
  runId,
  run,
  runLoading = false,
  locale,
  variant,
  refreshing = false,
  accessDenied = false,
  onRefresh,
  onClose,
}: {
  runId: string;
  run?: DwaionUserRun;
  runLoading?: boolean;
  locale: 'ko' | 'en';
  variant: 'inline' | 'drawer';
  refreshing?: boolean;
  accessDenied?: boolean;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('work');
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { isLoaded, hasPermission } = usePermissions();
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

  return (
    <DetailInspector
      open={Boolean(runId)}
      variant={variant}
      width={560}
      title={t('dwaionActivity.details.title')}
      subtitle={
        run?.activityTitle ??
        agentName ??
        t('dwaionActivity.details.deepLink', { id: runId.slice(0, 8) })
      }
      closeLabel={t('activityFoundation.closeSelectedRun')}
      onClose={onClose}
      status={
        variant === 'drawer' ? (
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ width: 1 }}
          >
            {runStatus ?? <Box />}
            <ActionIconButton
              label={t('dwaionActivity.refresh')}
              tooltip={t('dwaionActivity.refresh')}
              disabled={refreshing}
              onClick={refreshSelection}
            >
              <RefreshCw size={17} aria-hidden="true" />
            </ActionIconButton>
          </Stack>
        ) : (
          runStatus
        )
      }
    >
      <Stack gap={2.5}>
        {run ? (
          <>
            <RunReceipt run={run} locale={locale} />
            <ActivityRunObservability run={run} locale={locale} />
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

        {run?.conversationId && (
          <ActionButton
            intent="primary"
            fullWidth
            endIcon={<ExternalLink size={16} aria-hidden="true" />}
            onClick={() => navigate(`/dwaion/conversations/${run.conversationId}`)}
            sx={{ minHeight: { xs: 44, sm: 38 } }}
          >
            {t('dwaionActivity.openConversation')}
          </ActionButton>
        )}

        {!accessDenied && <Divider />}
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
          <ActivityEventDetail
            eventId={eventId}
            query={detail}
            evidenceQuery={auditRecordId ? evidence : undefined}
            showSourceAction={false}
          />
        )}
      </Stack>
    </DetailInspector>
  );
}

function RunReceipt({ run, locale }: { run: DwaionUserRun; locale: 'ko' | 'en' }) {
  const { t } = useTranslation('work');
  const values = [
    ...(run.activityTitle ? ([['activityTitle', run.activityTitle]] as const) : []),
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
  return (
    <Box component="section" aria-labelledby="dwaion-run-receipt-title">
      <SectionHeader
        id="dwaion-run-receipt-title"
        icon={ClipboardList}
        title={t('dwaionActivity.details.receiptTitle')}
        headingComponent="h3"
        density="compact"
      />
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
        {t('dwaionActivity.details.receiptDescription')}
      </Typography>
      <Box
        sx={(theme) => ({
          mt: 1.5,
          p: 1.5,
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
          sx={{ px: 0, minHeight: 44 }}
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
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
        gap: { xs: 1, sm: 1.5 },
        m: 0,
      }}
    >
      {values.map(([key, value]) => (
        <Box
          key={key}
          sx={{
            minWidth: 0,
            display: { xs: 'grid', sm: 'block' },
            gridTemplateColumns: 'minmax(0, 0.75fr) minmax(0, 1.25fr)',
            columnGap: 1,
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
              mt: { xs: 0, sm: 0.25 },
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
