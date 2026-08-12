import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { ASK_RUNTIME_FIXTURE } from './support/runtime-access';
import { fulfillSuccess, mockShellSession } from './support/shell-session';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'Mina Kim',
    appearance: { mode: 'light', density: 'standard', highContrast: false, reduceMotion: true },
  });
});

test('Ask DWP persists the governed question in the URL and replays it on reload', async ({
  page,
}) => {
  const questions: string[] = [];
  await page.route('**/api/agent/v1/ask', (route) => {
    const request = route.request().postDataJSON() as { requestId: string; query: string };
    questions.push(request.query);
    return fulfillSuccess(route, { ...ASK_RUNTIME_FIXTURE, requestId: request.requestId });
  });

  await page.goto('/ask');
  const prompt = 'Can I work remotely next Friday?';
  await page.getByRole('button', { name: prompt }).click();

  await expect(page).toHaveURL(
    (url) => url.pathname === '/ask' && url.searchParams.get('q') === prompt
  );
  await expect(page.getByRole('heading', { name: 'Governed answer' })).toBeVisible();
  await expect(page.getByText(ASK_RUNTIME_FIXTURE.answer)).toBeVisible();

  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Ask a work question' })).toHaveValue(prompt);
  await expect(page.getByText(ASK_RUNTIME_FIXTURE.answer)).toBeVisible();
  expect(questions).toEqual([prompt, prompt]);
});

test('Activity exposes truthful operational counts and actionable state filters', async ({
  page,
}) => {
  await page.goto('/activity');

  const summary = page.getByRole('region', { name: 'Activity summary' });
  await expect(summary).toContainText('Events from 4 sources');
  await expect(summary).toContainText('0 currently running');
  await expect(summary).toContainText('1 awaiting review');
  await expect(summary).toContainText('1 requiring investigation');

  await summary.getByRole('button', { name: /Policy blocked/ }).click();
  await expect(page).toHaveURL((url) => url.searchParams.get('state') === 'policy-blocked');
  await expect(
    page.getByRole('list', { name: 'Workspace activity' }).getByRole('listitem')
  ).toHaveCount(1);
  await expect(
    page
      .getByRole('list', { name: 'Workspace activity' })
      .getByText('External sharing blocked', { exact: true })
  ).toBeVisible();

  await page.getByRole('textbox', { name: 'Search activity' }).fill('not-an-event');
  await expect(page.getByText('No activity matches these filters')).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(page).toHaveURL(
    (url) => !url.searchParams.has('state') && !url.searchParams.has('q')
  );

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});
