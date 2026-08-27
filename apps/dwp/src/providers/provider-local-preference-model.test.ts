import { describe, expect, it } from 'vitest';

import { asPersonalPreferenceView } from './provider-local-preference-model';

import type { ProviderLocalPreferenceState } from './provider-local-preference-model';

const providerState: ProviderLocalPreferenceState = {
  schemaVersion: 2,
  customized: true,
  preferences: {
    appearance: { mode: 'dark', density: 'compact' },
    accessibility: {
      highContrast: false,
      reduceMotion: true,
      underlineLinks: false,
      reduceTransparency: false,
    },
    regional: {
      timeZone: 'system',
      dateFormat: 'locale',
      timeFormat: 'locale',
      firstDayOfWeek: 'locale',
      numberFormat: 'locale',
    },
  },
  version: 0,
  updatedAt: '2026-08-28T00:00:00.000Z',
};

describe('Provider local preference model', () => {
  it('keeps Provider state free of tenant managed-policy semantics', () => {
    expect(providerState).not.toHaveProperty('managedPolicy');
  });

  it('exposes the absence of tenant policy at the shared view boundary', () => {
    const adapted = asPersonalPreferenceView(providerState);

    expect(adapted.preferences).toBe(providerState.preferences);
    expect(adapted.managedPolicy).toBeNull();
    expect(providerState).not.toHaveProperty('managedPolicy');
  });
});
