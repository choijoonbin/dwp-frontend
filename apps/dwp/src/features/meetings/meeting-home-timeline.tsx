import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarClock, ShieldCheck, UsersRound } from 'lucide-react';
import {
  ActionButton,
  foundationTokens,
  GuidedEmptyState,
  SectionHeader,
} from '@dwp-frontend/design-system';
import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { homeMeetingDate, homeMeetingPath } from './meeting-home-model';
import { meetingPreparationPath } from './meeting-context-routing';
import { meetingListSurface } from './meeting-visual-system';

export function MeetingHomeTimeline({
  meetings,
  timeZone,
  disabled,
}: {
  meetings: VideoMeetingSummary[];
  timeZone: string;
  disabled: boolean;
}) {
  const { t, i18n } = useTranslation('meetings');
  const navigate = useNavigate();
  return (
    <Box
      component="section"
      aria-labelledby="meeting-today-title"
      data-testid="meeting-home-timeline"
      sx={{ minWidth: 0 }}
    >
      <SectionHeader
        density="compact"
        glyph="plain"
        id="meeting-today-title"
        icon={CalendarClock}
        title={t('home.today.title')}
        meta={
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Chip
              size="small"
              label={t('home.workspace.timelineCount', { count: meetings.length })}
            />
            <ActionButton
              intent="quiet"
              size="small"
              onClick={() => navigate('/meetings/mine')}
              endIcon={<ArrowRight size={14} aria-hidden="true" />}
              sx={{ minHeight: 44 }}
            >
              {t('actions.viewAll')}
            </ActionButton>
          </Stack>
        }
      />
      <Typography variant="caption" color="text.secondary">
        {t('home.workspace.timelineScope')}
      </Typography>
      <Box
        sx={(theme) => ({
          ...meetingListSurface(theme),
          mt: 1.5,
          p: meetings.length === 0 ? 2 : { xs: 1, md: 1.25 },
          containerType: 'inline-size',
        })}
      >
        {meetings.length === 0 ? (
          <GuidedEmptyState
            kind="empty"
            title={t('home.today.empty')}
            description={t('home.today.emptyDescription')}
            size="compact"
          />
        ) : (
          <Stack
            component="ol"
            sx={{
              p: 0,
              m: 0,
              listStyle: 'none',
              gap: 1,
            }}
          >
            {meetings.map((meeting) => {
              const ended =
                meeting.lifecycleState === 'ENDED' || meeting.lifecycleState === 'CANCELLED';
              const live = meeting.lifecycleState === 'LIVE';
              const preparing =
                meeting.lifecycleState === 'SCHEDULED' || meeting.lifecycleState === 'DRAFT';
              return (
                <Box
                  component="li"
                  key={meeting.meetingId}
                  data-testid="meeting-home-timeline-row"
                  sx={(theme) => ({
                    p: { xs: 1.5, md: 2 },
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'minmax(0, 1fr) auto',
                      md: '110px minmax(0, 1fr) auto',
                    },
                    gap: { xs: 0.75, md: 1.5 },
                    alignItems: 'center',
                    bgcolor: live ? alpha(theme.palette.success.main, 0.045) : 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    borderLeft: 3,
                    borderLeftColor: live ? 'success.main' : 'primary.main',
                    borderRadius: foundationTokens.radius.control + 'px',
                    '@media (forced-colors: active)': {
                      borderLeftColor: live || meeting.canHost ? 'CanvasText' : 'transparent',
                    },
                    '@container (max-width: 20rem)': {
                      gridTemplateColumns: 'minmax(0, 1fr)',
                    },
                  })}
                >
                  <Box
                    data-testid="meeting-home-timeline-time"
                    sx={{
                      gridColumn: { xs: '1 / -1', md: 'auto' },
                      display: { xs: 'flex', md: 'block' },
                      flexWrap: 'wrap',
                      alignItems: 'baseline',
                      gap: 1,
                      minWidth: 0,
                    }}
                  >
                    <Typography variant="subtitle2" color={live ? 'success.main' : 'text.primary'}>
                      {homeMeetingDate(meeting.startsAt, i18n.language, timeZone, true)} –{' '}
                      {homeMeetingDate(meeting.endsAt, i18n.language, timeZone, true)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('units.minutes', { count: meeting.durationMinutes })}
                    </Typography>
                  </Box>
                  <Box data-testid="meeting-home-timeline-content" sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                      {meeting.title}
                    </Typography>
                    <Stack
                      direction="row"
                      flexWrap="wrap"
                      gap={0.75}
                      alignItems="center"
                      sx={{ mt: { xs: 0.5, md: 0.75 } }}
                    >
                      <Chip
                        size="small"
                        color={meeting.canHost ? 'primary' : 'default'}
                        variant={meeting.canHost ? 'filled' : 'outlined'}
                        label={t(
                          meeting.canHost
                            ? 'home.workspace.hostRole'
                            : 'home.workspace.participantRole'
                        )}
                      />
                      <Chip
                        size="small"
                        variant="outlined"
                        color={live ? 'success' : 'default'}
                        label={t(`status.${meeting.lifecycleState}`)}
                      />
                      <UsersRound size={13} aria-hidden="true" />
                      <Typography variant="caption" color="text.secondary">
                        {t('units.participants', { count: meeting.attendeeCount })}
                      </Typography>
                      {meeting.waitingRoomEnabled && (
                        <Stack direction="row" alignItems="center" gap={0.4}>
                          <ShieldCheck size={13} aria-hidden="true" />
                          <Typography variant="caption" color="text.secondary">
                            {t('home.workspace.waitingRoom')}
                          </Typography>
                        </Stack>
                      )}
                    </Stack>
                  </Box>
                  <ActionButton
                    data-testid="meeting-home-timeline-action"
                    intent={live ? 'primary' : 'quiet'}
                    disabled={disabled && !ended && !preparing}
                    onClick={() =>
                      navigate(
                        preparing
                          ? meetingPreparationPath(meeting.meetingId)
                          : homeMeetingPath(meeting)
                      )
                    }
                    sx={(theme) => ({
                      minHeight: 44,
                      minWidth: 0,
                      maxWidth: { xs: '7rem', md: 'none' },
                      px: { xs: 1, md: 2 },
                      typography: { xs: 'caption', md: 'button' },
                      fontWeight: theme.typography.button.fontWeight,
                      whiteSpace: 'normal',
                      overflowWrap: 'anywhere',
                      justifySelf: 'end',
                      '@container (max-width: 20rem)': {
                        maxWidth: 'none',
                        justifySelf: 'stretch',
                      },
                    })}
                  >
                    {ended
                      ? t('home.workspace.viewRecord')
                      : live
                        ? t('actions.join')
                        : preparing
                          ? t('context.openPreparation')
                          : t('home.focus.prepare')}
                  </ActionButton>
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>
    </Box>
  );
}
