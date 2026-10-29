import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';

import type { MessagingConnectionState } from './use-messaging-realtime';

export function MessagingConnectionIndicator({ state }: { state: MessagingConnectionState }) {
  const { t } = useTranslation('messaging');
  const color =
    state === 'live'
      ? 'success'
      : state === 'offline'
        ? 'error'
        : state === 'reconnecting'
          ? 'warning'
          : 'default';

  return (
    <Chip
      role="status"
      aria-live="polite"
      aria-label={t(`conversation.connection.${state}`)}
      data-testid="messaging-connection-indicator"
      size="small"
      variant="outlined"
      color={color}
      icon={
        <Box
          aria-hidden="true"
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: color === 'default' ? 'text.disabled' : `${color}.main`,
          }}
        />
      }
      label={t(`conversation.connection.${state}`)}
      sx={{
        flexShrink: 0,
        '& .MuiChip-label': {
          maxWidth: { xs: 96, sm: 120 },
          px: 0.75,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
        '& .MuiChip-icon': { ml: 0.75, mr: 0 },
        minWidth: 0,
      }}
    />
  );
}
