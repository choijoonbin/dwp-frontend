import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  CircleCheck,
  CircleDashed,
  Clock3,
  FlaskConical,
  MonitorUp,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { InlineFeedback } from '@dwp-frontend/design-system/components/inline-feedback/inline-feedback';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';
import { formatDate } from '@dwp-frontend/shared-i18n/lib/formatters';

import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  notificationTestStageProgress,
  resolveNotificationTestAction,
} from './notification-attention-model';

import type {
  NotificationTestDiagnostics,
  NotificationTestStage,
  NotificationTestStageStatus,
} from './notification-attention-model';
import type { NotificationChannel } from '@dwp-frontend/shared-utils/api/notification-api';
import type { NotificationDiagnosticChannelOption } from './notification-attention-diagnostic-channels';

export type NotificationTestRequestFailure = 'RATE_LIMITED' | 'OFFLINE' | 'FORBIDDEN' | 'FAILED';

const CHANNEL_ICON = {
  IN_APP: FlaskConical,
  WEB_PUSH: MonitorUp,
  MOBILE_PUSH: Smartphone,
} as const;

function stateColor(
  state: NotificationTestDiagnostics['state']
): 'default' | 'info' | 'success' | 'warning' | 'error' {
  if (state === 'COMPLETE') return 'success';
  if (state === 'RUNNING' || state === 'QUEUED') return 'info';
  if (state === 'PARTIAL' || state === 'RATE_LIMITED' || state === 'EXPIRED') return 'warning';
  if (state === 'FAILED' || state === 'OFFLINE' || state === 'DISABLED') return 'error';
  return 'default';
}

function stageColor(
  status: NotificationTestStageStatus
): 'default' | 'info' | 'success' | 'warning' | 'error' {
  if (status === 'REACHED') return 'success';
  if (status === 'RUNNING' || status === 'QUEUED') return 'info';
  if (status === 'SKIPPED' || status === 'BLOCKED' || status === 'EXPIRED') return 'warning';
  if (status === 'FAILED') return 'error';
  return 'default';
}

function TestStateNotice({ diagnostics }: { diagnostics: NotificationTestDiagnostics }) {
  const { t } = useTranslation('notifications');
  const terminal = ['RATE_LIMITED', 'OFFLINE', 'EXPIRED', 'DISABLED', 'FAILED'].includes(
    diagnostics.state
  );
  if (!terminal && !diagnostics.statusMessage) return null;
  const detail =
    diagnostics.statusMessage ?? t(`attention.diagnostics.states.${diagnostics.state}`);
  return (
    <InlineFeedback
      severity={diagnostics.state === 'FAILED' ? 'error' : terminal ? 'warning' : 'info'}
    >
      <Typography variant="body2">{detail}</Typography>
      {diagnostics.retryAt && (
        <Typography variant="caption" color="text.secondary">
          {t('attention.diagnostics.retryAfter', {
            date: formatDate(diagnostics.retryAt, { dateStyle: 'medium', timeStyle: 'short' }),
          })}
        </Typography>
      )}
    </InlineFeedback>
  );
}

const STATE_RUN_REASON: Partial<
  Record<NotificationTestDiagnostics['state'], NotificationTestDiagnostics['runAvailability']>
> = {
  QUEUED: 'BUSY',
  RUNNING: 'BUSY',
  RATE_LIMITED: 'RATE_LIMITED',
  OFFLINE: 'OFFLINE',
  EXPIRED: 'EXPIRED',
  DISABLED: 'DISABLED',
};

function TestRunAvailabilityNotice({ diagnostics }: { diagnostics: NotificationTestDiagnostics }) {
  const { t } = useTranslation('notifications');
  const reason = diagnostics.runAvailability;
  if (reason === 'AVAILABLE' || STATE_RUN_REASON[diagnostics.state] === reason) return null;
  return (
    <InlineFeedback severity="warning" title={t('attention.diagnostics.actionUnavailable')}>
      <Typography variant="body2">{t(`attention.diagnostics.availability.${reason}`)}</Typography>
      {reason === 'RATE_LIMITED' && diagnostics.retryAt && (
        <Typography variant="caption" color="text.secondary">
          {t('attention.diagnostics.retryAfter', {
            date: formatDate(diagnostics.retryAt, { dateStyle: 'medium', timeStyle: 'short' }),
          })}
        </Typography>
      )}
    </InlineFeedback>
  );
}

