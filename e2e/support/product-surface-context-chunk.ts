import { deferred } from './deferred';

import type { Page } from '@playwright/test';

const productSurfaceControlsModule =
  /\/product-surface-controls(?:-[^/?]+)?\.(?:tsx|js)(?:\?.*)?$/u;

export async function holdProductSurfaceControlsChunk(page: Page) {
  const requested = deferred();
  const release = deferred();
  await page.route(productSurfaceControlsModule, async (route) => {
    requested.resolve();
    await release.promise;
    await route.continue();
  });
  return { requested, release };
}

export async function failFirstProductSurfaceControlsChunk(page: Page) {
  let requests = 0;
  await page.route(productSurfaceControlsModule, async (route) => {
    requests += 1;
    if (requests === 1) {
      await route.fulfill({ status: 503, body: '' });
      return;
    }
    await route.continue();
  });
  return () => requests;
}

export async function failFirstAndHoldRetryProductSurfaceControlsChunk(page: Page) {
  let requests = 0;
  const retryRequested = deferred();
  const releaseRetry = deferred();
  await page.route(productSurfaceControlsModule, async (route) => {
    requests += 1;
    if (requests === 1) {
      await route.fulfill({ status: 503, body: '' });
      return;
    }
    retryRequested.resolve();
    await releaseRetry.promise;
    await route.continue();
  });
  return { requests: () => requests, retryRequested, releaseRetry };
}
