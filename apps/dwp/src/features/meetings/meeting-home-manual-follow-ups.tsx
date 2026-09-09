import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ActionButton } from '@dwp-frontend/design-system';
import { ArrowRight, ClipboardPenLine } from 'lucide-react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { MeetingHomeManualOutcome } from './meeting-home-manual-outcomes-model';
import { meetingHomeCard } from './meeting-home-presentation';

export function MeetingHomeManualFollowUps({
  outcomes,
}: {
  outcomes: readonly MeetingHomeManualOutcome[];
}) {
  const { t } = useTranslation('meetings');
  const navigate = useNavigate();
  const entries = outcomes.filter((outcome) => outcome.followUp).slice(0, 1);
  if (!entries.length) return null;
  return (
    <Stack gap={1.25} data-testid="meeting-home-manual-follow-ups">
      {entries.map((entry) => (
        <Box
          component="article"
          key={entry.meetingId}
          sx={(theme) => ({ ...meetingHomeCard(theme), p: { xs: 1.25, md: 1.75 } })}
        >
          <Stack direction="row" alignItems="center" gap={0.75}>
            <ClipboardPenLine size={16} aria-hidden="true" />
            <Chip
              size="small"
              variant="outlined"
              color="warning"
              label={t('home.manual.followUpBadge')}
            />
          </Stack>
          <Typography
            component="h3"
            variant="subtitle2"
            sx={{
              mt: 0.75,
              overflowWrap: 'anywhere',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {entry.followUp!.action}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            component="p"
            sx={{
              mt: 0.5,
              mb: 0,
              overflowWrap: 'anywhere',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {t('home.manual.followUpDescription', { title: entry.meetingTitle })}
          </Typography>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
            sx={{ mt: 0.5 }}
          >
            <Typography variant="caption" color="warning.main" sx={{ overflowWrap: 'anywhere' }}>
              {entry.followUp!.dueInDays == null
                ? t('home.manual.noDue')
                : t('home.manual.dueInDays', { count: entry.followUp!.dueInDays })}
            </Typography>
            <ActionButton
              intent="quiet"
              size="small"
              endIcon={<ArrowRight size={15} aria-hidden="true" />}
              onClick={() =>
                navigate(`/meetings/history?meeting=${encodeURIComponent(entry.meetingId)}`)
              }
              sx={{ minHeight: 44, flexShrink: 0 }}
            >
              {t('home.manual.openMeeting')}
            </ActionButton>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}
