import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { workplaceMemberSoftSurface } from './workplace-member-surfaces';

import type { WorkplaceBooking, WorkplaceResource } from '@dwp-frontend/shared-utils';

export function WorkplaceRelocationComparison({
  booking,
  resource,
  siteName,
  floorName,
  startsAt,
  endsAt,
  timeZone,
}: {
  booking: WorkplaceBooking;
  resource: WorkplaceResource | null;
  siteName: string;
  floorName: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
}) {
  const { t, i18n } = useTranslation('rooms');
  const format = (value: string) =>
    formatDate(
      value,
      { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone },
      resolveSupportedLocale(i18n.resolvedLanguage)
    );
  const details = [
    {
      title: t('workplace.member.bookings.currentReservation'),
      name: booking.resourceName,
      location: `${booking.siteName} · ${booking.floorName}`,
      from: booking.startsAt,
      to: booking.endsAt,
    },
    ...(resource
      ? [
          {
            title: t('workplace.member.bookings.requestedReservation'),
            name: resource.name,
            location: [siteName, floorName, resource.neighborhood].filter(Boolean).join(' · '),
            from: startsAt,
            to: endsAt,
          },
        ]
      : []),
  ];
  return (
    <Box
      data-testid="workplace-relocation-comparison"
      sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25 }}
    >
      {details.map((detail) => (
        <Stack
          key={detail.title}
          spacing={0.75}
          sx={(theme) => ({
            ...workplaceMemberSoftSurface(theme),
            p: 1.5,
            border: 1,
            borderColor: 'divider',
            minWidth: 0,
          })}
        >
          <Typography variant="caption" color="primary.main" fontWeight="fontWeightBold">
            {detail.title}
          </Typography>
          <Typography variant="subtitle1" fontWeight="fontWeightBold">
            {detail.name}
          </Typography>
          <Stack direction="row" gap={0.75} alignItems="flex-start">
            <MapPin size={15} aria-hidden="true" />
            <Typography variant="body2">{detail.location}</Typography>
          </Stack>
          <Typography variant="body2">
            {format(detail.from)} – {format(detail.to)}
          </Typography>
        </Stack>
      ))}
    </Box>
  );
}
