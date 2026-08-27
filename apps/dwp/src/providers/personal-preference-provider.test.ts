// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import {
  legacyProviderPreferenceStorageKey,
  providerPreferenceStorageKey,
  providerRealmPreferenceIdentity,
  readProviderLocalPreference,
  updateProviderLocalPreference,
} from './personal-preference-provider';

import type { PersonalPreference, PersonalPreferencePatch } from '@dwp-frontend/shared-utils';
import type { UserAppearancePreference } from '@dwp-frontend/design-system/appearance';

const defaults: UserAppearancePreference = {
  mode: 'system',
  density: 'standard',
  highContrast: false,
  reduceMotion: false,
};

const currentPreference: PersonalPreference = {
  schemaVersion: 2,
  customized: false,
  preferences: {
    appearance: { mode: 'system', density: 'standard' },
    accessibility: {
      highContrast: false,
      reduceMotion: false,
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
  managedPolicy: {
    policyId: 'provider-local-preference',
    scope: 'TENANT',
    source: 'TENANT_EXPERIENCE_POLICY',
    ownerType: 'ROLE',
    ownerRef: 'PROVIDER_OPERATOR',
    ownerDisplayName: 'Provider operator',
    managedPaths: [],
    rules: [],
    version: 0,
  },
  version: 0,
  updatedAt: null,
};

describe('provider local preference storage boundary', () => {
  beforeEach(() => window.localStorage.clear());

  it('drops forbidden namespaces before writing the identity-scoped raw document', () => {
    const identity = providerRealmPreferenceIdentity(1);
    const otherProviderKey = providerPreferenceStorageKey(providerRealmPreferenceIdentity(99));
    const tenantRegional = JSON.stringify({ timeZone: 'America/New_York' });
    window.localStorage.setItem('dwp.regional.v2', tenantRegional);
    window.localStorage.setItem(otherProviderKey, '{"owner":"other-provider"}');

    updateProviderLocalPreference(
      identity,
      currentPreference,
      {
        appearance: { mode: 'dark' },
        home: { copiedFromTenant: true },
        notifications: { emailEnabled: true },
      } as unknown as PersonalPreferencePatch,
      defaults,
      '2026-08-26T04:00:00.000Z',
      window.localStorage
    );

    const raw = JSON.parse(
      window.localStorage.getItem(providerPreferenceStorageKey(identity)) ?? '{}'
    ) as { preferences?: Record<string, unknown> };
    expect(Object.keys(raw.preferences ?? {}).sort()).toEqual([
      'accessibility',
      'appearance',
      'regional',
    ]);
    expect(raw.preferences).not.toHaveProperty('home');
    expect(raw.preferences).not.toHaveProperty('notifications');
    expect(window.localStorage.getItem('dwp.regional.v2')).toBe(tenantRegional);
    expect(window.localStorage.getItem(otherProviderKey)).toBe('{"owner":"other-provider"}');
  });

  it('migrates only the matching legacy account into the immutable Provider realm key', () => {
    const identity = providerRealmPreferenceIdentity(1);
    const legacyIdentity = 'provider:42:1';
    const legacyKey = legacyProviderPreferenceStorageKey(legacyIdentity);
    const unrelatedLegacyKey = legacyProviderPreferenceStorageKey('provider:99:2');
    window.localStorage.setItem(
      legacyKey,
      JSON.stringify({
        preferences: {
          appearance: { mode: 'dark' },
          tenantHome: { widgets: ['private'] },
          supportSession: { tenantId: 'tenant-skax' },
        },
      })
    );
    window.localStorage.setItem(unrelatedLegacyKey, '{"owner":"other-provider"}');

    const migrated = readProviderLocalPreference(identity, legacyIdentity, defaults);

    expect(migrated.preferences.appearance.mode).toBe('dark');
    const stored = JSON.parse(
      window.localStorage.getItem(providerPreferenceStorageKey(identity)) ?? '{}'
    ) as { preferences?: Record<string, unknown> };
    expect(Object.keys(stored.preferences ?? {}).sort()).toEqual([
      'accessibility',
      'appearance',
      'regional',
    ]);
    expect(stored.preferences).not.toHaveProperty('tenantHome');
    expect(stored.preferences).not.toHaveProperty('supportSession');
    expect(window.localStorage.getItem(legacyKey)).toBeNull();
    expect(window.localStorage.getItem(unrelatedLegacyKey)).toBe('{"owner":"other-provider"}');
  });
});
