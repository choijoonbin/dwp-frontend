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
  | 'queued'
  | 'running'
  | 'waiting-approval'
  | 'succeeded'
  | 'failed'
  | 'stopped';

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
};

const statusPresentation = {
  queued: { label: 'Queued', color: 'default', icon: Circle },
  running: { label: 'Running', color: 'info', icon: Clock3 },
  'waiting-approval': { label: 'Waiting approval', color: 'warning', icon: Clock3 },
  succeeded: { label: 'Succeeded', color: 'success', icon: CircleCheck },
  failed: { label: 'Failed', color: 'error', icon: TriangleAlert },
  stopped: { label: 'Stopped', color: 'default', icon: CircleStop },
} as const;

export function AgentExecutionTimeline({
  title,
  steps,
  auditId,
  liveMessage,
  onStop,
  onRetry,
  onHandoff,
}: AgentExecutionTimelineProps) {
  const running = steps.some((step) => step.status === 'running');
  const failed = steps.some((step) => step.status === 'failed');
  const titleId = useId();

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
              Audit ID: {auditId}
            </Typography>
          )}
        </Box>
        <Stack direction="row" gap={1}>
          {failed && onRetry && (
            <Button variant="outlined" startIcon={<RotateCcw size={16} />} onClick={onRetry}>
              Retry
            </Button>
          )}
          {onHandoff && (
            <Button variant="outlined" startIcon={<UserRoundCheck size={16} />} onClick={onHandoff}>
              Handoff
            </Button>
          )}
          {running && onStop && (
            <Button
              color="error"
              variant="outlined"
              startIcon={<CircleStop size={16} />}
              onClick={onStop}
            >
              Stop
            </Button>
          )}
        </Stack>
      </Stack>

      {running && <LinearProgress aria-label="Execution progress" />}
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

      <List disablePadding aria-label="Execution steps" sx={{ px: 2.5, py: 1 }}>
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
                  <Chip size="small" color={presentation.color} label={presentation.label} />
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
