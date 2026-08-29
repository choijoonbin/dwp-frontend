import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ConnectionQualityIndicator,
  LiveKitRoom,
  useDataChannel,
  useLocalParticipant,
  type LocalUserChoices,
} from '@livekit/components-react';
import type { DisconnectReason } from 'livekit-client';
import { Radio, ShieldCheck, Square, UsersRound, X } from 'lucide-react';
import { ActionButton, ActionIconButton, ConfirmDialog } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Drawer from '@mui/material/Drawer';
import Modal from '@mui/material/Modal';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  VideoMeetingJoinCredential,
  VideoMeetingSummary,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';

import { MeetingLobbyPanel } from './meeting-lobby-panel';
import { MeetingConference } from './meeting-conference';
import { MeetingContentControl } from './meeting-content-governance';
import {
  authorizeReceivedMeetingReaction,
  type MeetingReactionInteraction,
} from './meeting-reaction-policy';

import '@livekit/components-styles';
import './live-video-meeting-room.css';

const INTERACTION_TOPIC = 'dwp.meetings.interaction.v1';
const REACTIONS = [
  { emoji: '👍', labelKey: 'thumbsUp' },
  { emoji: '👏', labelKey: 'clap' },
  { emoji: '🎉', labelKey: 'celebrate' },
  { emoji: '❤️', labelKey: 'heart' },
] as const;

type InteractionOverlay = {
  id: string;
  content: string;
  senderName: string;
};

export function LiveVideoMeetingRoom({
  meeting,
  credential,
  choices,
  ending,
  operationError,
  onConnected,
  onLeave,
  onEndForEveryone,
}: {
  meeting: VideoMeetingSummary;
  credential: VideoMeetingJoinCredential;
  choices: LocalUserChoices;
  ending: boolean;
  operationError?: string | null;
  onConnected: () => void;
  onLeave: (reason?: DisconnectReason) => void;
  onEndForEveryone: () => void;
}) {
  const { t } = useTranslation('meetings');
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [overlayPanelOpen, setOverlayPanelOpen] = useState(false);

  return (
    <Modal open hideBackdrop disableEscapeKeyDown aria-label={t('room.liveRegion')}>
      <Box className="dwp-video-meeting-room" tabIndex={-1}>
        <LiveKitRoom
          className="dwp-video-meeting-room__transport"
          data-lk-theme="default"
          token={credential.participantToken}
          serverUrl={credential.serverUrl}
          connect
          audio={choices.audioEnabled ? { deviceId: choices.audioDeviceId } : false}
          video={choices.videoEnabled ? { deviceId: choices.videoDeviceId } : false}
          connectOptions={{ autoSubscribe: true }}
          onConnected={() => {
            setConnected(true);
            setConnectionError(null);
            onConnected();
          }}
          onDisconnected={onLeave}
          onError={() => setConnectionError(t('errors.connection'))}
          onMediaDeviceFailure={() => setPermissionError(t('errors.mediaPermission'))}
        >
          <MeetingRoomChrome
            meeting={meeting}
            connected={connected}
            ending={ending}
            operationError={operationError ?? permissionError ?? connectionError}
            permissions={credential.effectivePermissions}
            overlayPanelOpen={overlayPanelOpen}
            onEndForEveryone={onEndForEveryone}
          />
          <MeetingConference
            meetingId={meeting.meetingId}
            permissions={credential.effectivePermissions}
            canModerate={meeting.canModerate}
            meetingLive={meeting.lifecycleState === 'LIVE'}
            onDeviceError={() => setPermissionError(t('errors.mediaPermission'))}
            onLeaveError={() => setConnectionError(t('errors.leaveSync'))}
            onOverlayPanelChange={setOverlayPanelOpen}
          />
        </LiveKitRoom>
      </Box>
    </Modal>
  );
}

