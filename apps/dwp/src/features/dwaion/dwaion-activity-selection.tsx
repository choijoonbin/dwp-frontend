import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, RefreshCw } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  DetailInspector,
  GuidedEmptyState,
  LoadingState,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { getActivityEvent, HttpError, useAuth, usePermissions } from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ActivityEventDetail } from '../../components/activity/activity-event-detail';
import { activityQueryKeys } from '../../components/activity/activity-detail-model';

import type { DwaionUserRun } from '@dwp-frontend/shared-utils';

export function DwaionActivitySelection({
  runId,
  run,
  runLoading = false,
  locale,
  variant,
  refreshing = false,
  onRefresh,
  onClose,
}: {
  runId: string;
  run?: DwaionUserRun;
  runLoading?: boolean;
  locale: 'ko' | 'en';
  variant: 'inline' | 'drawer';
  refreshing?: boolean;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('work');
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { isLoaded, hasPermission } = usePermissions();
  const canAsk = isLoaded && hasPermission('APP.ASK', 'VIEW');
  const canInspectCommonActivity = canAsk && hasPermission('APP.ACTIVITY', 'VIEW');
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
      Boolean(runId) && Boolean(user) && isAuthenticated && isLoaded && canInspectCommonActivity,
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

  return (
    <DetailInspector
      open={Boolean(runId)}
      variant={variant}
      width={560}
      title={t('dwaionActivity.details.title')}
      subtitle={agentName ?? t('dwaionActivity.details.deepLink', { id: runId.slice(0, 8) })}
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
              onClick={onRefresh}
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
          <RunReceipt run={run} locale={locale} />
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
            intent="secondary"
            endIcon={<ExternalLink size={16} aria-hidden="true" />}
            onClick={() => navigate(`/dwaion/conversations/${run.conversationId}`)}
          >
            {t('dwaionActivity.openConversation')}
          </ActionButton>
        )}

        <Divider />
        {!isLoaded ? (
          <LoadingState label={t('dwaionActivity.details.permissionLoading')} size="compact" />
        ) : !canInspectCommonActivity ? (
          <GuidedEmptyState
            kind="permission"
            title={t('dwaionActivity.details.permissionTitle')}
            description={t('dwaionActivity.details.permissionDescription')}
            size="compact"
          />
        ) : (
          <ActivityEventDetail eventId={eventId} query={detail} showSourceAction={false} />
        )}
      </Stack>
    </DetailInspector>
  );
}

function RunReceipt({ run, locale }: { run: DwaionUserRun; locale: 'ko' | 'en' }) {
  const { t } = useTranslation('work');
  const values = [
    ['runId', run.runId],
    ['agent', `${run.agentKey} · r${run.agentRevision}`],
    ['runState', t(`dwaionActivity.states.${run.runState}`)],
    ['policyOutcome', t(`dwaionActivity.outcomes.${run.policyOutcome}`)],
    [
      'answerState',
      run.answerState
        ? t(`dwaionActivity.answerStates.${run.answerState}`)
        : t('dwaionActivity.details.notRecorded'),
    ],
    ['riskTier', run.riskTier],
    ['sourceCount', t('dwaionActivity.details.sourceCountValue', { count: run.sourceCount })],
    ['latency', t('dwaionActivity.details.latencyValue', { count: run.latencyMs })],
    ['createdAt', displayTime(run.createdAt, locale)],
    ...(run.completedAt ? [['completedAt', displayTime(run.completedAt, locale)]] : []),
    ...(run.statusCode ? [['statusCode', run.statusCode]] : []),
  ] as const;
  return (
    <Box component="section" aria-labelledby="dwaion-run-receipt-title">
      <Typography id="dwaion-run-receipt-title" component="h3" variant="subtitle2">
        {t('dwaionActivity.details.receiptTitle')}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
        {t('dwaionActivity.details.receiptDescription')}
      </Typography>
      <Box
        component="dl"
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            sm: 'minmax(8rem, 0.7fr) minmax(0, 1.3fr)',
          },
          m: 0,
          mt: 1.5,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        {values.map(([key, value]) => (
          <Box
            key={key}
            sx={{ display: 'contents', '& > *': { borderBottom: 1, borderColor: 'divider' } }}
          >
            <Typography component="dt" variant="caption" color="text.secondary" sx={{ py: 1 }}>
              {t(`dwaionActivity.details.fields.${key}`)}
            </Typography>
            <Typography
              component="dd"
              variant="body2"
              sx={{ m: 0, py: 1, overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' }}
            >
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
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
