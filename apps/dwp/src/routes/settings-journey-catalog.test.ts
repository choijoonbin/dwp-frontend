import { describe, expect, it } from 'vitest';

import { accountNavigationGroups } from '../features/account/settings-navigation';
import { ADMIN_NAVIGATION } from '../features/admin/admin-navigation';
import { PROVIDER_NAVIGATION } from '../features/provider/provider-navigation';
import { PRODUCT_MENU_ROUTES } from './product-menu-manifest';
import {
  APP_MANAGEMENT_ENTRY_ROUTES,
  SETTINGS_INVENTORY_EXPECTATIONS,
  SETTINGS_JOURNEY_CATALOG,
  SETTINGS_LANDING_ROUTES,
  settingsJourney,
} from './settings-journey-catalog';

describe('accepted settings journey catalog', () => {
  it('maps S01-S19 exactly once', () => {
    expect(SETTINGS_JOURNEY_CATALOG.map(({ id }) => id)).toEqual(
      Array.from({ length: 19 }, (_, index) => `S${String(index + 1).padStart(2, '0')}`)
    );
    expect(SETTINGS_JOURNEY_CATALOG.every(({ routes }) => routes.length > 0)).toBe(true);
    expect(settingsJourney('S17').routes).toContain('/provider/feature-rollouts');
  });

  it('locks the canonical personal, tenant, provider, and app-management inventory', () => {
    expect(accountNavigationGroups.flatMap(({ items }) => items)).toHaveLength(
      SETTINGS_INVENTORY_EXPECTATIONS.accountLeaves
    );
    expect(ADMIN_NAVIGATION.flatMap(({ items }) => items)).toHaveLength(
      SETTINGS_INVENTORY_EXPECTATIONS.tenantLeaves
    );
    expect(PROVIDER_NAVIGATION.flatMap(({ items }) => items)).toHaveLength(
      SETTINGS_INVENTORY_EXPECTATIONS.providerLeaves
    );
    expect(APP_MANAGEMENT_ENTRY_ROUTES).toHaveLength(
      SETTINGS_INVENTORY_EXPECTATIONS.appManagementAreas
    );
  });

  it('resolves every leaf and app-management entry through the governed menu ledger', () => {
    const governedPaths = new Set<string>(PRODUCT_MENU_ROUTES.map(({ path }) => path));
    const landingPaths = new Set<string>(SETTINGS_LANDING_ROUTES);
    const expectedPaths = [
      ...accountNavigationGroups.flatMap(({ items }) => items.map(({ path }) => path)),
      ...ADMIN_NAVIGATION.flatMap(({ items }) => items.map(({ path }) => path)),
      ...PROVIDER_NAVIGATION.flatMap(({ items }) => items.map(({ path }) => path)),
      ...APP_MANAGEMENT_ENTRY_ROUTES,
    ];
    expect(expectedPaths.filter((path) => !governedPaths.has(path))).toEqual([]);
    expect(
      SETTINGS_JOURNEY_CATALOG.flatMap(({ routes }) => routes).filter(
        (path) => !governedPaths.has(path) && !landingPaths.has(path)
      )
    ).toEqual([]);
  });
});
