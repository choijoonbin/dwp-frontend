import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import english from '../../../../../libs/shared-i18n/src/locales/en/meetings.json';
import korean from '../../../../../libs/shared-i18n/src/locales/ko/meetings.json';

import {
  meetingAuthorizationDenied,
  synchronizeMeetingAttendance,
} from './meeting-attendance-sync';

describe('meeting attendance synchronization UX state', () => {
  it('provides matching Korean and English copy for retrying and exhausted states', () => {
    expect(Object.keys(english.errors)).toEqual(Object.keys(korean.errors));
    expect(english.errors.attendanceSyncRecovering).toContain('retrying it automatically');
    expect(english.errors.attendanceSyncFailed).toContain('meeting record may be incomplete');
    expect(korean.errors.attendanceSyncRecovering).toContain('자동으로 다시 반영');
    expect(korean.errors.attendanceSyncFailed).toContain('회의 기록이 누락될 수');
  });

  it('reports automatic recovery and clears the notice when recovery succeeds', async () => {
    const states: Array<'recovering' | 'failed' | null> = [];
    const recover = vi.fn().mockResolvedValue(undefined);

    await synchronizeMeetingAttendance({
      synchronize: vi.fn().mockRejectedValue(new Error('confirmation delayed')),
      recover,
      isCurrent: () => true,
      handleAccessRevoked: () => false,
      onStateChange: (state) => states.push(state),
    });

    expect(recover).toHaveBeenCalledOnce();
    expect(states).toEqual(['recovering', null]);
  });

  it('distinguishes exhausted automatic recovery from recovery in progress', async () => {
    const states: Array<'recovering' | 'failed' | null> = [];

    await synchronizeMeetingAttendance({
      synchronize: vi.fn().mockRejectedValue(new Error('confirmation delayed')),
      recover: vi.fn().mockRejectedValue(new Error('recovery exhausted')),
      isCurrent: () => true,
      handleAccessRevoked: () => false,
      onStateChange: (state) => states.push(state),
    });

    expect(states).toEqual(['recovering', 'failed']);
  });

  it.each([401, 403, 404])(
    'revokes access immediately without starting recovery for HTTP %s',
    async (status) => {
      const denied = new HttpError('access revoked', status);
      const recover = vi.fn();
      const onStateChange = vi.fn();
      const handleAccessRevoked = vi.fn(meetingAuthorizationDenied);

      await synchronizeMeetingAttendance({
        synchronize: vi.fn().mockRejectedValue(denied),
        recover,
        isCurrent: () => true,
        handleAccessRevoked,
        onStateChange,
      });

      expect(handleAccessRevoked).toHaveBeenCalledWith(denied);
      expect(recover).not.toHaveBeenCalled();
      expect(onStateChange).not.toHaveBeenCalled();
    }
  );

  it('continues automatic recovery for an HTTP failure that does not revoke access', async () => {
    const recover = vi.fn();
    const states: Array<'recovering' | 'failed' | null> = [];

    await synchronizeMeetingAttendance({
      synchronize: vi.fn().mockRejectedValue(new HttpError('temporary conflict', 409)),
      recover: recover.mockResolvedValue(undefined),
      isCurrent: () => true,
      handleAccessRevoked: meetingAuthorizationDenied,
      onStateChange: (state) => states.push(state),
    });

    expect(recover).toHaveBeenCalledOnce();
    expect(states).toEqual(['recovering', null]);
  });

  it('does not publish a failed state when access is revoked during recovery', async () => {
    const denied = new Error('access revoked');
    const states: Array<'recovering' | 'failed' | null> = [];

    await synchronizeMeetingAttendance({
      synchronize: vi.fn().mockRejectedValue(new Error('confirmation delayed')),
      recover: vi.fn().mockRejectedValue(denied),
      isCurrent: () => true,
      handleAccessRevoked: (error) => error === denied,
      onStateChange: (state) => states.push(state),
    });

    expect(states).toEqual(['recovering']);
  });

  it('does not start recovery after leave or unmount makes a foreground request stale', async () => {
    let current = true;
    let failConfirmation!: (error: Error) => void;
    const recover = vi.fn();
    const onStateChange = vi.fn();
    const confirmation = new Promise<void>((_resolve, reject) => {
      failConfirmation = reject;
    });
    const pending = synchronizeMeetingAttendance({
      synchronize: () => confirmation,
      recover,
      isCurrent: () => current,
      handleAccessRevoked: () => false,
      onStateChange,
    });

    current = false;
    failConfirmation(new Error('late confirmation failure'));
    await pending;

    expect(recover).not.toHaveBeenCalled();
    expect(onStateChange).not.toHaveBeenCalled();
  });

  it('fences a recovery failure after leave or unmount makes the credential stale', async () => {
    let current = true;
    let failRecovery!: (error: Error) => void;
    const states: Array<'recovering' | 'failed' | null> = [];
    const recovery = new Promise<void>((_resolve, reject) => {
      failRecovery = reject;
    });
    const pending = synchronizeMeetingAttendance({
      synchronize: vi.fn().mockRejectedValue(new Error('confirmation delayed')),
      recover: () => recovery,
      isCurrent: () => current,
      handleAccessRevoked: () => false,
      onStateChange: (state) => states.push(state),
    });
    await vi.waitFor(() => expect(states).toEqual(['recovering']));

    current = false;
    failRecovery(new Error('late recovery failure'));
    await pending;

    expect(states).toEqual(['recovering']);
  });
});
