import { test } from '@playwright/test';

import { PRODUCT_MENU_ROUTES } from '../apps/dwp/src/routes/product-menu-manifest';
import { exerciseGovernedMenuRoute } from './support/menu-route-harness';

test.describe.configure({ mode: 'parallel' });

for (const productRoute of PRODUCT_MENU_ROUTES) {
  test(`${productRoute.id} keeps its structural and runtime contract`, async ({
    page,
  }, testInfo) => {
    await exerciseGovernedMenuRoute(page, testInfo, productRoute);
  });
}
