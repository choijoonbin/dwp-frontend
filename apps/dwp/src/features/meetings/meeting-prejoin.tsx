import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PreJoin, type LocalUserChoices } from '@livekit/components-react';
import { CalendarClock, DoorOpen, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';

import { formatMeetingDateTime, MeetingPageHeading } from './meeting-components';
import { MeetingContentPreJoin } from './meeting-content-governance';

import '@livekit/components-styles';
import './meeting-prejoin.css';

export type MeetingPreJoinProps = {
  meeting: VideoMeetingSummary;
  defaultDisplayName: string;
  busy: boolean;
  onCancel: () => void;
  onError: (error: Error) => void;
  onSubmit: (choices: LocalUserChoices) => unknown | Promise<unknown>;
};

export function MeetingPreJoin({
  meeting,
  defaultDisplayName,
  busy,
  onCancel,
  onError,
  onSubmit,
}: MeetingPreJoinProps) {
  const { t, i18n } = useTranslation('meetings');
  const [mediaError, setMediaError] = useState<Error | null>(null);
  const [submissionError, setSubmissionError] = useState(false);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [contentGuarded, setContentGuarded] = useState(true);
  const liveKitRootRef = useRef<HTMLDivElement>(null);
  const displayNameInputId = useId();
  const privacyDescriptionId = useId();
  const validateChoices = useCallback(
    (choices: LocalUserChoices) => !busy && !contentGuarded && choices.username.trim().length > 0,
    [busy, contentGuarded]
  );

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
        className="dwp-meeting-prejoin"
        aria-label={t('room.preJoin.workspaceLabel')}
      >
        <div className="dwp-meeting-prejoin__workspace" data-lk-theme="default">
          <div className="dwp-meeting-prejoin__stage">
            <div className="dwp-meeting-prejoin__stage-heading">
              <span className="dwp-meeting-prejoin__private-badge">
                <ShieldCheck size={15} aria-hidden="true" />
                {t('room.preJoin.privatePreview')}
              </span>
              <span>{t('room.preJoin.localOnly')}</span>
            </div>

            <div ref={liveKitRootRef} className="dwp-meeting-prejoin__livekit">
              <label className="dwp-meeting-prejoin__visually-hidden" htmlFor={displayNameInputId}>
                {t('room.displayName')}
              </label>
              <PreJoin
                key={previewAttempt}
                defaults={{
                  username: defaultDisplayName,
                  audioEnabled: meeting.defaultMicrophoneEnabled,
                  videoEnabled: meeting.defaultCameraEnabled,
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

          <aside
            className="dwp-meeting-prejoin__rail"
            aria-labelledby="dwp-meeting-prejoin-security-title"
          >
            <div className="dwp-meeting-prejoin__meeting-summary">
              <div className="dwp-meeting-prejoin__rail-kicker">
                <span>{t('room.preJoin.meetingAndSecurity')}</span>
                <span
                  className="dwp-meeting-prejoin__lifecycle"
                  data-state={meeting.lifecycleState}
                >
                  {t(`status.${meeting.lifecycleState}`)}
                </span>
              </div>
              <h2 id="dwp-meeting-prejoin-security-title">{meeting.title}</h2>
              <p>
                <CalendarClock size={15} aria-hidden="true" />
                <span>
                  {formatMeetingDateTime(meeting.startsAt, i18n.language)} · {meeting.timeZone}
                </span>
              </p>
              <p>
                <span className="dwp-meeting-prejoin__organizer-mark" aria-hidden="true">
                  {meeting.organizerName.trim().charAt(0).toLocaleUpperCase() || '–'}
                </span>
                <span>{t('room.preJoin.hostedBy', { name: meeting.organizerName })}</span>
              </p>
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
