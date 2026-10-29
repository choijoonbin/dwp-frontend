import { expect, test } from '@playwright/test';

import { routeHomeWave2Flow } from './support/home-wave2-acceptance-fixtures';
import { routeHomeWave4ShadowRuntime } from './support/home-wave4-runtime-fixtures';
import { mockShellSession } from './support/shell-session';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'Mina Kim',
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: false,
    },
  });
});

test('home records explicit feedback and removes an irrelevant recommendation', async ({
  page,
}) => {
  await routeHomeWave2Flow(page, 'balanced');
  await routeHomeWave4ShadowRuntime(page, 'FLOW_V1');
  await page.goto('/');

  const recommendationCue = page.getByRole('button', { name: 'Recommendation' });
  await expect(recommendationCue).toBeVisible();
  await recommendationCue.click();
  const recommendation = page.getByRole('dialog', {
    name: 'Review work approaching its deadline',
  });
  await expect(recommendation).toBeVisible();
  const feedbackRequest = page.waitForRequest(
    (request) =>
      request.method() === 'POST' &&
      request.url().includes('/home/recommendations/work-due-soon/feedback')
  );
  await recommendation.getByRole('button', { name: 'This recommendation is not relevant' }).click();

  expect((await feedbackRequest).postDataJSON()).toMatchObject({
    feedbackType: 'NOT_RELEVANT',
  });
  await expect(recommendation).toHaveCount(0);
  await expect(recommendationCue).toHaveCount(0);
});
