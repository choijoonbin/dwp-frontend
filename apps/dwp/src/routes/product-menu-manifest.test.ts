import { describe, expect, it } from 'vitest';

import { accountNavigationGroups } from '../features/account/settings-navigation';
import { ADMIN_NAVIGATION } from '../features/admin/admin-navigation';
import { HRIS_NAVIGATION } from '../features/hris/hris-navigation';
import { PROVIDER_NAVIGATION } from '../features/provider/provider-navigation';

import { PRODUCT_MENU_ROUTES } from './product-menu-manifest';

import adminEn from '../../../../libs/shared-i18n/src/locales/en/admin.json';
import adminKo from '../../../../libs/shared-i18n/src/locales/ko/admin.json';

const EXPECTED_SHELL_COUNTS = {
  workspace: 5,
  hris: HRIS_NAVIGATION.flatMap((group) => group.items).length,
  admin: ADMIN_NAVIGATION.flatMap((group) => group.items).length,
  provider: PROVIDER_NAVIGATION.flatMap((group) => group.items).length,
  account: accountNavigationGroups.flatMap((group) => group.items).length,
};

const expectedRouteCount = Object.values(EXPECTED_SHELL_COUNTS).reduce(
  (total, count) => total + count,
  0
);

describe('product menu manifest', () => {
  it('keeps every supported menu route unique and under visual governance', () => {
    expect(PRODUCT_MENU_ROUTES).toHaveLength(expectedRouteCount);
    expect(new Set(PRODUCT_MENU_ROUTES.map((route) => route.id)).size).toBe(expectedRouteCount);
    expect(new Set(PRODUCT_MENU_ROUTES.map((route) => route.path)).size).toBe(expectedRouteCount);
  });

  it('derives the governed route count from each product navigation source', () => {
    expect(expectedRouteCount).toBe(59);
    const counts = PRODUCT_MENU_ROUTES.reduce<Record<string, number>>((result, route) => {
      result[route.shell] = (result[route.shell] ?? 0) + 1;
      return result;
    }, {});
    expect(counts).toEqual(EXPECTED_SHELL_COUNTS);
  });

  it('requires symmetric label, purpose, and description copy for every admin menu', () => {
    const englishItems = adminEn.navigation.items;
    const koreanItems = adminKo.navigation.items;

    for (const item of ADMIN_NAVIGATION.flatMap((group) => group.items)) {
      const english = englishItems[item.view];
      const korean = koreanItems[item.view];
      expect(english, `missing English copy for ${item.view}`).toBeDefined();
      expect(korean, `missing Korean copy for ${item.view}`).toBeDefined();
      expect(english.label.trim()).not.toBe('');
      expect(english.title.trim()).not.toBe('');
      expect(english.description.trim()).not.toBe('');
      expect(korean.label.trim()).not.toBe('');
      expect(korean.title.trim()).not.toBe('');
      expect(korean.description.trim()).not.toBe('');
    }
  });
});
