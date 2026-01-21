// ----------------------------------------------------------------------

import { useState } from 'react';
import { useStreamStore } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

/**
 * Dev-only Stream Debug Panel
 * 
 * Shows SSE stream status and debug information.
 * Only rendered in development mode.
 */
export const StreamDebugPanel = () => {
  const status = useStreamStore((state) => state.status);
  const errorMessage = useStreamStore((state) => state.errorMessage);
  const debug = useStreamStore((state) => state.debug);
  const [expanded, setExpanded] = useState(false);

  // Only render in development
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const getStatusColor = (statusValue: string) => {
    switch (statusValue) {
      case 'CONNECTING':
      case 'STREAMING':
        return 'info';
      case 'RECONNECTING':
        return 'warning';
      case 'COMPLETED':
        return 'success';
      case 'ERROR':
        return 'error';
      case 'ABORTED':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Card
      sx={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        minWidth: 300,
        maxWidth: 400,
        boxShadow: 3,
      }}
    >
      <Box
        sx={{
          p: 1.5,
          borderBottom: expanded ? 1 : 0,
          borderColor: 'divider',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            SSE Debug
          </Typography>
          <Chip
            label={status}
            size="small"
            color={getStatusColor(status) as any}
            sx={{ height: 20, fontSize: '0.65rem' }}
          />
        </Stack>
        <IconButton size="small">
          <Iconify
            icon={expanded ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'}
            width={16}
          />
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ p: 1.5 }}>
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                Status
              </Typography>
              <Typography variant="body2">{status}</Typography>
            </Box>

            {errorMessage && (
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  Error
                </Typography>
                <Typography variant="body2" sx={{ color: 'error.main' }}>
                  {errorMessage}
                </Typography>
              </Box>
            )}

            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                Endpoint
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                {debug.endpoint || '-'}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                Retry Count
              </Typography>
              <Typography variant="body2">{debug.retryCount}</Typography>
            </Box>

            {debug.lastEventId && (
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  Last Event ID
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                  {debug.lastEventId}
                </Typography>
              </Box>
            )}

            {debug.lastEventType && (
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  Last Event Type
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {debug.lastEventType}
                </Typography>
              </Box>
            )}

            {debug.recentEventTypes.length > 0 && (
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5, display: 'block' }}>
                  Recent Event Types (last 10)
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {debug.recentEventTypes.map((type, idx) => (
                    <Chip
                      key={idx}
                      label={type}
                      size="small"
                      sx={{ height: 20, fontSize: '0.65rem' }}
                    />
                  ))}
                </Stack>
              </Box>
            )}

            {debug.startedAt && (
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  Started At
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                  {new Date(debug.startedAt).toLocaleString('ko-KR')}
                </Typography>
              </Box>
            )}

            {debug.completedAt && (
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  Completed At
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                  {new Date(debug.completedAt).toLocaleString('ko-KR')}
                </Typography>
              </Box>
            )}
          </Stack>
        </Box>
      </Collapse>
    </Card>
  );
};
