// ----------------------------------------------------------------------

import type { ContextSnapshot } from 'src/store/use-aura-store';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type ContextualBridgeProps = {
  snapshot: ContextSnapshot | null;
  onClose?: () => void;
};

export const ContextualBridge = ({ snapshot, onClose }: ContextualBridgeProps) => {
  if (!snapshot) return null;

  return (
    <Paper
      sx={{
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: 320,
        bgcolor: 'background.paper',
        borderLeft: '1px solid',
        borderColor: 'divider',
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: (theme) => theme.customShadows.z24,
      }}
    >
      <Box
        sx={{
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Iconify icon="solar:window-frame-bold" width={20} />
          <Typography variant="subtitle2">참조 컨텍스트</Typography>
        </Stack>
        {onClose && (
          <IconButton size="small" onClick={onClose}>
            <Iconify icon="solar:close-circle-bold" width={18} />
          </IconButton>
        )}
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
              페이지 정보
            </Typography>
            <Paper sx={{ p: 1.5, bgcolor: 'background.neutral' }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                {snapshot.title}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                {snapshot.url}
              </Typography>
            </Paper>
          </Box>

          {snapshot.screenshot && (
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                화면 스냅샷
              </Typography>
              <Box
                component="img"
                src={snapshot.screenshot}
                alt="Context snapshot"
                sx={{
                  width: '100%',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              />
            </Box>
          )}

          {snapshot.metadata && Object.keys(snapshot.metadata).length > 0 && (
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                메타데이터
              </Typography>
              <Stack spacing={0.5}>
                {Object.entries(snapshot.metadata).map(([key, value]) => (
                  <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {key}:
                    </Typography>
                    <Chip
                      label={String(value)}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: 20 }}
                    />
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          <Divider />

          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
              캡처 시간
            </Typography>
            <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
              {snapshot.timestamp.toLocaleString()}
            </Typography>
          </Box>
        </Stack>
      </Box>
    </Paper>
  );
};
