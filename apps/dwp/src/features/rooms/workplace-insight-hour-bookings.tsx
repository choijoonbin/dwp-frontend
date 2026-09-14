import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ActionButton,
  EmptyState,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';
import { getWorkplaceAdminBookings } from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { WorkplaceAdminSection } from './workplace-admin-experience-ui';
import { WorkplaceExperienceBookingInspector } from './workplace-experience-booking-inspector';
import { useWorkplaceExperienceAuthority } from './workplace-experience-authority';
import { formatWorkplaceExperienceInstant } from './workplace-experience-format';
import { WorkplaceExperienceQueryError } from './workplace-experience-ui';
import type {
  WorkplaceAdminBookingPage,
  WorkplaceExperienceReport,
} from '@dwp-frontend/shared-utils';

type Hour = WorkplaceExperienceReport['hourlyHeatmap'][number];
const pageSize = 20;
const uuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/iu;

/** Validate the entire source page before revealing even its count or target IDs. */
function matchesHour(
  data: WorkplaceAdminBookingPage,
  siteId: string,
  floorId: string | undefined,
  hour: Hour,
  page: number
) {
  if (!data || typeof data !== 'object') return false;
  const from = Date.parse(hour.startsAt);
  const to = Date.parse(hour.endsAt);
  return (
    Array.isArray(data.content) &&
    Number.isFinite(from) &&
    Number.isFinite(to) &&
    from < to &&
    data.page === page &&
    data.size === pageSize &&
    Number.isSafeInteger(data.totalElements) &&
    data.totalElements >= 0 &&
    Number.isSafeInteger(data.totalPages) &&
    data.totalPages === Math.ceil(data.totalElements / pageSize) &&
    (page === 0 || page < data.totalPages) &&
    data.content.length === Math.min(pageSize, Math.max(0, data.totalElements - page * pageSize)) &&
    new Set(data.content.map((row) => row?.bookingId)).size === data.content.length &&
    data.content.every((row) => {
      if (!row || typeof row !== 'object') return false;
      const starts = Date.parse(row.startsAt);
      const ends = Date.parse(row.endsAt);
      return (
        uuid.test(row.bookingId) &&
        uuid.test(row.resourceId) &&
        Boolean(row.siteId && uuid.test(row.siteId)) &&
        Boolean(row.floorId && uuid.test(row.floorId)) &&
        row.siteId === siteId &&
        (!floorId || row.floorId === floorId) &&
        Number.isFinite(starts) &&
        Number.isFinite(ends) &&
        starts < ends &&
        starts < to &&
        ends > from
      );
    })
  );
}

