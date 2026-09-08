import { expect, type Page } from '@playwright/test';

async function settledDocumentHeight(page: Page) {
  let previousHeight = 0;
  let matchingMeasurements = 0;
  await expect
    .poll(
      async () => {
        const height = await page.evaluate(async () => {
          await document.fonts.ready;
          return Math.ceil(
            Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
          );
        });
        matchingMeasurements = height === previousHeight ? matchingMeasurements + 1 : 1;
        previousHeight = height;
        return matchingMeasurements;
      },
      { timeout: 5_000, intervals: [16, 32, 64] }
    )
    .toBeGreaterThanOrEqual(2);
  expect(previousHeight).toBeLessThan(32_000);
  return previousHeight;
}

/** Keep a fixed/sticky dock at the document end in a full-document evidence image.
 * The calling journey must first check its real viewport and dock clearance.
 * Viewport screenshots deliberately do not use this helper.
 */
export async function withMeetingDocumentCapture(page: Page, capture: () => Promise<void>) {
  await page.evaluate(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.querySelector<HTMLElement>('#dwp-main-content')?.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant',
    });
    // Reading layout works with a deliberately paused media clock as well.
    document.documentElement.getBoundingClientRect();
  });
  const original = page.viewportSize();
  const dock = page
    .locator(
      '[data-testid="meeting-mobile-navigation"], [data-testid="meeting-preferences-save-dock"], [data-testid="meeting-schedule-action-dock"], [data-testid="meeting-admin-policy-savebar"], .dwp-meeting-prejoin__admission-actions'
    )
    .filter({ visible: true });
  if (!original || original.width >= 900 || (await dock.count()) === 0) {
    await capture();
    return;
  }
  const position = await dock.last().evaluate((element) => getComputedStyle(element).position);
  if (!['fixed', 'sticky'].includes(position)) {
    await capture();
    return;
  }
  try {
    let captureHeight = original.height;
    for (let pass = 0; pass < 4; pass += 1) {
      const height = await settledDocumentHeight(page);
      if (height <= captureHeight) break;
      captureHeight = height;
      await page.setViewportSize({ width: original.width, height: captureHeight });
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    expect(await settledDocumentHeight(page)).toBeLessThanOrEqual(captureHeight);
    const bottom = await dock.last().evaluate((element) => element.getBoundingClientRect().bottom);
    if (position === 'fixed') expect(Math.abs(bottom - captureHeight)).toBeLessThanOrEqual(1);
    else {
      expect(bottom).toBeLessThanOrEqual(captureHeight + 1);
      expect(bottom).toBeGreaterThan(original.height);
    }
    await capture();
  } finally {
    await page.setViewportSize(original);
    await page.evaluate(() => window.scrollTo(0, 0));
  }
}
