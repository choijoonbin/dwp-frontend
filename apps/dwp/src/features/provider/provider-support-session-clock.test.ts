import { describe, expect, it } from 'vitest';

import { providerSupportRemainingTime } from './provider-support-session-clock';

describe('provider support session clock', () => {
  it('formats the server expiry as a locale-aware remaining duration', () => {
    const now = Date.parse('2026-08-26T02:30:00.000Z');

    expect(providerSupportRemainingTime('2026-08-26T02:45:00.000Z', 'en', now)).toBe(
      'in 15 minutes'
    );
    expect(providerSupportRemainingTime('2026-08-26T02:45:00.000Z', 'ko', now)).toBe('15분 후');
  });

  it('fails visibly for an invalid server expiry', () => {
    expect(providerSupportRemainingTime('invalid', 'en')).toBe('—');
  });
});
