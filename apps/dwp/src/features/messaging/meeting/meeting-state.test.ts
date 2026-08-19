import { describe, expect, it } from 'vitest';

import { resolveMeetingLobbyState } from './meeting-state';

const capability = {
  available: true,
  provider: 'LIVEKIT',
  audio: true,
  video: true,
  screenShare: true,
  participantList: true,
  tokenTtlSeconds: 300,
};

describe('meeting lobby state', () => {
  it('does not offer a fake start action while the provider is unavailable', () => {
    expect(
      resolveMeetingLobbyState({
        loading: false,
        capability: { ...capability, available: false },
        session: null,
      })
    ).toBe('UNAVAILABLE');
  });

  it('joins an active session and starts only when no session exists', () => {
    expect(resolveMeetingLobbyState({ loading: false, capability, session: null })).toBe('START');
    expect(
      resolveMeetingLobbyState({
        loading: false,
        capability,
        session: { lifecycleState: 'ACTIVE' } as never,
      })
    ).toBe('JOIN');
  });
});
