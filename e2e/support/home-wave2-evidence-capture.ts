import { expect, test } from '@playwright/test';

import {
  expectNoHorizontalOverflow,
  expectNoSeriousAccessibilityViolations,
} from './accessibility';

import type { Page } from '@playwright/test';

async function stabilizeHomeWave2Visual(page: Page) {
  await page.evaluate(async () => {
    document.querySelectorAll('vite-plugin-checker-error-overlay').forEach((node) => node.remove());
    const style = document.createElement('style');
    style.dataset.wave2VisualStability = 'true';
    style.textContent =
      '[data-testid="dwaion-launcher"], [role="tooltip"] { visibility: hidden !important; }';
    document.head.append(style);
    await document.fonts.ready;
  });
}

export async function captureHomeWave2Evidence(
  page: Page,
  canonicalId: string,
  fixtureId: string,
  include = '#dwp-main-content',
  maxDiffPixels?: number
) {
  test.info().annotations.push({ type: 'canonical-fixture', description: fixtureId });
  await stabilizeHomeWave2Visual(page);
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousAccessibilityViolations(page, include);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page).toHaveScreenshot(`home-wave2-${canonicalId}.png`, {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixels,
    scale: 'css',
  });
}

export async function captureHomeWave2ViewportInteraction(
  page: Page,
  canonicalId: string,
  include = '#dwp-main-content'
) {
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousAccessibilityViolations(page, include);
  await expect(page).toHaveScreenshot(`home-wave2-${canonicalId}-interaction.png`, {
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
    maxDiffPixels: 100,
    scale: 'css',
  });
}
