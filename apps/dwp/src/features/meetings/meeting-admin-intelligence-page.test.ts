// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MeetingAdminIntelligencePage } from './meeting-admin-intelligence-page';

const api = vi.hoisted(() => ({
  getPolicy: vi.fn(),
  getReadiness: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils/api/video-meeting-api', () => ({
  getVideoMeetingAdminPolicy: api.getPolicy,
}));

vi.mock('@dwp-frontend/shared-utils/api/video-meeting-admin-intelligence-api', () => ({
  getVideoMeetingAdminIntelligenceReadiness: api.getReadiness,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@dwp-frontend/design-system', () => ({
  LoadingState: ({ label }: { label: string }) => createElement('div', null, label),
  PageCanvas: ({ children }: { children: React.ReactNode }) =>
    createElement('main', null, children),
}));

vi.mock('./meeting-admin-intelligence', () => ({
  MeetingAdminIntelligence: ({
    readiness,
    sourceFailures,
  }: {
    readiness: {
      capabilities: { recording: { state: string; reason?: string } };
      retention: { meetingDays: number | null };
    };
    sourceFailures: Array<{ key: string }>;
  }) =>
    createElement('output', {
      'data-recording': readiness.capabilities.recording.state,
      'data-reason': readiness.capabilities.recording.reason,
      'data-retention': readiness.retention.meetingDays,
      'data-failures': sourceFailures.map(({ key }) => key).join(','),
    }),
}));

const policy = {
  meetingsEnabled: true,
  waitingRoomRequired: true,
  guestsAllowed: false,
  participantChatAllowed: true,
  reactionsAllowed: true,
  screenShareAllowed: true,
  unmuteControl: 'REQUEST_ONLY',
  recordingPolicy: 'HOST_OPT_IN',
  allowJoinBeforeHost: false,
  requireAuthenticatedInternalUsers: true,
  maximumParticipants: 100,
  retentionDays: 90,
  artifactRetentionDays: 30,
  chatRetentionDays: 60,
  recordingConfigured: true,
  aiNotesConfigured: true,
  version: 4,
};

const readiness = {
  readinessVersion: 'meeting-intelligence-readiness-v1',
  observedAt: '2026-08-29T06:00:00Z',
  recordingPolicy: 'HOST_OPT_IN',
  providerCode: 'managed-provider',
  providerModel: 'enterprise-model',
  processingRegion: 'kr-central-1',
  capabilities: {
    recording: { state: 'READY' },
    transcript: { state: 'READY' },
    aiNotes: { state: 'READY' },
  },
  dependencies: Object.fromEntries(
    ['provider', 'region', 'kms', 'audit', 'egress', 'storage', 'stt', 'llm'].map((key) => [
      key,
      { state: 'READY' },
    ])
  ),
  governance: Object.fromEntries(
    ['humanReview', 'explicitPublish', 'adminContentAccess', 'legalHold', 'deletionEvidence'].map(
      (key) => [key, { state: 'READY' }]
    )
  ),
  retention: {
    meetingDays: 90,
    artifactDays: 30,
    chatDays: 60,
    intelligenceWorkerReady: true,
  },
};

let root: Root;
let container: HTMLDivElement;
let queryClient: QueryClient;

async function mountPage() {
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(MeetingAdminIntelligencePage)
      )
    );
  });
}

describe('MeetingAdminIntelligencePage source isolation', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    api.getPolicy.mockReset().mockResolvedValue(policy);
    api.getReadiness.mockReset().mockResolvedValue(readiness);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('fails runtime controls closed while retaining independently loaded policy windows', async () => {
    api.getReadiness.mockRejectedValue(new Error('readiness unavailable'));
    await mountPage();

    await vi.waitFor(
      () => expect(container.querySelector('output')?.dataset.recording).toBe('NOT_VERIFIED'),
      { timeout: 3_000 }
    );
    const output = container.querySelector('output');
    expect(output?.dataset.reason).toBe('READINESS_ENDPOINT_UNAVAILABLE');
    expect(output?.dataset.retention).toBe('90');
    expect(output?.dataset.failures).toBe('readiness');
  });

  it('keeps runtime evidence visible when the policy refresh fails independently', async () => {
    api.getPolicy.mockRejectedValue(new Error('policy unavailable'));
    await mountPage();

    await vi.waitFor(
      () => expect(container.querySelector('output')?.dataset.failures).toBe('policy'),
      { timeout: 3_000 }
    );
    expect(container.querySelector('output')?.dataset.recording).toBe('READY');
    expect(container.querySelector('output')?.dataset.retention).toBe('90');
  });
});
