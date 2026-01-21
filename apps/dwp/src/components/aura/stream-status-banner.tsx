// ----------------------------------------------------------------------

import { useStreamStore } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type StreamStatusBannerProps = {
  onRetry?: () => void;
  onCancel?: () => void;
};

export const StreamStatusBanner = ({ onRetry, onCancel }: StreamStatusBannerProps) => {
  const status = useStreamStore((state) => state.status);
  const errorMessage = useStreamStore((state) => state.errorMessage);
  const debug = useStreamStore((state) => state.debug);

  // Don't show banner for IDLE, COMPLETED, or ABORTED
  if (status === 'IDLE' || status === 'COMPLETED' || status === 'ABORTED') {
    return null;
  }

  // CONNECTING
  if (status === 'CONNECTING') {
    return (
      <Alert
        severity="info"
        icon={<CircularProgress size={16} />}
        sx={{ borderRadius: 1 }}
      >
        연결 중...
      </Alert>
    );
  }

  // STREAMING
  if (status === 'STREAMING') {
    return (
      <Alert
        severity="info"
        icon={<CircularProgress size={16} />}
        action={
          onCancel && (
            <IconButton size="small" onClick={onCancel} color="inherit">
              <Iconify icon="solar:close-circle-bold" width={20} />
            </IconButton>
          )
        }
        sx={{ borderRadius: 1 }}
      >
        응답 생성 중...
      </Alert>
    );
  }

  // RECONNECTING
  if (status === 'RECONNECTING') {
    return (
      <Alert
        severity="warning"
        icon={<CircularProgress size={16} />}
        sx={{ borderRadius: 1 }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2">
            연결이 불안정하여 재연결 중... ({debug.retryCount}/5)
          </Typography>
        </Stack>
      </Alert>
    );
  }

  // ERROR
  if (status === 'ERROR') {
    return (
      <Alert
        severity="error"
        action={
          <Stack direction="row" spacing={1}>
            {onRetry && (
              <Button size="small" onClick={onRetry} variant="outlined">
                다시 시도
              </Button>
            )}
            {onCancel && (
              <IconButton size="small" onClick={onCancel} color="inherit">
                <Iconify icon="solar:close-circle-bold" width={20} />
              </IconButton>
            )}
          </Stack>
        }
        sx={{ borderRadius: 1 }}
      >
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            연결 오류
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {errorMessage || '연결에 실패했습니다. 다시 시도해주세요.'}
          </Typography>
        </Box>
      </Alert>
    );
  }

  return null;
};
