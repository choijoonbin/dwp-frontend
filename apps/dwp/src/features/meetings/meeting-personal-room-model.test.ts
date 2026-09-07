import { describe, expect, it } from 'vitest';
import {
  personalRoomCommandFailure,
  personalRoomInvitationUrl,
} from './meeting-personal-room-model';

const room = { opaqueAlias: 'a'.repeat(32), invitationRevision: 3 };
describe('personal room invitation semantics', () => {
  it('uses an exact same-origin join route without treating the alias as media authority', () => {
    expect(personalRoomInvitationUrl('https://dwp.example', room)).toBe(
      'https://dwp.example/meetings/join?room=' + room.opaqueAlias + '&revision=3'
    );
  });
  it('keeps the alias stable and replaces only the revision', () => {
    const old = new URL(personalRoomInvitationUrl('https://dwp.example', room));
    const next = new URL(
      personalRoomInvitationUrl('https://dwp.example', { ...room, invitationRevision: 4 })
    );
    expect(next.searchParams.get('room')).toBe(old.searchParams.get('room'));
    expect(next.searchParams.get('revision')).not.toBe(old.searchParams.get('revision'));
  });
  it.each([
    'javascript:alert(1)',
    'https://dwp.example/other',
    'https://user:password@dwp.example',
    'https://dwp.example?token=x',
  ])('rejects a non-origin base: %s', (origin) => {
    expect(() => personalRoomInvitationUrl(origin, room)).toThrow();
  });
  it.each([{ opaqueAlias: '../escape' }, { invitationRevision: 0 }, { invitationRevision: 1.5 }])(
    'rejects an invalid invitation reference: %j',
    (patch) => {
      expect(() =>
        personalRoomInvitationUrl('https://dwp.example', { ...room, ...patch })
      ).toThrow();
    }
  );
  it('separates permission, conflict and retryable operation failure', () => {
    expect(personalRoomCommandFailure({ status: 403 })).toBe('forbidden');
    expect(personalRoomCommandFailure({ status: 409 })).toBe('conflict');
    expect(personalRoomCommandFailure({ status: 500 })).toBe('failed');
  });
});
