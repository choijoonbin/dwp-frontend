import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import type { Locator, Page, TestInfo } from '@playwright/test';

export function useVisualProject(testInfo: TestInfo, expectedProject: 'chromium' | 'mobile') {
  test.skip(
    testInfo.project.name !== expectedProject,
    `${expectedProject === 'mobile' ? 'Mobile' : 'Desktop'} visual baseline uses the ${expectedProject} project.`
  );
}

export async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const documentOverflow =
      document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const main = document.querySelector<HTMLElement>('#dwp-main-content');
    const mainOverflow = main ? main.scrollWidth - main.clientWidth : 0;
    return { document: documentOverflow, main: mainOverflow };
  });
  expect(overflow.document, `${label}: document overflow`).toBeLessThanOrEqual(1);
  expect(overflow.main, `${label}: main overflow`).toBeLessThanOrEqual(1);
}

export async function expectNoBlockingA11y(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious'
  );
  expect(blocking, `${label}: axe serious/critical violations`).toEqual([]);
}

export async function expectMinimumTarget(locator: Locator, label: string, minimum = 44) {
  await expect(locator, `${label}: target visible`).toBeVisible();
  const target = await locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { width: bounds.width, height: bounds.height };
  });
  expect(target.width, `${label}: target width`).toBeGreaterThanOrEqual(minimum);
  expect(target.height, `${label}: target height`).toBeGreaterThanOrEqual(minimum);
}

export async function expectViewportInset(locator: Locator, label: string, minimum = 12) {
  const geometry = await locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { left: bounds.left, right: innerWidth - bounds.right };
  });
  expect(geometry.left, `${label}: left viewport inset`).toBeGreaterThanOrEqual(minimum);
  expect(geometry.right, `${label}: right viewport inset`).toBeGreaterThanOrEqual(minimum);
}
