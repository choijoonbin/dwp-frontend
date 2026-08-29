import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ConnectionQualityIndicator, useParticipants } from '@livekit/components-react';
import { Mic, MicOff, MonitorUp, Video, VideoOff, X } from 'lucide-react';

import type { VideoMeetingRole } from '@dwp-frontend/shared-utils/api/video-meeting-api';

import { containMeetingOverlayTab } from './meeting-overlay-focus-boundary';

const MEETING_ROLES = new Set<VideoMeetingRole>([
  'ORGANIZER',
  'CO_HOST',
  'PRESENTER',
  'ATTENDEE',
  'GUEST',
]);

function participantRole(metadata?: string): VideoMeetingRole {
  if (!metadata) return 'ATTENDEE';
  try {
    const value = JSON.parse(metadata) as { meetingRole?: unknown };
    return typeof value.meetingRole === 'string' &&
      MEETING_ROLES.has(value.meetingRole as VideoMeetingRole)
      ? (value.meetingRole as VideoMeetingRole)
      : 'ATTENDEE';
  } catch {
    return 'ATTENDEE';
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/u).filter(Boolean);
  if (!parts.length) return '?';
  return parts
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join('')
    .toUpperCase();
}

export function MeetingParticipantsPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('meetings');
  const participants = useParticipants();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const orderedParticipants = useMemo(
    () =>
      [...participants].sort((left, right) => {
        if (left.isLocal !== right.isLocal) return left.isLocal ? -1 : 1;
        if (left.isSpeaking !== right.isSpeaking) return left.isSpeaking ? -1 : 1;
        return (left.name || left.identity).localeCompare(right.name || right.identity);
      }),
    [participants]
  );

  useEffect(() => closeButtonRef.current?.focus(), []);

  return (
    <aside
      ref={panelRef}
      id="meeting-participants-panel"
      className="dwp-meeting-side-panel dwp-meeting-participants"
      aria-labelledby="meeting-participants-title"
      onKeyDownCapture={(event) => containMeetingOverlayTab(event, panelRef.current)}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        onClose();
      }}
    >
      <header className="dwp-meeting-side-panel__header">
        <div>
          <strong id="meeting-participants-title">{t('room.controls.participantsTitle')}</strong>
          <small>{t('room.controls.participantsCount', { count: participants.length })}</small>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          className="dwp-meeting-side-panel__close"
          aria-label={t('room.controls.participantsClose')}
          title={t('room.controls.participantsClose')}
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <ul className="dwp-meeting-participants__list">
        {orderedParticipants.map((participant) => {
          const name = participant.name || participant.identity;
          const role = participantRole(participant.metadata);
          const mediaState = [
            participant.isScreenShareEnabled ? t('room.controls.screenSharing') : null,
            t(
              participant.isMicrophoneEnabled
                ? 'room.controls.microphoneEnabled'
                : 'room.controls.microphoneDisabled'
            ),
            t(
              participant.isCameraEnabled
                ? 'room.controls.cameraEnabled'
                : 'room.controls.cameraDisabled'
            ),
          ]
            .filter(Boolean)
            .join(', ');
          return (
            <li
              key={participant.sid || participant.identity}
              className="dwp-meeting-participant"
              data-speaking={participant.isSpeaking}
            >
              <span className="dwp-meeting-participant__avatar" aria-hidden="true">
                {initials(name)}
              </span>
              <span className="dwp-meeting-participant__identity">
                <span className="dwp-meeting-participant__name">
                  {name}
                  {participant.isLocal && <small>{t('room.controls.participantYou')}</small>}
                </span>
                <small>{t(`room.roles.${role}`)}</small>
              </span>
              <span
                className="dwp-meeting-participant__media"
                aria-label={`${t('room.controls.participantMediaState', { name })}: ${mediaState}`}
              >
                {participant.isScreenShareEnabled && <MonitorUp size={15} aria-hidden="true" />}
                {participant.isMicrophoneEnabled ? (
                  <Mic size={15} aria-hidden="true" />
                ) : (
                  <MicOff size={15} aria-hidden="true" />
                )}
                {participant.isCameraEnabled ? (
                  <Video size={15} aria-hidden="true" />
                ) : (
                  <VideoOff size={15} aria-hidden="true" />
                )}
                <ConnectionQualityIndicator participant={participant} />
              </span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
