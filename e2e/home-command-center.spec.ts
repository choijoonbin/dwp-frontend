import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  createHomeOverviewFixture,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'Mina Kim',
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
});

test('home turns live work signals into a keyboard-operable next action', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  const commandCenter = page.getByTestId('home-command-center');
  await expect(commandCenter.getByRole('heading', { name: 'Welcome back, Mina' })).toBeVisible();
  await expect(
    commandCenter.getByRole('heading', { name: 'Approve software access request' })
  ).toBeVisible();
  await expect(
    commandCenter.getByRole('region', { name: "Today's schedule timeline" })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Workday insights' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Frequent apps' })).toBeVisible();

  const accessibility = await new AxeBuilder({ page })
    .include('[data-testid="home-command-center"]')
    .analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);

  const openPriority = commandCenter.getByRole('button', { name: 'Open priority in Work' });
  await openPriority.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/work\?item=WK-1042/);
});

test('home presents a truthful healthy-empty state without invented priorities', async ({
  page,
}) => {
  await page.route('**/api/platform/v1/home/overview**', (route) => {
    const fixture = createHomeOverviewFixture();
    return fulfillSuccess(route, {
      ...fixture,
      work: {
        ...fixture.work,
        data: {
          summary: { total: 0, dueSoon: 0, inProgress: 0, waiting: 0, completed: 0 },
          items: [],
          generatedAt: '2026-08-12T00:00:00Z',
        },
      },
      recommendations: [],
    });
  });

  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');

  const commandCenter = page.getByTestId('home-command-center');
  await expect(commandCenter.getByText('There is no priority work right now')).toBeVisible();
  await expect(commandCenter.getByRole('button', { name: 'Open priority in Work' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Frequent apps' })).toBeVisible();

  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(geometry.content).toBeLessThanOrEqual(geometry.viewport);
});

test('home isolates a work-queue outage and recovers without hiding apps or widgets', async ({
  page,
}) => {
  let unavailable = true;
  await page.route('**/api/platform/v1/home/overview**', (route) =>
    unavailable
      ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
      : fulfillSuccess(route, createHomeOverviewFixture())
  );

  await page.goto('/');

  const commandCenter = page.getByTestId('home-command-center');
  await expect(commandCenter.getByText(/Work priorities could not be loaded/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Frequent apps' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Workday insights' })).toBeVisible();

  unavailable = false;
  await commandCenter.getByRole('button', { name: 'Try again' }).last().click();
  await expect(
    commandCenter.getByRole('heading', { name: 'Approve software access request' })
  ).toBeVisible();
});

test('home records explicit feedback and removes an irrelevant recommendation', async ({
  page,
}) => {
  await page.goto('/');

  const insights = page.getByRole('region', { name: 'Workday insights' });
  const insight = insights.getByRole('heading', {
    name: 'Review work approaching its deadline',
  });
  await expect(insight).toBeVisible();
  const feedbackRequest = page.waitForRequest(
    (request) =>
      request.method() === 'POST' &&
      request.url().includes('/home/recommendations/work-due-soon/feedback')
  );
  await insights.getByRole('button', { name: 'This recommendation is not relevant' }).click();

  expect((await feedbackRequest).postDataJSON()).toMatchObject({
    feedbackType: 'NOT_RELEVANT',
  });
  await expect(insight).toHaveCount(0);
});