export function WorkplaceInsightHourBookings({
  siteId,
  floorId,
  hour,
  reportGeneratedAt,
  timeZone,
  enabled,
}: {
  siteId: string;
  floorId?: string;
  hour: Hour;
  reportGeneratedAt: string;
  timeZone: string;
  enabled: boolean;
}) {
  const { t } = useTranslation('rooms');
  const authority = useWorkplaceExperienceAuthority();
  const context = JSON.stringify([authority, siteId, floorId, hour.startsAt, hour.endsAt]);
  const [paging, setPaging] = useState({ context: '', page: 0 });
  const [review, setReview] = useState<{ context: string; bookingId: string } | null>(null);
  useEffect(() => {
    setPaging({ context, page: 0 });
    setReview(null);
  }, [context]);
  const page = paging.context === context ? paging.page : 0;
  const reader = useQuery({
    queryKey: ['workplace', 'insight-hour-bookings', context, page],
    queryFn: () =>
      getWorkplaceAdminBookings(hour.startsAt, hour.endsAt, {
        siteId,
        floorId,
        page,
        size: pageSize,
      }),
    enabled: enabled && uuid.test(siteId) && (!floorId || uuid.test(floorId)),
    staleTime: 0,
    retry: false,
  });
  const mismatch = reader.isSuccess && !matchesHour(reader.data, siteId, floorId, hour, page);
  const data = enabled && !reader.isError && !mismatch ? reader.data : undefined;
  const rows = data?.content.filter((row) => row.resourceType !== 'ROOM') ?? [];
  const bookingId =
    !reader.isFetching &&
    data &&
    review?.context === context &&
    rows.some((row) => row.bookingId === review.bookingId)
      ? review.bookingId
      : null;
  const refresh = () => {
    setReview(null);
    void reader.refetch();
  };
  return (
    <Box id="workplace-insight-hour-bookings" tabIndex={-1} sx={{ scrollMarginTop: 100 }}>
      <WorkplaceAdminSection
        title={t('workplace.experience.polish.hourBookingsTitle')}
        description={`${formatWorkplaceExperienceInstant(hour.startsAt, timeZone)} – ${formatWorkplaceExperienceInstant(hour.endsAt, timeZone)}`}
        actions={
          <ActionButton
            intent="secondary"
            disabled={reader.isFetching || !enabled}
            onClick={refresh}
          >
            {t('workplace.experience.refresh')}
          </ActionButton>
        }
      >
        <Stack gap={1.5}>
          <InlineFeedback severity="info">
            {t('workplace.experience.polish.hourBookingsCohort')}
          </InlineFeedback>
          <Typography variant="caption" color="text.secondary">
            {t('workplace.experience.polish.hourBookingsAuthority')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('workplace.experience.polish.hourBookingsSnapshot', {
              at: formatWorkplaceExperienceInstant(reportGeneratedAt, timeZone),
            })}
          </Typography>
          {!enabled ? (
            <InlineFeedback severity="info">
              {t('workplace.experience.floorScope.globalReaderUnavailable')}
            </InlineFeedback>
          ) : null}
          {reader.isLoading ? (
            <LoadingState
              embedded
              variant="skeleton"
              skeletonRows={2}
              label={t('workplace.experience.refreshing')}
            />
          ) : reader.isError || mismatch ? (
            <WorkplaceExperienceQueryError retry={refresh} />
          ) : data ? (
            <>
              <Typography variant="caption">
                {t('workplace.experience.polish.hourBookingsTotal', { count: data.totalElements })}
              </Typography>
              {data.content.length !== rows.length ? (
                <Typography variant="caption" color="text.secondary">
                  {t('workplace.experience.polish.hourBookingsRoomRows', {
                    count: data.content.length - rows.length,
                  })}
                </Typography>
              ) : null}
              {rows.length ? (
                <Stack component="ul" gap={1} sx={{ listStyle: 'none', p: 0, m: 0 }}>
                  {rows.map((row) => (
                    <Box
                      component="li"
                      key={row.bookingId}
                      sx={{ minWidth: 0, bgcolor: 'var(--dwp-product-soft)', p: 1.5 }}
                    >
                      <Stack direction="row" justifyContent="space-between" gap={1} flexWrap="wrap">
                        <Typography variant="body2" fontWeight="fontWeightBold">
                          {row.resourceName}
                        </Typography>
                        <Chip size="small" label={t(`workplace.bookingStatus.${row.status}`)} />
                      </Stack>
                      <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                        {formatWorkplaceExperienceInstant(row.startsAt, timeZone)} –{' '}
                        {formatWorkplaceExperienceInstant(row.endsAt, timeZone)}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', overflowWrap: 'anywhere' }}
                      >
                        {row.bookingId}
                      </Typography>
                      {row.status === 'CANCELLED' || row.status === 'NO_SHOW' ? (
                        <Typography variant="caption" color="text.secondary">
                          {t('workplace.experience.polish.hourBookingsNotContributing')}
                        </Typography>
                      ) : null}
                      <ActionButton
                        intent="secondary"
                        disabled={reader.isFetching}
                        sx={{ mt: 1 }}
                        onClick={() => setReview({ context, bookingId: row.bookingId })}
                      >
                        {t('workplace.experience.review')}
                      </ActionButton>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <EmptyState title={t('workplace.experience.polish.hourBookingsNoRows')} />
              )}
              <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                <ActionButton
                  intent="quiet"
                  disabled={page === 0 || reader.isFetching}
                  onClick={() => {
                    setReview(null);
                    setPaging({ context, page: page - 1 });
                  }}
                >
                  {t('workplace.experience.previous')}
                </ActionButton>
                <Typography variant="caption">
                  {t('workplace.experience.polish.hourBookingsPage', {
                    page: page + 1,
                    count: Math.max(1, data.totalPages),
                  })}
                </Typography>
                <ActionButton
                  intent="quiet"
                  disabled={page + 1 >= data.totalPages || reader.isFetching}
                  onClick={() => {
                    setReview(null);
                    setPaging({ context, page: page + 1 });
                  }}
                >
                  {t('workplace.experience.next')}
                </ActionButton>
              </Stack>
            </>
          ) : null}
        </Stack>
      </WorkplaceAdminSection>
      {bookingId ? (
        <WorkplaceExperienceBookingInspector
          key={`${context}:${page}`}
          siteId={siteId}
          bookingId={bookingId}
          timeZone={timeZone}
          onClose={() => setReview(null)}
        />
      ) : null}
    </Box>
  );
}
