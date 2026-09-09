import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LocalUserChoices } from '@livekit/components-react';
import { DoorOpen, Mic, Camera, RefreshCw, ShieldCheck, UsersRound } from 'lucide-react';
import {
  ActionButton,
  FormField,
  InlineFeedback,
  SectionHeader,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import type { MeetingPreJoinPreferenceDefaults } from './meeting-preferences-model';
import type { MeetingBackgroundMode } from './meeting-background-types';
import { formatMeetingDateTime } from './meeting-components';
import { MeetingContentPreJoin } from './meeting-content-governance';
import { MeetingPrejoinDevices } from './meeting-prejoin-devices';
import { MeetingPrejoinAgenda } from './meeting-prejoin-agenda';
import { useMeetingPrejoinSession } from './use-meeting-prejoin-session';
import { meetingInsetSurface, meetingSurface } from './meeting-visual-system';
import './meeting-prejoin.css';

export type MeetingPreJoinProps = {
  meeting: VideoMeetingSummary;
  defaults: MeetingPreJoinPreferenceDefaults;
  busy: boolean;
  onCancel: () => void;
  onError: (error: Error) => void;
  onSpeakerDeviceChange: (speakerDeviceId: string) => void;
  onBackgroundModeChange?: (mode: MeetingBackgroundMode) => void;
  onSubmit: (choices: LocalUserChoices) => unknown | Promise<unknown>;
};

export function MeetingPreJoin({
  meeting,
  defaults,
  busy,
  onCancel,
  onError,
  onSpeakerDeviceChange,
  onBackgroundModeChange,
  onSubmit,
}: MeetingPreJoinProps) {
  const { t, i18n } = useTranslation('meetings');
  const session = useMeetingPrejoinSession(defaults, onBackgroundModeChange);
  const [submissionError, setSubmissionError] = useState(false);
  const [contentGuarded, setContentGuarded] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formId = useId();
  const disabled = busy || submitting;
  const backgroundFailed = session.preview.backgroundState === 'failed';
  const valid =
    !disabled && !contentGuarded && !session.requesting && session.choices.username.length > 0;
  useEffect(() => {
    mounted.current = true;
    const initialFocus = document.activeElement;
    const frame = requestAnimationFrame(() => {
      if (document.activeElement !== initialFocus && document.activeElement !== document.body)
        return;
      document.getElementById('dwp-main-content')?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      headingRef.current?.focus({ preventScroll: true });
    });
    return () => {
      mounted.current = false;
      cancelAnimationFrame(frame);
    };
  }, []);
  const submit = async () => {
    if (!valid || pending.current) return;
    pending.current = true;
    setSubmitting(true);
    setSubmissionError(false);
    const choices = { ...session.choices };
    // Release local capture before the room acquires its actual publication tracks.
    session.stop();
    try {
      await onSubmit(choices);
    } catch {
      if (mounted.current) {
        setSubmissionError(true);
        onError(new Error('Meeting entry could not complete'));
      }
    } finally {
      pending.current = false;
      if (mounted.current) setSubmitting(false);
    }
  };
  const admission = (
    <Stack gap={1} className="dwp-meeting-prejoin__admission-actions">
      <ActionButton
        className="lk-join-button"
        type="submit"
        form={formId}
        intent="primary"
        disabled={!valid}
        loading={disabled}
        startIcon={<DoorOpen size={18} aria-hidden="true" />}
        sx={{ minHeight: 48 }}
      >
        {busy ? t('room.connecting') : t('room.joinLabel')}
      </ActionButton>
      <Typography variant="caption" color="text.secondary">
        {t('room.preJoin.design.entryBoundary')}
      </Typography>
    </Stack>
  );
  return (
    <>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        sx={{ mb: 1 }}
      >
        <Typography variant="caption" color="text.secondary">
          {t('room.deviceCheck')}
        </Typography>
        <ActionButton intent="quiet" onClick={onCancel} disabled={disabled}>
          {t('actions.cancel')}
        </ActionButton>
      </Stack>
      {submissionError && (
        <InlineFeedback severity="error" sx={{ mb: 2 }}>
          {t('errors.operation')}
        </InlineFeedback>
      )}
      {session.preview.error && (
        <InlineFeedback severity="warning" sx={{ mb: 2 }}>
          <Stack gap={1}>
            <Typography variant="subtitle2">
              {t(
                backgroundFailed
                  ? 'preferences.video.backgroundFailed'
                  : 'room.preJoin.permissionTitle'
              )}
            </Typography>
            <Typography variant="body2">
              {t(
                backgroundFailed
                  ? 'preferences.video.backgroundHint'
                  : 'preferences.devices.errors.' + session.preview.error
              )}
            </Typography>
            <Typography variant="caption">{t('room.preJoin.design.deviceFailure')}</Typography>
            <ActionButton
              intent="quiet"
              disabled={
                disabled ||
                session.requesting ||
                (backgroundFailed && session.preview.error === 'unsupported')
              }
              startIcon={<RefreshCw size={16} aria-hidden="true" />}
              onClick={() =>
                backgroundFailed ? session.toggle('video') : void session.preview.refresh()
              }
              sx={{ alignSelf: 'flex-start', minHeight: 44 }}
            >
              {t(backgroundFailed ? 'actions.retry' : 'preferences.devices.refresh')}
            </ActionButton>
          </Stack>
        </InlineFeedback>
      )}
      <Box
        component="section"
        data-testid="meeting-prejoin-context"
        aria-labelledby="dwp-meeting-prejoin-context-title"
        sx={(theme) => ({
          ...meetingSurface(theme),
          p: { xs: 2, md: 0 },
          mb: 2,
          [theme.breakpoints.up('md')]: {
            padding: 0,
            border: 0,
            borderRadius: 0,
            boxShadow: 'none',
            background: 'transparent',
          },
        })}
      >
        <Typography
          id="dwp-meeting-prejoin-context-title"
          component="h1"
          variant="h5"
          ref={headingRef}
          tabIndex={-1}
          sx={{ typography: { xs: 'h6', md: 'h4' }, overflowWrap: 'anywhere' }}
        >
          {meeting.title}
        </Typography>
        <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1.5} sx={{ mt: 1 }}>
          <Chip
            size="small"
            color={meeting.lifecycleState === 'LIVE' ? 'success' : 'primary'}
            variant="outlined"
            label={t(`status.${meeting.lifecycleState}`)}
          />
          <Typography variant="caption" color="text.secondary">
            {formatMeetingDateTime(meeting.startsAt, i18n.language)} · {meeting.timeZone}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('room.preJoin.hostedBy', { name: meeting.organizerName })}
          </Typography>
          <Stack direction="row" alignItems="center" gap={0.5}>
            <UsersRound size={15} aria-hidden="true" />
            <Typography variant="caption" color="text.secondary">
              {t('units.participants', { count: meeting.attendeeCount })}
            </Typography>
          </Stack>
          <Chip
            size="small"
            variant="outlined"
            icon={<DoorOpen size={14} aria-hidden="true" />}
            label={t(
              meeting.waitingRoomEnabled
                ? 'room.preJoin.waitingRoomEnabled'
                : 'room.preJoin.waitingRoomDisabled'
            )}
          />
          <Chip
            size="small"
            variant="outlined"
            icon={<ShieldCheck size={14} aria-hidden="true" />}
            label={t('access.' + meeting.accessScope)}
          />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {t('room.deviceDescription')}
        </Typography>
      </Box>
      <Box
        component="section"
        className="dwp-meeting-prejoin"
        aria-label={t('room.preJoin.workspaceLabel')}
        sx={(theme) => ({
          '--dwp-prejoin-page-divider': theme.palette.divider,
          '--dwp-prejoin-page-surface': theme.palette.background.paper,
        })}
      >
        <Box
          className="dwp-meeting-prejoin__workspace"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 8fr) minmax(280px, 4fr)' },
            gap: { xs: 2, md: 3 },
            alignItems: 'start',
          }}
        >
          <MeetingPrejoinDevices
            session={session}
            busy={disabled}
            speakerDeviceId={defaults.speakerDeviceId}
            onSpeakerDeviceChange={onSpeakerDeviceChange}
          />
          <Stack
            component="aside"
            className="dwp-meeting-prejoin__rail"
            gap={2}
            sx={{ minWidth: 0 }}
          >
            <Stack
              component="section"
              gap={2}
              sx={(theme) => ({ ...meetingSurface(theme), p: { xs: 2, md: 2.5 } })}
            >
              <Stack gap={1} sx={(theme) => ({ ...meetingInsetSurface(theme, 'primary'), p: 1.5 })}>
                <SectionHeader
                  icon={DoorOpen}
                  glyph="plain"
                  density="compact"
                  title={t(
                    meeting.waitingRoomEnabled
                      ? 'room.preJoin.waitingRoomEnabled'
                      : 'room.preJoin.waitingRoomDisabled'
                  )}
                />
                <Typography variant="body2" color="text.secondary">
                  {t(
                    meeting.waitingRoomEnabled
                      ? 'room.preJoin.waitingRoomEnabledDetail'
                      : 'room.preJoin.waitingRoomDisabledDetail'
                  )}
                </Typography>
              </Stack>
              <Box
                component="form"
                id={formId}
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit();
                }}
              >
                <FormField
                  label={t('room.displayName')}
                  value={session.username}
                  onChange={(event) => session.setUsername(event.target.value)}
                  disabled={disabled}
                  inputProps={{ maxLength: 160 }}
                />
              </Box>
              <Stack gap={1.5} sx={(theme) => ({ ...meetingInsetSurface(theme), p: 1.5 })}>
                <Typography variant="subtitle2">{t('room.preJoin.design.joiningState')}</Typography>
                {(['audio', 'video'] as const).map((kind) => {
                  const Icon = kind === 'audio' ? Mic : Camera;
                  const active = session.preview.states[kind] === 'active';
                  return (
                    <Stack key={kind} direction="row" alignItems="center" gap={1}>
                      <Icon size={16} aria-hidden="true" />
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {t(kind === 'audio' ? 'room.microphone' : 'room.camera')}
                      </Typography>
                      <Typography
                        variant="caption"
                        color={active ? 'success.main' : 'text.secondary'}
                      >
                        {t('preferences.devices.states.' + session.preview.states[kind])}
                      </Typography>
                    </Stack>
                  );
                })}
              </Stack>
              {admission}
              <ActionButton
                intent="quiet"
                onClick={onCancel}
                disabled={disabled}
                sx={{ minHeight: 44 }}
              >
                {t('preparation.back')}
              </ActionButton>
            </Stack>
            <MeetingPrejoinAgenda meetingId={meeting.meetingId} />
            <Stack
              component="section"
              gap={1.5}
              sx={(theme) => ({ ...meetingSurface(theme), p: { xs: 2, md: 2.5 } })}
            >
              <SectionHeader
                id="dwp-meeting-prejoin-security-title"
                icon={ShieldCheck}
                glyph="plain"
                density="compact"
                title={t('room.preJoin.meetingAndSecurity')}
              />
              <Typography variant="body2">{t('access.' + meeting.accessScope)}</Typography>
              <Typography variant="caption" color="text.secondary">
                {t('room.preJoin.accessDetails.' + meeting.accessScope)}
              </Typography>
              <MeetingContentPreJoin
                meetingId={meeting.meetingId}
                canHost={meeting.canHost}
                onGuardChange={setContentGuarded}
              />
            </Stack>
          </Stack>
        </Box>
      </Box>
    </>
  );
}
