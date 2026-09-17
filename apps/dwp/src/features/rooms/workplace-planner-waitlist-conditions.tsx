import { useTranslation } from 'react-i18next';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';

import type { WorkplaceWaitlistConditions } from '@dwp-frontend/shared-utils';

export function WorkplacePlannerWaitlistConditions({
  conditions,
  timeZone,
}: {
  conditions: WorkplaceWaitlistConditions;
  timeZone: string;
}) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage ?? i18n.language);
  const price =
    conditions.pricingMode === 'NOT_APPLICABLE'
      ? t('workplace.planner.waitlist.priceNotApplicable')
      : conditions.maximumPrice !== null && conditions.currency
        ? t('workplace.planner.waitlist.maximumPrice', {
            value: conditions.maximumPrice,
            currency: conditions.currency,
          })
        : t('workplace.planner.waitlist.priceUnavailable');
  const start = conditions.earliestStart
    ? formatDate(
        conditions.earliestStart,
        { dateStyle: 'medium', timeStyle: 'short', timeZone },
        locale
      )
    : t('workplace.planner.waitlist.openBoundary');
  const end = conditions.latestEnd
    ? formatDate(conditions.latestEnd, { timeStyle: 'short', timeZone }, locale)
    : t('workplace.planner.waitlist.openBoundary');
  return (
    <Stack
      data-testid="workplace-planner-waitlist-conditions"
      direction="row"
      gap={0.5}
      flexWrap="wrap"
      mt={0.75}
    >
      <Chip
        size="small"
        variant="outlined"
        label={
          conditions.maximumDistanceMeters === null
            ? t('workplace.planner.waitlist.distanceNotSpecified')
            : t('workplace.planner.waitlist.maximumDistance', {
                value: conditions.maximumDistanceMeters,
              })
        }
      />
      {(conditions.earliestStart || conditions.latestEnd) && (
        <Chip
          size="small"
          variant="outlined"
          label={t('workplace.planner.waitlist.timeWindow', {
            start,
            end,
          })}
        />
      )}
      <Chip
        size="small"
        color={conditions.pricingMode === 'NOT_APPLICABLE' ? 'default' : 'primary'}
        variant="outlined"
        label={price}
      />
    </Stack>
  );
}
