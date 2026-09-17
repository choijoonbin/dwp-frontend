import { ArrowRight, CalendarClock, Leaf, LockKeyhole, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { InlineFeedback } from '@dwp-frontend/design-system';
import {
  formatDate,
  formatNumber,
  resolveSupportedLocale,
  type SupportedLocale,
} from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';

import type { WorkplaceResource } from '@dwp-frontend/shared-utils';
import type {
  WorkplacePlanningBookingImpact,
  WorkplacePlanningScenarioPreview,
} from '@dwp-frontend/shared-utils/api/workplace-planning-contract';

function formatInstant(value: string, locale: SupportedLocale, timeZone: string) {
  return formatDate(value, { dateStyle: 'medium', timeStyle: 'short', timeZone }, locale);
}

function ComparisonValue({
  label,
  current,
  proposed,
}: {
  label: string;
  current: number | null;
  proposed: number | null;
}) {
  const { i18n } = useTranslation();
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const format = (value: number | null) => (value === null ? '—' : formatNumber(value, {}, locale));
  return (
    <Box sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.25, minWidth: 0 })}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Stack direction="row" alignItems="center" gap={0.75} mt={0.5}>
        <Typography variant="subtitle1" fontWeight={700}>
          {format(current)}
        </Typography>
        <ArrowRight size={15} aria-hidden="true" />
        <Typography variant="subtitle1" fontWeight={800} color="primary.main">
          {format(proposed)}
        </Typography>
      </Stack>
    </Box>
  );
}

export function WorkplaceSpacePlanningComparison({
  preview,
  locale,
  timeZone,
}: {
  preview: WorkplacePlanningScenarioPreview;
  locale: SupportedLocale;
  timeZone: string;
}) {
  const { t } = useTranslation('rooms');
  const comparison = preview.comparison;
  return (
    <Box
      component="section"
      aria-labelledby="space-planning-comparison-title"
      data-testid="space-planning-comparison"
      sx={workplaceMemberCard}
    >
      <Box p={{ xs: 1.5, md: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
          <Box>
            <Typography
              id="space-planning-comparison-title"
              component="h3"
              variant="subtitle1"
              fontWeight={780}
            >
              {t('workplace.spacePlanning.comparison.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('workplace.spacePlanning.comparison.description')}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {t('workplace.spacePlanning.comparison.validity', {
                value: `${formatInstant(preview.expiresAt, locale, timeZone)} · ${timeZone}`,
              })}
            </Typography>
          </Box>
          <Chip
            size="small"
            color={preview.eligible ? 'success' : 'warning'}
            label={
              preview.eligible
                ? t('workplace.spacePlanning.comparison.eligible')
                : t('workplace.spacePlanning.comparison.ineligible')
            }
          />
        </Stack>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(3, minmax(0, 1fr))',
            },
            gap: 1,
            mt: 1.5,
          }}
        >
          <ComparisonValue
            label={t('workplace.spacePlanning.comparison.capacity')}
            current={comparison.currentCapacity}
            proposed={comparison.proposedCapacity}
          />
          <ComparisonValue
            label={t('workplace.spacePlanning.comparison.roomCapacity')}
            current={comparison.currentRoomCapacity}
            proposed={comparison.proposedRoomCapacity}
          />
          <ComparisonValue
            label={t('workplace.spacePlanning.comparison.accessible')}
            current={comparison.currentAccessibleResourceCount}
            proposed={comparison.proposedAccessibleResourceCount}
          />
          <ComparisonValue
            label={t('workplace.spacePlanning.comparison.utilization')}
            current={comparison.currentUtilizationPercent}
            proposed={comparison.proposedUtilizationPercent}
          />
          <ComparisonValue
            label={t('workplace.spacePlanning.comparison.excess')}
            current={comparison.currentExcessDemand}
            proposed={comparison.proposedExcessDemand}
          />
          <ComparisonValue
            label={t('workplace.spacePlanning.comparison.bookings')}
            current={null}
            proposed={comparison.impactedBookingCount}
          />
        </Box>
        {preview.limitations.length ? (
          <InlineFeedback severity="warning" icon={<TriangleAlert size={17} />}>
            {preview.limitations.join(' · ')}
          </InlineFeedback>
        ) : null}
        {preview.emission ? (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            gap={1}
            mt={1.5}
            p={1.25}
            border="1px solid"
            borderColor="divider"
            borderRadius={2}
          >
            <Leaf size={18} color="var(--dwp-product-accent)" aria-hidden="true" />
            <Typography variant="body2">
              {t('workplace.spacePlanning.comparison.emissionEvidence', {
                energy: preview.emission.energyValue,
                energyUnit: preview.emission.energyUnit,
                co2e: preview.emission.co2eValue,
                co2eUnit: preview.emission.co2eUnit,
                factor: preview.emission.factorVersion,
                region: preview.emission.regionCode,
                evidence: preview.emission.evidenceReference,
              })}
            </Typography>
          </Stack>
        ) : null}
      </Box>
    </Box>
  );
}

