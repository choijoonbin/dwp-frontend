import { useId } from 'react';
import {
  Circle,
  CircleCheck,
  CircleStop,
  Clock3,
  RotateCcw,
  TriangleAlert,
  UserRoundCheck,
} from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import ListItem from '@mui/material/ListItem';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

export type AgentExecutionStatus =
  'queued' | 'running' | 'waiting-approval' | 'succeeded' | 'failed' | 'stopped';

export type AgentExecutionStep = {
  id: string;
  title: string;
  status: AgentExecutionStatus;
  detail?: string;
  tool?: string;
  timestamp?: string;
};

export type AgentExecutionTimelineProps = {
  title: string;
  steps: readonly AgentExecutionStep[];
  auditId?: string;
  liveMessage?: string;
  onStop?: () => void;
  onRetry?: () => void;
  onHandoff?: () => void;
  labels?: Partial<AgentExecutionTimelineLabels>;
};

export type AgentExecutionTimelineLabels = {
  auditId: (id: string) => string;
  retry: string;
  handoff: string;
  stop: string;
  progress: string;
  steps: string;
  states: Record<AgentExecutionStatus, string>;
};

const statusPresentation = {
  queued: { color: 'default', icon: Circle },
  running: { color: 'info', icon: Clock3 },
  'waiting-approval': { color: 'warning', icon: Clock3 },
  succeeded: { color: 'success', icon: CircleCheck },
  failed: { color: 'error', icon: TriangleAlert },
  stopped: { color: 'default', icon: CircleStop },
} as const;

const defaultLabels: AgentExecutionTimelineLabels = {
  auditId: (id) => `Audit ID: ${id}`,
  retry: 'Retry',
  handoff: 'Handoff',
  stop: 'Stop',
  progress: 'Execution progress',
  steps: 'Execution steps',
  states: {
    queued: 'Queued',
    running: 'Running',
    'waiting-approval': 'Waiting approval',
    succeeded: 'Succeeded',
    failed: 'Failed',
    stopped: 'Stopped',
  },
};

export function AgentExecutionTimeline({
  title,
  steps,
  auditId,
  liveMessage,
  onStop,
  onRetry,
  onHandoff,
  labels,
}: AgentExecutionTimelineProps) {
  const running = steps.some((step) => step.status === 'running');
  const failed = steps.some((step) => step.status === 'failed');
  const titleId = useId();
  const copy: AgentExecutionTimelineLabels = {
    ...defaultLabels,
    ...labels,
    states: { ...defaultLabels.states, ...labels?.states },
  };

  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        gap={1}
        sx={{ px: 2.5, py: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Box>
          <Typography id={titleId} component="h2" variant="h6">
            {title}
          </Typography>
          {auditId && (
            <Typography variant="caption" color="text.secondary">
              {copy.auditId(auditId)}
            </Typography>
          )}
        </Box>
        <Stack direction="row" gap={1}>
          {failed && onRetry && (
            <Button variant="outlined" startIcon={<RotateCcw size={16} />} onClick={onRetry}>
              {copy.retry}
            </Button>
          )}
          {onHandoff && (
            <Button variant="outlined" startIcon={<UserRoundCheck size={16} />} onClick={onHandoff}>
              {copy.handoff}
            </Button>
          )}
          {running && onStop && (
            <Button
              color="error"
              variant="outlined"
              startIcon={<CircleStop size={16} />}
              onClick={onStop}
            >
              {copy.stop}
            </Button>
          )}
        </Stack>
      </Stack>

      {running && <LinearProgress aria-label={copy.progress} />}
      <Box
        aria-live="polite"
        sx={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
        }}
      >
        {liveMessage}
      </Box>

      <List disablePadding aria-label={copy.steps} sx={{ px: 2.5, py: 1 }}>
        {steps.map((step) => {
          const presentation = statusPresentation[step.status];
          const StatusIcon = presentation.icon;

          return (
            <ListItem key={step.id} disableGutters sx={{ py: 1.25, alignItems: 'flex-start' }}>
              <StatusIcon size={19} aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }} />
              <Box sx={{ ml: 1.25, minWidth: 0, flex: 1 }}>
                <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                  <Typography variant="body2" fontWeight={600}>
                    {step.title}
                  </Typography>
                  <Chip size="small" color={presentation.color} label={copy.states[step.status]} />
                  {step.tool && <Chip size="small" variant="outlined" label={step.tool} />}
                </Stack>
                {(step.detail || step.timestamp) && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                    {[step.detail, step.timestamp].filter(Boolean).join(' · ')}
                  </Typography>
                )}
              </Box>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
}
