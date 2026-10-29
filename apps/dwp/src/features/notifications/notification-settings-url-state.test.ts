import { describe, expect, it } from 'vitest';

import {
  canonicalizeNotificationSettingsSearch,
  readNotificationSettingsUrlState,
  writeNotificationSettingsUrlState,
} from './notification-settings-url-state';

describe('notification settings URL state', () => {
  it('restores a validated view, section, and app selection', () => {
    expect(
      readNotificationSettingsUrlState(
        new URLSearchParams('view=diagnostics&section=apps&app=messaging')
      )
    ).toEqual({ view: 'diagnostics', section: 'apps', appKey: 'messaging' });
  });

  it('fails closed to safe defaults for unsupported or oversized values', () => {
    expect(
      readNotificationSettingsUrlState(
        new URLSearchParams(
          `view=unexpected&section=internal&app=${encodeURIComponent('x'.repeat(65))}`
        )
      )
    ).toEqual({ view: 'settings', section: 'global', appKey: null });
  });

  it('keeps unrelated query state and omits default values', () => {
    const written = writeNotificationSettingsUrlState(new URLSearchParams('source=header'), {
      view: 'settings',
      section: 'global',
      appKey: null,
    });

    expect(written.toString()).toBe('source=header');
  });

  it('canonicalizes invalid values without discarding unrelated state', () => {
    const canonical = canonicalizeNotificationSettingsSearch(
      new URLSearchParams('view=bad&section=quiet&app=%2Funsafe&source=home')
    );

    expect(canonical.toString()).toBe('section=quiet&source=home');
  });
});