function StageTile({ stage, index }: { stage: NotificationTestStage; index: number }) {
  const { t } = useTranslation('notifications');
  const reached = stage.status === 'REACHED';
  return (
    <Box
      component="li"
      sx={{
        minWidth: 0,
        p: 1.15,
        display: 'grid',
        gridTemplateColumns: '24px minmax(0, 1fr)',
        gap: 0.75,
        border: 1,
        borderColor: reached ? 'success.light' : 'divider',
        borderRadius: foundationTokens.radius.surface,
        bgcolor: reached ? 'success.50' : 'background.paper',
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 22,
          height: 22,
          display: 'grid',
          placeItems: 'center',
          color: reached ? 'success.main' : 'text.secondary',
        }}
      >
        {reached ? (
          <CircleCheck size={19} />
        ) : (
          <Typography variant="caption">{index + 1}</Typography>
        )}
      </Box>
      <Box minWidth={0}>
        <Stack direction="row" gap={0.5} alignItems="center" flexWrap="wrap">
          <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
            {stage.label}
          </Typography>
          <Chip
            size="small"
            variant="outlined"
            color={stageColor(stage.status)}
            label={t(`attention.diagnostics.stageStates.${stage.status}`)}
            sx={{ ml: { sm: 'auto' } }}
          />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {stage.description}
        </Typography>
        {stage.detail && (
          <Typography
            variant="caption"
            sx={{ display: 'block', mt: 0.4, overflowWrap: 'anywhere' }}
          >
            {stage.detail}
          </Typography>
        )}
        <Stack direction="row" gap={0.5} alignItems="center" flexWrap="wrap" sx={{ mt: 0.5 }}>
          <Chip
            size="small"
            variant="outlined"
            label={t(`attention.diagnostics.capabilities.${stage.capability}`)}
            color={stage.capability === 'SUPPORTED' ? 'default' : 'warning'}
          />
          {stage.observedAt && (
            <Stack direction="row" gap={0.35} alignItems="center">
              <Clock3 size={12} aria-hidden />
              <Typography variant="caption" color="text.secondary">
                {formatDate(stage.observedAt, { dateStyle: 'medium', timeStyle: 'short' })}
              </Typography>
            </Stack>
          )}
        </Stack>
      </Box>
    </Box>
  );
}

function StagePipeline({ diagnostics }: { diagnostics: NotificationTestDiagnostics }) {
  const { t } = useTranslation('notifications');
  if (diagnostics.stages.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
        <CircleDashed size={22} aria-hidden />
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {t('attention.diagnostics.noStages')}
        </Typography>
      </Box>
    );
  }
  return (
    <Box
      component="ol"
      aria-label={t('attention.diagnostics.pipelineLabel')}
      sx={{
        m: 0,
        p: 0,
        display: 'grid',
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          md: 'repeat(2, minmax(0, 1fr))',
          xl: 'repeat(4, minmax(0, 1fr))',
        },
        gap: 0.75,
        listStyle: 'none',
      }}
    >
      {diagnostics.stages.map((stage, index) => (
        <StageTile key={stage.stageId} stage={stage} index={index} />
      ))}
    </Box>
  );
}

function channelStateColor(
  state: NotificationDiagnosticChannelOption['availability']
): 'default' | 'success' | 'warning' | 'error' {
  if (state === 'AVAILABLE') return 'success';
  if (state === 'CHECKING') return 'default';
  if (state === 'OFFLINE' || state === 'PERMISSION_DENIED') return 'error';
  return 'warning';
}

