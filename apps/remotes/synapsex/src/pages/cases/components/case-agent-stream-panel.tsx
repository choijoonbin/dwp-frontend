/**
 * Case Detail Agent Stream Panel
 * SSE 이벤트 타임라인 + Start Analysis / Retry / Empty state
 */

import type { Theme, SxProps } from '@mui/material/styles';
import type { SynapseStreamEvent, StreamTimelineStep } from '@dwp-frontend/shared-utils';

import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useStreamStore } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';

// ----------------------------------------------------------------------

export type StepProgress = { label?: string; detail?: string; percent?: number };

export type CaseAgentStreamPanelProps = {
  caseId: string;
  events: SynapseStreamEvent[];
  streamingText: string;
  isThinking: boolean;
  isReconnecting: boolean;
  stepProgress?: StepProgress | null;
  onStartAnalysis: () => void;
  onRetry: () => void;
  onCancel: () => void;
  sx?: SxProps<Theme>;
};

const getEventIcon = (type: SynapseStreamEvent['type']): string => {
  switch (type) {
    case 'thought':
    case 'thinking':
      return 'solar:brain-bold-duotone';
    case 'analysis':
      return 'solar:magnifer-bold-duotone';
    case 'plan':
      return 'solar:list-bold-duotone';
    case 'tool':
      return 'solar:wrench-bold-duotone';
    case 'hitl':
      return 'solar:shield-check-bold-duotone';
    default:
      return 'solar:chat-round-dots-bold-duotone';
  }
};

const getEventLabelKey = (type: SynapseStreamEvent['type']): string => {
  switch (type) {
    case 'thought':
    case 'thinking':
      return 'thinking';
    case 'analysis':
      return 'analysis';
    case 'plan':
      return 'plan';
    case 'tool':
      return 'tool';
    case 'hitl':
      return 'hitl';
    default:
      return 'content';
  }
};

