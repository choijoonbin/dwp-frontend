import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowRight, LockKeyhole, MapPin } from 'lucide-react';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
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
      version: booking.version,
      features: [] as string[],
    },
    ...(resource
      ? [
          {
            title: t('workplace.member.bookings.requestedReservation'),
            name: resource.name,
            location: [siteName, floorName, resource.neighborhood].filter(Boolean).join(' · '),
            from: startsAt,
            to: endsAt,
            version: resource.version,
            features: resource.features.slice(0, 3),
          },
        ]
      : []),
  ];
  return (
    <Box
      data-testid="workplace-relocation-comparison"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto minmax(0, 1fr)' },
        alignItems: 'stretch',
        gap: 1,
      }}
    >
      {details.map((detail, index) => (
        <Fragment key={detail.title}>
          {index === 1 ? (
            <Box
              aria-hidden="true"
              sx={{
                display: 'grid',
                placeItems: 'center',
                color: 'primary.main',
                minHeight: { xs: 28, sm: 'auto' },
              }}
            >
              <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                <ArrowDown size={20} />
              </Box>
              <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                <ArrowRight size={20} />
              </Box>
            </Box>
          ) : null}
          <Stack
            spacing={0.75}
            sx={(theme) => ({
              ...workplaceMemberSoftSurface(theme),
              p: 1.5,
              border: 1,
              borderColor: index === 1 ? 'primary.main' : 'divider',
              borderLeftWidth: index === 1 ? 3 : 1,
              minWidth: 0,
            })}
          >
            <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
              <Typography variant="caption" color="primary.main" fontWeight="fontWeightBold">
                {detail.title}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                icon={index === 0 ? <LockKeyhole size={13} /> : undefined}
                label={`${t('workplace.experience.version')} ${detail.version}`}
              />
            </Stack>
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
            {detail.features.length ? (
              <Stack direction="row" gap={0.5} useFlexGap flexWrap="wrap">
                {detail.features.map((feature) => (
                  <Chip
                    key={feature}
                    size="small"
                    label={t(`features.${feature}`, { defaultValue: feature })}
                  />
                ))}
              </Stack>
            ) : null}
          </Stack>
        </Fragment>
      ))}
    </Box>
  );
}
