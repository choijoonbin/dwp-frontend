/**
 * Dev Error Panel — 개발모드에서 endpoint/params/tenant 표시
 * @see SynapseX 운영형 UX 마감 - Observability
 */

import { useState, useEffect } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { registerDevErrorReporter } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CardContent from '@mui/material/CardContent';

export type DevErrorEntry = {
  endpoint: string;
  method?: string;
  params?: Record<string, unknown>;
  tenantId?: string;
  status?: number;
  message: string;
  timestamp: string;
  gatewayRequestId?: string;
  traceId?: string;
};

const MAX_ENTRIES = 5;
const storage: DevErrorEntry[] = [];

function pushToStorage(entry: Omit<DevErrorEntry, 'timestamp'>): void {
  storage.unshift({
    ...entry,
    timestamp: new Date().toISOString(),
  });
  if (storage.length > MAX_ENTRIES) storage.pop();
}

const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';

export function DevErrorPanel() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<DevErrorEntry[]>([]);

  useEffect(() => {
    registerDevErrorReporter((p) => pushToStorage(p));
    return () => registerDevErrorReporter(null);
  }, []);

  const refresh = () => setEntries([...storage]);

  if (!isDev) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
      }}
    >
      <Collapse in={open}>
        <Card variant="outlined" sx={{ width: 360, maxHeight: 400, overflow: 'auto' }}>
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Dev Error Log
              </Typography>
              <Button size="small" onClick={refresh}>
                Refresh
              </Button>
            </Stack>
            {entries.length === 0 ? (
              <Typography variant="caption" color="text.secondary">
                No errors captured
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {entries.map((e, i) => (
                  <Box
                    key={i}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: 'error.lighter',
                      border: 1,
                      borderColor: 'error.light',
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                      {e.method ?? 'GET'} {e.endpoint}
                    </Typography>
                    {e.status && (
                      <Chip label={e.status} size="small" color="error" sx={{ mt: 0.5, height: 18 }} />
                    )}
                    {e.tenantId && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        tenant: {e.tenantId}
                      </Typography>
                    )}
                    {(e.gatewayRequestId || e.traceId) && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontFamily: 'monospace', fontSize: 10 }}>
                        {e.gatewayRequestId && <>req: {e.gatewayRequestId}</>}
                        {e.gatewayRequestId && e.traceId && ' · '}
                        {e.traceId && <>trace: {e.traceId}</>}
                      </Typography>
                    )}
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                      {e.message}
                    </Typography>
                    {e.params && Object.keys(e.params).length > 0 && (
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          mt: 0.5,
                          fontFamily: 'monospace',
                          fontSize: 10,
                          wordBreak: 'break-all',
                        }}
                      >
                        {JSON.stringify(e.params)}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Collapse>
      <IconButton
        size="small"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) refresh();
        }}
        sx={{
          mt: 1,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Iconify icon="solar:bug-bold" width={18} />
      </IconButton>
    </Box>
  );
}
