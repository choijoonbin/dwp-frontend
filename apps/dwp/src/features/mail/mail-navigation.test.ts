import { describe, expect, it } from 'vitest';

import { findMailNavigationItem, MAIL_DEFAULT_PATH, MAIL_NAVIGATION } from './mail-navigation';

describe('mail navigation', () => {
  it('owns unique product routes and resolves trailing slashes', () => {
    const items = MAIL_NAVIGATION.flatMap((group) => group.items);
    expect(new Set(items.map((item) => item.path)).size).toBe(items.length);
    expect(MAIL_DEFAULT_PATH).toBe('/mail/home');
    expect(findMailNavigationItem('/mail/inbox/')?.view).toBe('inbox');
  });

  it('keeps tenant operations behind delegated mail administration', () => {
    const adminItems = MAIL_NAVIGATION.find((group) => group.id === 'admin')?.items ?? [];
    expect(adminItems.length).toBeGreaterThan(0);
    expect(
      adminItems.every(
        (item) =>
          item.requiredResourceKey === 'ADMIN.MAIL' && item.requiredPermissionCode === 'VIEW'
      )
    ).toBe(true);
  });
});
