// ----------------------------------------------------------------------

import type { TimelineStep } from 'src/store/use-aura-store';

import { motion } from 'framer-motion';

import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Timeline from '@mui/lab/Timeline';
import TimelineDot from '@mui/lab/TimelineDot';
import TimelineItem from '@mui/lab/TimelineItem';
import Typography from '@mui/material/Typography';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import CircularProgress from '@mui/material/CircularProgress';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type ReasoningTimelineProps = {
  steps: TimelineStep[];
  currentStepIndex: number;
};

export const ReasoningTimeline = ({ steps, currentStepIndex }: ReasoningTimelineProps) => {
  const getStatusColor = (status: TimelineStep['status']): 'success' | 'warning' | 'error' | 'grey' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'grey';
    }
  };

  const getChipColor = (status: TimelineStep['status']): 'success' | 'warning' | 'error' | 'default' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: TimelineStep['status']) => {
    switch (status) {
      case 'completed':
        return 'solar:check-circle-bold';
      case 'processing':
        return 'solar:settings-bold';
      case 'failed':
        return 'solar:close-circle-bold';
      default:
        return 'solar:clock-circle-bold';
    }
  };

  const getStatusLabel = (status: TimelineStep['status']) => {
    switch (status) {
      case 'completed':
        return '완료';
      case 'processing':
        return '진행 중';
      case 'failed':
        return '실패';
      default:
        return '대기';
    }
  };

  if (steps.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          에이전트가 계획을 수립하면 여기에 표시됩니다.
        </Typography>
      </Paper>
    );
  }

  return (
    <Timeline
      position="right"
      sx={{
        p: 0,
        m: 0,
        '& .MuiTimelineItem-root:before': {
          flex: 0,
          padding: 0,
        },
      }}
    >
      {steps.map((step, index) => {
        const isActive = index === currentStepIndex;
        const isPast = index < currentStepIndex;

        return (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <TimelineItem>
              <TimelineSeparator>
                <TimelineDot
                  color={getStatusColor(step.status)}
                  variant={step.status === 'processing' ? 'outlined' : 'filled'}
                  sx={{
                    ...(isActive && {
                      animation: 'pulse 2s ease-in-out infinite',
                      '@keyframes pulse': {
                        '0%, 100%': { transform: 'scale(1)' },
                        '50%': { transform: 'scale(1.2)' },
                      },
                    }),
                  }}
                >
                  {step.status === 'processing' ? (
                    <CircularProgress size={16} color="warning" />
                  ) : (
                    <Iconify icon={getStatusIcon(step.status)} width={16} />
                  )}
                </TimelineDot>
                {index < steps.length - 1 && (
                  <TimelineConnector
                    sx={{
                      bgcolor: isPast ? 'success.main' : 'divider',
                      transition: 'background-color 0.3s',
                    }}
                  />
                )}
              </TimelineSeparator>
              <TimelineContent sx={{ pr: 0 }}>
                <Paper
                  sx={{
                    p: 2,
                    bgcolor: isActive ? 'action.selected' : 'background.paper',
                    border: isActive ? '2px solid' : '1px solid',
                    borderColor: isActive ? 'primary.main' : 'divider',
                    transition: 'all 0.3s',
                  }}
                >
                  <Stack spacing={1} sx={{ mb: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          label={getStatusLabel(step.status)}
                          size="small"
                          color={getChipColor(step.status)}
                          icon={
                            step.status === 'processing' ? (
                              <CircularProgress size={12} color="inherit" />
                            ) : undefined
                          }
                        />
                        {step.metadata?.tool && (
                          <Chip label={step.metadata.tool} size="small" variant="outlined" />
                        )}
                      </Stack>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {step.timestamp.toLocaleTimeString()}
                      </Typography>
                    </Stack>
                  </Stack>
                  <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: isActive ? 'bold' : 'normal' }}>
                    {step.title}
                  </Typography>
                  {step.description && (
                    <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap' }}>
                      {step.description}
                    </Typography>
                  )}
                </Paper>
              </TimelineContent>
            </TimelineItem>
          </motion.div>
        );
      })}
    </Timeline>
  );
};
