// ----------------------------------------------------------------------

import type { PlanStep } from 'src/store/use-aura-store';

import { useState } from 'react';
import { motion, Reorder } from 'framer-motion';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type DynamicPlanBoardProps = {
  steps: PlanStep[];
  onReorder: (stepIds: string[]) => void;
  onUpdate: (id: string, updates: Partial<PlanStep>) => void;
  onApprove: (id: string) => void;
  onSkip: (id: string) => void;
};

export const DynamicPlanBoard = ({ steps, onReorder, onUpdate, onApprove, onSkip }: DynamicPlanBoardProps) => {
  const [reorderMode, setReorderMode] = useState(false);
  const [items, setItems] = useState(steps.map((s) => s.id));

  const handleReorder = (newOrder: string[]) => {
    setItems(newOrder);
    onReorder(newOrder);
  };

  const getStatusColor = (status: PlanStep['status']) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'executing':
        return 'warning';
      case 'failed':
        return 'error';
      case 'approved':
        return 'info';
      case 'skipped':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: PlanStep['status']) => {
    switch (status) {
      case 'completed':
        return 'solar:check-circle-bold';
      case 'executing':
        return 'solar:settings-bold';
      case 'failed':
        return 'solar:close-circle-bold';
      case 'approved':
        return 'solar:verified-check-bold';
      case 'skipped':
        return 'solar:double-alt-arrow-right-bold';
      default:
        return 'solar:clock-circle-bold';
    }
  };

  if (steps.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          작업 계획이 수립되면 여기에 표시됩니다.
        </Typography>
      </Paper>
    );
  }

  const sortedSteps = [...steps].sort((a, b) => a.order - b.order);

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">작업 계획</Typography>
        <Button
          size="small"
          variant={reorderMode ? 'contained' : 'outlined'}
          onClick={() => setReorderMode(!reorderMode)}
          startIcon={<Iconify icon="solar:sort-by-alphabet-bold" />}
        >
          {reorderMode ? '순서 확정' : '순서 변경'}
        </Button>
      </Box>

      {reorderMode ? (
        <Reorder.Group axis="y" values={items} onReorder={handleReorder}>
          {sortedSteps.map((step) => (
            <Reorder.Item key={step.id} value={step.id}>
              <Paper
                sx={{
                  p: 2,
                  mb: 1,
                  border: '2px solid',
                  borderColor: 'primary.main',
                  borderRadius: 2,
                  cursor: 'grab',
                  '&:active': { cursor: 'grabbing' },
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <Iconify icon="solar:alt-arrow-up-down-bold" width={20} sx={{ color: 'text.secondary' }} />
                  <Typography variant="subtitle2" sx={{ flex: 1 }}>
                    {step.order + 1}. {step.title}
                  </Typography>
                </Stack>
              </Paper>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      ) : (
        <Stack spacing={2}>
          {sortedSteps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Paper
                sx={{
                  p: 2.5,
                  border: '1px solid',
                  borderColor: step.status === 'executing' ? 'primary.main' : 'divider',
                  borderRadius: 2,
                  bgcolor: step.status === 'executing' ? 'action.selected' : 'background.paper',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {step.status === 'executing' && (
                  <LinearProgress
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 2,
                    }}
                  />
                )}
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Chip
                      label={`${step.order + 1}`}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ minWidth: 32 }}
                    />
                    <Typography variant="subtitle2" sx={{ flex: 1 }}>
                      {step.title}
                    </Typography>
                    <Chip
                      label={step.status === 'executing' ? '실행 중' : step.status === 'completed' ? '완료' : step.status === 'approved' ? '승인됨' : step.status === 'skipped' ? '건너뜀' : '대기'}
                      size="small"
                      color={getStatusColor(step.status)}
                      icon={
                        step.status === 'executing' ? (
                          <CircularProgress size={12} color="inherit" />
                        ) : (
                          <Iconify icon={getStatusIcon(step.status)} width={12} />
                        )
                      }
                    />
                    {step.confidence !== undefined && (
                      <Chip
                        label={`신뢰도: ${Math.round(step.confidence * 100)}%`}
                        size="small"
                        variant="outlined"
                        color={step.confidence > 0.8 ? 'success' : step.confidence > 0.5 ? 'warning' : 'error'}
                      />
                    )}
                  </Stack>
                  <Typography variant="body2" sx={{ color: 'text.secondary', pl: 5 }}>
                    {step.description}
                  </Typography>
                  {step.status === 'pending' && (
                    <Stack direction="row" spacing={1} sx={{ pl: 5 }}>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => onApprove(step.id)}
                        startIcon={<Iconify icon="solar:check-circle-bold" />}
                      >
                        승인
                      </Button>
                      {step.canSkip && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => onSkip(step.id)}
                          startIcon={<Iconify icon="solar:double-alt-arrow-right-bold" />}
                        >
                          건너뛰기
                        </Button>
                      )}
                    </Stack>
                  )}
                </Stack>
              </Paper>
            </motion.div>
          ))}
        </Stack>
      )}
    </Stack>
  );
};
