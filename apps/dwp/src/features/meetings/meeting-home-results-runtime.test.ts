// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SharedUtils from '@dwp-frontend/shared-utils';
import type * as ReactI18next from 'react-i18next';
import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import type { VideoMeetingIntelligenceReport } from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';

const api = vi.hoisted(() => ({ latest: vi.fn(), published: vi.fn() }));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-intelligence-api', () => ({
  getLatestVisibleVideoMeetingIntelligenceReport: api.latest,
  getLatestPublishedVideoMeetingIntelligenceReport: api.published,
}));
vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedUtils>()),
  useAuth: () => ({ user: { tenantId: 1, userId: 7 }, isAuthenticated: true }),
}));
vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof ReactI18next>()),
  useTranslation: () => ({
    t: (key: string, options?: { date?: string }) => options?.date ?? key,
    i18n: { resolvedLanguage: 'en-US' },
  }),
}));

import { MeetingHomeResults } from './meeting-home-results';

const published: VideoMeetingIntelligenceReport = {
  reportId: 'report-1',
  meetingId: 'meeting-1',
  runId: 'run-1',
  state: 'PUBLISHED',
  audience: 'MEETING_PARTICIPANTS',
  schemaVersion: 'meeting-intelligence-v1',
  retentionUntil: '2100-09-20T00:00:00Z',
  legalHold: false,
  version: 1,
  publishedAt: '2026-09-04T03:00:00Z',
  canCurrentViewerReview: false,
  reviews: [],
  analysis: {
    executiveSummary: { text: 'A published recap, authorized after mount.', citations: [] },
    topics: [],
    decisions: [],
    actionItems: [],
    openQuestions: [],
    risks: [],
    conversationClimate: { label: 'INSUFFICIENT_EVIDENCE', signals: [], citations: [] },
  },
};
const recent = [{ meetingId: 'meeting-1', title: 'Planning meeting' }] as VideoMeetingSummary[];
let root: Root | null = null;
let container: HTMLDivElement;
let client: QueryClient;

async function mount() {
  await act(async () => {
    root?.render(
      createElement(
        StrictMode,
        null,
        createElement(
          QueryClientProvider,
          { client },
          createElement(
            MemoryRouter,
            null,
            createElement(MeetingHomeResults, { recent, section: 'recent', timeZone: 'Asia/Seoul' })
          )
        )
      )
    );
  });
}

async function waitForContent(text: string) {
  await act(async () => {
    await vi.waitFor(() => expect(container.textContent).toContain(text));
  });
}

describe('meeting home results StrictMode runtime', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    api.published.mockReset();
    api.latest.mockReset();
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    root = null;
    client.clear();
    container.remove();
    vi.restoreAllMocks();
  });

  it('revalidates after the StrictMode cleanup replay and renders explicit home timezone', async () => {
    api.published.mockResolvedValue(published);
    await mount();
    await waitForContent('A published recap, authorized after mount.');
    expect(container.textContent).not.toContain('home.results.errorTitle');
    expect(container.textContent).toContain('12:00 PM');
    expect(client.getQueryCache().getAll()[0].options.gcTime).toBe(0);
  });

  it('removes a published snippet on a denied refresh instead of keeping cached data', async () => {
    api.published.mockResolvedValue(published);
    await mount();
    await waitForContent('A published recap, authorized after mount.');
    api.published.mockRejectedValue({ status: 403 });
    await act(async () => {
      await client.refetchQueries({ queryKey: ['meetings', 'home', 'results'] });
    });
    expect(container.textContent).not.toContain('A published recap, authorized after mount.');
    expect(container.textContent).toContain('home.results.errorTitle');
  });
});
