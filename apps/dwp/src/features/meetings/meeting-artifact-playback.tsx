import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Headphones, Video } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import { createVideoMeetingArtifactAccessTicket } from '@dwp-frontend/shared-utils/api/video-meeting-artifact-api';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { VideoMeetingArtifact } from '@dwp-frontend/shared-utils/api/video-meeting-api';

import { formatMeetingDateTime } from './meeting-components';
import {
  classifyMeetingArtifactAccessFailure,
  deriveMeetingArtifactPlaybackAvailability,
  type MeetingArtifactAccessFailure,
} from './meeting-artifact-playback-model';

type AccessState =
  | { state: 'IDLE'; binding: string }
  | { state: 'LOADING'; binding: string }
  | { state: 'OPENED'; binding: string; expiresAt: string }
  | { state: 'ERROR'; binding: string; failure: MeetingArtifactAccessFailure };

export function MeetingArtifactPlayback({
  meetingId,
  artifact,
}: {
  meetingId: string;
  artifact: VideoMeetingArtifact;
}) {
  const { t, i18n } = useTranslation('meetings');
  const binding = `${artifact.artifactId}:${artifact.version}:${artifact.contentType ?? ''}:${artifact.retentionUntil ?? ''}`;
  const bindingRef = useRef(binding);
  bindingRef.current = binding;
  const [access, setAccess] = useState<AccessState>({ state: 'IDLE', binding });
  const currentAccess: AccessState =
    access.binding === binding ? access : { state: 'IDLE', binding };
  const [now, setNow] = useState(() => Date.now());
  const availability = deriveMeetingArtifactPlaybackAvailability(artifact, now);

  useEffect(() => {
    const retentionUntil = artifact.retentionUntil
      ? Date.parse(artifact.retentionUntil)
      : Number.NaN;
    if (!Number.isFinite(retentionUntil) || retentionUntil <= now) return;
    const timer = globalThis.setTimeout(
      () => setNow(Date.now()),
      Math.max(50, Math.min(60_000, retentionUntil - now + 50))
    );
    return () => globalThis.clearTimeout(timer);
  }, [artifact.retentionUntil, now]);

  if (availability.state !== 'READY') {
    if (availability.state === 'RETENTION_EXPIRED') {
      return (
        <Typography variant="caption" color="warning.main" role="status">
          {t('history.recap.artifacts.access.retentionExpired')}
        </Typography>
      );
    }
    if (
      availability.state === 'RETENTION_UNVERIFIED' ||
      availability.state === 'MEDIA_UNSUPPORTED'
    ) {
      return (
        <Typography variant="caption" color="text.secondary" role="status">
          {t('history.recap.artifacts.access.unverified')}
        </Typography>
      );
    }
    return null;
  }

  const openRecording = async () => {
    if (currentAccess.state === 'LOADING') return;
    if (deriveMeetingArtifactPlaybackAvailability(artifact).state !== 'READY') {
      setAccess({ state: 'ERROR', binding, failure: 'NOT_AVAILABLE' });
      setNow(Date.now());
      return;
    }
    const playbackWindow = globalThis.open('about:blank', '_blank');
    if (!playbackWindow) {
      setAccess({ state: 'ERROR', binding, failure: 'UNKNOWN' });
      return;
    }
    playbackWindow.opener = null;
    setAccess({ state: 'LOADING', binding });
    try {
      const ticket = await createVideoMeetingArtifactAccessTicket(
        meetingId,
        artifact.artifactId,
        artifact.version,
        artifact.contentType!,
        artifact.retentionUntil!
      );
      if (bindingRef.current !== binding) {
        playbackWindow.close();
        return;
      }
      playbackWindow.location.replace(ticket.accessUrl);
      setAccess({ state: 'OPENED', binding, expiresAt: ticket.expiresAt });
    } catch (error) {
      playbackWindow.close();
      if (bindingRef.current === binding) {
        setAccess({
          state: 'ERROR',
          binding,
          failure: classifyMeetingArtifactAccessFailure(error),
        });
      }
    }
  };

  const mediaLabel = availability.mediaKind === 'audio' ? 'audio' : 'video';
  return (
    <Stack gap={1} alignItems={{ xs: 'stretch', sm: 'flex-end' }} sx={{ minWidth: 0 }}>
      <ActionButton
        intent="secondary"
        size="small"
        startIcon={
          availability.mediaKind === 'audio' ? (
            <Headphones size={16} aria-hidden="true" />
          ) : (
            <Video size={16} aria-hidden="true" />
          )
        }
        endIcon={<ExternalLink size={15} aria-hidden="true" />}
        loading={currentAccess.state === 'LOADING'}
        loadingLabel={t('history.recap.artifacts.access.loading')}
        onClick={() => void openRecording()}
        sx={{ minHeight: 44, minWidth: 44 }}
      >
        {t(`history.recap.artifacts.access.open.${mediaLabel}`)}
      </ActionButton>
      {currentAccess.state === 'OPENED' && (
        <Typography variant="caption" color="success.main" role="status" aria-live="polite">
          {t('history.recap.artifacts.access.opened', {
            time: formatMeetingDateTime(currentAccess.expiresAt, i18n.language),
          })}
        </Typography>
      )}
      {currentAccess.state === 'ERROR' && (
        <Alert
          severity="error"
          role="alert"
          sx={{ maxWidth: 360, '& .MuiAlert-message': { overflowWrap: 'anywhere' } }}
        >
          {t(`history.recap.artifacts.access.errors.${currentAccess.failure}`)}
        </Alert>
      )}
    </Stack>
  );
}
