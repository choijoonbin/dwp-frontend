import { describe, expect, it } from 'vitest';

import { createMeetingJoinAttemptFence } from './meeting-join-attempt-fence';

describe('meeting join attempt fence', () => {
  it('rejects a late direct-join success after the user replaces the meeting code', () => {
    const fence = createMeetingJoinAttemptFence('AAAAAAAAAAAA');
    const resolution = fence.beginResolution('AAAAAAAAAAAA');
    expect(fence.acceptResolution(resolution, 'meeting-a')).toBe(true);
    const request = fence.beginRequest({
      meetingId: 'meeting-a',
      displayName: 'Mina Kim',
      requiresApproval: false,
    });
    expect(request).not.toBeNull();

    fence.replaceCode('BBBBBBBBBBBB');

    expect(fence.canCommitRequest(request!)).toBe(false);
    expect(fence.ownsMeeting('meeting-a')).toBe(false);
  });

  it('lets a new request supersede a pending request without accepting its late error', () => {
    const fence = createMeetingJoinAttemptFence('AAAAAAAAAAAA');
    const firstResolution = fence.beginResolution('AAAAAAAAAAAA');
    expect(fence.acceptResolution(firstResolution, 'meeting-a')).toBe(true);
    const firstRequest = fence.beginRequest({
      meetingId: 'meeting-a',
      displayName: 'Mina Kim',
      requiresApproval: false,
    });

    fence.replaceCode('BBBBBBBBBBBB');
    const secondResolution = fence.beginResolution('BBBBBBBBBBBB');
    expect(fence.acceptResolution(secondResolution, 'meeting-b')).toBe(true);
    const secondRequest = fence.beginRequest({
      meetingId: 'meeting-b',
      displayName: 'Mina Kim',
      requiresApproval: false,
    });

    expect(fence.canCommitRequest(firstRequest!)).toBe(false);
    expect(fence.canCommitRequest(secondRequest!)).toBe(true);
  });

  it('does not let an older resolution replace the latest code context', () => {
    const fence = createMeetingJoinAttemptFence('AAAAAAAAAAAA');
    const stale = fence.beginResolution('AAAAAAAAAAAA');
    const current = fence.beginResolution('BBBBBBBBBBBB');

    expect(fence.acceptResolution(stale, 'meeting-a')).toBe(false);
    expect(fence.canCommitResolution(stale)).toBe(false);
    expect(fence.acceptResolution(current, 'meeting-b')).toBe(true);
    expect(fence.ownsMeeting('meeting-b')).toBe(true);
  });
});
