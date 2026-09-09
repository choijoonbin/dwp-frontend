import { beforeEach, describe, expect, it, vi } from 'vitest';
const runtime = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('../axios-instance', () => ({ axiosInstance: { post: runtime.post } }));
import { disconnectVideoMeetingParticipant } from './video-meeting-moderation-api';
const meetingId = '87000000-0000-4000-8000-000000000001';
const participantId = '87000000-0000-4000-8000-000000000002';
const commandId = '87000000-0000-4000-8000-000000000003';
const key = '87000000-0000-4000-8000-000000000004';
const authority = {
  mode: 'SECURE' as const,
  rolloutState: '110' as const,
  expectedDecisionRevision: 'decision-revision-7',
  contextKey: 'meetings.work',
  contextScopeKey: 'tenant:1',
};
const receipt = {
  meetingId,
  participantId,
  commandId,
  state: 'DISCONNECTED',
  blockedForCurrentSession: true,
};
describe('meeting participant disconnect boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtime.post.mockResolvedValue({ data: { data: receipt } });
  });
  it('binds current participant version and stable command key', async () => {
    await expect(
      disconnectVideoMeetingParticipant(meetingId, participantId, 7, key, authority)
    ).resolves.toEqual(receipt);
    expect(runtime.post).toHaveBeenCalledWith(
      expect.stringContaining(`/meetings/${meetingId}/participants/${participantId}/disconnect`),
      { expectedVersion: 7 },
      {
        contextScopeKey: 'tenant:1',
        headers: {
          'X-DWP-Expected-Decision-Revision': 'decision-revision-7',
          'Idempotency-Key': key,
        },
      }
    );
  });
  it.each(['PENDING', 'DISCONNECTED'])(
    'preserves authoritative %s without manufacturing success',
    async (state) => {
      runtime.post.mockResolvedValue({ data: { data: { ...receipt, state } } });
      expect(
        (await disconnectVideoMeetingParticipant(meetingId, participantId, 7, key, authority)).state
      ).toBe(state);
    }
  );
  it.each([
    { meetingId: commandId },
    { participantId: commandId },
    { commandId: 'bad' },
    { state: 'SUCCEEDED' },
    { blockedForCurrentSession: false },
  ])('rejects mismatched or unsupported receipt %o', async (change) => {
    runtime.post.mockResolvedValue({ data: { data: { ...receipt, ...change } } });
    await expect(
      disconnectVideoMeetingParticipant(meetingId, participantId, 7, key, authority)
    ).rejects.toThrow('receipt');
  });
  it('rejects noncanonical paths and invalid CAS before network access', async () => {
    await expect(
      disconnectVideoMeetingParticipant('../other', participantId, 7, key, authority)
    ).rejects.toThrow();
    await expect(
      disconnectVideoMeetingParticipant(meetingId, participantId, -1, key, authority)
    ).rejects.toThrow();
    expect(runtime.post).not.toHaveBeenCalled();
  });
});
