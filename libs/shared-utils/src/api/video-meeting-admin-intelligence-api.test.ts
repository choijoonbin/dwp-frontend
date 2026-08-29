import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import { getVideoMeetingAdminIntelligenceReadiness } from './video-meeting-admin-intelligence-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

describe('video meeting admin intelligence API boundary', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('loads authoritative runtime readiness without projecting configuration into readiness', async () => {
    const readiness = {
      readinessVersion: 'meeting-intelligence-readiness-v1',
      observedAt: '2026-08-29T06:00:00Z',
      recordingPolicy: 'HOST_OPT_IN',
      providerCode: 'managed-provider',
      providerModel: 'enterprise-model',
      processingRegion: 'kr-central-1',
      capabilities: { recording: { state: 'READY' } },
      dependencies: { kms: { state: 'BLOCKED', reason: 'KMS_NOT_READY' } },
      governance: { humanReview: { state: 'READY' } },
      retention: {
        meetingDays: 90,
        artifactDays: 30,
        chatDays: 60,
        intelligenceWorkerReady: true,
        signals: {
          intelligenceReports: { state: 'READY' },
          meetingRecords: {
            state: 'NOT_VERIFIED',
            reason: 'MEETING_RECORD_RETENTION_WORKER_NOT_CONFIGURED',
          },
          artifacts: {
            state: 'NOT_VERIFIED',
            reason: 'ARTIFACT_RETENTION_WORKER_NOT_CONFIGURED',
          },
          chat: {
            state: 'NOT_VERIFIED',
            reason: 'CHAT_RETENTION_WORKER_NOT_CONFIGURED',
          },
        },
      },
    } as const;
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(readiness));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getVideoMeetingAdminIntelligenceReadiness()).resolves.toEqual(readiness);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/meetings/v1/admin/intelligence/readiness',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
  });
});
