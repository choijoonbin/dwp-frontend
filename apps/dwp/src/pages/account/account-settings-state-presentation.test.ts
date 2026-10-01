import { describe, expect, it } from 'vitest';

import {
  identityProviderProtocol,
  managedEffectiveFreshness,
  managedEffectiveSourceLabelKey,
  managedExceptionState,
  managedOverrideState,
  managedOwnerLabelKey,
  managedPreferencePathLabelKey,
  personalActivityType,
  personalSettingLabelKey,
} from './account-settings-state-presentation';

describe('account settings state presentation', () => {
  it('does not expose unsupported recent-activity setting keys or types', () => {
    expect(personalSettingLabelKey('security')).toBe('navigation.security');
    expect(personalSettingLabelKey('INTERNAL_SETTING')).toBe(
      'settingsHome.observations.recent.unknownSetting'
    );
    expect(personalActivityType('CHANGE')).toBe('CHANGE');
    expect(personalActivityType('OWNER_REPLAY')).toBe('UNAVAILABLE');
  });

  it('does not expose unsupported managed paths or exception states', () => {
    expect(managedPreferencePathLabelKey('appearance.fontFamily')).toBe(
      'managed.pathLabels.appearance.fontFamily'
    );
    expect(managedPreferencePathLabelKey('internal.owner.secret')).toBe(
      'managed.pathLabels.unknown'
    );
    expect(managedExceptionState('APPROVED')).toBe('APPROVED');
    expect(managedExceptionState('OWNER_DEBUG')).toBe('UNAVAILABLE');
  });

  it('fails closed for unsupported effective-setting provenance values', () => {
    expect(managedEffectiveFreshness('FRESH')).toBe('FRESH');
    expect(managedEffectiveFreshness('OWNER_UNKNOWN')).toBe('UNAVAILABLE');
    expect(managedEffectiveSourceLabelKey('OWNER_PUBLICATION')).toBe(
      'managed.effective.source.owner'
    );
    expect(managedEffectiveSourceLabelKey('INTERNAL_SOURCE')).toBe(
      'managed.effective.source.unavailable'
    );
    expect(managedOverrideState('OWNER_LOCKED')).toBe('OWNER_LOCKED');
    expect(managedOverrideState('INTERNAL_STATE')).toBe('UNAVAILABLE');
    expect(managedOwnerLabelKey('managed.effective.owners.authPolicy')).toBe(
      'managed.effective.owners.authPolicy'
    );
    expect(managedOwnerLabelKey('internal.owner.key')).toBe(
      'managed.effective.owners.registeredOwner'
    );
  });

  it('does not expose unsupported identity-provider protocol codes', () => {
    expect(identityProviderProtocol('OIDC')).toBe('OIDC');
    expect(identityProviderProtocol('INTERNAL_PROTOCOL')).toBe('UNAVAILABLE');
  });
});