function DiagnosticChannelPicker({
  options,
  selectedChannels,
  disabled,
  onChange,
}: {
  options: readonly NotificationDiagnosticChannelOption[];
  selectedChannels: readonly NotificationChannel[];
  disabled: boolean;
  onChange: (channels: NotificationChannel[]) => void;
}) {
  const { t } = useTranslation('notifications');
  const hasRunnableSelection = options.some(
    (option) => option.availability === 'AVAILABLE' && selectedChannels.includes(option.channel)
  );
  return (
    <Box
      component="fieldset"
      sx={{ m: 0, mx: { xs: 1.25, sm: 1.5 }, mb: 1.25, p: 0, border: 0, minWidth: 0 }}
    >
      <Typography component="legend" variant="subtitle2" sx={{ mb: 0.75 }}>
        {t('attention.diagnostics.channelsTitle')}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(3, minmax(0, 1fr))' },
          gap: 0.75,
        }}
      >
        {options.map((option) => {
          const available = option.availability === 'AVAILABLE';
          const checked = selectedChannels.includes(option.channel);
          const Icon = CHANNEL_ICON[option.channel];
          return (
            <Box
              key={option.channel}
              sx={{
                minWidth: 0,
                p: 1,
                border: 1,
                borderColor: checked ? 'primary.main' : 'divider',
                borderRadius: foundationTokens.radius.control,
                bgcolor: checked ? 'primary.50' : 'background.paper',
              }}
            >
              <FormControlLabel
                disabled={disabled || !available}
                sx={{ m: 0, width: '100%', alignItems: 'flex-start' }}
                control={
                  <Checkbox
                    size="small"
                    checked={checked}
                    onChange={(event) =>
                      onChange(
                        event.target.checked
                          ? [...selectedChannels, option.channel]
                          : selectedChannels.filter((channel) => channel !== option.channel)
                      )
                    }
                  />
                }
                label={
                  <Box minWidth={0} sx={{ pt: 0.15 }}>
                    <Stack direction="row" gap={0.5} alignItems="center" flexWrap="wrap">
                      <Icon size={15} aria-hidden />
                      <Typography variant="body2" fontWeight="fontWeightBold">
                        {t(`channels.${option.channel}`)}
                      </Typography>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={channelStateColor(option.availability)}
                        label={t(
                          `attention.diagnostics.channelAvailability.${option.availability}`
                        )}
                        sx={{ ml: { sm: 'auto' } }}
                      />
                    </Stack>
                    {option.reason && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mt: 0.25, overflowWrap: 'anywhere' }}
                      >
                        {t(`attention.diagnostics.channelReasons.${option.reason}`)}
                      </Typography>
                    )}
                    {option.endpointLabels.length > 0 && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mt: 0.25, overflowWrap: 'anywhere' }}
                      >
                        {t('attention.diagnostics.activeEndpoints', {
                          endpoints: option.endpointLabels.join(', '),
                        })}
                      </Typography>
                    )}
                  </Box>
                }
              />
            </Box>
          );
        })}
      </Box>
      {!hasRunnableSelection && (
        <Typography variant="caption" color="warning.dark" sx={{ display: 'block', mt: 0.5 }}>
          {t('attention.diagnostics.selectChannel')}
        </Typography>
      )}
    </Box>
  );
}

export type NotificationTestDiagnosticsPanelProps = {
  diagnostics: NotificationTestDiagnostics;
  channelOptions: readonly NotificationDiagnosticChannelOption[];
  selectedChannels: readonly NotificationChannel[];
  requestFailure?: NotificationTestRequestFailure | null;
  busy?: boolean;
  defaultExpanded?: boolean;
  onRun: () => void;
  onSelectedChannelsChange: (channels: NotificationChannel[]) => void;
  onRefresh?: () => void;
};

