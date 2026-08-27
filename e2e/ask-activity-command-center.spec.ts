import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Route } from '@playwright/test';

import { ASK_RUNTIME_FIXTURE } from './support/runtime-access';
import { mockQuestionLaunches } from './support/question-launch';
import { mockShellSession } from './support/shell-session';

function fulfillAskStream(route: Route, response: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'text/event-stream',
    body: `event: result\ndata: ${JSON.stringify({ data: response })}\n\n`,
  });
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'Mina Kim',
    appearance: { mode: 'light', density: 'standard', highContrast: false, reduceMotion: true },
  });
});

test('DWAI·ON keeps the governed question out of the URL and never replays it on reload', async ({
  page,
}) => {
  await mockQuestionLaunches(page);
  const questions: string[] = [];
  await page.route('**/api/agent/v1/ask/stream', (route) => {
    const request = route.request().postDataJSON() as { requestId: string; query: string };
    questions.push(request.query);
    return fulfillAskStream(route, { ...ASK_RUNTIME_FIXTURE, requestId: request.requestId });
  });

  await page.goto('/dwaion');
  const prompt = 'Can I work remotely next Friday?';
  await page.getByRole('textbox', { name: 'Ask a work question' }).fill(prompt);
  await page.getByRole('button', { name: 'Send question' }).click();

  await expect(page).toHaveURL(
    (url) => url.pathname === '/dwaion/new' && !url.searchParams.has('q')
  );
  expect(page.url()).not.toContain(encodeURIComponent(prompt));
  await expect(page.getByRole('heading', { name: 'DWAI·ON response' })).toBeVisible();
  await expect(page.getByText(ASK_RUNTIME_FIXTURE.answer)).toBeVisible();

  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Ask a work question' })).toBeVisible();
  await expect(page.getByText(ASK_RUNTIME_FIXTURE.answer)).toHaveCount(0);
  expect(questions).toEqual([prompt]);
});

test('legacy /ask links discard URL questions without submitting them', async ({ page }) => {
  let askRequests = 0;
  await page.route('**/api/agent/v1/ask/stream', (route) => {
    askRequests += 1;
    const request = route.request().postDataJSON() as { requestId: string };
    return fulfillAskStream(route, { ...ASK_RUNTIME_FIXTURE, requestId: request.requestId });
  });

  const prompt = 'Summarize my urgent work';
  await page.goto(`/ask?q=${encodeURIComponent(prompt)}`);
  await expect(page).toHaveURL(
    (url) => url.pathname === '/dwaion/new' && !url.searchParams.has('q')
  );
  await expect(page.getByRole('textbox', { name: 'Ask a work question' })).toBeVisible();
  expect(askRequests).toBe(0);
});

test('global search hands an Ask question to DWAI·ON without URL disclosure', async ({ page }) => {
  await mockQuestionLaunches(page);
  const questions: string[] = [];
  await page.route('**/api/agent/v1/ask/stream', (route) => {
    const request = route.request().postDataJSON() as { requestId: string; query: string };
    questions.push(request.query);
    return fulfillAskStream(route, { ...ASK_RUNTIME_FIXTURE, requestId: request.requestId });
  });

  const prompt = 'Summarize the confidential launch readiness';
  await page.goto('/');
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByRole('combobox', { name: 'Search DWP' }).fill(prompt);
  await page.getByRole('option', { name: new RegExp(`Ask DWAI·ON: ${prompt}`) }).click();

  await expect(page).toHaveURL(
    (url) => url.pathname === '/dwaion/new' && !url.searchParams.has('q')
  );
  expect(page.url()).not.toContain(encodeURIComponent(prompt));
  await expect(page.getByText(ASK_RUNTIME_FIXTURE.answer)).toBeVisible();
  expect(questions).toEqual([prompt]);
});

test('an opaque question ticket survives an independent DWAI·ON document reload', async ({
  page,
}) => {
  const launches = await mockQuestionLaunches(page);
  const questions: string[] = [];
  await page.route('**/api/agent/v1/ask/stream', (route) => {
    const request = route.request().postDataJSON() as { requestId: string; query: string };
    questions.push(request.query);
    return fulfillAskStream(route, { ...ASK_RUNTIME_FIXTURE, requestId: request.requestId });
  });

  const prompt = 'Review the restricted acquisition readiness';
  const launchId = launches.seed(prompt);
  await page.goto('/');
  await page.evaluate((opaqueLaunchId) => {
    globalThis.history.replaceState(
      {
        usr: { dwaionQuestionLaunch: { version: 2, launchId: opaqueLaunchId } },
        key: 'question-launch-reload',
        idx: 0,
      },
      '',
      '/dwaion/new'
    );
  }, launchId);
  expect(await page.evaluate(() => JSON.stringify(globalThis.history.state))).not.toContain(prompt);

  await page.reload();

  await expect(page.getByText(ASK_RUNTIME_FIXTURE.answer)).toBeVisible();
  await expect(page).toHaveURL(
    (url) => url.pathname === '/dwaion/new' && !url.searchParams.has('q')
  );
  expect(await page.evaluate(() => globalThis.history.state?.usr ?? null)).toBeNull();
  expect(questions).toEqual([prompt]);
});

test('DWAI·ON consumes a new ticket when global search navigates to the current route', async ({
  page,
}) => {
  await mockQuestionLaunches(page);
  const questions: string[] = [];
  await page.route('**/api/agent/v1/ask/stream', (route) => {
    const request = route.request().postDataJSON() as { requestId: string; query: string };
    questions.push(request.query);
    return fulfillAskStream(route, { ...ASK_RUNTIME_FIXTURE, requestId: request.requestId });
  });

  const prompt = 'Review the current route launch boundary';
  await page.goto('/dwaion/new');
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByRole('combobox', { name: 'Search DWP' }).fill(prompt);
  await page.getByRole('option', { name: new RegExp(`Ask DWAI·ON: ${prompt}`) }).click();

  await expect(page.getByText(ASK_RUNTIME_FIXTURE.answer)).toBeVisible();
  expect(questions).toEqual([prompt]);
});

test('Activity exposes truthful operational counts and actionable state filters', async ({
  page,
}) => {
  await page.goto('/activity/timeline');

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
