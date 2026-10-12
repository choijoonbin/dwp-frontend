import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberCard } from './workplace-member-surfaces';

import type { WorkplaceBooking } from '@dwp-frontend/shared-utils';
import type { SupportedLocale } from '@dwp-frontend/shared-i18n';

export function WorkplaceReservationsNextAction({
  booking,
  busy,
  locale,
  onCheckIn,
}: {
  booking: WorkplaceBooking | undefined;
  busy: boolean;
  locale: SupportedLocale;
  onCheckIn: (booking: WorkplaceBooking) => void;
}) {
  const { t } = useTranslation('rooms');
  if (!booking) return null;
  return (
    <Box
      data-testid="workplace-reservations-next-action"
      sx={(theme) => ({
        ...workplaceMemberCard(theme),
        p: { xs: 2, md: 2.5 },
        mb: 2,
        borderColor: 'error.light',
      })}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between">
        <Box minWidth={0}>
          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
            <Chip size="small" color="error" label={t('workplace.reservations.checkInDue')} />
            <Typography component="h2" variant="h6">
              {booking.resourceName}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            {formatDate(
              booking.checkInClosesAt,
              { dateStyle: 'medium', timeStyle: 'short' },
              locale
            )}{' '}
            · {booking.siteName} · {booking.floorName}
          </Typography>
        </Box>
        <ActionButton
          intent="primary"
          startIcon={<CheckCircle2 size={17} />}
          loading={busy}
          onClick={() => onCheckIn(booking)}
        >
          {t('workplace.reservations.actions.checkIn')}
        </ActionButton>
      </Stack>
    </Box>
  );
}
