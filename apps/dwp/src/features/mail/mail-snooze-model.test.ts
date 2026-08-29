import { describe, expect, it } from 'vitest';

import { isValidMailSnoozeTime, resolveMailSnoozePreset } from './mail-snooze-model';

describe('mail snooze policy', () => {
  const morning = new Date('2026-08-31T08:00:00+09:00');

  it('resolves stable future presets in the local calendar', () => {
    expect(resolveMailSnoozePreset('LATER_TODAY', morning)).toBe(
      new Date('2026-08-31T17:00:00+09:00').toISOString()
    );
    expect(resolveMailSnoozePreset('TOMORROW', morning)).toBe(
      new Date('2026-09-01T09:00:00+09:00').toISOString()
    );
    expect(resolveMailSnoozePreset('NEXT_WEEK', morning)).toBe(
      new Date('2026-09-07T09:00:00+09:00').toISOString()
    );
  });

  it('does not present later today after the day has effectively ended', () => {
    expect(
      resolveMailSnoozePreset('LATER_TODAY', new Date('2026-08-31T23:30:00+09:00'))
    ).toBeNull();
  });

  it('rejects missing, invalid, and past custom values', () => {
    expect(isValidMailSnoozeTime(null, morning)).toBe(false);
    expect(isValidMailSnoozeTime('invalid', morning)).toBe(false);
    expect(isValidMailSnoozeTime('2026-08-30T23:00:00.000Z', morning)).toBe(false);
    expect(isValidMailSnoozeTime('2026-09-01T00:00:00.000Z', morning)).toBe(true);
  });
});
