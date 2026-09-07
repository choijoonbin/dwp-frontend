import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  askVideoMeetingQuestion,
  getVideoMeetingFacilitation,
  voteVideoMeetingPoll,
  type VideoMeetingFacilitationPoll,
  type VideoMeetingFacilitationQuestion,
  type VideoMeetingFacilitationSnapshot,
} from './video-meeting-facilitation-api';

const meetingId = '11111111-1111-4111-8111-111111111111';
const commandId = '22222222-2222-4222-8222-222222222222';
const serverTime = '2026-09-04T05:00:00Z';
const question: VideoMeetingFacilitationQuestion = {
  questionId: '33333333-3333-4333-8333-333333333333',
  state: 'OPEN',
  text: 'What is the decision?',
  authorDisplayName: 'Meeting participant',
  answer: null,
  upvoteCount: 1,
  upvotedByMe: false,
  mine: true,
  canModerate: false,
  version: 0,
  sequence: 1,
  createdAt: serverTime,
  answeredAt: null,
};
const poll: VideoMeetingFacilitationPoll = {
  pollId: '44444444-4444-4444-8444-444444444444',
  state: 'OPEN',
  question: 'Choose one',
  anonymous: true,
  options: [
    {
      optionId: '55555555-5555-4555-8555-555555555555',
      position: 0,
      label: 'Option A',
      voteCount: 1,
    },
    {
      optionId: '66666666-6666-4666-8666-666666666666',
      position: 1,
      label: 'Option B',
      voteCount: 0,
    },
  ],
  totalVotes: 1,
  myOptionId: null,
  myBallotVersion: 0,
  canVote: true,
  canModerate: false,
  version: 1,
  sequence: 2,
  openedAt: serverTime,
  closedAt: null,
};
const snapshot: VideoMeetingFacilitationSnapshot = {
  transport: 'POLLING',
  pollingIntervalMillis: 3_000,
  serverTime,
  sequence: 2,
  capabilities: {
    meetingLive: true,
    canAskQuestion: true,
    canVote: true,
    canModerate: false,
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
  questions: [question],
  polls: [poll],
};

const response = (data: unknown) =>
  ({ ok: true, status: 200, text: async () => JSON.stringify({ data }) }) as Response;

afterEach(() => {
  vi.unstubAllGlobals();
  resetCsrfToken();
});

describe('video meeting live facilitation boundary', () => {
  it('reads the meeting-bound polling snapshot and removes unexpected response fields', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(response({ ...snapshot, unexpectedTranscript: 'must not enter cache' }));
    vi.stubGlobal('fetch', fetcher);

    const result = await getVideoMeetingFacilitation(meetingId);

    expect(fetcher.mock.calls[0]?.[0]).toBe(`/api/meetings/v1/meetings/${meetingId}/facilitation`);
    expect(result).toEqual(snapshot);
    expect(result).not.toHaveProperty('unexpectedTranscript');
  });

  it.each([
    { ...snapshot, transport: 'WEBSOCKET' },
    { ...snapshot, capabilities: { ...snapshot.capabilities, canVote: 'yes' } },
    { ...snapshot, serverTime: 'not-an-instant' },
    {
      ...snapshot,
      capabilities: { ...snapshot.capabilities, meetingLive: false, canVote: false },
    },
    {
      ...snapshot,
      polls: [{ ...poll, totalVotes: 99 }],
    },
  ])('fails closed for partial or misleading snapshots', async (invalid) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(invalid)));
    await expect(getVideoMeetingFacilitation(meetingId)).rejects.toThrow(
      'Meeting facilitation returned an invalid snapshot.'
    );
  });

  it('sends a UUID idempotency key and an exact question command body', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response({ resource: question, sequence: 3, serverTime }));
    vi.stubGlobal('fetch', fetcher);

    const result = await askVideoMeetingQuestion(meetingId, '  What is the decision?  ', commandId);
    const [url, request] = fetcher.mock.calls[1] as [string, RequestInit];

    expect(url).toBe(`/api/meetings/v1/meetings/${meetingId}/facilitation/questions`);
    expect(new Headers(request.headers).get('Idempotency-Key')).toBe(commandId);
    expect(JSON.parse(String(request.body))).toEqual({ text: 'What is the decision?' });
    expect(result).toEqual({ resource: question, sequence: 3, serverTime });
  });

  it('sends the current ballot version and rejects malformed command ids before network access', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);

    await expect(
      voteVideoMeetingPoll(
        meetingId,
        poll.pollId,
        poll.options[0]!.optionId,
        poll.myBallotVersion,
        'not-a-uuid'
      )
    ).rejects.toThrow('Meeting facilitation commands require a UUID idempotency key.');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
