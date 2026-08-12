import { describe, expect, it } from 'vitest';

import { PRODUCT_MENU_ROUTES } from './product-menu-manifest';

describe('product menu manifest', () => {
  it('keeps every supported menu route unique and under visual governance', () => {
    expect(PRODUCT_MENU_ROUTES).toHaveLength(45);
    expect(new Set(PRODUCT_MENU_ROUTES.map((route) => route.id)).size).toBe(45);
    expect(new Set(PRODUCT_MENU_ROUTES.map((route) => route.path)).size).toBe(45);
  });

  it('preserves the audited route count by product shell', () => {
    const counts = PRODUCT_MENU_ROUTES.reduce<Record<string, number>>((result, route) => {
      result[route.shell] = (result[route.shell] ?? 0) + 1;
      return result;
    }, {});
    expect(counts).toEqual({
      workspace: 5,
      people: 2,
      workforce: 6,
      admin: 16,
      provider: 9,
      account: 7,
    });
  });
});
