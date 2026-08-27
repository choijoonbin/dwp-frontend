import { describe, expect, it } from 'vitest';

import {
  getAccountNavigationGroups,
  isAccountSettingsSectionAvailable,
  resolveProviderAccountRouteDecision,
} from './settings-navigation';

describe('provider account settings navigation', () => {
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
