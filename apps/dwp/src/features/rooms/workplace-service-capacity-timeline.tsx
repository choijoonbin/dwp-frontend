import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Clock3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getWorkplaceServiceCapacity } from '@dwp-frontend/shared-utils';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberSoftSurface } from './workplace-member-surfaces';

import type { WorkplaceServiceCapacityBucket } from '@dwp-frontend/shared-utils';

function bucketColor(bucket: WorkplaceServiceCapacityBucket) {
  if (!bucket.fresh) return 'warning' as const;
  if (bucket.availableQuantity === 0) return 'error' as const;
  if (bucket.availableQuantity <= Math.max(1, bucket.capacityLimit * 0.2)) {
    return 'warning' as const;
  }
  return 'success' as const;
}

export function WorkplaceServiceCapacityTimeline({
  catalogItemId,
  siteId,
  startsAt,
  endsAt,
}: {
  catalogItemId: string;
  siteId: string | null;
  startsAt: string;
  endsAt: string;
}) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const query = useQuery({
    queryKey: ['workplace', 'services', 'capacity', catalogItemId, siteId, startsAt, endsAt],
    queryFn: () => getWorkplaceServiceCapacity(catalogItemId, siteId!, startsAt, endsAt),
    enabled: Boolean(catalogItemId && siteId && startsAt && endsAt),
    retry: false,
    staleTime: 15_000,
  });
  const freshness = useMemo(() => {
    if (!query.data) return 'unknown';
    return query.data.complete && query.data.buckets.every((bucket) => bucket.fresh)
      ? 'fresh'
      : 'stale';
  }, [query.data]);

  if (!siteId) {
    return (
      <InlineFeedback severity="warning">
        {t('workplace.services.extensions.capacitySiteUnavailable')}
      </InlineFeedback>
    );
  }
  return (
    <Box
      aria-labelledby="workplace-service-capacity-heading"
      sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.25 })}
    >
      <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
        <Stack direction="row" gap={0.75} alignItems="center">
          <Activity size={17} aria-hidden="true" />
          <Typography
            id="workplace-service-capacity-heading"
            component="h4"
            variant="subtitle2"
            fontWeight="fontWeightBold"
          >
            {t('workplace.services.extensions.capacityTitle')}
          </Typography>
        </Stack>
        {query.data ? (
          <Chip
            size="small"
            color={freshness === 'fresh' ? 'success' : 'warning'}
            label={t(`workplace.services.extensions.capacityFreshness.${freshness}`)}
          />
        ) : null}
      </Stack>
      {query.isLoading ? (
        <LinearProgress aria-label={t('workplace.services.loading')} sx={{ mt: 1 }} />
      ) : null}
      {query.isError ? (
        <InlineFeedback
          severity="warning"
          action={
            <ActionButton intent="quiet" size="small" onClick={() => void query.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('workplace.services.extensions.capacityUnavailable')}
        </InlineFeedback>
      ) : null}
      {query.data ? (
        <>
          <Stack component="ol" spacing={0.75} sx={{ listStyle: 'none', p: 0, m: 0, mt: 1 }}>
            {query.data.buckets.map((bucket) => (
              <Box component="li" key={bucket.capacityBucketId}>
                <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
                  <Stack direction="row" gap={0.6} alignItems="center">
                    <Clock3 size={14} aria-hidden="true" />
                    <Typography variant="body2">
                      {formatDate(bucket.startsAt, { timeStyle: 'short' }, locale)} –{' '}
                      {formatDate(bucket.endsAt, { timeStyle: 'short' }, locale)}
                    </Typography>
                  </Stack>
                  <Chip
                    size="small"
                    color={bucketColor(bucket)}
                    label={t('workplace.services.extensions.capacityRemaining', {
                      remaining: bucket.availableQuantity,
                      total: bucket.capacityLimit,
                    })}
                  />
                </Stack>
              </Box>
            ))}
          </Stack>
          {!query.data.complete || query.data.limitations.length ? (
            <InlineFeedback severity="warning">
              {t('workplace.services.extensions.capacityLimitations', {
                limitations: query.data.limitations.join(', '),
              })}
            </InlineFeedback>
          ) : null}
          <Typography variant="caption" color="text.secondary" display="block" mt={1}>
            {t('workplace.services.extensions.capacityGeneratedAt', {
              time: formatDate(
                query.data.generatedAt,
                { dateStyle: 'medium', timeStyle: 'short' },
                locale
              ),
            })}
          </Typography>
        </>
      ) : null}
    </Box>
  );
}
