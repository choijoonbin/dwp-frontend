import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Headphones, Play, Video } from 'lucide-react';
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
import { useMeetingPlaybackSync } from './meeting-playback-sync';

type AccessState =
  | { state: 'IDLE'; binding: string }
  | { state: 'LOADING'; binding: string }
  | { state: 'READY'; binding: string; accessUrl: string; expiresAt: string }
  | { state: 'ERROR'; binding: string; failure: MeetingArtifactAccessFailure };

export function MeetingArtifactPlayback({
  meetingId,
  artifact,
}: {
  meetingId: string;
  artifact: VideoMeetingArtifact;
}) {
  const { t, i18n } = useTranslation('meetings');
  const playbackSync = useMeetingPlaybackSync();
  const registerAccessRequest = playbackSync?.registerAccessRequest;
  const registerMedia = playbackSync?.registerMedia;
  const binding = `${artifact.artifactId}:${artifact.version}:${artifact.contentType ?? ''}:${artifact.retentionUntil ?? ''}`;
  const bindingRef = useRef(binding);
  const requestGenerationRef = useRef(0);
  bindingRef.current = binding;
  const [access, setAccess] = useState<AccessState>({ state: 'IDLE', binding });
  const currentAccess = useMemo<AccessState>(
    () => (access.binding === binding ? access : { state: 'IDLE', binding }),
    [access, binding]
  );
  const [now, setNow] = useState(() => Date.now());
  const availability = deriveMeetingArtifactPlaybackAvailability(artifact, now);
  const requestRecording = useCallback(async () => {
    if (currentAccess.state === 'LOADING') return;
    if (deriveMeetingArtifactPlaybackAvailability(artifact).state !== 'READY') {
      setAccess({ state: 'ERROR', binding, failure: 'NOT_AVAILABLE' });
      setNow(Date.now());
      return;
    }
    const requestGeneration = ++requestGenerationRef.current;
    setAccess({ state: 'LOADING', binding });
    try {
      const ticket = await createVideoMeetingArtifactAccessTicket(
        meetingId,
        artifact.artifactId,
        artifact.version,
        artifact.contentType!,
        artifact.retentionUntil!
      );
      if (bindingRef.current !== binding || requestGenerationRef.current !== requestGeneration) {
        return;
      }
      setAccess({
        state: 'READY',
        binding,
        accessUrl: ticket.accessUrl,
        expiresAt: ticket.expiresAt,
      });
    } catch (error) {
      if (bindingRef.current === binding && requestGenerationRef.current === requestGeneration) {
        setAccess({
          state: 'ERROR',
          binding,
          failure: classifyMeetingArtifactAccessFailure(error),
        });
      }
    }
  }, [artifact, binding, currentAccess.state, meetingId]);

  useEffect(
    () => () => {
      requestGenerationRef.current += 1;
    },
    [binding]
  );

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

  useEffect(() => {
    registerAccessRequest?.(() => void requestRecording());
    return () => registerAccessRequest?.(null);
  }, [registerAccessRequest, requestRecording]);

  useEffect(() => {
    if (currentAccess.state !== 'READY') return;
    const expiresAt = Date.parse(currentAccess.expiresAt);
    const timeout = expiresAt - Date.now();
    if (!Number.isFinite(expiresAt) || timeout <= 0) {
      registerMedia?.(null);
      setAccess({ state: 'IDLE', binding });
      return;
    }
    const timer = globalThis.setTimeout(
      () => {
        registerMedia?.(null);
        setAccess({ state: 'IDLE', binding });
      },
      Math.min(timeout + 50, 2_147_483_647)
    );
    return () => globalThis.clearTimeout(timer);
  }, [binding, currentAccess, registerMedia]);

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
        endIcon={<Play size={15} aria-hidden="true" />}
        loading={currentAccess.state === 'LOADING'}
        loadingLabel={t('history.recap.artifacts.access.loading')}
        onClick={() => void requestRecording()}
        sx={{ minHeight: 44, minWidth: 44 }}
      >
        {t(`history.recap.artifacts.access.open.${mediaLabel}`)}
      </ActionButton>
      {currentAccess.state === 'READY' && (
        <Stack gap={0.75} sx={{ width: '100%', minWidth: 0 }}>
          {availability.mediaKind === 'audio' ? (
            <audio
              ref={(element) => registerMedia?.(element)}
              controls
              preload="metadata"
              src={currentAccess.accessUrl}
              aria-label={t('history.recap.artifacts.access.player.audio')}
              onLoadedMetadata={(event) => registerMedia?.(event.currentTarget)}
            />
          ) : (
            <video
              ref={(element) => registerMedia?.(element)}
              controls
              playsInline
              preload="metadata"
              src={currentAccess.accessUrl}
              aria-label={t('history.recap.artifacts.access.player.video')}
              onLoadedMetadata={(event) => registerMedia?.(event.currentTarget)}
              style={{ width: '100%', maxHeight: 280 }}
            />
          )}
          <Typography variant="caption" color="success.main" role="status" aria-live="polite">
            {t('history.recap.artifacts.access.inlineReady', {
              time: formatMeetingDateTime(currentAccess.expiresAt, i18n.language),
            })}
          </Typography>
        </Stack>
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
