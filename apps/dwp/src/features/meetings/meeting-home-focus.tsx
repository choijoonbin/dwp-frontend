import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Circle,
  Copy,
  LockKeyhole,
  MicOff,
  ShieldCheck,
  UsersRound,
  Video,
  VideoOff,
} from 'lucide-react';
import { ActionButton, foundationTokens } from '@dwp-frontend/design-system';
import { useToast } from '@dwp-frontend/shared-utils';
import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import Avatar from '@mui/material/Avatar';
import AvatarGroup from '@mui/material/AvatarGroup';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  homeAgendaItems,
  homeMeetingDate,
  homeMeetingMinutesUntil,
  homeMeetingPath,
} from './meeting-home-model';
import { meetingPreparationPath } from './meeting-context-routing';
import { meetingInsetSurface, meetingSurface } from './meeting-visual-system';

export function MeetingHomeFocus({
  meeting,
  now,
  timeZone,
  disabled,
  onStart,
}: {
  meeting?: VideoMeetingSummary | null;
  now: number;
  timeZone: string;
  disabled: boolean;
  onStart: () => void;
}) {
  const { t, i18n } = useTranslation('meetings');
  const navigate = useNavigate();
  const toast = useToast();
  const minutes = meeting ? homeMeetingMinutesUntil(meeting, now) : null;
  const live = meeting?.lifecycleState === 'LIVE';
  const agendaItems = homeAgendaItems(meeting?.agenda);
  const visibleParticipants = (meeting?.participants ?? []).slice(0, 3);
  const remainingParticipants = Math.max(
    0,
    (meeting?.attendeeCount ?? 0) - visibleParticipants.length
  );
  const copyLink = async () => {
    if (!meeting) return;
    try {
      const url = new URL('/meetings/join', window.location.origin);
      url.searchParams.set('code', meeting.meetingCode);
      await navigator.clipboard.writeText(url.href);
      toast.success(t('home.workspace.linkCopied'));
    } catch {
      toast.error(t('home.workspace.copyFailed'));
    }
  };
  return (
    <Box
      component="section"
      aria-label={t('home.command.label')}
      data-testid="meeting-command-primary"
      sx={(theme) => ({
        ...meetingSurface(theme, {
          tone: live ? 'success' : 'primary',
          elevated: true,
        }),
        position: 'relative',
        overflow: 'hidden',
        minWidth: 0,
        borderTopWidth: 1,
        p: { xs: 1.5, md: 2.5 },
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          bottom: 'auto',
          height: 3,
          backgroundColor: live ? theme.palette.success.main : theme.palette.primary.main,
          pointerEvents: 'none',
        },
        '@media (forced-colors: active)': {
          border: '1px solid CanvasText',
          background: 'Canvas',
          boxShadow: 'none',
          '&::before': { backgroundColor: 'CanvasText' },
        },
      })}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 264px' },
          gap: { xs: 2, lg: 3 },
          alignItems: 'stretch',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mb: { xs: 1, sm: 1.5 } }}>
            <Chip
              size="small"
              color={live ? 'success' : 'primary'}
              variant="outlined"
              label={
                meeting
                  ? minutes
                    ? t('home.workspace.startsIn', { count: minutes })
                    : t(`status.${meeting.lifecycleState}`)
                  : t('home.workspace.deviceCheckFirst')
              }
            />
            {meeting && (
              <Chip
                size="small"
                label={t(
                  meeting.canHost ? 'home.workspace.hostRole' : 'home.workspace.participantRole'
                )}
              />
            )}
            {meeting && (
              <Chip
                size="small"
                variant="outlined"
                icon={<LockKeyhole size={13} aria-hidden="true" />}
                label={t('access.' + meeting.accessScope)}
              />
            )}
            {meeting?.aiNotesAvailable && (
              <Chip size="small" color="success" label={t('home.workspace.aiNotesAvailable')} />
            )}
          </Stack>
          <Typography component="h2" variant="h5" sx={{ overflowWrap: 'anywhere' }}>
            {meeting?.title ?? t('home.command.clearTitle')}
          </Typography>
          {meeting ? (
            <>
              <Stack
                direction="row"
                flexWrap="wrap"
                columnGap={2}
                rowGap={1}
                alignItems="center"
                sx={{ mt: 1.5 }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {meeting.durationMinutes > 0 ? (
                    <>
                      {homeMeetingDate(meeting.startsAt, i18n.language, timeZone, true)} –{' '}
                      {homeMeetingDate(meeting.endsAt, i18n.language, timeZone, true)}
                      {' · '}
                      {t('units.minutes', { count: meeting.durationMinutes })}
                    </>
                  ) : (
                    t('home.workspace.noScheduledTime')
                  )}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                  {visibleParticipants.length > 0 ? (
                    <AvatarGroup
                      max={4}
                      aria-hidden="true"
                      sx={(theme) => ({
                        mr: 1,
                        '& .MuiAvatar-root': {
                          width: 28,
                          height: 28,
                          bgcolor: 'primary.main',
                          color: 'primary.contrastText',
                          borderColor: 'background.paper',
                          fontSize: theme.typography.caption.fontSize,
                          fontWeight: theme.typography.fontWeightBold,
                        },
                      })}
                    >
                      {visibleParticipants.map((participant) => (
                        <Avatar key={participant.participantId} alt={participant.displayName}>
                          {participant.displayName.trim().slice(0, 1).toLocaleUpperCase() || '?'}
                        </Avatar>
                      ))}
                      {remainingParticipants > 0 && (
                        <Avatar
                          alt={t('home.workspace.moreParticipants', {
                            count: remainingParticipants,
                          })}
                        >
                          +{remainingParticipants}
                        </Avatar>
                      )}
                    </AvatarGroup>
                  ) : (
                    <UsersRound size={15} aria-hidden="true" />
                  )}
                  <Typography variant="body2" sx={{ ml: visibleParticipants.length ? 0 : 0.75 }}>
                    {t('units.participants', { count: meeting.attendeeCount })}
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
                <ShieldCheck size={14} aria-hidden="true" />
                <Typography variant="caption" color="text.secondary">
                  {t('home.focus.hostedBy', { name: meeting.organizerName })}
                </Typography>
                {meeting.waitingRoomEnabled && (
                  <Typography variant="caption" color="text.secondary">
                    {t('home.workspace.waitingRoom')}
                  </Typography>
                )}
              </Stack>
              <Box
                sx={(theme) => ({
                  ...meetingInsetSurface(theme, 'primary'),
                  mt: 2,
                  p: { xs: 1.25, sm: 1.5 },
                })}
              >
                <Stack
                  direction="row"
                  gap={0.75}
                  alignItems="center"
                  justifyContent="space-between"
                  flexWrap="wrap"
                  sx={{ mb: 1 }}
                >
                  <Stack direction="row" gap={0.75} alignItems="center">
                    <ClipboardList size={15} aria-hidden="true" />
                    <Typography variant="subtitle2">{t('home.workspace.agenda')}</Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {agendaItems.length
                      ? t('home.workspace.agendaSummary', {
                          count: agendaItems.length,
                          minutes: meeting.durationMinutes,
                        })
                      : t('home.workspace.agendaCount', { count: 0 })}
                  </Typography>
                </Stack>
                {agendaItems.length ? (
                  <Box
                    component="ol"
                    tabIndex={0}
                    aria-label={t('home.workspace.agenda')}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: 'minmax(0, 1fr)',
                        sm: 'repeat(auto-fit, minmax(180px, 1fr))',
                      },
                      gap: 1,
                      p: 0,
                      m: 0,
                      listStyle: 'none',
                    }}
                  >
                    {agendaItems.map((item, index) => (
                      <Box
                        component="li"
                        key={`${index}-${item}`}
                        sx={(theme) => ({
                          display: 'grid',
                          gridTemplateColumns: 'auto minmax(0, 1fr)',
                          gap: 1,
                          alignItems: 'start',
                          minWidth: 0,
                          p: { xs: 0.75, sm: 1 },
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: foundationTokens.radius.control + 'px',
                          bgcolor: 'background.paper',
                          '&::before': {
                            content: `'${String(index + 1).padStart(2, '0')}'`,
                            display: 'grid',
                            placeItems: 'center',
                            minWidth: 26,
                            minHeight: 22,
                            px: 0.5,
                            borderRadius: foundationTokens.radius.compact + 'px',
                            bgcolor: 'action.selected',
                            color: 'primary.main',
                            fontSize: theme.typography.caption.fontSize,
                            fontWeight: theme.typography.fontWeightBold,
                            fontVariantNumeric: 'tabular-nums',
                          },
                        })}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            typography: { xs: 'caption', sm: 'body2' },
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {item}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ overflowWrap: 'anywhere' }}
                  >
                    {t('home.workspace.noAgenda')}
                  </Typography>
                )}
              </Box>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, maxWidth: 600 }}>
              {t('home.command.clearDescription')}
            </Typography>
          )}
        </Box>
        <Stack
          gap={1.25}
          sx={{
            minWidth: 0,
            alignSelf: 'stretch',
            justifyContent: 'center',
            borderLeft: { xs: 0, lg: 1 },
            borderTop: { xs: 1, lg: 0 },
            borderColor: 'divider',
            pt: { xs: 2, lg: 0 },
            pl: { xs: 0, lg: 3 },
            '@media (forced-colors: active)': {
              borderColor: 'CanvasText',
            },
          }}
        >
          <Box
            sx={(theme) => ({
              ...meetingInsetSurface(theme, live ? 'success' : 'neutral'),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              px: 1.25,
              py: 1,
            })}
          >
            <Stack direction="row" alignItems="center" gap={0.75} sx={{ color: 'success.main' }}>
              <Circle size={8} fill="currentColor" aria-hidden="true" />
              <Typography variant="caption" color="text.secondary">
                {t('home.workspace.privatePreview')}
              </Typography>
            </Stack>
            <Stack direction="row" alignItems="center" gap={0.75} color="text.secondary">
              <MicOff size={15} aria-hidden="true" />
              <VideoOff size={15} aria-hidden="true" />
            </Stack>
          </Box>
          <ActionButton
            intent="primary"
            startIcon={<Video size={17} aria-hidden="true" />}
            disabled={disabled}
            sx={{ minHeight: 48 }}
            onClick={() => (meeting ? navigate(homeMeetingPath(meeting)) : onStart())}
          >
            {meeting
              ? live
                ? t('actions.join')
                : t('home.focus.prepare')
              : t('home.instant.action')}
          </ActionButton>
          {meeting && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: '1fr' },
                gap: 1,
              }}
            >
              <ActionButton
                intent="quiet"
                startIcon={<ClipboardList size={15} aria-hidden="true" />}
                onClick={() => navigate(meetingPreparationPath(meeting.meetingId))}
                sx={{ minHeight: 44, minWidth: 0, whiteSpace: 'normal' }}
              >
                {t('context.openPreparation')}
              </ActionButton>
              <ActionButton
                intent="secondary"
                disabled={disabled || !meeting.meetingCode}
                startIcon={<Copy size={15} aria-hidden="true" />}
                onClick={() => void copyLink()}
                sx={{ minHeight: 44, minWidth: 0, whiteSpace: 'normal' }}
              >
                {t('home.workspace.copyLink')}
              </ActionButton>
            </Box>
          )}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: { xs: 'none', sm: 'block' } }}
          >
            {t('home.workspace.entryHint')}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}
