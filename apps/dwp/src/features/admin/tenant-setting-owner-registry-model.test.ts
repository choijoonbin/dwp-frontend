import { describe, expect, it } from 'vitest';

import type { TenantSettingOwnerDescriptor } from '@dwp-frontend/shared-utils';

import {
  formatTenantSettingValue,
  settingActionLabelKey,
  settingFreshnessLabelKey,
  settingLifecycleLabelKey,
  settingOwnerAdapterLabelKey,
  settingResolutionLabelKey,
  supportsGenericTenantSettingEditor,
} from './tenant-setting-owner-registry-model';

const labels = {
  enabled: 'enabled',
  disabled: 'disabled',
  ownerOnly: 'owner-only',
  unavailable: 'unavailable',
  localLogin: 'local-login',
  ssoLogin: 'sso-login',
  durationMinutes: (count: number) => `${count} minutes`,
};

function owner(
  editorKind: TenantSettingOwnerDescriptor['editorKind'],
  valueType: TenantSettingOwnerDescriptor['valueType'] = 'STRING'
): TenantSettingOwnerDescriptor {
  return {
    ownerKey: 'TEST_OWNER',
    ownerVersion: 1,
    settingKey: 'test.setting',
    ownerService: 'test',
    valueType,
    editorKind,
    resolutionStrategy: 'TENANT_OVERRIDE_OR_OWNER_DEFAULT',
    overridePolicy: 'TENANT_ALLOWED',
    activationMode: 'PUBLISH',
    defaultValue: null,
    localizedLabelKey: 'test.setting.title',
    lifecycleState: 'ACTIVE',
    adapterState: 'CONNECTED',
    observedAt: '2026-09-29T08:00:00Z',
    freshnessState: 'FRESH',
    allowedActions: ['VIEW_EFFECTIVE', 'CREATE_CHANGE'],
  };
}

describe('tenant setting owner editor registry', () => {
  it('fails closed for owner-specific objects without serializing their value', () => {
    const descriptor = owner('OWNER_ONLY', 'OBJECT');
    const raw = { secret: 'must-not-render' };

    expect(supportsGenericTenantSettingEditor(descriptor)).toBe(false);
    expect(formatTenantSettingValue(descriptor, raw, labels)).toBe('owner-only');
    expect(formatTenantSettingValue(descriptor, raw, labels)).not.toContain('secret');
  });

  it('fails closed for unregistered owner protocol values', () => {
    for (const key of [
      settingOwnerAdapterLabelKey('INTERNAL_ADAPTER'),
      settingResolutionLabelKey('INTERNAL_RESOLUTION'),
      settingFreshnessLabelKey('INTERNAL_FRESHNESS'),
      settingLifecycleLabelKey('INTERNAL_LIFECYCLE'),
      settingActionLabelKey('INTERNAL_ACTION'),
    ]) {
      expect(key).toMatch(/\.UNKNOWN$/);
      expect(key).not.toContain('INTERNAL_');
    }
  });

  it('formats supported values through typed localized labels', () => {
    expect(formatTenantSettingValue(owner('BOOLEAN', 'BOOLEAN'), true, labels)).toBe('enabled');
    expect(formatTenantSettingValue(owner('LOGIN_TYPE'), 'SSO', labels)).toBe('sso-login');
    expect(formatTenantSettingValue(owner('DURATION_SECONDS', 'INTEGER'), 7_200, labels)).toBe(
      '120 minutes'
    );
    expect(supportsGenericTenantSettingEditor(owner('LOCALE'))).toBe(true);
  });
});
