// ----------------------------------------------------------------------

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type ConfidenceScoreProps = {
  confidence: number;
  onRequestInfo?: () => void;
};

export const ConfidenceScore = ({ confidence, onRequestInfo }: ConfidenceScoreProps) => {
  const percentage = Math.round(confidence * 100);
  const getColor = () => {
    if (confidence > 0.8) return 'success';
    if (confidence > 0.5) return 'warning';
    return 'error';
  };

  const getLabel = () => {
    if (confidence > 0.8) return '높음';
    if (confidence > 0.5) return '보통';
    return '낮음';
  };

  const getIcon = () => {
    if (confidence > 0.8) return 'solar:verified-check-bold';
    if (confidence > 0.5) return 'solar:question-circle-bold';
    return 'solar:info-circle-bold';
  };

  return (
    <Paper
      sx={{
        p: 2,
        bgcolor: 'background.neutral',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            <Iconify icon={getIcon()} width={20} sx={{ color: `${getColor()}.main` }} />
            <Typography variant="subtitle2">AI 신뢰도</Typography>
          </Stack>
          <Chip
            label={getLabel()}
            size="small"
            color={getColor()}
            icon={<Iconify icon={getIcon()} width={14} />}
          />
        </Stack>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <LinearProgress
              variant="determinate"
              value={percentage}
              sx={{
                flex: 1,
                height: 8,
                borderRadius: 1,
                bgcolor: 'background.paper',
              }}
              color={getColor()}
            />
            <Typography variant="caption" sx={{ minWidth: 40, textAlign: 'right', fontWeight: 'bold' }}>
              {percentage}%
            </Typography>
          </Stack>
        </Box>
        {confidence < 0.5 && onRequestInfo && (
          <Button
            size="small"
            variant="outlined"
            color="info"
            fullWidth
            onClick={onRequestInfo}
            startIcon={<Iconify icon="solar:question-circle-bold" />}
          >
            추가 정보 제공
          </Button>
        )}
        {confidence < 0.8 && confidence >= 0.5 && (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
            AI가 확신하지 못하는 부분이 있습니다. 결과를 검토해주세요.
          </Typography>
        )}
      </Stack>
    </Paper>
  );
};
