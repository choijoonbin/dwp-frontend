import { useTranslation } from 'react-i18next';
import { CalendarCheck2, CheckCircle2, Circle } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import { foundationTokens } from '@dwp-frontend/design-system/foundation';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

type FlowMeetingPrepProps = Readonly<{
  title?: string;
  route?: string;
  startsAt?: string;
}>;

/** Healthy base-preset projection; provider enrichment remains behind the Wave 4 boundary. */
export function FlowMeetingPrep({ title, route, startsAt }: FlowMeetingPrepProps) {
  const { t } = useTranslation('home');
  return (
    <Box
      component="section"
      aria-labelledby="flow-meeting-prep-title"
      data-flow-meeting-prep
      data-widget-owner="DWP Meetings"
      data-widget-source="calendar.next-event"
      data-widget-permission="APP.MEETINGS:VIEW"
      data-integration-boundary="WAVE4_PROVIDER_ENRICHMENT"
      sx={{
        p: { xs: 2, md: 2.25 },
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.home.radius.surface,
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} justifyContent="space-between">
        <Stack direction="row" gap={1.25} minWidth={0}>
          <Box
            aria-hidden="true"
            sx={{
              width: 38,
              height: 38,
              flex: '0 0 auto',
              display: 'grid',
              placeItems: 'center',
              borderRadius: foundationTokens.home.radius.card,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
            }}
          >
            <CalendarCheck2 size={20} />
          </Box>
          <Box minWidth={0}>
            <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
              <Typography
                id="flow-meeting-prep-title"
                component="h2"
                variant="subtitle1"
                fontWeight={foundationTokens.home.typography.weightEmphasis}
              >
                {t('flow.meetingPrep.title')}
              </Typography>
              <Chip
                size="small"
                color="primary"
                variant="outlined"
                label={t('flow.meetingPrep.next')}
              />
            </Stack>
            <Typography
              variant="body2"
              fontWeight={foundationTokens.home.typography.weightSemibold}
              sx={{ mt: 0.5 }}
            >
              {title ?? t('flow.meetingPrep.fallbackTitle')}
            </Typography>
            {startsAt && (
              <Typography variant="caption" color="text.secondary">
                {t('flow.meetingPrep.startsAt', { time: startsAt })}
              </Typography>
            )}
          </Box>
        </Stack>
        <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center">
          {(['agenda', 'brief', 'room'] as const).map((item, index) => (
            <Stack key={item} direction="row" alignItems="center" gap={0.5}>
              {index < 2 ? (
                <CheckCircle2 size={17} color="currentColor" aria-hidden="true" />
              ) : (
                <Circle size={17} aria-hidden="true" />
              )}
              <Typography variant="caption">{t(`flow.meetingPrep.checks.${item}`)}</Typography>
            </Stack>
          ))}
          <ActionButton
            component={route ? 'a' : 'button'}
            href={route}
            intent="secondary"
            sx={{ minHeight: 44 }}
          >
            {t('flow.meetingPrep.action')}
          </ActionButton>
        </Stack>
      </Stack>
    </Box>
  );
}
