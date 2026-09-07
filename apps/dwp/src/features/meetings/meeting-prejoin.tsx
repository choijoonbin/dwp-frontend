import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PreJoin, type LocalUserChoices } from '@livekit/components-react';
import { DoorOpen, LockKeyhole, RefreshCw, ShieldCheck, UsersRound } from 'lucide-react';
import { ActionButton, foundationTokens } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import type { MeetingPreJoinPreferenceDefaults } from './meeting-preferences-model';

import { formatMeetingDateTime, MeetingPageHeading } from './meeting-components';
import { MeetingContentPreJoin } from './meeting-content-governance';
import { MeetingPreJoinSpeaker } from './meeting-prejoin-speaker';

import '@livekit/components-styles';
import './meeting-prejoin.css';

export type MeetingPreJoinProps = {
  meeting: VideoMeetingSummary;
  defaults: MeetingPreJoinPreferenceDefaults;
  busy: boolean;
  onCancel: () => void;
  onError: (error: Error) => void;
  onSpeakerDeviceChange: (speakerDeviceId: string) => void;
  onSubmit: (choices: LocalUserChoices) => unknown | Promise<unknown>;
};

export function MeetingPreJoin({
  meeting,
  defaults,
  busy,
  onCancel,
  onError,
  onSpeakerDeviceChange,
  onSubmit,
}: MeetingPreJoinProps) {
  const { t, i18n } = useTranslation('meetings');
  const [mediaError, setMediaError] = useState<Error | null>(null);
  const [submissionError, setSubmissionError] = useState(false);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [contentGuarded, setContentGuarded] = useState(true);
  const liveKitRootRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const displayNameInputId = useId();
  const privacyDescriptionId = useId();
  const validateChoices = useCallback(
    (choices: LocalUserChoices) => !busy && !contentGuarded && choices.username.trim().length > 0,
    [busy, contentGuarded]
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      document.scrollingElement?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.getElementById('dwp-main-content')?.scrollTo({
        top: 0,
        left: 0,
        behavior: 'auto',
      });
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      headingRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const liveKitRoot = liveKitRootRef.current;
    if (!liveKitRoot) return;

    const applyAccessibleMetadata = () => {
      const displayNameInput =
        liveKitRoot.querySelector<HTMLInputElement>('input[name="username"]');
      if (displayNameInput) {
        displayNameInput.id = displayNameInputId;
        displayNameInput.setAttribute('aria-describedby', privacyDescriptionId);
      }

      const deviceMenuButtons =
        liveKitRoot.querySelectorAll<HTMLButtonElement>('button.lk-button-menu');
      const deviceMenuLabels = [
        t('room.controls.deviceMenu', { device: t('room.controls.microphone') }),
        t('room.controls.deviceMenu', { device: t('room.controls.camera') }),
      ];
      deviceMenuButtons.forEach((button, index) => {
        const label = deviceMenuLabels[index] ?? t('room.controls.deviceMenu', { device: '' });
        button.setAttribute('aria-label', label.trim());
        button.title = label.trim();
      });
    };

    applyAccessibleMetadata();
    const observer = new MutationObserver(applyAccessibleMetadata);
    observer.observe(liveKitRoot, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [displayNameInputId, previewAttempt, privacyDescriptionId, t]);

  const handleMediaError = (error: Error) => {
    setMediaError(error);
    onError(error);
  };

  const retryDevices = () => {
    setMediaError(null);
    setPreviewAttempt((attempt) => attempt + 1);
  };

  const submitChoices = (choices: LocalUserChoices) => {
    if (busy) return;
    setSubmissionError(false);
    try {
      void Promise.resolve(onSubmit(choices)).catch(() => setSubmissionError(true));
    } catch {
      setSubmissionError(true);
    }
  };

  return (
    <>
      <MeetingPageHeading
        eyebrow={t('room.eyebrow')}
        title={t('room.deviceCheck')}
        description={t('room.deviceDescription')}
        headingRef={headingRef}
        headingTabIndex={-1}
        actions={
          <ActionButton intent="quiet" onClick={onCancel}>
            {t('actions.cancel')}
          </ActionButton>
        }
      />

      {submissionError && (
        <Alert severity="error" role="alert" sx={{ mb: 2 }}>
          {t('errors.operation')}
        </Alert>
      )}

      {mediaError && (
        <Alert
          className="dwp-meeting-prejoin__permission-alert"
          severity="error"
          role="alert"
          sx={{ mb: 2 }}
        >
          <AlertTitle>{t('room.preJoin.permissionTitle')}</AlertTitle>
          <Typography component="p" variant="body2">
            {t('room.preJoin.permissionDescription')}
          </Typography>
          <Box component="ol" className="dwp-meeting-prejoin__recovery-steps">
            <li>{t('room.preJoin.permissionStepOne')}</li>
            <li>{t('room.preJoin.permissionStepTwo')}</li>
          </Box>
          <ActionButton
            intent="secondary"
            size="small"
            startIcon={<RefreshCw size={15} aria-hidden="true" />}
            onClick={retryDevices}
          >
            {t('room.preJoin.retryDevices')}
          </ActionButton>
        </Alert>
      )}

      <Box
        component="section"
        aria-labelledby="dwp-meeting-prejoin-context-title"
        data-testid="meeting-prejoin-context"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) auto' },
          alignItems: 'center',
          gap: { xs: 1.5, md: 3 },
          pb: 2,
          borderBottom: 1,
          borderColor: 'divider',
          mb: 2,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" flexWrap="wrap" alignItems="center" gap={0.75} sx={{ mb: 1 }}>
            <Chip
              size="small"
              color={meeting.lifecycleState === 'LIVE' ? 'success' : 'primary'}
              variant="outlined"
              label={t(`status.${meeting.lifecycleState}`)}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatMeetingDateTime(meeting.startsAt, i18n.language)} · {meeting.timeZone}
            </Typography>
          </Stack>
          <Typography
            id="dwp-meeting-prejoin-context-title"
            component="h2"
            variant="h5"
            sx={{ overflowWrap: 'anywhere' }}
          >
            {meeting.title}
          </Typography>
          <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1.5} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t('room.preJoin.hostedBy', { name: meeting.organizerName })}
            </Typography>
            <Stack direction="row" alignItems="center" gap={0.5}>
              <UsersRound size={15} aria-hidden="true" />
              <Typography variant="body2" color="text.secondary">
                {t('units.participants', { count: meeting.attendeeCount })}
              </Typography>
            </Stack>
          </Stack>
        </Box>
        <Stack direction="row" flexWrap="wrap" gap={0.75} justifyContent={{ md: 'flex-end' }}>
          <Chip
            size="small"
            icon={<DoorOpen size={14} aria-hidden="true" />}
            label={t(
              meeting.waitingRoomEnabled
                ? 'room.preJoin.waitingRoomEnabled'
                : 'room.preJoin.waitingRoomDisabled'
            )}
          />
          <Chip
            size="small"
            color="success"
            variant="outlined"
            icon={<ShieldCheck size={14} aria-hidden="true" />}
            label={t(`access.${meeting.accessScope}`)}
          />
        </Stack>
      </Box>

      <Box
        component="section"
        className="dwp-meeting-prejoin"
        aria-label={t('room.preJoin.workspaceLabel')}
        sx={(theme) => {
          return {
            '--dwp-prejoin-border': alpha(theme.palette.common.white, 0.14),
            '--dwp-prejoin-subtle-border': alpha(theme.palette.common.white, 0.09),
            '--dwp-prejoin-outer-border': alpha(theme.palette.primary.light, 0.28),
            '--dwp-prejoin-muted': alpha(theme.palette.common.white, 0.66),
            '--dwp-prejoin-placeholder': alpha(theme.palette.common.white, 0.54),
            '--dwp-prejoin-foreground': theme.palette.common.white,
            '--dwp-prejoin-accent-text': theme.palette.common.white,
            '--dwp-prejoin-accent-soft': alpha(theme.palette.primary.main, 0.18),
            '--dwp-prejoin-accent-border': alpha(theme.palette.primary.light, 0.36),
            '--dwp-prejoin-success-text':
              theme.palette.mode === 'dark'
                ? theme.palette.success.light
                : theme.palette.success.dark,
            '--dwp-prejoin-success-soft': alpha(theme.palette.success.main, 0.16),
            '--dwp-prejoin-success-border': alpha(theme.palette.success.light, 0.4),
            '--dwp-prejoin-canvas': theme.palette.common.black,
            '--dwp-prejoin-stage': theme.palette.grey[900],
            '--dwp-prejoin-surface': theme.palette.grey[800],
            '--dwp-prejoin-raised': theme.palette.grey[700],
            '--dwp-prejoin-action': theme.palette.primary.main,
            '--dwp-prejoin-action-contrast': theme.palette.getContrastText(
              theme.palette.primary.main
            ),
            '--dwp-prejoin-action-hover': theme.palette.primary.dark,
            '--dwp-prejoin-action-hover-contrast': theme.palette.getContrastText(
              theme.palette.primary.dark
            ),
            '--dwp-prejoin-action-border': theme.palette.primary.light,
            '--dwp-prejoin-focus': theme.palette.primary.light,
            '--dwp-prejoin-page-surface': theme.palette.background.paper,
            '--dwp-prejoin-page-text': theme.palette.text.primary,
            '--dwp-prejoin-page-muted': theme.palette.text.secondary,
            '--dwp-prejoin-page-divider': theme.palette.divider,
            '--dwp-prejoin-page-accent': theme.palette.primary.main,
            '--dwp-prejoin-radius': foundationTokens.radius.control + 'px',
            '--dwp-prejoin-radius-large': foundationTokens.radius.surface + 'px',
          };
        }}
      >
        <div className="dwp-meeting-prejoin__workspace" data-lk-theme="default">
          <div className="dwp-meeting-prejoin__preview-column">
            <div className="dwp-meeting-prejoin__stage">
              <div className="dwp-meeting-prejoin__stage-heading">
                <span className="dwp-meeting-prejoin__private-badge">
                  <ShieldCheck size={15} aria-hidden="true" />
                  {t('room.preJoin.privatePreview')}
                </span>
                <span>{t('room.preJoin.localOnly')}</span>
              </div>

              <div ref={liveKitRootRef} className="dwp-meeting-prejoin__livekit">
                <label
                  className="dwp-meeting-prejoin__visually-hidden"
                  htmlFor={displayNameInputId}
                >
                  {t('room.displayName')}
                </label>
                <PreJoin
                  key={previewAttempt}
                  defaults={{
                    username: defaults.username,
                    audioEnabled: defaults.audioEnabled,
                    videoEnabled: defaults.videoEnabled,
                    audioDeviceId: defaults.audioDeviceId,
                    videoDeviceId: defaults.videoDeviceId,
                  }}
                  persistUserChoices={false}
                  joinLabel={busy ? t('room.connecting') : t('room.joinLabel')}
                  micLabel={t('room.microphone')}
                  camLabel={t('room.camera')}
                  userLabel={t('room.displayName')}
                  onValidate={validateChoices}
                  onError={handleMediaError}
                  onSubmit={submitChoices}
                  aria-busy={busy || undefined}
                  aria-describedby={privacyDescriptionId}
                />
              </div>

              <p id={privacyDescriptionId} className="dwp-meeting-prejoin__privacy-note">
                <LockKeyhole size={15} aria-hidden="true" />
                {t('room.preJoin.privacyNote')}
              </p>
            </div>
            <MeetingPreJoinSpeaker
              speakerDeviceId={defaults.speakerDeviceId}
              onSpeakerDeviceChange={onSpeakerDeviceChange}
            />
          </div>

          <aside
            className="dwp-meeting-prejoin__rail"
            aria-labelledby="dwp-meeting-prejoin-security-title"
          >
            <div className="dwp-meeting-prejoin__rail-kicker">
              <h2 id="dwp-meeting-prejoin-security-title">
                {t('room.preJoin.meetingAndSecurity')}
              </h2>
              <span className="dwp-meeting-prejoin__lifecycle" data-state={meeting.lifecycleState}>
                {t(`status.${meeting.lifecycleState}`)}
              </span>
            </div>

            <ul className="dwp-meeting-prejoin__security-list">
              <li>
                <DoorOpen size={18} aria-hidden="true" />
                <div>
                  <span>{t('room.preJoin.waitingRoom')}</span>
                  <strong>
                    {t(
                      meeting.waitingRoomEnabled
                        ? 'room.preJoin.waitingRoomEnabled'
                        : 'room.preJoin.waitingRoomDisabled'
                    )}
                  </strong>
                  <p>
                    {t(
                      meeting.waitingRoomEnabled
                        ? 'room.preJoin.waitingRoomEnabledDetail'
                        : 'room.preJoin.waitingRoomDisabledDetail'
                    )}
                  </p>
                </div>
              </li>
              <li>
                <ShieldCheck size={18} aria-hidden="true" />
                <div>
                  <span>{t('room.preJoin.access')}</span>
                  <strong>{t(`access.${meeting.accessScope}`)}</strong>
                  <p>{t(`room.preJoin.accessDetails.${meeting.accessScope}`)}</p>
                </div>
              </li>
            </ul>
            <MeetingContentPreJoin
              meetingId={meeting.meetingId}
              canHost={meeting.canHost}
              onGuardChange={setContentGuarded}
            />
          </aside>
        </div>
      </Box>
    </>
  );
}
