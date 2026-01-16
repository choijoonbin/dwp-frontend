// ----------------------------------------------------------------------

import type { ThoughtChain } from 'src/store/use-aura-store';

import { motion, AnimatePresence } from 'framer-motion';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Timeline from '@mui/lab/Timeline';
import TimelineDot from '@mui/lab/TimelineDot';
import TimelineItem from '@mui/lab/TimelineItem';
import Typography from '@mui/material/Typography';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineConnector from '@mui/lab/TimelineConnector';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type ThoughtChainUIProps = {
  thoughts: ThoughtChain[];
};

export const ThoughtChainUI = ({ thoughts }: ThoughtChainUIProps) => {
  const getTypeIcon = (type: ThoughtChain['type']) => {
    switch (type) {
      case 'analysis':
        return 'solar:magnifer-zoom-in-bold';
      case 'planning':
        return 'solar:document-text-bold';
      case 'execution':
        return 'solar:settings-bold';
      case 'verification':
        return 'solar:check-circle-bold';
      default:
        return 'solar:brain-bold';
    }
  };

  const getTypeLabel = (type: ThoughtChain['type']) => {
    switch (type) {
      case 'analysis':
        return '분석 중';
      case 'planning':
        return '계획 수립';
      case 'execution':
        return '실행 중';
      case 'verification':
        return '검증 중';
      default:
        return '사고 중';
    }
  };

  const getTypeColor = (type: ThoughtChain['type']): 'info' | 'primary' | 'warning' | 'success' | 'grey' => {
    switch (type) {
      case 'analysis':
        return 'info';
      case 'planning':
        return 'primary';
      case 'execution':
        return 'warning';
      case 'verification':
        return 'success';
      default:
        return 'grey';
    }
  };

  const getChipColor = (type: ThoughtChain['type']): 'info' | 'primary' | 'warning' | 'success' | 'default' => {
    switch (type) {
      case 'analysis':
        return 'info';
      case 'planning':
        return 'primary';
      case 'execution':
        return 'warning';
      case 'verification':
        return 'success';
      default:
        return 'default';
    }
  };

  if (thoughts.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'background.neutral' }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          AI가 사고 과정을 시작하면 여기에 표시됩니다.
        </Typography>
      </Paper>
    );
  }

  return (
    <Timeline sx={{ p: 0 }}>
      <AnimatePresence>
        {thoughts.map((thought, index) => (
          <motion.div
            key={thought.id}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <TimelineItem>
              <TimelineSeparator>
                <TimelineDot color={getTypeColor(thought.type)} variant="outlined">
                  <Iconify icon={getTypeIcon(thought.type)} width={16} />
                </TimelineDot>
                {index < thoughts.length - 1 && <TimelineConnector />}
              </TimelineSeparator>
              <TimelineContent>
                <Paper
                  sx={{
                    p: 2,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                  }}
                >
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        label={getTypeLabel(thought.type)}
                        size="small"
                        color={getChipColor(thought.type)}
                        icon={<Iconify icon={getTypeIcon(thought.type)} width={14} />}
                      />
                      <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto' }}>
                        {thought.timestamp.toLocaleTimeString()}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {thought.content}
                    </Typography>
                    {thought.sources && thought.sources.length > 0 && (
                      <Box sx={{ pt: 1, borderTop: '1px dashed', borderColor: 'divider' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                          참고 자료:
                        </Typography>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          {thought.sources.map((source, idx) => (
                            <Chip
                              key={idx}
                              label={source.name}
                              size="small"
                              variant="outlined"
                              icon={
                                <Iconify
                                  icon={
                                    source.type === 'code'
                                      ? 'solar:code-bold'
                                      : source.type === 'conversation'
                                        ? 'solar:chat-round-bold'
                                        : 'solar:database-bold'
                                  }
                                  width={12}
                                />
                              }
                              sx={{ fontSize: '0.7rem', height: 20 }}
                            />
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </Stack>
                </Paper>
              </TimelineContent>
            </TimelineItem>
          </motion.div>
        ))}
      </AnimatePresence>
    </Timeline>
  );
};