export function NotificationTestDiagnosticsPanel({
  diagnostics,
  channelOptions,
  selectedChannels,
  requestFailure = null,
  busy = false,
  defaultExpanded = false,
  onRun,
  onSelectedChannelsChange,
  onRefresh,
}: NotificationTestDiagnosticsPanelProps) {
  const { t } = useTranslation('notifications');
  const titleId = useId();
  const action = resolveNotificationTestAction(diagnostics, busy);
  const selectedAvailable = selectedChannels.every((channel) =>
    channelOptions.some(
      (option) => option.channel === channel && option.availability === 'AVAILABLE'
    )
  );
  const canRun = action.allowed && selectedChannels.length > 0 && selectedAvailable;
  const progress = notificationTestStageProgress(diagnostics.stages);
  const supported = diagnostics.stages.filter((stage) => stage.capability === 'SUPPORTED').length;
  const expiration = diagnostics.expiresAt
    ? formatDate(diagnostics.expiresAt, { dateStyle: 'medium', timeStyle: 'short' })
    : t('attention.diagnostics.notIssued');

  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      data-testid="notification-test-diagnostics"
      data-business-outcome="excluded"
      sx={{
        minWidth: 0,
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.radius.surface,
        bgcolor: 'background.paper',
        overflow: 'hidden',
        '& .MuiChip-outlinedWarning': { color: 'text.primary', borderColor: 'warning.dark' },
        '@media (prefers-reduced-motion: reduce)': {
          '& *, & *::before, & *::after': { transition: 'none !important' },
        },
        '@media (forced-colors: active)': { borderColor: 'CanvasText' },
      }}
    >
      <Box sx={{ px: { xs: 1.25, sm: 1.5 }, py: 1.25 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          gap={1}
        >
          <Stack direction="row" gap={1} alignItems="flex-start" minWidth={0}>
            <Box
              aria-hidden="true"
              sx={{
                width: 34,
                height: 34,
                flex: '0 0 auto',
                display: 'grid',
                placeItems: 'center',
                color: 'primary.main',
                bgcolor: 'primary.50',
                borderRadius: foundationTokens.radius.control,
              }}
            >
              <FlaskConical size={19} />
            </Box>
            <Box minWidth={0}>
              <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
                <Typography id={titleId} component="h3" variant="subtitle1">
                  {t('attention.diagnostics.title')}
                </Typography>
                <Chip
                  size="small"
                  color={stateColor(diagnostics.state)}
                  variant="outlined"
                  label={t(`attention.diagnostics.states.${diagnostics.state}`)}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {t('attention.diagnostics.description')}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" gap={0.75} flexWrap="wrap">
            {onRefresh && diagnostics.testId && (
              <ActionButton
                intent="quiet"
                size="small"
                startIcon={<RefreshCw size={15} />}
                disabled={busy}
                onClick={onRefresh}
              >
                {t('actions.refresh')}
              </ActionButton>
            )}
            <ActionButton
              intent="primary"
              size="small"
              startIcon={<Send size={15} />}
              disabled={!canRun}
              loading={busy}
              loadingLabel={t('attention.diagnostics.starting')}
              onClick={onRun}
              sx={{ flexGrow: { xs: 1, sm: 0 } }}
            >
              {t(requestFailure ? 'actions.retry' : 'attention.diagnostics.run')}
            </ActionButton>
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ px: { xs: 1.25, sm: 1.5 }, pb: 1.25 }}>
        <InlineFeedback severity="info" icon={<ShieldCheck size={18} />}>
          {t('attention.diagnostics.exclusion')}
        </InlineFeedback>
      </Box>

      <DiagnosticChannelPicker
        options={channelOptions}
        selectedChannels={selectedChannels}
        disabled={busy}
        onChange={onSelectedChannelsChange}
      />

      <Box
        role="group"
        aria-label={t('attention.diagnostics.summaryLabel')}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' },
          borderBlock: 1,
          borderColor: 'divider',
          bgcolor: 'action.hover',
          '& > div': { minWidth: 0, p: 1, borderRight: 1, borderColor: 'divider' },
          '& > div:nth-of-type(2n)': { borderRight: { xs: 0, sm: 1 } },
          '& > div:last-of-type': { borderRight: 0 },
        }}
      >
        <Box>
          <Typography variant="caption" color="text.secondary">
            {t('attention.diagnostics.stateLabel')}
          </Typography>
          <Typography variant="body2" fontWeight="fontWeightBold">
            {t(`attention.diagnostics.states.${diagnostics.state}`)}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {t('attention.diagnostics.supportedStages')}
          </Typography>
          <Typography
            variant="body2"
            fontWeight="fontWeightBold"
            sx={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {supported}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {t('attention.diagnostics.observedStages')}
          </Typography>
          <Typography
            variant="body2"
            fontWeight="fontWeightBold"
            sx={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {progress.observed} / {progress.total}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {t('attention.diagnostics.resultExpiry')}
          </Typography>
          <Typography
            variant="body2"
            fontWeight="fontWeightBold"
            sx={{ overflowWrap: 'anywhere' }}
          >
            {expiration}
          </Typography>
        </Box>
      </Box>

      <Stack gap={1} sx={{ px: { xs: 1.25, sm: 1.5 }, pt: 1.25 }}>
        {requestFailure && (
          <InlineFeedback
            severity={requestFailure === 'RATE_LIMITED' ? 'warning' : 'error'}
            title={t(`attention.diagnostics.requestFailures.${requestFailure}.title`)}
          >
            {t(`attention.diagnostics.requestFailures.${requestFailure}.description`)}
          </InlineFeedback>
        )}
        <TestStateNotice diagnostics={diagnostics} />
        <TestRunAvailabilityNotice diagnostics={diagnostics} />
      </Stack>

      <Box sx={{ display: { xs: 'none', md: 'block' }, p: 1.5 }}>
        <StagePipeline diagnostics={diagnostics} />
      </Box>

      <Accordion
        disableGutters
        defaultExpanded={defaultExpanded}
        elevation={0}
        sx={{
          display: { xs: 'block', md: 'none' },
          mt: 1,
          borderTop: 1,
          borderColor: 'divider',
          '&::before': { display: 'none' },
        }}
      >
        <AccordionSummary expandIcon={<ChevronDown size={17} />} sx={{ px: 1.25 }}>
          <Stack direction="row" gap={0.75} alignItems="center">
            <CircleDashed size={17} aria-hidden />
            <Typography variant="subtitle2">{t('attention.diagnostics.stageDetails')}</Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 1.25, borderTop: 1, borderColor: 'divider' }}>
          <StagePipeline diagnostics={diagnostics} />
        </AccordionDetails>
      </Accordion>

      {diagnostics.testId && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          gap={{ xs: 0.25, sm: 1 }}
          sx={{ px: { xs: 1.25, sm: 1.5 }, py: 1, borderTop: 1, borderColor: 'divider' }}
        >
          <Typography variant="caption" color="text.secondary">
            {t('attention.diagnostics.id', { id: diagnostics.testId })}
          </Typography>
          {diagnostics.generatedAt && (
            <Typography variant="caption" color="text.secondary">
              {t('attention.diagnostics.started', {
                date: formatDate(diagnostics.generatedAt, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }),
              })}
            </Typography>
          )}
        </Stack>
      )}
    </Box>
  );
}
