import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page } from '@playwright/test';

export async function expectNoAutomaticAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => ({
      target: node.target,
      html: node.html,
      failureSummary: node.failureSummary,
      checks: node.any.map((check) => check.data),
    })),
  }));
  expect(summary).toEqual([]);
}

export async function expectNoSeriousAccessibilityViolations(page: Page, include: string) {
  const accessibility = await new AxeBuilder({ page }).include(include).analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
}

export async function expectMinimumTouchTargets(targets: Locator, contract: string) {
  const measurements = await targets.evaluateAll((elements) =>
    elements
      .filter((element) => {
        const node = element as HTMLElement;
        return node.offsetParent !== null && getComputedStyle(node).visibility !== 'hidden';
      })
      .map((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          label:
            element.getAttribute('aria-label') ??
            element.textContent?.replace(/\s+/gu, ' ').trim() ??
            element.tagName,
          width: Math.round(bounds.width * 100) / 100,
          height: Math.round(bounds.height * 100) / 100,
        };
      })
  );
  expect(measurements.length, `${contract} must expose at least one touch target`).toBeGreaterThan(
    0
  );
  expect(
    measurements.filter(({ width, height }) => width < 44 || height < 44),
    `${contract} requires 44px targets`
  ).toEqual([]);
  return measurements;
}

export async function expectNoHorizontalOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(geometry.document).toBeLessThanOrEqual(geometry.viewport + 1);
}

export async function tabTo(page: Page, target: Locator, maximumTabs = 120, reverse = false) {
  for (let attempt = 0; attempt < maximumTabs; attempt += 1) {
    if (await target.evaluate((node) => node === document.activeElement)) return;
    await page.keyboard.press(reverse ? 'Shift+Tab' : 'Tab');
  }
  throw new Error(`Keyboard traversal did not reach ${await target.getAttribute('data-testid')}.`);
}
