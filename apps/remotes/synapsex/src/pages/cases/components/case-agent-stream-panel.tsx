/**
 * Case Detail Agent Stream Panel
 * SSE 이벤트 타임라인 + Start Analysis / Retry / Empty state
 */

import type { Theme, SxProps } from '@mui/material/styles';
import type { SynapseStreamEvent } from '@dwp-frontend/shared-utils';

import { Iconify } from '@dwp-frontend/design-system';
import { useStreamStore } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';

// ----------------------------------------------------------------------

export type CaseAgentStreamPanelProps = {
  caseId: string;
  events: SynapseStreamEvent[];
  streamingText: string;
  isThinking: boolean;
  isReconnecting: boolean;
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

const getEventLabel = (type: SynapseStreamEvent['type']): string => {
  switch (type) {
    case 'thought':
    case 'thinking':
      return 'Thinking';
    case 'analysis':
      return 'Analysis';
    case 'plan':
      return 'Plan';
    case 'tool':
      return 'Tool';
    case 'hitl':
      return 'HITL';
    default:
      return 'Content';
  }
};

export const CaseAgentStreamPanel = ({
  caseId,
  events,
  streamingText,
  isThinking,
  isReconnecting,
  onStartAnalysis,
  onRetry,
  onCancel,
  sx,
}: CaseAgentStreamPanelProps) => {
  const status = useStreamStore((state) => state.status);
  const errorMessage = useStreamStore((state) => state.errorMessage);

  const hasContent = events.length > 0 || streamingText.length > 0;
  const isActive = status === 'CONNECTING' || status === 'STREAMING' || status === 'RECONNECTING';
  const hasError = status === 'ERROR';

  return (
    <Box sx={{ p: 2, ...sx }}>
      <Stack spacing={2}>
        {/* CTA / Empty state */}
        {!hasContent && !isActive && !hasError && (
          <Card variant="outlined" sx={{ bgcolor: 'action.hover' }}>
            <CardContent sx={{ p: 4, textAlign: 'center' }}>
              <Iconify
                icon="solar:play-circle-bold-duotone"
                width={48}
                sx={{ color: 'primary.main', mb: 2, opacity: 0.8 }}
              />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                No stream data
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Start Agent analysis to see reasoning and recommendations in real time.
              </Typography>
              <Button
                variant="contained"
                startIcon={<Iconify icon="solar:play-bold" width={18} />}
                onClick={onStartAnalysis}
              >
                Start Analysis
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Error state */}
        {hasError && (
          <Card variant="outlined" sx={{ borderColor: 'error.main', bgcolor: 'error.lighter' }}>
            <CardContent sx={{ p: 2 }}>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Iconify icon="solar:danger-triangle-bold-duotone" width={24} sx={{ color: 'error.main', flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Stream error
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {errorMessage || 'Connection failed'}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button variant="outlined" size="small" startIcon={<Iconify icon="solar:refresh-bold" width={16} />} onClick={onRetry}>
                      Retry
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
            <Typography variant="caption">Reconnecting...</Typography>
          </Stack>
        )}

        {/* Active: Cancel button */}
        {isActive && (
          <Button variant="outlined" color="error" size="small" startIcon={<Iconify icon="solar:close-circle-bold" width={16} />} onClick={onCancel}>
            Cancel
          </Button>
        )}

        {/* Event timeline */}
        {hasContent && (
          <Card variant="outlined">
            <CardContent sx={{ p: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <Iconify icon="solar:history-bold-duotone" width={18} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Agent Stream
                </Typography>
                {isThinking && (
                  <CircularProgress size={14} sx={{ ml: 0.5 }} />
                )}
              </Stack>
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
                            {evt.type === 'hitl' ? 'HITL approval required' : getEventLabel(evt.type)}
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
