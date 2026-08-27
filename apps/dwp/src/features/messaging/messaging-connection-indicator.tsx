import { useTranslation } from 'react-i18next';

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
      size="small"
      variant="outlined"
      color={color}
      label={t(`conversation.connection.${state}`)}
      sx={{
        flexShrink: 0,
        '& .MuiChip-label': {
          maxWidth: { xs: 0, md: 120 },
          px: { xs: 0.5, md: 1 },
          overflow: 'hidden',
        },
        minWidth: { xs: 24, md: 'auto' },
      }}
    />
  );
}
