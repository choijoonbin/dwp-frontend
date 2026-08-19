import { useState } from 'react';
import { LiveKitRoom, VideoConference, type LocalUserChoices } from '@livekit/components-react';
import { Radio, Square } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { MessagingMeetingJoinCredential } from '@dwp-frontend/shared-utils/api/messaging-meeting-api';

import '@livekit/components-styles';
import './livekit-meeting-room.css';

export type LiveKitMeetingRoomLabels = {
  live: string;
  connecting: string;
  connectionError: string;
  permissionError: string;
  disconnected: string;
  endForEveryone: string;
  ending: string;
};

export type LiveKitMeetingRoomProps = {
  conversationName: string;
  credential: MessagingMeetingJoinCredential;
  choices: LocalUserChoices;
  labels: LiveKitMeetingRoomLabels;
  ending?: boolean;
  canEndForEveryone: boolean;
  operationError?: string | null;
  onLeave: () => void;
  onEndForEveryone: () => void;
};

export function LiveKitMeetingRoom({
  conversationName,
  credential,
  choices,
  labels,
  ending = false,
  canEndForEveryone,
  operationError,
  onLeave,
  onEndForEveryone,
}: LiveKitMeetingRoomProps) {
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  return (
    <LiveKitRoom
      className="dwp-meeting-room"
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
      }}
      onDisconnected={() => {
        setConnected(false);
        onLeave();
      }}
      onError={() => setConnectionError(labels.connectionError)}
      onMediaDeviceFailure={() => setPermissionError(labels.permissionError)}
    >
      <div className="dwp-meeting-room__header">
        <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
          <Chip
            icon={<Radio size={14} />}
            label={connected ? labels.live : labels.connecting}
            color={connected ? 'success' : 'default'}
            size="small"
            sx={{ bgcolor: 'rgba(17, 19, 21, 0.82)', color: 'common.white' }}
          />
          <Typography color="common.white" fontWeight={700} noWrap>
            {conversationName}
          </Typography>
        </Stack>
        {canEndForEveryone && (
          <ActionButton
            intent="danger"
            size="small"
            loading={ending}
            loadingLabel={labels.ending}
            startIcon={<Square size={15} />}
            onClick={onEndForEveryone}
          >
            {labels.endForEveryone}
          </ActionButton>
        )}
      </div>
      {(operationError || connectionError || permissionError) && (
        <Box className="dwp-meeting-room__status">
          <Alert severity="warning">{operationError ?? permissionError ?? connectionError}</Alert>
        </Box>
      )}
      <VideoConference />
    </LiveKitRoom>
  );
}

export default LiveKitMeetingRoom;
