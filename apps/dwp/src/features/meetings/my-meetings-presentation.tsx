import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarClock,
  CheckCircle2,
  FileText,
  Link2,
  Mic,
  Paperclip,
  ShieldCheck,
  UsersRound,
  Video,
} from 'lucide-react';
import { ActionButton, InlineFeedback, LoadingState } from '@dwp-frontend/design-system';
import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { formatMeetingTime, MeetingStatusChip } from './meeting-components';
import { meetingPreparationPath } from './meeting-context-routing';
import { homeAgendaItems } from './meeting-home-model';
import { meetingInsetSurface, meetingShape, meetingSoftShadow } from './meeting-visual-system';
import { meetingInvitationProgress, type MyMeetingEvidence } from './my-meetings-model';

export function MyMeetingCopyLink({ meeting }: { meeting: VideoMeetingSummary }) {
  const { t } = useTranslation('meetings');
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  return (
    <Stack gap={0.5}>
      <ActionButton
        intent="secondary"
        startIcon={<Link2 size={16} aria-hidden="true" />}
        disabled={!meeting.meetingCode || meeting.lifecycleState === 'CANCELLED'}
        onClick={() => {
          const url = new URL('/meetings/join', window.location.origin);
          url.searchParams.set('code', meeting.meetingCode);
          void Promise.resolve()
            .then(() => navigator.clipboard.writeText(url.href))
            .then(
              () => setState('copied'),
              () => setState('failed')
            );
        }}
      >
        {t('home.design.copyLink')}
      </ActionButton>
      {state !== 'idle' && (
        <Typography
          role="status"
          variant="caption"
          color={state === 'failed' ? 'error.main' : 'success.main'}
        >
          {t('mine.design.copy.' + state)}
        </Typography>
      )}
    </Stack>
  );
}

export function MyMeetingAgenda({
  meeting,
  evidence,
  mobile = false,
}: {
  meeting: VideoMeetingSummary;
  evidence?: MyMeetingEvidence;
  mobile?: boolean;
}) {
  const { t } = useTranslation('meetings');
  const items =
    evidence?.preparation?.agendaItems ??
    homeAgendaItems(meeting.agenda).map((title, position) => ({
      itemId: String(position),
      title,
      plannedMinutes: null,
      ownerDisplayName: null,
    }));
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" fontWeight="fontWeightBold">
        {t('mine.inspector.agenda')}
      </Typography>
      <Box
        component="ol"
        aria-label={t('mine.inspector.agenda')}
        sx={{
          listStyle: 'none',
          p: 0,
          mb: 0,
          mt: 1,
          display: 'grid',
          gridTemplateColumns: mobile ? '1fr' : { xs: '1fr', sm: 'repeat(3,minmax(0,1fr))' },
          gap: 1,
        }}
      >
        {items.map((item, index) => (
          <Box
            key={item.itemId}
            component="li"
            sx={(theme) => ({
              ...meetingInsetSurface(theme),
              p: 1.25,
              minWidth: 0,
              display: 'flex',
              gap: 1,
            })}
          >
            <Typography variant="caption" color="primary.main" fontWeight="fontWeightBold">
              {String(index + 1).padStart(2, '0')}
            </Typography>
            <Box
              sx={{
                minWidth: 0,
                flex: 1,
                display: { xs: 'grid', sm: mobile ? 'grid' : 'block' },
                gridTemplateColumns: 'minmax(0, 1fr) fit-content(38%)',
                alignItems: 'start',
                columnGap: 1,
              }}
            >
              <Typography
                variant="body2"
                fontWeight="fontWeightMedium"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {item.title}
              </Typography>
              {(item.plannedMinutes != null || item.ownerDisplayName) && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    textAlign: { xs: 'right', sm: mobile ? 'right' : 'left' },
                    overflowWrap: 'anywhere',
                  }}
                >
                  {[
                    item.plannedMinutes != null
                      ? t('units.minutes', { count: item.plannedMinutes })
                      : '',
                    item.ownerDisplayName,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Typography>
              )}
            </Box>
          </Box>
        ))}
      </Box>
      {!items.length && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {t('room.agendaEmpty')}
        </Typography>
      )}
    </Box>
  );
}

