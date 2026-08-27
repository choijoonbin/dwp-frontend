import { useTranslation } from 'react-i18next';
import { LogOut, WifiOff } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export type MeetingDepartureKind = 'LEFT' | 'DISCONNECTED';

export function MeetingDepartureState({
  kind,
  busy,
  error,
  onRejoin,
  onHome,
  onHistory,
}: {
  kind: MeetingDepartureKind;
  busy: boolean;
  error?: string | null;
  onRejoin: () => void;
  onHome: () => void;
  onHistory: () => void;
}) {
  const { t } = useTranslation('meetings');
  const disconnected = kind === 'DISCONNECTED';

  return (
    <Box
      role="status"
      sx={{ minHeight: 420, display: 'grid', placeItems: 'center', textAlign: 'center' }}
    >
      <Stack alignItems="center" gap={2} sx={{ width: 'min(100%, 560px)' }}>
        <Box
          sx={{
            width: 52,
            height: 52,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 1,
            color: disconnected ? 'warning.main' : 'primary.main',
            bgcolor: 'action.hover',
          }}
        >
          {disconnected ? <WifiOff size={25} /> : <LogOut size={25} />}
        </Box>
        <Typography component="h1" variant="h4" fontWeight={800}>
          {t(disconnected ? 'room.disconnectedTitle' : 'room.leftTitle')}
        </Typography>
        <Typography color="text.secondary">
          {t(disconnected ? 'room.disconnectedDescription' : 'room.leftDescription')}
        </Typography>
        {error && <Alert severity="warning">{error}</Alert>}
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} justifyContent="center">
          <ActionButton
            intent="primary"
            loading={busy}
            loadingLabel={t('room.reconnecting')}
            onClick={onRejoin}
          >
            {t('room.rejoin')}
          </ActionButton>
          <ActionButton intent="secondary" onClick={onHome}>
            {t('room.returnHome')}
          </ActionButton>
          <ActionButton intent="quiet" onClick={onHistory}>
            {t('room.viewHistory')}
          </ActionButton>
        </Stack>
      </Stack>
    </Box>
  );
}
