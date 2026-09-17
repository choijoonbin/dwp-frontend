import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import { workplaceMemberCard } from './workplace-member-surfaces';
import { WorkplaceReservationSourceStatus } from './workplace-reservation-source-status';
import { formatWorkplaceReservationUpdatedAt } from './workplace-unified-reservations-runtime';

import type { SupportedLocale } from '@dwp-frontend/shared-i18n';
import type { WorkplaceHomeSourceState } from './workplace-home-source-state';

type SourceSnapshot = Readonly<{
  state: WorkplaceHomeSourceState;
  updatedAt: number;
  retry: () => void;
}>;

export function WorkplaceReservationSourceSummary({
  workplace,
  calendar,
  locale,
  notYetVerified,
}: {
  workplace: SourceSnapshot;
  calendar: SourceSnapshot;
  locale: SupportedLocale;
  notYetVerified: string;
}) {
  const lastVerified = (updatedAt: number) =>
    formatWorkplaceReservationUpdatedAt(updatedAt, locale, notYetVerified);
  return (
    <Box sx={(theme) => ({ ...workplaceMemberCard(theme), p: 2, mb: 2 })}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        gap={1.5}
        sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}
      >
        <WorkplaceReservationSourceStatus
          authority="WORKPLACE"
          state={workplace.state}
          lastVerified={lastVerified(workplace.updatedAt)}
          onRetry={workplace.retry}
        />
        <WorkplaceReservationSourceStatus
          authority="CALENDAR"
          state={calendar.state}
          lastVerified={lastVerified(calendar.updatedAt)}
          onRetry={calendar.retry}
        />
      </Stack>
    </Box>
  );
}
