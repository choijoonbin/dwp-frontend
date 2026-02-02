import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CardContent from '@mui/material/CardContent';

import { formatTime, formatDate } from '../utils';

import type { LineageStep } from '../../../components/evidence/types';

// ----------------------------------------------------------------------

interface LineageFlowProps {
  steps: LineageStep[];
  selectedStepId: string | null;
  onStepClick: (stepId: string) => void;
  onStepDetail: (stepId: string) => void;
}

const STEP_ICONS = [
  'solar:server-bold',
  'solar:database-bold',
  'solar:brain-bold',
  'solar:danger-triangle-bold',
];

export function LineageFlow({ steps, selectedStepId, onStepClick, onStepDetail }: LineageFlowProps) {
  const theme = useTheme();

  return (
    <Box>
      {/* Horizontal Step Indicator */}
      <Box sx={{ position: 'relative', mb: 4 }}>
        <Box
          sx={{
            position: 'absolute',
            top: 24,
            left: 0,
            right: 0,
            height: 2,
            bgcolor: 'divider',
          }}
        />
        <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'space-between' }}>
          {steps.map((step, index) => (
            <Box
              key={step.id}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'relative',
                zIndex: 10,
              }}
            >
              <Tooltip title={`${step.name}\n${formatTime(step.timestamp)}`}>
                <IconButton
                  onClick={() => onStepClick(step.id)}
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    bgcolor: step.status === 'complete' ? 'success.main' : 'action.disabledBackground',
                    color: step.status === 'complete' ? 'success.contrastText' : 'text.disabled',
                    '&:hover': {
                      bgcolor: step.status === 'complete' ? 'success.dark' : 'action.disabledBackground',
                    },
                    ...(selectedStepId === step.id && {
                      outline: `2px solid ${theme.palette.primary.main}`,
                      outlineOffset: 2,
                    }),
                  }}
                >
                  <Iconify icon={STEP_ICONS[index] || 'solar:widget-bold'} width={20} />
                </IconButton>
              </Tooltip>
              <Typography variant="caption" sx={{ fontWeight: 500, mt: 1, textAlign: 'center', maxWidth: 80 }}>
                {step.name}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '0.625rem', color: 'text.secondary' }}>
                {formatTime(step.timestamp)}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* All Steps List */}
      <Stack spacing={1.5}>
        {steps.map((step, index) => (
          <Card
            key={step.id}
            sx={{
              bgcolor: 'background.paper',
              cursor: 'pointer',
              transition: 'all 0.2s',
              ...(selectedStepId === step.id && {
                borderColor: 'primary.main',
                borderWidth: 2,
                borderStyle: 'solid',
              }),
            }}
            onClick={() => onStepClick(step.id)}
          >
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    bgcolor: step.status === 'complete' ? 'success.lighter' : 'action.disabledBackground',
                    color: step.status === 'complete' ? 'success.main' : 'text.disabled',
                  }}
                >
                  <Iconify icon={STEP_ICONS[index] || 'solar:widget-bold'} width={20} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {step.name}
                    </Typography>
                    {step.status === 'complete' && (
                      <Iconify icon="solar:check-circle-bold" width={16} sx={{ color: 'success.main' }} />
                    )}
                  </Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {step.system}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block' }}>
                    {formatTime(step.timestamp)}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.625rem', color: 'text.secondary' }}>
                    {formatDate(step.timestamp)}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStepDetail(step.id);
                  }}
                  sx={{ flexShrink: 0 }}
                >
                  <Iconify icon="solar:eye-bold" width={18} sx={{ color: 'primary.main' }} />
                </IconButton>
                <Iconify
                  icon="solar:alt-arrow-right-linear"
                  width={16}
                  sx={{
                    color: 'text.secondary',
                    transform: selectedStepId === step.id ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.2s',
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}
