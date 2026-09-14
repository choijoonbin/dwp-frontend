import { useTranslation } from 'react-i18next';
import { foundationTokens, InlineFeedback } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { workplaceMemberSoftSurface } from './workplace-member-surfaces';
import {
  workplaceResourceWindowFacts,
  type WorkplaceResourceWindowContext,
} from './workplace-resource-window-facts';
import type { WorkplaceResource } from '@dwp-frontend/shared-utils';

export function WorkplaceResourceWindowSummary({
  resource,
  context,
  timeZone,
}: {
  resource: WorkplaceResource;
  context?: WorkplaceResourceWindowContext;
  timeZone?: string;
}) {
  const { t } = useTranslation('rooms');
  const facts = workplaceResourceWindowFacts(resource, context);
  if (!facts || !timeZone)
    return (
      <InlineFeedback severity="info">
        {t('workplace.explore.nativeDetailsUnavailable')}
      </InlineFeedback>
    );
  const labels = {
    RESERVED: t('workplace.explore.anonymousReservation'),
    UNRESERVED: t('workplace.explore.unreservedInterval'),
    CLOSED: t('workplace.explore.closureInterval'),
  };
  const colors = {
    RESERVED: 'action.disabledBackground',
    UNRESERVED: 'primary.main',
    CLOSED: 'warning.main',
  };
  const duration = Date.parse(facts.endsAt) - Date.parse(facts.startsAt);
  const time = (value: string) =>
    formatDate(value, { timeStyle: 'short', hourCycle: 'h23', timeZone });
  return (
    <Stack spacing={1.5} data-testid="workplace-resource-window-summary">
      <Box component="section" sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.5 })}>
        <Typography
          component="h3"
          sx={{ ...foundationTokens.workplace.typography.cardTitle, fontWeight: 'fontWeightBold' }}
        >
          {t('workplace.explore.selectedWindowTimeline')}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.75 }}>
          {formatDate(facts.startsAt, { dateStyle: 'medium', timeZone })} · {time(facts.startsAt)}–
          {time(facts.endsAt)}
        </Typography>
        <Box
          aria-hidden="true"
          sx={{
            display: 'flex',
            height: 16,
            my: 1,
            overflow: 'hidden',
            borderRadius: foundationTokens.radius.compact + 'px',
          }}
        >
          {facts.segments.map((segment) => (
            <Box
              key={segment.startsAt}
              sx={{
                width: `${((Date.parse(segment.endsAt) - Date.parse(segment.startsAt)) / duration) * 100}%`,
                bgcolor: colors[segment.kind],
                borderRight: 1,
                borderColor: 'background.paper',
              }}
            />
          ))}
        </Box>
        <Stack component="ul" spacing={0.5} sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {facts.segments.map((segment) => (
            <Stack
              component="li"
              key={segment.startsAt}
              direction="row"
              alignItems="baseline"
              justifyContent="space-between"
              gap={1}
            >
              <Typography
                variant="caption"
                sx={{ ...foundationTokens.workplace.typography.caption, minWidth: 0 }}
              >
                {labels[segment.kind]}
              </Typography>
              <Typography
                variant="caption"
                sx={{ ...foundationTokens.workplace.typography.caption, flexShrink: 0 }}
              >
                {time(segment.startsAt)}–{time(segment.endsAt)}
              </Typography>
            </Stack>
          ))}
        </Stack>
        <Typography
          color="text.secondary"
          sx={{ ...foundationTokens.workplace.typography.caption, mt: 1 }}
        >
          {t('workplace.explore.timelineNotice')}
        </Typography>
      </Box>
      {facts.policy ? (
        <InlineFeedback severity="info" title={t('workplace.explore.policyTitle')}>
          {facts.policy.requireCheckIn
            ? t('workplace.booking.autoReleaseSummary', {
                lead: facts.policy.checkInLeadMinutes,
                release: facts.policy.autoReleaseMinutes,
              })
            : t('workplace.explore.checkInNotRequired')}
        </InlineFeedback>
      ) : null}
    </Stack>
  );
}
