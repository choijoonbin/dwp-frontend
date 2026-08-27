import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CarouselLayout,
  ConnectionStateToast,
  FocusLayout,
  FocusLayoutContainer,
  GridLayout,
  isTrackReference,
  LayoutContextProvider,
  MediaDeviceMenu,
  ParticipantTile,
  RoomAudioRenderer,
  StartMediaButton,
  useCreateLayoutContext,
  useLocalParticipantPermissions,
  usePersistentUserChoices,
  usePinnedTracks,
  useTracks,
  useTrackToggle,
  type TrackReferenceOrPlaceholder,
} from '@livekit/components-react';
import { RoomEvent, Track } from 'livekit-client';
import {
  ChevronUp,
  Hand,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  MonitorX,
  UsersRound,
  Video,
  VideoOff,
} from 'lucide-react';

import type { VideoMeetingEffectivePermissions } from '@dwp-frontend/shared-utils/api/video-meeting-api';

import { MeetingCollaborationRuntime } from './meeting-collaboration-runtime';
import { MeetingLeaveControl } from './meeting-leave-control';
import { MeetingParticipantsPanel } from './meeting-participants-panel';

type MeetingConferenceProps = {
  meetingId: string;
  permissions: VideoMeetingEffectivePermissions;
  canModerate: boolean;
  onDeviceError: (error: Error) => void;
  onLeaveError: () => void;
};

type MeetingSidePanel = 'chat' | 'floor' | 'participants' | null;

const LIVEKIT_PROTOCOL_SOURCE = {
  camera: 1,
  microphone: 2,
  screenShare: 3,
} as const;

function trackKey(track: TrackReferenceOrPlaceholder) {
  if (isTrackReference(track)) {
    return track.publication.trackSid ?? `${track.participant.identity}:${track.source}`;
  }
  return `${track.participant.identity}:${track.source}:placeholder`;
}

function isSameTrack(
  first: TrackReferenceOrPlaceholder,
  second: TrackReferenceOrPlaceholder | undefined
) {
  return second ? trackKey(first) === trackKey(second) : false;
}

export function MeetingConference({
  meetingId,
  permissions,
  canModerate,
  onDeviceError,
  onLeaveError,
}: MeetingConferenceProps) {
  const { t } = useTranslation('meetings');
  const [sidePanel, setSidePanel] = useState<MeetingSidePanel>(null);
  const lastAutoFocusedScreenShare = useRef<string | null>(null);
  const layoutContext = useCreateLayoutContext();
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false }
  );
  const focusTrack = usePinnedTracks(layoutContext)?.[0];
  const screenShareTracks = useMemo(
    () =>
      tracks
        .filter(isTrackReference)
        .filter((track) => track.publication.source === Track.Source.ScreenShare),
    [tracks]
  );
  const subscribedScreenShare = screenShareTracks.find((track) => track.publication.isSubscribed);

  useEffect(() => {
    if (subscribedScreenShare && lastAutoFocusedScreenShare.current === null) {
      layoutContext.pin.dispatch?.({
        msg: 'set_pin',
        trackReference: subscribedScreenShare,
      });
      lastAutoFocusedScreenShare.current = trackKey(subscribedScreenShare);
      return;
    }

    if (
      lastAutoFocusedScreenShare.current &&
      !screenShareTracks.some((track) => trackKey(track) === lastAutoFocusedScreenShare.current)
    ) {
      layoutContext.pin.dispatch?.({ msg: 'clear_pin' });
      lastAutoFocusedScreenShare.current = null;
    }
  }, [layoutContext.pin, screenShareTracks, subscribedScreenShare]);

  const carouselTracks = tracks.filter((track) => !isSameTrack(track, focusTrack));

  return (
    <div className="dwp-meeting-conference">
      <LayoutContextProvider value={layoutContext}>
        <div className="dwp-meeting-conference__workspace" data-panel-open={sidePanel !== null}>
          <section
            className="dwp-meeting-conference__stage"
            aria-label={t('room.controls.stageLabel')}
          >
            {!focusTrack ? (
              <div className="lk-grid-layout-wrapper dwp-meeting-conference__layout">
                <GridLayout tracks={tracks}>
                  <ParticipantTile />
                </GridLayout>
              </div>
            ) : (
              <div className="lk-focus-layout-wrapper dwp-meeting-conference__layout">
                <FocusLayoutContainer>
                  <CarouselLayout tracks={carouselTracks}>
                    <ParticipantTile />
                  </CarouselLayout>
                  <FocusLayout trackRef={focusTrack} />
                </FocusLayoutContainer>
              </div>
            )}
            <MeetingControlBar
              meetingId={meetingId}
              permissions={permissions}
              sidePanel={sidePanel}
              onPanelToggle={(panel) =>
                setSidePanel((current) => (current === panel ? null : panel))
              }
              onDeviceError={onDeviceError}
              onLeaveError={onLeaveError}
            />
          </section>
          <MeetingCollaborationRuntime
            meetingId={meetingId}
            activeTab={sidePanel === 'chat' || sidePanel === 'floor' ? sidePanel : null}
            meetingLive
            canModerate={canModerate}
            permissions={permissions}
            onClose={() => setSidePanel(null)}
            onTabChange={setSidePanel}
          />
          {sidePanel === 'participants' && (
            <MeetingParticipantsPanel onClose={() => setSidePanel(null)} />
          )}
        </div>
      </LayoutContextProvider>
      <RoomAudioRenderer />
      <ConnectionStateToast />
    </div>
  );
}