export function MyMeetingCard({
  meeting,
  evidence,
  selected,
  compact,
  onSelect,
}: {
  meeting: VideoMeetingSummary;
  evidence?: MyMeetingEvidence;
  selected: boolean;
  compact: boolean;
  onSelect: () => void;
}) {
  const { t, i18n } = useTranslation('meetings');
  const navigate = useNavigate();
  const { search } = useLocation();
  const progress = meetingInvitationProgress(evidence?.preparation);
  const schedule = evidence?.schedule;
  const active = !['ENDED', 'CANCELLED'].includes(meeting.lifecycleState);
  const prepare = () =>
    navigate(
      active
        ? meetingPreparationPath(meeting.meetingId, search)
        : `/meetings/history?meeting=${encodeURIComponent(meeting.meetingId)}`
    );
  return (
    <Box
      component="article"
      data-meeting-id={meeting.meetingId}
      sx={(theme) => ({
        bgcolor: 'background.paper',
        border: 1,
        borderColor: selected ? 'primary.main' : alpha(theme.palette.primary.main, 0.12),
        borderRadius: selected ? meetingShape.stage : meetingShape.card,
        boxShadow: meetingSoftShadow(theme),
        p: { xs: selected ? 2 : 1.75, lg: selected ? 3 : 2.5 },
        minWidth: 0,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          insetInlineStart: 0,
          top: 0,
          bottom: 0,
          width: { xs: 0, lg: 5 },
          bgcolor: selected ? 'primary.main' : alpha(theme.palette.primary.main, 0.22),
        },
        ...(selected
          ? {
              backgroundImage: {
                xs: 'none',
                lg: `linear-gradient(100deg, ${alpha(theme.palette.primary.main, 0.035)}, ${theme.palette.background.paper} 70%)`,
              },
              borderWidth: { xs: 2, lg: 1 },
            }
          : {}),
        '@media (forced-colors: active)': { borderColor: 'CanvasText', backgroundImage: 'none' },
      })}
    >
      <Stack gap={selected ? 2 : 1.25}>
        <Stack
          direction="row"
          gap={1}
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
        >
          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
            <MeetingStatusChip state={meeting.lifecycleState} />
            <Typography
              variant="body2"
              color={selected ? 'primary.main' : 'text.primary'}
              fontWeight="fontWeightBold"
            >
              {formatMeetingTime(meeting.startsAt, i18n.language)} –{' '}
              {formatMeetingTime(meeting.endsAt, i18n.language)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('units.minutes', { count: meeting.durationMinutes })}
            </Typography>
          </Stack>
          <Stack direction="row" gap={0.75} flexWrap="wrap">
            <Chip
              size="small"
              color={meeting.canHost ? 'primary' : 'default'}
              variant="outlined"
              label={t('mine.filters.role.' + (meeting.canHost ? 'HOST' : 'ATTENDEE'))}
            />
            {schedule?.seriesId && (
              <Chip
                size="small"
                icon={<CalendarClock size={14} />}
                label={t('scheduleManagement.seriesPosition', {
                  current: schedule.occurrenceIndex,
                  total: schedule.occurrenceCount,
                })}
              />
            )}
          </Stack>
        </Stack>
        <Box>
          <ActionButton
            intent="quiet"
            aria-pressed={selected}
            onClick={onSelect}
            sx={{
              p: 0,
              minHeight: 32,
              textAlign: 'left',
              justifyContent: 'flex-start',
              whiteSpace: 'normal',
              width: '100%',
            }}
          >
            <Typography
              component="h2"
              variant={selected ? 'h6' : 'subtitle1'}
              fontWeight="fontWeightBold"
              sx={{ overflowWrap: 'anywhere' }}
            >
              {meeting.title}
            </Typography>
          </ActionButton>
          {selected && meeting.description && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.75, display: { xs: 'none', lg: 'block' } }}
            >
              {meeting.description}
            </Typography>
          )}
        </Box>
        <Stack
          direction="row"
          gap={1.5}
          flexWrap="wrap"
          sx={(theme) => ({
            ...(selected ? meetingInsetSurface(theme) : {}),
            p: selected ? 1.25 : 0,
          })}
        >
          <Stack direction="row" gap={0.75} alignItems="center">
            <UsersRound size={16} aria-hidden="true" />
            <Typography variant="caption">
              {meeting.organizerName} · {t('units.participants', { count: meeting.attendeeCount })}
            </Typography>
          </Stack>
          <Stack direction="row" gap={0.75} alignItems="center">
            <ShieldCheck size={16} aria-hidden="true" />
            <Typography variant="caption">{t('access.' + meeting.accessScope)}</Typography>
          </Stack>
        </Stack>
        {selected && progress && (
          <Stack
            direction="row"
            justifyContent="space-between"
            gap={1}
            alignItems="center"
            sx={(theme) => ({
              ...meetingInsetSurface(
                theme,
                progress.accepted === progress.total && progress.total > 0 ? 'success' : 'neutral'
              ),
              p: 1.25,
            })}
          >
            <Stack direction="row" gap={0.75} alignItems="center">
              <CheckCircle2 size={16} aria-hidden="true" />
              <Typography variant="caption">{t('mine.design.acceptance', progress)}</Typography>
            </Stack>
            <Typography variant="caption" fontWeight="fontWeightBold">
              {progress.percent}%
            </Typography>
          </Stack>
        )}
        {selected && <MyMeetingAgenda meeting={meeting} evidence={evidence} />}
        {!selected && !compact && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: { xs: 'none', lg: 'block' } }}
          >
            {meeting.agenda || t('room.agendaEmpty')}
          </Typography>
        )}
        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ pt: 0.5 }}>
          {selected && active && (
            <ActionButton
              intent="primary"
              startIcon={<Video size={18} aria-hidden="true" />}
              onClick={() => navigate(`/meetings/room/${encodeURIComponent(meeting.meetingId)}`)}
              sx={{ order: { xs: -1, lg: 1 }, width: { xs: '100%', lg: 'auto' }, minHeight: 44 }}
            >
              {t('room.deviceCheck')}
            </ActionButton>
          )}
          <ActionButton
            intent="secondary"
            startIcon={selected ? <FileText size={16} aria-hidden="true" /> : undefined}
            onClick={prepare}
            disabled={meeting.lifecycleState === 'CANCELLED'}
          >
            {t(active ? 'home.focus.prepare' : 'history.openRecap')}
          </ActionButton>
          {selected && active && (
            <>
              <MyMeetingCopyLink key={meeting.meetingId} meeting={meeting} />
              <ActionButton
                intent="quiet"
                startIcon={<Paperclip size={16} aria-hidden="true" />}
                onClick={() => navigate(meetingPreparationPath(meeting.meetingId, search))}
                sx={{ display: { xs: 'none', lg: 'inline-flex' } }}
              >
                {t('preparation.materials')}
                {evidence?.preparation ? ` ${evidence.preparation.materials.length}` : ''}
              </ActionButton>
              <ActionButton
                intent="quiet"
                startIcon={<Mic size={16} aria-hidden="true" />}
                onClick={() => navigate('/meetings/preferences')}
                sx={{ display: { xs: 'none', lg: 'inline-flex' } }}
              >
                {t('room.deviceCheck')}
              </ActionButton>
            </>
          )}
        </Stack>
        {selected && evidence?.loading && (
          <LoadingState size="compact" label={t('preparation.loading')} />
        )}
        {selected && evidence?.failed && (
          <InlineFeedback severity="warning">{t('mine.design.evidenceFailed')}</InlineFeedback>
        )}
      </Stack>
    </Box>
  );
}
