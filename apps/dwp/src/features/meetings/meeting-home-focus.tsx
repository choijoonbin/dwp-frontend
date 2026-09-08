import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Copy, FileText, LockKeyhole, MicOff, ShieldCheck, Video, VideoOff } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import { useAuth, useToast } from '@dwp-frontend/shared-utils';
import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import { getVideoMeetingPreparation } from '@dwp-frontend/shared-utils/api/video-meeting-preparation-api';
import Avatar from '@mui/material/Avatar';
import AvatarGroup from '@mui/material/AvatarGroup';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import {
  homeAgendaItems,
  homeMeetingMinutesUntil,
  homeMeetingPath,
  homeMeetingTime,
} from './meeting-home-model';
import { meetingPreparationPath } from './meeting-context-routing';
import { meetingShape } from './meeting-visual-system';
import { meetingHomeCard, meetingHomeInset } from './meeting-home-presentation';

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
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const preparation = useQuery({
    queryKey: [
      'meetings',
      'home',
      'preparation',
      user?.identityPlane,
      user?.tenantId,
      user?.userId,
      meeting?.meetingId,
    ],
    queryFn: ({ signal }) => getVideoMeetingPreparation(meeting!.meetingId, signal),
    enabled:
      isAuthenticated &&
      user?.identityPlane === 'TENANT' &&
      Boolean(user?.userId && meeting?.meetingId),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
    gcTime: 0,
    meta: { accessSensitive: true },
  });
  const current = preparation.isError || preparation.isRefetchError ? undefined : preparation.data;
  const agenda =
    current?.agendaItems ??
    (preparation.isError
      ? []
      : homeAgendaItems(meeting?.agenda).map((title, index) => ({
          itemId: String(index),
          title,
          plannedMinutes: null,
          ownerDisplayName: null,
        })));
  const responses = current?.invitationResponses ?? [];
  const participants = responses.length ? responses : (meeting?.participants ?? []);
  const minutes = meeting ? homeMeetingMinutesUntil(meeting, now) : null;
  const live = meeting?.lifecycleState === 'LIVE';
  const materialCount = current?.materials.filter(
    (item) => Date.parse(item.retentionUntil) > now
  ).length;
  const prepared =
    current && current.myPreparation.agendaVersion === current.agendaVersion
      ? current.myPreparation.preparedAgendaItemIds.filter((id) =>
          agenda.some((item) => item.itemId === id)
        ).length
      : 0;
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
        ...meetingHomeCard(theme),
        position: 'relative',
        overflow: 'hidden',
        minWidth: 0,
        p: { xs: 1.75, md: 3 },
        borderRadius: meetingShape.spotlight,
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background:
            'linear-gradient(90deg, ' +
            theme.palette.primary.main +
            ', ' +
            theme.palette.success.main +
            ')',
        },
        '@media (forced-colors: active)': {
          border: '1px solid CanvasText',
          '&::before': { background: 'CanvasText' },
        },
      })}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'minmax(0,1fr) 260px' },
          gap: { xs: 1.5, md: 3 },
          alignItems: 'center',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack
            direction="row"
            flexWrap="wrap"
            gap={0.75}
            sx={(theme) => ({
              mb: 1.5,
              '& .MuiChip-root': { borderRadius: meetingShape.spotlight },
              '& .MuiChip-colorPrimary': { bgcolor: alpha(theme.palette.primary.main, 0.055) },
              '& .MuiChip-colorSuccess': { bgcolor: alpha(theme.palette.success.main, 0.055) },
              '& .MuiChip-colorError': { bgcolor: alpha(theme.palette.error.main, 0.055) },
            })}
          >
            <Chip
              size="small"
              color={live ? 'success' : minutes !== null && minutes <= 15 ? 'error' : 'primary'}
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
                color="primary"
                variant="outlined"
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
              <Chip
                size="small"
                color="success"
                variant="outlined"
                label={t('home.workspace.aiNotesAvailable')}
              />
            )}
          </Stack>
          <Typography
            component="h2"
            variant="h5"
            sx={{
              fontSize: { xs: 'h5.fontSize', md: 'h3.fontSize' },
              fontWeight: 'fontWeightBold',
              overflowWrap: 'anywhere',
            }}
          >
            {meeting?.title ?? t('home.command.clearTitle')}
          </Typography>
          {meeting ? (
            <>
              <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1} sx={{ mt: 1.5 }}>
                {participants.length > 0 && (
                  <AvatarGroup
                    total={Math.max(meeting.attendeeCount, participants.length)}
                    max={4}
                    aria-hidden="true"
                    sx={{
                      '& .MuiAvatar-root': {
                        width: 28,
                        height: 28,
                        fontSize: 'caption.fontSize',
                        borderColor: 'background.paper',
                      },
                    }}
                  >
                    {participants.slice(0, 3).map((person, index) => (
                      <Avatar
                        key={person.participantId}
                        alt={person.displayName}
                        sx={{
                          bgcolor:
                            index === 2
                              ? 'success.main'
                              : index === 1
                                ? 'primary.dark'
                                : 'primary.main',
                          color: 'primary.contrastText',
                        }}
                      >
                        {person.displayName.trim().slice(0, 1)}
                      </Avatar>
                    ))}
                  </AvatarGroup>
                )}
                <Typography variant="caption" color="text.secondary">
                  {t('units.participants', { count: meeting.attendeeCount })}
                  {current &&
                    ' · ' +
                      t('home.design.responses', {
                        accepted: current.invitationCounts.accepted,
                        pending: current.invitationCounts.pending,
                      })}
                </Typography>
                <Stack direction="row" alignItems="center" gap={0.5} sx={{ color: 'success.main' }}>
                  <ShieldCheck size={13} aria-hidden="true" />
                  <Typography variant="caption" color="text.secondary">
                    {t('home.focus.hostedBy', { name: meeting.organizerName })}
                    {meeting.waitingRoomEnabled && ' · ' + t('home.workspace.waitingRoom')}
                  </Typography>
                </Stack>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {meeting.durationMinutes > 0
                    ? homeMeetingTime(meeting.startsAt, i18n.language, timeZone) +
                      ' – ' +
                      homeMeetingTime(meeting.endsAt, i18n.language, timeZone)
                    : t('home.workspace.noScheduledTime')}
                </Typography>
              </Stack>
              <Box
                data-testid="meeting-home-agenda"
                sx={(theme) => ({ ...meetingHomeInset(theme), mt: 2, p: { xs: 1.25, md: 1.75 } })}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  gap={1}
                  sx={{ mb: 1 }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {t('home.workspace.agenda')} ·{' '}
                    {t('units.minutes', { count: meeting.durationMinutes })}
                  </Typography>
                  <Typography variant="caption" color="primary.main">
                    {current
                      ? t('home.design.prepared', { completed: prepared, total: agenda.length })
                      : t('home.workspace.agendaCount', { count: agenda.length })}
                  </Typography>
                </Stack>
                {agenda.length ? (
                  <Box
                    component="ol"
                    aria-label={t('home.workspace.agenda')}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'repeat(3,minmax(0,1fr))' },
                      gap: 1,
                      p: 0,
                      m: 0,
                      listStyle: 'none',
                    }}
                  >
                    {agenda.slice(0, 3).map((item, index) => (
                      <Box
                        component="li"
                        key={item.itemId}
                        sx={(theme) => ({
                          ...meetingHomeCard(theme),
                          borderRadius: meetingShape.inset,
                          boxShadow: 'none',
                          p: 1,
                          minWidth: 0,
                        })}
                      >
                        <Stack direction="row" alignItems="flex-start" gap={0.75}>
                          <Box
                            component="span"
                            sx={{
                              px: 0.5,
                              borderRadius: meetingShape.inset,
                              bgcolor: 'action.selected',
                              color: 'primary.main',
                              typography: 'caption',
                              fontWeight: 'fontWeightBold',
                            }}
                          >
                            {String(index + 1).padStart(2, '0')}
                          </Box>
                          <Box
                            sx={{
                              minWidth: 0,
                              flex: 1,
                              display: { xs: 'flex', md: 'block' },
                              justifyContent: 'space-between',
                              gap: 0.75,
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{ fontWeight: 'fontWeightBold', overflowWrap: 'anywhere' }}
                            >
                              {item.title}
                            </Typography>
                            {(item.plannedMinutes || item.ownerDisplayName) && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                component="p"
                                sx={{ flexShrink: 0 }}
                              >
                                {item.plannedMinutes &&
                                  t('units.minutes', { count: item.plannedMinutes })}
                                {item.ownerDisplayName && (
                                  <Box
                                    component="span"
                                    sx={{ display: { xs: 'none', md: 'inline' } }}
                                  >
                                    {' · ' + item.ownerDisplayName}
                                  </Box>
                                )}
                              </Typography>
                            )}
                          </Box>
                        </Stack>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    {t(
                      preparation.isError
                        ? 'home.design.preparationUnavailable'
                        : 'home.workspace.noAgenda'
                    )}
                  </Typography>
                )}
                {agenda.length > 3 && (
                  <ActionButton
                    intent="quiet"
                    size="small"
                    onClick={() => navigate(meetingPreparationPath(meeting.meetingId))}
                  >
                    {t('home.design.allAgenda', { count: agenda.length })}
                  </ActionButton>
                )}
              </Box>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {t('home.command.clearDescription')}
            </Typography>
          )}
        </Box>
        <Stack
          gap={1.25}
          sx={(theme) => ({
            minWidth: 0,
            pl: { md: 3 },
            borderLeft: { md: '1px solid ' + alpha(theme.palette.primary.main, 0.1) },
          })}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
            sx={(theme) => ({ ...meetingHomeInset(theme), px: 1.25, py: 0.75 })}
          >
            <Typography variant="caption" color="text.secondary">
              {t('home.workspace.privatePreview')}
            </Typography>
            <Stack direction="row" gap={0.5} color="text.secondary">
              <MicOff size={14} aria-hidden="true" />
              <VideoOff size={14} aria-hidden="true" />
            </Stack>
          </Stack>
          <ActionButton
            intent="primary"
            startIcon={<Video size={17} aria-hidden="true" />}
            disabled={disabled}
            sx={{ minHeight: 48, borderRadius: meetingShape.card }}
            onClick={() => (meeting ? navigate(homeMeetingPath(meeting)) : onStart())}
          >
            {meeting ? t('home.design.enterAndCheck') : t('home.instant.action')}
          </ActionButton>
          {meeting && (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 1 }}>
              <ActionButton
                intent="secondary"
                size="small"
                startIcon={<FileText size={14} aria-hidden="true" />}
                onClick={() => navigate(meetingPreparationPath(meeting.meetingId))}
                sx={{
                  minHeight: 40,
                  px: 0.75,
                  minWidth: 0,
                  whiteSpace: 'normal',
                  borderRadius: meetingShape.control,
                }}
              >
                {materialCount === undefined
                  ? t('home.design.materials')
                  : t('home.design.materialCount', { count: materialCount })}
              </ActionButton>
              <ActionButton
                intent="secondary"
                size="small"
                disabled={disabled || !meeting.meetingCode}
                startIcon={<Copy size={14} aria-hidden="true" />}
                onClick={() => void copyLink()}
                sx={{
                  minHeight: 40,
                  px: 0.75,
                  minWidth: 0,
                  whiteSpace: 'normal',
                  borderRadius: meetingShape.control,
                }}
              >
                {t('home.design.copyLink')}
              </ActionButton>
            </Box>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