function reference(value: string) {
  return value.slice(-8).toUpperCase();
}

export function WorkplaceSpacePlanningBookingImpact({
  impact,
  resources,
  locale,
  timeZone,
}: {
  impact: WorkplacePlanningBookingImpact;
  resources: readonly WorkplaceResource[];
  locale: SupportedLocale;
  timeZone: string;
}) {
  const { t } = useTranslation('rooms');
  const resourcesById = new Map(resources.map((resource) => [resource.resourceId, resource]));
  return (
    <Box
      component="section"
      aria-labelledby="space-planning-booking-impact-title"
      data-testid="space-planning-booking-impact"
      sx={workplaceMemberCard}
    >
      <Box p={{ xs: 1.5, md: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
          <Box>
            <Typography
              id="space-planning-booking-impact-title"
              component="h3"
              variant="subtitle1"
              fontWeight={780}
            >
              {t('workplace.spacePlanning.impact.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('workplace.spacePlanning.impact.description')}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {t('workplace.spacePlanning.impact.expiresAt', {
                value: formatInstant(impact.expiresAt, locale, timeZone),
                timeZone,
              })}
            </Typography>
          </Box>
          <Chip
            size="small"
            color={impact.state === 'READY' ? 'success' : 'warning'}
            label={t(`workplace.spacePlanning.impact.states.${impact.state}`)}
          />
        </Stack>
        <InlineFeedback severity="info" icon={<LockKeyhole size={17} />}>
          {t('workplace.spacePlanning.impact.noAutomaticMove')}
        </InlineFeedback>
        {impact.state === 'READY' ? (
          <Stack gap={1} mt={1.5}>
            <Typography variant="body2" fontWeight={700}>
              {t('workplace.spacePlanning.impact.count', {
                count: impact.impactedBookingCount ?? 0,
              })}
            </Typography>
            {impact.bookings.map((booking) => {
              const resource = resourcesById.get(booking.resourceId);
              return (
                <Box
                  key={booking.bookingId}
                  role="group"
                  aria-label={`${resource?.name ?? reference(booking.resourceId)} · ${reference(
                    booking.bookingId
                  )} · ${booking.bookingStatus}`}
                  sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.25 })}
                >
                  <Stack
                    direction="row"
                    gap={1}
                    justifyContent="space-between"
                    alignItems="flex-start"
                  >
                    <Box minWidth={0}>
                      <Typography
                        variant="body2"
                        fontWeight={750}
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {resource?.name ?? t('workplace.spacePlanning.impact.resourceUnavailable')}{' '}
                        ·{' '}
                        {t('workplace.spacePlanning.impact.bookingReference', {
                          value: reference(booking.bookingId),
                        })}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        <CalendarClock
                          size={13}
                          aria-hidden="true"
                          style={{ verticalAlign: '-2px' }}
                        />{' '}
                        {formatInstant(booking.startsAt, locale, timeZone)} –{' '}
                        {formatInstant(booking.endsAt, locale, timeZone)} · {timeZone}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {booking.impactReason}
                      </Typography>
                    </Box>
                    <Chip size="small" variant="outlined" label={booking.bookingStatus} />
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        ) : (
          <InlineFeedback severity="warning">
            {impact.limitations.length
              ? impact.limitations.join(' · ')
              : t('workplace.spacePlanning.impact.unavailable')}
          </InlineFeedback>
        )}
      </Box>
    </Box>
  );
}
