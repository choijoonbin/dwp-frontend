import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function openStory(page: Page, id: string, globals?: string) {
  const search = new URLSearchParams({ id, viewMode: 'story' });
  if (globals) search.set('globals', globals);

  await page.goto(`/iframe.html?${search}`);
  await expect(page.locator('#storybook-root')).toBeVisible();
}

async function expectNoAutomaticAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).include('#storybook-root').analyze();
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => ({ target: node.target, html: node.html })),
  }));
  expect(summary).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('foundation play interaction and accessibility', async ({ page }) => {
  await openStory(page, 'dwp-foundation-overview--foundation');

  await expect(page.getByRole('textbox', { name: 'Request title' })).toHaveValue('Access review');
  await expectNoAutomaticAccessibilityViolations(page);
});

test('page canvas exposes workspace and focus width contracts', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openStory(page, 'dwp-foundation-page-canvas--layout-modes');

  const workspace = page.locator('[data-dwp-page-canvas="workspace"]');
  const focus = page.locator('[data-dwp-page-canvas="focus"]');
  await expect(workspace).toBeVisible();
  await expect(focus).toBeVisible();
  await expect
    .poll(() => workspace.evaluate((element) => element.getBoundingClientRect().width))
    .toBe(1440);
  await expect
    .poll(() => focus.evaluate((element) => element.getBoundingClientRect().width))
    .toBe(1200);
  await expectNoAutomaticAccessibilityViolations(page);
});

test('enterprise grid visual and accessibility', async ({ page }) => {
  await openStory(page, 'dwp-enterprise-data-grid--work-queue');

  await expect(page.getByRole('grid', { name: 'Work queue' })).toBeVisible();
  await expectNoAutomaticAccessibilityViolations(page);
  await expect(page).toHaveScreenshot('enterprise-grid.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

test('agent plan visual and accessibility', async ({ page }) => {
  await openStory(page, 'dwp-ai-trust-patterns--plan-review');

  await expect(page.getByRole('list', { name: 'Plan steps' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve plan' })).toBeVisible();
  await expectNoAutomaticAccessibilityViolations(page);
  await expect(page).toHaveScreenshot('agent-plan.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

test('agent execution high-contrast visual and accessibility', async ({ page }) => {
  await openStory(
    page,
    'dwp-ai-trust-patterns--execution',
    'theme:dark;contrast:high;density:compact'
  );

  await expect(page.getByRole('list', { name: 'Execution steps' })).toBeVisible();
  await expect(page.getByText('Failed', { exact: true })).toBeVisible();
  await expectNoAutomaticAccessibilityViolations(page);
  await expect(page).toHaveScreenshot('agent-execution-high-contrast.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});
