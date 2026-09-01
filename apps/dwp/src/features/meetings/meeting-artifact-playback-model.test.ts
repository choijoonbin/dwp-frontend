import { describe, expect, it } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import type { VideoMeetingArtifact } from '@dwp-frontend/shared-utils/api/video-meeting-api';

import {
  classifyMeetingArtifactAccessFailure,
  deriveMeetingArtifactPlaybackAvailability,
} from './meeting-artifact-playback-model';

const artifact: VideoMeetingArtifact = {
  artifactId: 'artifact-1',
  artifactType: 'RECORDING',
  artifactState: 'AVAILABLE',
  contentType: 'video/mp4',
  sizeBytes: 4_096,
  retentionUntil: '2026-09-01T00:00:00Z',
  metadata: {},
  version: 3,
};

describe('meeting artifact playback policy', () => {
  it('allows only an available playable recording with verified future retention', () => {
    expect(
      deriveMeetingArtifactPlaybackAvailability(artifact, Date.parse('2026-08-31T00:00:00Z'))
    ).toEqual({ state: 'READY', mediaKind: 'video' });
    expect(
      deriveMeetingArtifactPlaybackAvailability(
        { ...artifact, contentType: 'audio/webm' },
        Date.parse('2026-08-31T00:00:00Z')
      )
    ).toEqual({ state: 'READY', mediaKind: 'audio' });
  });

  it.each([
    [{ ...artifact, artifactType: 'TRANSCRIPT' }, 'NOT_RECORDING'],
    [{ ...artifact, artifactState: 'PROCESSING' }, 'NOT_AVAILABLE'],
    [{ ...artifact, retentionUntil: null }, 'RETENTION_UNVERIFIED'],
    [{ ...artifact, retentionUntil: 'invalid' }, 'RETENTION_UNVERIFIED'],
    [{ ...artifact, retentionUntil: '2026-08-30T00:00:00Z' }, 'RETENTION_EXPIRED'],
    [{ ...artifact, contentType: 'application/json' }, 'MEDIA_UNSUPPORTED'],
  ] as const)('fails closed for %s', (candidate, state) => {
    expect(
      deriveMeetingArtifactPlaybackAvailability(
        candidate as VideoMeetingArtifact,
        Date.parse('2026-08-31T00:00:00Z')
      )
    ).toEqual({ state });
  });

  it('maps server failures to stable UX categories without exposing raw messages', () => {
    expect(
      classifyMeetingArtifactAccessFailure(
        new HttpError('raw provider detail', 409, { errorCode: 'OBJECT_VERSION_CONFLICT' })
      )
    ).toBe('STALE');
    expect(
      classifyMeetingArtifactAccessFailure(
        new HttpError('object key leaked here', 503, { errorCode: 'EXTERNAL_SERVICE_ERROR' })
      )
    ).toBe('SERVICE_UNAVAILABLE');
    expect(
      classifyMeetingArtifactAccessFailure(
        new HttpError('unknown artifact', 404, { errorCode: 'ENTITY_NOT_FOUND' })
      )
    ).toBe('NOT_AUTHORIZED');
    expect(classifyMeetingArtifactAccessFailure(new TypeError('invalid ticket'))).toBe(
      'INVALID_TICKET'
    );
  });
});
