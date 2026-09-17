import { describe, expect, it } from 'vitest';

import { homeStudioNavigation } from './home-studio-navigation';

describe('homeStudioNavigation', () => {
  it('keeps account page routes addressable when a mode preset is present', () => {
    const keys = homeStudioNavigation({
      presentation: 'page',
      modePreset: true,
      advancedMode: false,
      legacyStore: false,
      composerEnabled: true,
    }).map(({ key }) => key);

    expect(keys).toEqual([
      'overview',
      'mode',
      'layout',
      'appearance',
      'profiles',
      'content',
      'device',
      'templates',
      'history',
      'ai',
    ]);
  });

  it('limits legacy storage to sections backed by the legacy preference contract', () => {
    const keys = homeStudioNavigation({
      presentation: 'page',
      modePreset: true,
      advancedMode: false,
      legacyStore: true,
      composerEnabled: true,
    }).map(({ key }) => key);

    expect(keys).toEqual(['overview', 'mode', 'layout', 'appearance']);
  });
});
