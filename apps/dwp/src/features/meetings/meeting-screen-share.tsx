import { useTranslation } from 'react-i18next';
import { Track, type ScreenShareCaptureOptions } from 'livekit-client';
import { MonitorUp } from 'lucide-react';

import './meeting-screen-share.css';

type ScreenShareTrackDescriptor = {
  participant: { isLocal: boolean };
  publication: { source: Track.Source };
};

/**
 * Browser hints only: the browser still owns the source picker and the user can choose a
 * full display that contains DWP. The local preview fence below remains the reliable guard
 * against a hall-of-mirrors stage in browsers that ignore these hints.
 */
export const MEETING_SCREEN_SHARE_CAPTURE_OPTIONS = {
  audio: true,
  video: { displaySurface: 'window' },
  selfBrowserSurface: 'exclude',
  surfaceSwitching: 'include',
  preferCurrentTab: false,
} as const satisfies ScreenShareCaptureOptions;

export function isLocalScreenShareTrack(track: ScreenShareTrackDescriptor) {
  return track.participant.isLocal && track.publication.source === Track.Source.ScreenShare;
}

export function MeetingLocalScreenShareNotice() {
  const { t } = useTranslation('meetings');

  return (
    <div
      className="dwp-meeting-screen-share-guidance"
      role="status"
      aria-live="polite"
      data-testid="local-screen-share-guidance"
    >
      <MonitorUp size={20} aria-hidden="true" />
      <span>
        <strong>{t('room.controls.screenShareSelfTitle')}</strong>
        <span>{t('room.controls.screenShareSelfDescription')}</span>
      </span>
    </div>
  );
}