function MeetingControlBar({
  meetingId,
  permissions: effectivePermissions,
  sidePanel,
  onPanelToggle,
  onDeviceError,
  onLeaveError,
}: {
  meetingId: string;
  permissions: VideoMeetingEffectivePermissions;
  sidePanel: MeetingSidePanel;
  onPanelToggle: (panel: Exclude<MeetingSidePanel, null>) => void;
  onDeviceError: (error: Error) => void;
  onLeaveError: () => void;
}) {
  const { t } = useTranslation('meetings');
  const permissions = useLocalParticipantPermissions();
  const {
    saveAudioInputEnabled,
    saveVideoInputEnabled,
    saveAudioInputDeviceId,
    saveVideoInputDeviceId,
  } = usePersistentUserChoices();
  const microphone = useTrackToggle({
    source: Track.Source.Microphone,
    onChange: (enabled, userInitiated) => {
      if (userInitiated) saveAudioInputEnabled(enabled);
    },
    onDeviceError,
  });
  const camera = useTrackToggle({
    source: Track.Source.Camera,
    onChange: (enabled, userInitiated) => {
      if (userInitiated) saveVideoInputEnabled(enabled);
    },
    onDeviceError,
  });
  const screenShare = useTrackToggle({
    source: Track.Source.ScreenShare,
    captureOptions: { audio: true, selfBrowserSurface: 'include' },
    onDeviceError,
  });
  const allowedPublishSources = permissions?.canPublishSources as readonly number[] | undefined;
  const canPublishSource = (source: number) =>
    permissions?.canPublish === true &&
    (!allowedPublishSources?.length || allowedPublishSources.includes(source));
  const canPublishMicrophone =
    effectivePermissions.microphone && canPublishSource(LIVEKIT_PROTOCOL_SOURCE.microphone);
  const canPublishCamera =
    effectivePermissions.camera && canPublishSource(LIVEKIT_PROTOCOL_SOURCE.camera);
  const canPublishScreenShare =
    effectivePermissions.screenShare && canPublishSource(LIVEKIT_PROTOCOL_SOURCE.screenShare);
  const canChat = effectivePermissions.chat;
  const screenShareSupported =
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getDisplayMedia === 'function';
  const microphoneLabel = t(
    microphone.enabled ? 'room.controls.microphoneDisable' : 'room.controls.microphoneEnable'
  );
  const cameraLabel = t(
    camera.enabled ? 'room.controls.cameraDisable' : 'room.controls.cameraEnable'
  );
  const screenShareLabel = t(
    screenShare.enabled ? 'room.controls.screenShareStop' : 'room.controls.screenShareStart'
  );

  return (
    <div
      className="dwp-meeting-control-bar"
      role="toolbar"
      aria-orientation="horizontal"
      aria-label={t('room.controls.label')}
    >
      {canPublishMicrophone && (
        <div className="dwp-meeting-control-bar__group">
          <button
            {...microphone.buttonProps}
            type="button"
            className={`${microphone.buttonProps.className ?? ''} dwp-meeting-control`}
            aria-label={microphoneLabel}
            title={microphoneLabel}
          >
            {microphone.enabled ? <Mic size={20} /> : <MicOff size={20} />}
            <span>{t('room.controls.microphone')}</span>
          </button>
          <MediaDeviceMenu
            kind="audioinput"
            className="dwp-meeting-device-menu"
            aria-label={t('room.controls.deviceMenu', {
              device: t('room.controls.microphone'),
            })}
            title={t('room.controls.deviceMenu', {
              device: t('room.controls.microphone'),
            })}
            onActiveDeviceChange={(_kind, deviceId) =>
              saveAudioInputDeviceId(deviceId ?? 'default')
            }
          >
            <ChevronUp size={14} />
          </MediaDeviceMenu>
        </div>
      )}

      {canPublishCamera && (
        <div className="dwp-meeting-control-bar__group">
          <button
            {...camera.buttonProps}
            type="button"
            className={`${camera.buttonProps.className ?? ''} dwp-meeting-control`}
            aria-label={cameraLabel}
            title={cameraLabel}
          >
            {camera.enabled ? <Video size={20} /> : <VideoOff size={20} />}
            <span>{t('room.controls.camera')}</span>
          </button>
          <MediaDeviceMenu
            kind="videoinput"
            className="dwp-meeting-device-menu"
            aria-label={t('room.controls.deviceMenu', { device: t('room.controls.camera') })}
            title={t('room.controls.deviceMenu', { device: t('room.controls.camera') })}
            onActiveDeviceChange={(_kind, deviceId) =>
              saveVideoInputDeviceId(deviceId ?? 'default')
            }
          >
            <ChevronUp size={14} />
          </MediaDeviceMenu>
        </div>
      )}

      {canPublishScreenShare && screenShareSupported && (
        <button
          {...screenShare.buttonProps}
          type="button"
          className={`${screenShare.buttonProps.className ?? ''} dwp-meeting-control`}
          aria-label={screenShareLabel}
          title={screenShareLabel}
        >
          {screenShare.enabled ? <MonitorX size={20} /> : <MonitorUp size={20} />}
          <span>{t('room.controls.screenShare')}</span>
        </button>
      )}

      {canChat && (
        <button
          type="button"
          className="dwp-meeting-control"
          aria-label={t(
            sidePanel === 'chat' ? 'room.controls.chatClose' : 'room.controls.chatOpen'
          )}
          aria-pressed={sidePanel === 'chat'}
          title={t(sidePanel === 'chat' ? 'room.controls.chatClose' : 'room.controls.chatOpen')}
          onClick={() => onPanelToggle('chat')}
        >
          <MessageSquare size={20} />
          <span>{t('room.controls.chat')}</span>
        </button>
      )}

      {effectivePermissions.handRaise && (
        <button
          type="button"
          className="dwp-meeting-control"
          aria-label={t(
            sidePanel === 'floor' ? 'room.controls.floorClose' : 'room.controls.floorOpen'
          )}
          aria-pressed={sidePanel === 'floor'}
          title={t(sidePanel === 'floor' ? 'room.controls.floorClose' : 'room.controls.floorOpen')}
          onClick={() => onPanelToggle('floor')}
        >
          <Hand size={20} aria-hidden="true" />
          <span>{t('room.controls.floor')}</span>
        </button>
      )}

      {effectivePermissions.participantList && (
        <button
          type="button"
          className="dwp-meeting-control"
          aria-label={t('room.controls.participantsOpen')}
          aria-pressed={sidePanel === 'participants'}
          aria-controls="meeting-participants-panel"
          title={t('room.controls.participantsOpen')}
          onClick={() => onPanelToggle('participants')}
        >
          <UsersRound size={20} aria-hidden="true" />
          <span>{t('room.controls.participants')}</span>
        </button>
      )}

      <MeetingLeaveControl meetingId={meetingId} onError={onLeaveError} />

      <StartMediaButton
        className="dwp-meeting-control dwp-meeting-control--playback"
        label={t('room.controls.startPlayback')}
      />
    </div>
  );
}