export const CaseAgentStreamPanel = ({
  caseId,
  events,
  streamingText,
  isThinking,
  isReconnecting,
  stepProgress,
  onStartAnalysis,
  onRetry,
  onCancel,
  sx,
}: CaseAgentStreamPanelProps) => {
  const { t } = useTranslation('common');
  const status = useStreamStore((state) => state.status);
  const errorMessage = useStreamStore((state) => state.errorMessage);
  const eventLog = useStreamStore((state) => state.eventLog);
  const timelineSteps = useStreamStore((state) => state.timelineSteps);
  const retryable = useStreamStore((state) => state.debug?.retryable);
  const failedStage = useStreamStore((state) => state.debug?.failedStage);

  const hasContent =
    events.length > 0 ||
    streamingText.length > 0 ||
    (stepProgress?.label != null && stepProgress.label.length > 0) ||
    eventLog.length > 0 ||
    timelineSteps.length > 0;
  const isActive = status === 'CONNECTING' || status === 'STREAMING' || status === 'RECONNECTING';
  const hasError = status === 'ERROR';
  const hasCompletedWithoutContent = status === 'COMPLETED' && !hasContent;

  return (
    <Box sx={{ p: 2, ...sx }}>
      <Stack spacing={2}>
        {/* Phase2: Completed without event content */}
        {hasCompletedWithoutContent && (
          <Card variant="outlined" sx={{ bgcolor: 'success.lighter', borderColor: 'success.main' }}>
            <CardContent sx={{ p: 4, textAlign: 'center' }}>
              <Iconify
                icon="solar:check-circle-bold-duotone"
                width={48}
                sx={{ color: 'success.main', mb: 2, opacity: 0.9 }}
              />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                {t('caseDetail.agentStreamPanel.analysisComplete')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('caseDetail.agentStreamPanel.analysisCompleteHint')}
              </Typography>
              <Button
                variant="outlined"
                startIcon={<Iconify icon="solar:refresh-bold" width={18} />}
                onClick={onRetry}
              >
                {t('caseDetail.agentStreamPanel.retry')}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* CTA / Empty state */}
        {!hasContent && !isActive && !hasError && !hasCompletedWithoutContent && (
          <Card variant="outlined" sx={{ bgcolor: 'action.hover' }}>
            <CardContent sx={{ p: 4, textAlign: 'center' }}>
              <Iconify
                icon="solar:play-circle-bold-duotone"
                width={48}
                sx={{ color: 'primary.main', mb: 2, opacity: 0.8 }}
              />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                {t('caseDetail.agentStreamPanel.noStreamData')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('caseDetail.agentStreamPanel.startAnalysisHint')}
              </Typography>
              <Button
                variant="contained"
                startIcon={<Iconify icon="solar:play-bold" width={18} />}
                onClick={onStartAnalysis}
              >
                {t('caseDetail.agentStreamPanel.startAnalysis')}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Error state (P1: stage 기반 메시지 + 재시도 CTA) */}
        {hasError && (
          <Card variant="outlined" sx={{ borderColor: 'error.main', bgcolor: 'error.lighter' }}>
            <CardContent sx={{ p: 2 }}>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Iconify icon="solar:danger-triangle-bold-duotone" width={24} sx={{ color: 'error.main', flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    {t('caseDetail.agentStreamPanel.streamError')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    {errorMessage || t('caseDetail.agentStreamPanel.connectionFailed')}
                  </Typography>
                  {failedStage && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      {t('caseDetail.agentStreamPanel.failedStage', { stage: failedStage, defaultValue: 'Stage: {{stage}}' })}
                    </Typography>
                  )}
                  {retryable === true && (
                    <Typography variant="caption" color="info.main" sx={{ display: 'block', mb: 1 }}>
                      {t('caseDetail.agentStreamPanel.retryable')}
                    </Typography>
                  )}
                  <Stack direction="row" spacing={1}>
                    <Button variant="contained" size="small" startIcon={<Iconify icon="solar:refresh-bold" width={16} />} onClick={onRetry}>
                      {t('caseDetail.agentStreamPanel.retry')}
                    </Button>
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Reconnecting */}
        {isReconnecting && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'warning.main' }}>
            <CircularProgress size={16} />
            <Typography variant="caption">{t('caseDetail.agentStreamPanel.reconnecting')}</Typography>
          </Stack>
        )}

        {/* Active: Step progress + Cancel */}
        {isActive && (
          <Stack spacing={1}>
            {stepProgress != null && (stepProgress.label != null || stepProgress.percent != null) && (
              <Box>
                {stepProgress.label && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    {stepProgress.label}
                  </Typography>
                )}
                {stepProgress.percent != null && (
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, Math.max(0, stepProgress.percent))}
                    sx={{ height: 6, borderRadius: 1 }}
                  />
                )}
              </Box>
            )}
            <Button variant="outlined" color="error" size="small" startIcon={<Iconify icon="solar:close-circle-bold" width={16} />} onClick={onCancel}>
              {t('caseDetail.agentStreamPanel.cancel')}
            </Button>
          </Stack>
        )}

        {/* P1: Step timeline (started/step/completed/failed) or Event timeline */}
        {hasContent && (
          <Card variant="outlined">
            <CardContent sx={{ p: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <Iconify icon="solar:history-bold-duotone" width={18} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {t('caseDetail.agentStreamPanel.title')}
                </Typography>
                {isThinking && (
                  <CircularProgress size={14} sx={{ ml: 0.5 }} />
                )}
              </Stack>
              {/* P1: Step-based timeline (started → steps → completed/failed) */}
              {timelineSteps.length > 0 && (
                <Box sx={{ position: 'relative', pl: 3, mb: 2 }}>
                  <Box
                    sx={{
                      position: 'absolute',
                      left: 7,
                      top: 0,
                      bottom: 0,
                      width: 2,
                      bgcolor: 'divider',
                    }}
                  />
                  <Stack spacing={1.5}>
                    {timelineSteps.map((step: StreamTimelineStep, idx: number) => (
                      <Stack key={idx} direction="row" spacing={1.5} sx={{ position: 'relative', zIndex: 1 }}>
                        <Box
                          sx={{
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            border: 1,
                            borderColor:
                              step.type === 'failed'
                                ? 'error.main'
                                : step.type === 'completed'
                                  ? 'success.main'
                                  : step.type === 'started'
                                    ? 'primary.main'
                                    : 'primary.light',
                            bgcolor:
                              step.type === 'failed'
                                ? 'error.lighter'
                                : step.type === 'completed'
                                  ? 'success.lighter'
                                  : step.type === 'started'
                                    ? 'primary.lighter'
                                    : 'background.paper',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            mt: 0.25,
                          }}
                        >
                          {step.type === 'started' && (
                            <Iconify icon="solar:play-bold" width={8} sx={{ color: 'primary.main' }} />
                          )}
                          {step.type === 'completed' && (
                            <Iconify icon="solar:check-circle-bold" width={10} sx={{ color: 'success.main' }} />
                          )}
                          {step.type === 'failed' && (
                            <Iconify icon="solar:close-circle-bold" width={10} sx={{ color: 'error.main' }} />
                          )}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          {step.type === 'started' && (
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main' }}>
                              {t('caseDetail.agentStreamPanel.timelineStarted', { defaultValue: 'Started' })}
                            </Typography>
                          )}
                          {step.type === 'step' && (
                            <>
                              {step.label && (
                                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block' }}>
                                  {step.label}
                                </Typography>
                              )}
                              {step.percent != null && (
                                <LinearProgress
                                  variant="determinate"
                                  value={Math.min(100, Math.max(0, step.percent))}
                                  sx={{ height: 4, borderRadius: 1, mt: 0.5, mb: 0.5 }}
                                />
                              )}
                              {step.detail && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                  {step.detail}
                                </Typography>
                              )}
                            </>
                          )}
                          {step.type === 'completed' && (
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'success.main' }}>
                              {t('caseDetail.agentStreamPanel.timelineCompleted', { defaultValue: 'Completed' })}
                            </Typography>
                          )}
                          {step.type === 'failed' && (
                            <>
                              <Typography variant="caption" sx={{ fontWeight: 600, color: 'error.main', display: 'block' }}>
                                {t('caseDetail.agentStreamPanel.timelineFailed', { defaultValue: 'Failed' })}
                              </Typography>
                              {step.message && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                  {step.message}
                                </Typography>
                              )}
                              {step.stage && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                  {t('caseDetail.agentStreamPanel.failedStage', { stage: step.stage, defaultValue: 'Stage: {{stage}}' })}
                                </Typography>
                              )}
                            </>
                          )}
                        </Box>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              )}
              {/* Phase3: Raw event log (보조, timeline 없을 때 또는 디버그용) */}
              {eventLog.length > 0 && (
                <Box
                  sx={{
                    mb: 2,
                    maxHeight: 280,
                    overflow: 'auto',
                    bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100'),
                    borderRadius: 1,
                    border: 1,
                    borderColor: 'divider',
                    p: 1.5,
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    {t('caseDetail.agentStreamPanel.eventLog', { count: eventLog.length, defaultValue: 'Event log ({{count}} lines)' })}
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      m: 0,
                      color: (theme) => (theme.palette.mode === 'dark' ? 'grey.300' : 'grey.800'),
                    }}
                  >
                    {eventLog.join('\n')}
                  </Box>
                </Box>
              )}
              <Box sx={{ position: 'relative', pl: 3 }}>
                <Box
                  sx={{
                    position: 'absolute',
                    left: 6,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    bgcolor: 'divider',
                  }}
                />
                <Stack spacing={2}>
                  {events.map((evt, idx) => (
                    <Stack key={idx} direction="row" spacing={1.5} sx={{ position: 'relative', zIndex: 1 }}>
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          border: 1,
                          borderColor: evt.type === 'hitl' ? 'warning.main' : 'primary.main',
                          bgcolor: evt.type === 'hitl' ? 'warning.lighter' : 'primary.lighter',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Iconify icon={getEventIcon(evt.type)} width={12} sx={{ color: evt.type === 'hitl' ? 'warning.main' : 'primary.main' }} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        {(evt.type === 'analysis' || evt.type === 'plan' || evt.type === 'tool' || evt.type === 'hitl') && (
                          <Typography variant="caption" sx={{ fontWeight: 600, color: evt.type === 'hitl' ? 'warning.dark' : 'text.secondary' }}>
                            {evt.type === 'hitl'
                              ? t('caseDetail.agentStreamPanel.hitlApprovalRequired')
                              : t(`caseDetail.agentStreamPanel.eventLabels.${getEventLabelKey(evt.type)}`)}
                          </Typography>
                        )}
                        {evt.content && (
                          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                            {evt.content}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  ))}
                  {streamingText && events.every((e) => e.type !== 'content' && e.type !== 'message') && (
                    <Typography variant="body2" sx={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {streamingText}
                    </Typography>
                  )}
                </Stack>
              </Box>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Box>
  );
};