function MeetingRoomChrome({
  meeting,
  connected,
  ending,
  operationError,
  permissions,
  overlayPanelOpen,
  onEndForEveryone,
}: {
  meeting: VideoMeetingSummary;
  connected: boolean;
  ending: boolean;
  operationError?: string | null;
  permissions: VideoMeetingJoinCredential['effectivePermissions'];
  overlayPanelOpen: boolean;
  onEndForEveryone: () => void;
}) {
  const { t } = useTranslation('meetings');
  const [lobbyOpen, setLobbyOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [overlays, setOverlays] = useState<InteractionOverlay[]>([]);
  const [reactionError, setReactionError] = useState<string | null>(null);
  const timers = useRef(new Map<string, number>());
  const { localParticipant } = useLocalParticipant();

  const showOverlay = useCallback((overlay: InteractionOverlay) => {
    setOverlays((current) => [...current.slice(-4), overlay]);
    const timer = window.setTimeout(() => {
      setOverlays((current) => current.filter((item) => item.id !== overlay.id));
      timers.current.delete(overlay.id);
    }, 2_400);
    timers.current.set(overlay.id, timer);
  }, []);

  useEffect(
    () => () => {
      for (const timer of timers.current.values()) window.clearTimeout(timer);
      timers.current.clear();
    },
    []
  );

  const handleInteraction = useCallback(
    (message: {
      payload: Uint8Array;
      from?: {
        identity: string;
        name?: string;
        metadata?: string;
        permissions?: { canPublishData?: boolean };
      };
    }) => {
      const interaction = authorizeReceivedMeetingReaction({
        payload: message.payload,
        sender: message.from,
        meetingId: meeting.meetingId,
        receiverAllowsReactions: permissions.reactions,
      });
      if (!interaction) return;
      showOverlay({
        id: interaction.id,
        content: interaction.emoji,
        senderName: interaction.senderName,
      });
    },
    [meeting.meetingId, permissions.reactions, showOverlay]
  );
  const { send, isSending } = useDataChannel(INTERACTION_TOPIC, handleInteraction);

  const publish = async (interaction: MeetingReactionInteraction, reliable: boolean) => {
    const payload = new TextEncoder().encode(JSON.stringify(interaction));
    await send(payload, { reliable });
  };
  const senderName = localParticipant.name || localParticipant.identity;
  const sendReaction = (emoji: string) => {
    if (!permissions.reactions) return;
    const interaction: MeetingReactionInteraction = {
      type: 'REACTION',
      id: crypto.randomUUID(),
      emoji,
      senderName,
      sentAt: Date.now(),
    };
    showOverlay({ id: interaction.id, content: emoji, senderName });
    setReactionError(null);
    void publish(interaction, false).catch(() => {
      setOverlays((current) => current.filter((overlay) => overlay.id !== interaction.id));
      setReactionError(t('room.reactionSendError'));
    });
  };
  return (
    <>
      <header
        className="dwp-video-meeting-room__header"
        aria-hidden={overlayPanelOpen || undefined}
        inert={overlayPanelOpen || undefined}
      >
        <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
          <Chip
            icon={<Radio size={14} />}
            label={connected ? t('room.live') : t('room.connecting')}
            color={connected ? 'success' : 'default'}
            size="small"
            sx={{ bgcolor: 'rgba(17, 19, 21, 0.82)', color: 'common.white' }}
          />
          <Typography color="common.white" fontWeight={700} noWrap>
            {meeting.title}
          </Typography>
          <Stack
            direction="row"
            alignItems="center"
            gap={0.5}
            role="status"
            aria-label={t('room.quality')}
            sx={{ color: 'common.white' }}
          >
            <ConnectionQualityIndicator participant={localParticipant} />
          </Stack>
        </Stack>
        <Stack direction="row" gap={0.75} alignItems="center">
          <MeetingContentControl
            meetingId={meeting.meetingId}
            canHost={meeting.canHost}
            meetingLive={meeting.lifecycleState === 'LIVE'}
          />
          {meeting.canModerate && (
            <ActionButton
              intent="quiet"
              size="small"
              startIcon={<UsersRound size={16} />}
              sx={{ color: 'common.white' }}
              title={t('room.lobby')}
              onClick={() => setLobbyOpen(true)}
            >
              {t('room.lobby')}
            </ActionButton>
          )}
          {meeting.canHost && (
            <ActionButton
              intent="danger"
              size="small"
              loading={ending}
              loadingLabel={t('room.ending')}
              startIcon={<Square size={14} />}
              title={t('actions.end')}
              onClick={() => setEndOpen(true)}
            >
              {t('actions.end')}
            </ActionButton>
          )}
        </Stack>
      </header>

      {permissions.reactions && (
        <div
          className="dwp-video-meeting-room__interactions"
          role="toolbar"
          aria-orientation="horizontal"
          aria-label={t('room.reactionsLabel')}
          aria-hidden={overlayPanelOpen || undefined}
          inert={overlayPanelOpen || undefined}
        >
          {REACTIONS.map((reaction) => (
            <ActionIconButton
              key={reaction.emoji}
              label={t('room.reaction', {
                reaction: t(`room.reactions.${reaction.labelKey}`),
              })}
              disabled={isSending}
              onClick={() => sendReaction(reaction.emoji)}
            >
              <span aria-hidden="true">{reaction.emoji}</span>
            </ActionIconButton>
          ))}
        </div>
      )}

      <div
        className="dwp-video-meeting-room__reaction-layer"
        aria-live="polite"
        aria-atomic="false"
        aria-hidden={overlayPanelOpen || undefined}
      >
        {overlays.map((overlay) => (
          <div key={overlay.id} className="dwp-video-meeting-room__reaction">
            <span aria-hidden="true">{overlay.content}</span>
            <small>{overlay.senderName}</small>
            <span className="dwp-meeting-visually-hidden">
              {t('room.reactionAnnouncement', {
                name: overlay.senderName,
                reaction: overlay.content,
              })}
            </span>
          </div>
        ))}
      </div>

      {(operationError || reactionError) && (
        <Box
          className="dwp-video-meeting-room__status"
          aria-hidden={overlayPanelOpen || undefined}
          inert={overlayPanelOpen || undefined}
        >
          <Alert severity="warning">{operationError || reactionError}</Alert>
        </Box>
      )}

      <Drawer
        anchor="right"
        open={lobbyOpen}
        onClose={() => setLobbyOpen(false)}
        sx={{ zIndex: 1400 }}
        slotProps={{ paper: { sx: { width: { xs: '100%', sm: 400 }, p: 2.5 } } }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Stack direction="row" gap={0.75} alignItems="center">
            <ShieldCheck size={19} />
            <Typography component="h2" variant="h6" fontWeight={800}>
              {t('room.lobby')}
            </Typography>
          </Stack>
          <ActionIconButton label={t('actions.close')} onClick={() => setLobbyOpen(false)}>
            <X size={18} />
          </ActionIconButton>
        </Stack>
        <MeetingLobbyPanel meetingId={meeting.meetingId} />
      </Drawer>

      <ConfirmDialog
        open={endOpen}
        title={t('room.endConfirmTitle')}
        description={t('room.endConfirmDescription')}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('actions.end')}
        confirmingLabel={t('room.ending')}
        intent="danger"
        busy={ending}
        onClose={() => setEndOpen(false)}
        onConfirm={onEndForEveryone}
      />
    </>
  );
}

export default LiveVideoMeetingRoom;
