import { describe, expect, it, vi } from 'vitest';

import { applyMeetingAudioOutput } from './meeting-audio-output';

describe('meeting audio output selection', () => {
  it('keeps the selected browser-local output when it is available', async () => {
    const switchActiveDevice = vi.fn().mockResolvedValue(undefined);

    await expect(applyMeetingAudioOutput({ switchActiveDevice }, 'speaker-current')).resolves.toBe(
      'SELECTED'
    );
    expect(switchActiveDevice).toHaveBeenCalledExactlyOnceWith(
      'audiooutput',
      'speaker-current',
      true
    );
  });

  it('falls back to the system output when the saved id is stale', async () => {
    const switchActiveDevice = vi
      .fn()
      .mockRejectedValueOnce(new Error('missing output'))
      .mockResolvedValueOnce(undefined);

    await expect(applyMeetingAudioOutput({ switchActiveDevice }, 'speaker-removed')).resolves.toBe(
      'FALLBACK'
    );
    expect(switchActiveDevice.mock.calls).toEqual([
      ['audiooutput', 'speaker-removed', true],
      ['audiooutput', 'default', true],
    ]);
  });

  it('distinguishes a failed system fallback from a recovered stale selection', async () => {
    const switchActiveDevice = vi.fn().mockRejectedValue(new Error('output policy denied'));

    await expect(applyMeetingAudioOutput({ switchActiveDevice }, 'speaker-removed')).resolves.toBe(
      'FAILED'
    );
    expect(switchActiveDevice).toHaveBeenCalledTimes(2);
  });
});
