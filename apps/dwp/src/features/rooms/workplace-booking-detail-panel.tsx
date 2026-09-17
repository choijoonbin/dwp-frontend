import { useTranslation } from 'react-i18next';
import { Clock3, MapPin, ShieldCheck } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { WorkplaceResourcePhoto } from './workplace-resource-photo';
import { WorkplaceBookingCheckInWindow } from './workplace-booking-check-in-window';

import type { WorkplaceBooking } from '@dwp-frontend/shared-utils';
import type { ReactNode } from 'react';

export function WorkplaceBookingDetailPanel({
  booking,
  format,
  now,
  actions,
}: {
  booking: WorkplaceBooking | null;
  format: (value: string) => string;
  now: number;
  actions?: ReactNode;
}) {
  const { t } = useTranslation('rooms');
  if (!booking) return null;
  return (
    <Box
      component="aside"
      aria-labelledby="workplace-booking-detail-title"
      sx={(theme) => ({
        ...workplaceMemberCard(theme),
        p: 2.5,
        alignSelf: 'start',
        display: { xs: 'none', lg: 'block' },
      })}
    >
      <Stack spacing={2}>
        <Typography variant="overline" color="primary.main">
          {t('workplace.member.bookings.detail')}
        </Typography>
        <WorkplaceResourcePhoto resourceId={booking.resourceId} alt={booking.resourceName} />
        <Box>
          <Typography id="workplace-booking-detail-title" component="h2" variant="h6">
            {booking.resourceName}
          </Typography>
          <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1 }}>
            <Chip size="small" label={t(`workplace.resourceTypes.${booking.resourceType}`)} />
            <Chip
              size="small"
              color={booking.status === 'CHECKED_IN' ? 'success' : 'default'}
              label={t(`workplace.bookingStatus.${booking.status}`)}
            />
          </Stack>
        </Box>
        <Box component="dl" sx={{ m: 0 }}>
          <Typography component="dt" variant="caption" color="text.secondary">
            {t('workplace.member.bookings.bookingId')}
          </Typography>
          <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
            {booking.bookingId}
          </Typography>
        </Box>
        <Stack spacing={1.5} sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.5 })}>
          <Stack direction="row" gap={1} alignItems="flex-start">
            <Clock3 size={17} aria-hidden="true" />
            <Typography variant="body2">
              {format(booking.startsAt)} – {format(booking.endsAt)}
            </Typography>
          </Stack>
          <Stack direction="row" gap={1} alignItems="flex-start">
            <MapPin size={17} aria-hidden="true" />
            <Typography variant="body2">
              {booking.siteName} · {booking.floorName}
            </Typography>
          </Stack>
        </Stack>
        <WorkplaceBookingCheckInWindow booking={booking} now={now} format={format} />
        {actions ? (
          <Box
            sx={{
              pt: 2,
              borderTop: 1,
              borderColor: 'divider',
              '& .MuiButton-root': { minHeight: 44 },
            }}
          >
            {actions}
          </Box>
        ) : null}
        {booking.purpose && (
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {booking.purpose}
          </Typography>
        )}
        <Stack direction="row" gap={1} alignItems="flex-start" color="text.secondary">
          <ShieldCheck size={17} aria-hidden="true" />
          <Typography variant="caption">{t('workplace.explore.policyApplied')}</Typography>
        </Stack>
      </Stack>
    </Box>
  );
}
