import { describe, expect, it } from 'vitest';

import {
  brandingChangeTypeKey,
  homeExperienceChangeTypeKey,
  homeExperienceScopeKey,
  homeTemplateLifecycleKey,
  homeTemplateRevisionSourceKey,
} from './home-revision-presentation';

describe('home revision presentation', () => {
  it('keeps known protocol values on closed localized keys', () => {
    expect(homeExperienceChangeTypeKey('ROLLBACK')).toBe(
      'homeExperience.history.changeTypes.ROLLBACK'
    );
    expect(homeExperienceScopeKey('COMPOSITION')).toBe('homeExperience.history.scopes.COMPOSITION');
    expect(brandingChangeTypeKey('ASSET_RESET')).toBe('branding.history.changeTypes.ASSET_RESET');
    expect(homeTemplateRevisionSourceKey('PUBLISH')).toBe(
      'homeWidgets.blueprints.history.sources.PUBLISH'
    );
    expect(homeTemplateLifecycleKey('DRAFT')).toBe('homeWidgets.blueprints.lifecycle.DRAFT');
  });

  it.each([
    [homeExperienceChangeTypeKey, 'homeExperience.history.changeTypes.UNAVAILABLE'],
    [homeExperienceScopeKey, 'homeExperience.history.scopes.UNAVAILABLE'],
    [brandingChangeTypeKey, 'branding.history.changeTypes.UNAVAILABLE'],
    [homeTemplateRevisionSourceKey, 'homeWidgets.blueprints.history.sources.UNAVAILABLE'],
    [homeTemplateLifecycleKey, 'homeWidgets.blueprints.lifecycle.UNAVAILABLE'],
  ])('maps unknown runtime values to unavailable', (present, expected) => {
    expect(present('INTERNAL_FUTURE_VALUE')).toBe(expected);
  });
});
