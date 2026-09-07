// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ReactI18next from 'react-i18next';
import type { VideoMeetingFacilitationSnapshot } from '@dwp-frontend/shared-utils/api/video-meeting-facilitation-api';

const runtime = vi.hoisted(() => ({
  read: vi.fn(),
  preparation: vi.fn(),
  ask: vi.fn(),
  upvote: vi.fn(),
  answer: vi.fn(),
  dismiss: vi.fn(),
  createPoll: vi.fn(),
  pollState: vi.fn(),
  vote: vi.fn(),
  timerStart: vi.fn(),
  timerState: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils/api/video-meeting-facilitation-api', () => ({
  getVideoMeetingFacilitation: runtime.read,
  askVideoMeetingQuestion: runtime.ask,
  upvoteVideoMeetingQuestion: runtime.upvote,
  answerVideoMeetingQuestion: runtime.answer,
  dismissVideoMeetingQuestion: runtime.dismiss,
  createVideoMeetingPoll: runtime.createPoll,
  transitionVideoMeetingPoll: runtime.pollState,
  voteVideoMeetingPoll: runtime.vote,
  startVideoMeetingAgendaTimer: runtime.timerStart,
  transitionVideoMeetingAgendaTimer: runtime.timerState,
}));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-preparation-api', () => ({
  getVideoMeetingPreparation: runtime.preparation,
}));
vi.mock('react-i18next', async (original) => ({
  ...(await original<typeof ReactI18next>()),
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

import { MeetingLiveFacilitation } from './meeting-live-facilitation';

const snapshot: VideoMeetingFacilitationSnapshot = {
  transport: 'POLLING',
  pollingIntervalMillis: 10_000,
  serverTime: '2026-09-04T05:00:00Z',
  sequence: 3,
  capabilities: {
    meetingLive: true,
    canAskQuestion: true,
    canVote: true,
    canModerate: true,
  },
  timer: {
    state: 'IDLE',
    agendaItemId: null,
    agendaItemTitle: null,
    plannedSeconds: null,
    elapsedSeconds: 0,
    remainingSeconds: null,
    runningSince: null,
    version: 0,
  },
  questions: [
    {
      questionId: 'question-1',
      state: 'OPEN',
      text: 'What is the decision?',
      authorDisplayName: 'Participant',
      answer: null,
      upvoteCount: 2,
      upvotedByMe: false,
      mine: false,
      canModerate: true,
      version: 0,
      sequence: 1,
      createdAt: '2026-09-04T04:59:00Z',
      answeredAt: null,
    },
  ],
  polls: [
    {
      pollId: 'poll-1',
      state: 'OPEN',
      question: 'Choose the release window',
      anonymous: true,
      options: [
        { optionId: 'option-1', position: 0, label: 'Morning', voteCount: 2 },
        { optionId: 'option-2', position: 1, label: 'Evening', voteCount: 1 },
      ],
      totalVotes: 3,
      myOptionId: null,
      myBallotVersion: 0,
      canVote: true,
      canModerate: true,
      version: 1,
      sequence: 2,
      openedAt: '2026-09-04T04:58:00Z',
      closedAt: null,
    },
  ],
};

let root: Root;
let container: HTMLDivElement;
let client: QueryClient;

async function render() {
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(MeetingLiveFacilitation, {
          meetingId: 'meeting-1',
          onClose: vi.fn(),
        })
      )
    );
  });
}

async function expectText(value: string) {
  await act(async () => {
    await vi.waitFor(() => expect(container.textContent).toContain(value));
  });
}

describe('meeting live facilitation runtime', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    for (const value of Object.values(runtime)) value.mockReset();
    runtime.read.mockResolvedValue(snapshot);
    runtime.preparation.mockResolvedValue({
      agendaItems: [{ itemId: 'agenda-1', title: 'Release decision' }],
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
  });

  it('shows polling truth, accessible tools, and host-only moderation from verified capabilities', async () => {
    await render();
    await expectText('What is the decision?');

    expect(container.textContent).toContain('liveFacilitation.polling');
    expect(container.textContent).toContain('What is the decision?');
    expect(container.textContent).toContain('Choose the release window');
    expect(container.textContent).toContain('liveFacilitation.questions.answer');
    expect(container.textContent).toContain('liveFacilitation.poll.close');
    expect(container.querySelectorAll('section[aria-labelledby]').length).toBe(3);
    expect(runtime.preparation).toHaveBeenCalledWith('meeting-1', expect.any(AbortSignal));
  });

  it('fails closed instead of rendering empty interactive state when verification fails', async () => {
    runtime.read.mockRejectedValue(new Error('membership unavailable'));
    await render();
    await expectText('liveFacilitation.unavailableTitle');

    expect(container.textContent).not.toContain('liveFacilitation.poll.empty');
    expect(container.textContent).not.toContain('liveFacilitation.questions.ask');
    expect(runtime.preparation).not.toHaveBeenCalled();
  });
});
