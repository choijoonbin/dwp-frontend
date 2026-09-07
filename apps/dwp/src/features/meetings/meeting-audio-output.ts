export type MeetingAudioOutputSwitcher = {
  switchActiveDevice: (kind: 'audiooutput', deviceId: string, exact?: boolean) => Promise<unknown>;
};

export type MeetingAudioOutputResult = 'DEFAULT' | 'SELECTED' | 'FALLBACK' | 'FAILED';

/** A stale browser-local output id must never prevent the system default from remaining usable. */
export async function applyMeetingAudioOutput(
  switcher: MeetingAudioOutputSwitcher,
  deviceId: string
): Promise<MeetingAudioOutputResult> {
  if (!deviceId || deviceId === 'default') return 'DEFAULT';
  try {
    await switcher.switchActiveDevice('audiooutput', deviceId, true);
    return 'SELECTED';
  } catch {
    try {
      await switcher.switchActiveDevice('audiooutput', 'default', true);
      return 'FALLBACK';
    } catch {
      return 'FAILED';
    }
  }
}
