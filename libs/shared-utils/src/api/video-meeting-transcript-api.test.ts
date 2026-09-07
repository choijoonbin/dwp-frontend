import { beforeEach, describe, expect, it, vi } from 'vitest';

import { axiosInstance } from '../axios-instance';
import type { VideoMeetingArtifact } from './video-meeting-api';
import {
  normalizeVideoMeetingTranscriptPage,
  queryVideoMeetingTranscript,
} from './video-meeting-transcript-api';

vi.mock('../axios-instance', () => ({
  axiosInstance: { post: vi.fn() },
}));

const artifact: VideoMeetingArtifact = {
  artifactId: '00000000-0000-4000-8000-000000000001',
  artifactType: 'TRANSCRIPT',
  artifactState: 'AVAILABLE',
  retentionUntil: '2099-09-04T00:00:00Z',
  metadata: {},
  version: 4,
};

describe('video meeting transcript API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts search terms in a bounded body rather than the URL', async () => {
    vi.mocked(axiosInstance.post).mockResolvedValue({
      data: {
        data: {
          artifactId: artifact.artifactId,
          artifactVersion: 4,
          segments: [],
          nextCursor: null,
          hasMore: false,
          queryApplied: true,
          retentionUntil: artifact.retentionUntil!,
        },
      },
    });

    await queryVideoMeetingTranscript('meeting/1', artifact, { query: '결정 사항' });

    expect(axiosInstance.post).toHaveBeenCalledWith(
      expect.stringContaining(
        '/meeting%2F1/artifacts/00000000-0000-4000-8000-000000000001/transcript/query'
      ),
      expect.objectContaining({ query: '결정 사항', cursor: 0, pageSize: 25 })
    );
    expect(vi.mocked(axiosInstance.post).mock.calls[0]?.[0]).not.toContain('결정');
  });

  it('rejects stale or unbounded transcript payloads', () => {
    expect(() =>
      normalizeVideoMeetingTranscriptPage(
        {
          artifactId: artifact.artifactId,
          artifactVersion: 3,
          segments: [],
          nextCursor: null,
          hasMore: false,
          queryApplied: false,
          retentionUntil: artifact.retentionUntil!,
        },
        artifact
      )
    ).toThrow(TypeError);
    expect(() =>
      normalizeVideoMeetingTranscriptPage(
        {
          artifactId: artifact.artifactId,
          artifactVersion: 4,
          segments: Array.from({ length: 51 }, (_, index) => ({
            segmentId: `s-${index}`,
            startMillis: index * 1_000,
            endMillis: index * 1_000 + 500,
            text: 'bounded',
          })),
          nextCursor: null,
          hasMore: false,
          queryApplied: false,
          retentionUntil: artifact.retentionUntil!,
        },
        artifact
      )
    ).toThrow(TypeError);
  });
});
