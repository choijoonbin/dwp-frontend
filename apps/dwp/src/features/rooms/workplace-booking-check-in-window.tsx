import { useTranslation } from 'react-i18next';
import { Clock3 } from 'lucide-react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberSoftSurface } from './workplace-member-surfaces';

import type { WorkplaceBooking } from '@dwp-frontend/shared-utils';

export function WorkplaceBookingCheckInWindow({
  booking,
  now,
  format,
}: {
  booking: WorkplaceBooking;
  now: number;
  format: (value: string) => string;
}) {
  const { t } = useTranslation('rooms');
  const opens = Date.parse(booking.checkInOpensAt);
  const closes = Date.parse(booking.checkInClosesAt);
  if (
    booking.status !== 'RESERVED' ||
    !Number.isFinite(opens) ||
    !Number.isFinite(closes) ||
    opens > closes
  )
    return null;
  const open = booking.canCheckIn && now >= opens && now <= closes;
  const remaining = Math.max(0, Math.ceil((closes - now) / 60_000));
  const progress =
    closes > opens ? Math.max(0, Math.min(100, ((now - opens) / (closes - opens)) * 100)) : 100;
  return (
    <Box
      data-testid={`workplace-check-in-window-${booking.bookingId}`}
      sx={(theme) => ({
        ...workplaceMemberSoftSurface(theme),
        p: 1.25,
        border: 1,
        borderColor: open ? 'primary.main' : 'divider',
      })}
    >
      <Stack direction="row" justifyContent="space-between" gap={1} flexWrap="wrap">
        <Stack direction="row" gap={0.75} alignItems="center">
          <Clock3 size={16} aria-hidden="true" />
          <Typography variant="caption" fontWeight="fontWeightBold">
            {t('workplace.member.bookings.checkInWindow')}
          </Typography>
        </Stack>
        {open ? (
          <Typography variant="caption" color="primary.main" fontWeight="fontWeightBold">
            {t('workplace.member.bookings.checkInRemaining', { count: remaining })}
          </Typography>
        ) : null}
      </Stack>
      <Typography variant="body2" sx={{ mt: 0.5 }}>
        {format(booking.checkInOpensAt)} – {format(booking.checkInClosesAt)}
      </Typography>
      {open ? (
        <Box
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('workplace.member.bookings.checkInWindow')}
          aria-valuetext={t('workplace.member.bookings.checkInRemaining', { count: remaining })}
          sx={{ mt: 1, height: 4, bgcolor: 'action.selected' }}
        >
          <Box sx={{ height: 1, width: `${progress}%`, bgcolor: 'primary.main' }} />
        </Box>
      ) : null}
    </Box>
  );
}
