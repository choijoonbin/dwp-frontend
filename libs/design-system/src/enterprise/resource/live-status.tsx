import { RefreshCw } from 'lucide-react';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { ActionIconButton } from '../../components/actions';

export type LiveStatusState = 'live' | 'syncing' | 'stale' | 'degraded';

const STATUS_COLOR: Record<LiveStatusState, string> = {
  live: 'success.main',
  syncing: 'info.main',
  stale: 'warning.main',
  degraded: 'error.main',
};

export type LiveStatusProps = {
  state: LiveStatusState;
  label: string;
  detail?: string;
  refreshLabel?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
};

export function LiveStatus({
  state,
  label,
  detail,
  refreshLabel,
  onRefresh,
  refreshing = false,
}: LiveStatusProps) {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          bgcolor: STATUS_COLOR[state],
          flex: '0 0 auto',
        }}
      />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" fontWeight={700} sx={{ display: 'block' }}>
          {label}
        </Typography>
        {detail && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {detail}
          </Typography>
        )}
      </Box>
      {onRefresh && refreshLabel && (
        <ActionIconButton
          label={refreshLabel}
          tooltip={refreshLabel}
          size="small"
          loading={refreshing}
          onClick={onRefresh}
        >
          <RefreshCw size={15} aria-hidden="true" />
        </ActionIconButton>
      )}
    </Box>
  );
}
