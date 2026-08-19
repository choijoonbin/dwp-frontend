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
      size="small"
      variant="outlined"
      color={color}
      label={t(`conversation.connection.${state}`)}
      sx={{ flexShrink: 0, display: { xs: 'none', md: 'inline-flex' } }}
    />
  );
}
