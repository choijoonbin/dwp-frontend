import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_SETTINGS_HOME_PATH,
  getAccountNavigationGroups,
  isAccountSettingsSectionAvailable,
  resolvePersonalSettingKey,
  resolveProviderAccountRouteDecision,
} from './settings-navigation';

describe('provider account settings navigation', () => {
  it('keeps the settings entry on the searchable settings home', () => {
    expect(ACCOUNT_SETTINGS_HOME_PATH).toBe('/account/settings');
  });

  it('maps account routes to the server-owned activity key', () => {
    expect(resolvePersonalSettingKey('/account/profile')).toBe('profile');
    expect(resolvePersonalSettingKey('/account/settings/home/layout')).toBe('home');
    expect(resolvePersonalSettingKey('/account/settings')).toBeNull();
    expect(resolvePersonalSettingKey('/provider')).toBeNull();
  });

  it('keeps only identity and provider-safe personal preferences for provider identities', () => {
    expect(
      getAccountNavigationGroups(true).flatMap((group) => group.items.map((item) => item.key))
    ).toEqual(['profile', 'security', 'appearance', 'accessibility', 'language']);
  });

  it('keeps the full tenant-member settings navigation for non-provider identities', () => {
    expect(
      getAccountNavigationGroups(false).flatMap((group) => group.items.map((item) => item.key))
    ).toEqual([
      'profile',
      'security',
      'appearance',
      'accessibility',
      'language',
      'home',
      'notifications',
      'managed',
    ]);
  });

  it('denies tenant-personal and tenant-managed settings to provider identities', () => {
    expect(isAccountSettingsSectionAvailable('home', true)).toBe(false);
    expect(isAccountSettingsSectionAvailable('notifications', true)).toBe(false);
    expect(isAccountSettingsSectionAvailable('managed', true)).toBe(false);
    expect(isAccountSettingsSectionAvailable('language', true)).toBe(true);
  });

  it('redirects provider account routes while support state is active or unverifiable', () => {
    expect(
      resolveProviderAccountRouteDecision({
        providerAccount: true,
        supportLoading: false,
        supportError: false,
        hasActiveSupport: true,
      })
    ).toBe('redirect-support');
    expect(
      resolveProviderAccountRouteDecision({
        providerAccount: true,
        supportLoading: false,
        supportError: true,
        hasActiveSupport: false,
      })
    ).toBe('redirect-support');
    expect(
      resolveProviderAccountRouteDecision({
        providerAccount: true,
        supportLoading: false,
        supportError: false,
        hasActiveSupport: false,
      })
    ).toBe('allow');
    expect(
      resolveProviderAccountRouteDecision({
        providerAccount: false,
        supportLoading: false,
        supportError: false,
        hasActiveSupport: true,
      })
    ).toBe('allow');
  });
});
