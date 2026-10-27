import { useTranslation } from 'react-i18next';
import { FilterBar, SelectField } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';

import { workplaceMemberCard } from './workplace-member-surfaces';
import {
  WORKPLACE_RESERVATION_AUTHORITIES,
  WORKPLACE_RESERVATION_PERIODS,
  WORKPLACE_RESERVATION_STATUSES,
  WORKPLACE_RESERVATION_TYPES,
  type parseWorkplaceReservationsUrl,
  type WorkplaceReservationsUrlPatch,
} from './workplace-reservations-url-state';

export function WorkplaceReservationsFilters({
  state,
  resultCount,
  onReset,
  onUpdate,
}: {
  state: ReturnType<typeof parseWorkplaceReservationsUrl>['state'];
  resultCount: number;
  onReset: () => void;
  onUpdate: (patch: WorkplaceReservationsUrlPatch) => void;
}) {
  const { t } = useTranslation('rooms');
  return (
    <Box
      data-testid="workplace-reservations-filters"
      sx={(theme) => ({ ...workplaceMemberCard(theme), p: 2, mb: 2 })}
    >
      <FilterBar
        ariaLabel={t('workplace.reservations.filters.label')}
        searchLabel={t('workplace.reservations.filters.search')}
        searchValue={state.query}
        onSearchChange={(value) => onUpdate({ q: value, reservation: null })}
        searchPlaceholder={t('workplace.reservations.filters.searchPlaceholder')}
        resetLabel={t('actions.onReset')}
        onReset={onReset}
        resultLabel={t('workplace.reservations.resultCount', { count: resultCount })}
        filters={
          <>
            <SelectField
              size="small"
              fullWidth={false}
              label={t('workplace.reservations.filters.period')}
              value={state.period}
              options={WORKPLACE_RESERVATION_PERIODS.map((value) => ({
                value,
                label: t(`workplace.reservations.periods.${value}`),
              }))}
              onValueChange={(value) =>
                value && onUpdate({ period: value, reservation: null, reservationAuthority: null })
              }
              sx={{ width: { xs: 1, sm: 140 } }}
            />
            <SelectField
              size="small"
              fullWidth={false}
              label={t('workplace.reservations.filters.type')}
              value={state.type}
              options={WORKPLACE_RESERVATION_TYPES.map((value) => ({
                value,
                label: t(`workplace.reservations.types.${value}`),
              }))}
              onValueChange={(value) =>
                value && onUpdate({ types: value, reservation: null, reservationAuthority: null })
              }
              sx={{ width: { xs: 1, sm: 150 } }}
            />
            <SelectField
              size="small"
              fullWidth={false}
              label={t('workplace.reservations.filters.status')}
              value={state.status}
              options={WORKPLACE_RESERVATION_STATUSES.map((value) => ({
                value,
                label: t(`workplace.reservations.statuses.${value}`),
              }))}
              onValueChange={(value) =>
                value && onUpdate({ status: value, reservation: null, reservationAuthority: null })
              }
              sx={{ width: { xs: 1, sm: 150 } }}
            />
            <SelectField
              size="small"
              fullWidth={false}
              label={t('workplace.reservations.filters.authority')}
              value={state.authority}
              options={WORKPLACE_RESERVATION_AUTHORITIES.map((value) => ({
                value,
                label: t(`workplace.reservations.authorities.${value}`),
              }))}
              onValueChange={(value) =>
                value &&
                onUpdate({ authority: value, reservation: null, reservationAuthority: null })
              }
              sx={{ width: { xs: 1, sm: 160 } }}
            />
          </>
        }
      />
    </Box>
  );
}
