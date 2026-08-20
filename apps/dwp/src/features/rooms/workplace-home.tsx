import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Building2, CalendarCheck2, LogIn, MapPinned } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ActionButton,
  EmptyState,
  LiveStatus,
  LocalErrorState,
  LoadingState,
  OperationalKpiStrip,
  PageCanvas,
  ResourcePageHeader,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { getWorkplaceBookings, getWorkplaceExplore } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

const activeBookingStates = new Set(['RESERVED', 'CHECKED_IN']);

export function WorkplaceHome() {
  const { t } = useTranslation('rooms');
  const range = useMemo(() => {
    const now = new Date();
    const availabilityEnd = new Date(now.getTime() + 60 * 60_000);
    const bookingEnd = new Date(now.getTime() + 7 * 24 * 60 * 60_000);
    return {
      from: now.toISOString(),
      availabilityEnd: availabilityEnd.toISOString(),
      bookingEnd: bookingEnd.toISOString(),
    };
  }, []);
  const query = useQuery({
    queryKey: ['workplace', 'home', range.from],
    queryFn: async () => {
      const [explore, bookings] = await Promise.all([
        getWorkplaceExplore(range.from, range.availabilityEnd),
        getWorkplaceBookings(range.from, range.bookingEnd),
      ]);
      return { explore, bookings };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
  const activeBookings = (query.data?.bookings ?? [])
    .filter((booking) => activeBookingStates.has(booking.status))
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  const checkInReady = activeBookings.filter((booking) => booking.canCheckIn);
  const occupiedIds = new Set(query.data?.explore.occupancy.map((item) => item.resourceId) ?? []);
  const availableResources = (query.data?.explore.resources ?? []).filter(
    (resource) => resource.state === 'AVAILABLE' && !occupiedIds.has(resource.resourceId)
  );
  const header = (
    <ResourcePageHeader
      eyebrow={t('workplace.home.eyebrow')}
      title={t('workplace.home.title')}
      description={t('workplace.home.description')}
      status={
        <LiveStatus
          state={query.isFetching ? 'syncing' : 'live'}
          label={t('workplace.home.live')}
          refreshLabel={t('actions.retry')}
          refreshing={query.isFetching}
          onRefresh={() => void query.refetch()}
        />
      }
    />
  );

  if (query.isLoading)
    return (
      <PageCanvas>
        {header}
        <LoadingState label={t('workplace.home.loading')} variant="skeleton" size="page" />
      </PageCanvas>
    );
  if (query.isError || !query.data)
    return (
      <PageCanvas>
        {header}
        <LocalErrorState
          title={t('workplace.home.errorTitle')}
          description={t('workplace.home.errorDescription')}
          retryLabel={t('actions.retry')}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
          size="page"
        />
      </PageCanvas>
    );

  return (
    <PageCanvas>
      {header}
      <Box sx={{ mt: 3 }}>
        <OperationalKpiStrip
          ariaLabel={t('workplace.home.summaryLabel')}
          items={[
            {
              key: 'sites',
              value: query.data.explore.sites.length,
              label: t('workplace.home.metrics.sites'),
              detail: t('workplace.home.metrics.sitesDetail'),
            },
            {
              key: 'available',
              value: availableResources.length,
              label: t('workplace.home.metrics.available'),
              detail: t('workplace.home.metrics.availableDetail'),
              tone: 'info',
            },
            {
              key: 'bookings',
              value: activeBookings.length,
              label: t('workplace.home.metrics.bookings'),
              detail: t('workplace.home.metrics.bookingsDetail'),
            },
            {
              key: 'checkIn',
              value: checkInReady.length,
              label: t('workplace.home.metrics.checkIn'),
              detail: t('workplace.home.metrics.checkInDetail'),
              tone: checkInReady.length ? 'warning' : undefined,
            },
          ]}
        />
      </Box>
      <Box component="section" aria-labelledby="workplace-home-upcoming" sx={{ mt: 4 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          gap={1.5}
        >
          <Box>
            <Typography id="workplace-home-upcoming" component="h2" variant="h6">
              {t('workplace.home.upcomingTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
              {t('workplace.home.upcomingDescription')}
            </Typography>
          </Box>
          <Stack direction="row" gap={1}>
            <ActionButton
              component={Link}
              to="/workplace/explore"
              intent="secondary"
              startIcon={<MapPinned size={16} />}
            >
              {t('workplace.home.findSpace')}
            </ActionButton>
            <ActionButton
              component={Link}
              to="/workplace/my-bookings"
              intent="quiet"
              endIcon={<ArrowRight size={16} />}
            >
              {t('workplace.home.openBookings')}
            </ActionButton>
          </Stack>
        </Stack>
        <Box sx={{ mt: 2, borderBlock: 1, borderColor: 'divider' }}>
          {activeBookings.length ? (
            activeBookings.slice(0, 5).map((booking, index) => (
              <Box key={booking.bookingId}>
                {index > 0 && <Divider />}
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', md: 'center' }}
                  gap={1.5}
                  sx={{ py: 1.7 }}
                >
                  <Stack direction="row" spacing={1.25} alignItems="flex-start" minWidth={0}>
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: 34,
                        height: 34,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: 'var(--dwp-product-soft)',
                        color: 'var(--dwp-product-accent)',
                        borderRadius: 1,
                        flexShrink: 0,
                      }}
                    >
                      {booking.canCheckIn ? <LogIn size={17} /> : <CalendarCheck2 size={17} />}
                    </Box>
                    <Box minWidth={0}>
                      <Typography variant="body2" fontWeight={800}>
                        {booking.resourceName}
                      </Typography>
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={0.6}
                        color="text.secondary"
                      >
                        <Building2 size={13} />
                        <Typography variant="caption">
                          {booking.siteName} · {booking.floorName}
                        </Typography>
                      </Stack>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
                    {booking.canCheckIn && (
                      <Chip size="small" color="warning" label={t('workplace.home.checkInReady')} />
                    )}
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(booking.startsAt, { dateStyle: 'medium', timeStyle: 'short' })}
                    </Typography>
                    <ActionButton
                      component={Link}
                      to="/workplace/my-bookings"
                      intent="quiet"
                      size="small"
                    >
                      {t('workplace.home.open')}
                    </ActionButton>
                  </Stack>
                </Stack>
              </Box>
            ))
          ) : (
            <EmptyState
              title={t('workplace.home.emptyTitle')}
              description={t('workplace.home.emptyDescription')}
              size="compact"
            />
          )}
        </Box>
      </Box>
    </PageCanvas>
  );
}
