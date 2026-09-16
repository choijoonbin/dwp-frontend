import { describe, expect, it } from 'vitest';
import {
  WORK_MESSENGER_CAPTURE_TTL_MS,
  createWorkMessengerCaptureState,
  readWorkMessengerCaptureState,
  workMessengerSourceReference,
} from '../../components/work-messenger-capture-state';

const conversationId = '10000000-0000-4000-8000-000000000001';
const messageId = '20000000-0000-4000-8000-000000000002';

describe('Work Messenger capture route state', () => {
  it('carries only owner-bound identity and converts it to the governed source reference', () => {
    const state = createWorkMessengerCaptureState(
      'tenant-1:user-7',
      conversationId,
      messageId,
      100
    );
    expect(JSON.stringify(state)).not.toContain('message body');
    const capture = readWorkMessengerCaptureState(state, 'tenant-1:user-7', 200);
    expect(capture).toEqual({
      owner: 'tenant-1:user-7',
      conversationId,
      messageId,
      createdAt: 100,
    });
    expect(workMessengerSourceReference(capture!)).toEqual({
      sourceSystem: 'MESSAGING_MESSAGE',
      sourceReference: conversationId,
      obligationKey: messageId,
    });
    expect(
      createWorkMessengerCaptureState(
        'tenant-1:user-7',
        '71000000-0000-0000-0000-000000000001',
        '72000000-0000-0000-0000-000000000001',
        100
      )
    ).toBeDefined();
  });

  it('rejects owner changes, expiry, future timestamps, malformed ids and extra metadata', () => {
    const state = createWorkMessengerCaptureState('owner-a', conversationId, messageId, 1_000);
    expect(readWorkMessengerCaptureState(state, 'owner-b', 1_001)).toBeNull();
    expect(
      readWorkMessengerCaptureState(state, 'owner-a', 1_000 + WORK_MESSENGER_CAPTURE_TTL_MS + 1)
    ).toBeNull();
    expect(readWorkMessengerCaptureState(state, 'owner-a', 6_001)).not.toBeNull();
    expect(
      readWorkMessengerCaptureState(
        {
          workMessengerCapture: {
            ...state.workMessengerCapture,
            excerpt: 'must never enter router state',
          },
        },
        'owner-a',
        1_001
      )
    ).toBeNull();
    expect(() => createWorkMessengerCaptureState('owner-a', 'bad', messageId)).toThrow();
    expect(() =>
      createWorkMessengerCaptureState(
        'owner-a',
        'a0000000-0000-4000-8000-000000000001'.toUpperCase(),
        messageId
      )
    ).toThrow();
  });
});
