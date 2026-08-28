import { describe, expect, it } from 'vitest';

import { authorizeReceivedMeetingReaction } from './meeting-reaction-policy';

const NOW = Date.parse('2026-08-28T03:00:00Z');
const MEETING_ID = '81000000-0000-0000-0000-000000000001';

function payload(overrides: Record<string, unknown> = {}) {
  return new TextEncoder().encode(
    JSON.stringify({
      type: 'REACTION',
      id: 'reaction-1',
      emoji: '👏',
      senderName: 'Spoofed display name',
      sentAt: NOW,
      ...overrides,
    })
  );
}

function sender(overrides: Record<string, unknown> = {}) {
  return {
    identity: 'tenant:1:user:42',
    name: 'Verified sender',
    metadata: JSON.stringify({ meetingId: MEETING_ID, reactionsAllowed: true }),
    permissions: { canPublishData: true },
    ...overrides,
  };
}

describe('received meeting reaction policy', () => {
  it('accepts only an authorized sender and ignores the spoofable payload display name', () => {
    expect(
      authorizeReceivedMeetingReaction({
        payload: payload(),
        sender: sender(),
        meetingId: MEETING_ID,
        receiverAllowsReactions: true,
        now: NOW,
      })
    ).toEqual({
      id: 'reaction-1',
      emoji: '👏',
      senderName: 'Verified sender',
      sentAt: NOW,
    });
  });

  it('blocks a generic data publisher whose immutable reaction claim is false', () => {
    expect(
      authorizeReceivedMeetingReaction({
        payload: payload(),
        sender: sender({
          metadata: JSON.stringify({ meetingId: MEETING_ID, reactionsAllowed: false }),
        }),
        meetingId: MEETING_ID,
        receiverAllowsReactions: true,
        now: NOW,
      })
    ).toBeNull();
  });

  it('blocks policy-disabled receivers and senders without data permission', () => {
    const input = { payload: payload(), sender: sender(), meetingId: MEETING_ID, now: NOW };
    expect(
      authorizeReceivedMeetingReaction({ ...input, receiverAllowsReactions: false })
    ).toBeNull();
    expect(
      authorizeReceivedMeetingReaction({
        ...input,
        sender: sender({ permissions: { canPublishData: false } }),
        receiverAllowsReactions: true,
      })
    ).toBeNull();
  });

  it('blocks absent, malformed, or cross-meeting server metadata', () => {
    const authorize = (metadata?: string) =>
      authorizeReceivedMeetingReaction({
        payload: payload(),
        sender: sender({ metadata }),
        meetingId: MEETING_ID,
        receiverAllowsReactions: true,
        now: NOW,
      });

    expect(authorize()).toBeNull();
    expect(authorize('{bad-json')).toBeNull();
    expect(
      authorize(JSON.stringify({ meetingId: 'different-meeting', reactionsAllowed: true }))
    ).toBeNull();
  });

  it('blocks malformed, unsupported, stale, and oversized reaction payloads', () => {
    const authorize = (candidate: Uint8Array) =>
      authorizeReceivedMeetingReaction({
        payload: candidate,
        sender: sender(),
        meetingId: MEETING_ID,
        receiverAllowsReactions: true,
        now: NOW,
      });

    expect(authorize(payload({ emoji: '🧨' }))).toBeNull();
    expect(authorize(payload({ sentAt: NOW - 6 * 60 * 1_000 }))).toBeNull();
    expect(authorize(new Uint8Array(1_025))).toBeNull();
    expect(authorize(new TextEncoder().encode('{bad-json'))).toBeNull();
  });
});
