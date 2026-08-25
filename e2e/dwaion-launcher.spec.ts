import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Route } from '@playwright/test';

import { ASK_RUNTIME_FIXTURE } from './support/runtime-access';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

function fulfillAskStream(route: Route, response: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'text/event-stream',
    body: [
      'event: progress\ndata: {"stage":"AUTHORIZING"}',
      'event: progress\ndata: {"stage":"RETRIEVING"}',
      `event: result\ndata: ${JSON.stringify({ data: response })}`,
      '',
    ].join('\n\n'),
  });
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'Mina Kim',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.route('**/api/agent/v1/ask/stream', (route) => {
    const request = route.request().postDataJSON() as { requestId: string };
    return fulfillAskStream(route, { ...ASK_RUNTIME_FIXTURE, requestId: request.requestId });
  });
});

test('DWAI·ON opens as an overlay without shifting the personal home', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const launcher = page.getByTestId('dwaion-launcher');
  const trigger = launcher.getByRole('button', { name: 'Open DWAI·ON' });
  const mascot = page.getByTestId('dwaion-mascot');
  const mascotMotion = page.getByTestId('dwaion-mascot-motion');
  const mascotGreeting = page.getByTestId('dwaion-mascot-greeting');
  await expect(trigger).toBeVisible();
  await expect(mascotMotion).toHaveCSS('animation-name', 'none');
  await expect(mascotGreeting).toHaveCSS('animation-name', 'none');
  expect(await mascot.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

  const mainBefore = await page.getByTestId('personal-home-main').boundingBox();
  await trigger.click();

  const panel = page.getByRole('dialog', { name: 'DWAI·ON conversation and support panel' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText('DWAI·ON', { exact: true })).toBeVisible();
  await expect(panel.getByText('Mina, what can we solve together?')).toBeVisible();
  await expect(
    panel.getByRole('button', { name: 'What should I review first today?' })
  ).toBeVisible();
  await expect(panel.getByRole('button', { name: 'User guide' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Contact directory' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Service status' })).toBeVisible();
  await panel.getByRole('button', { name: 'User guide' }).click();
  await expect(panel.getByRole('region', { name: 'User guide' })).toContainText(
    'Get started with home tools'
  );

  const mainAfter = await page.getByTestId('personal-home-main').boundingBox();
  expect(mainAfter).toEqual(mainBefore);

  const accessibility = await new AxeBuilder({ page })
    .include('[data-testid="dwaion-launcher"]')
    .include('[data-testid="dwaion-panel"]')
    .analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);

  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('DWAI·ON runs a governed question and carries it into the evidence workspace', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByTestId('dwaion-launcher')
    .getByRole('button', { name: /^Open DWAI·ON/ })
    .click();

  const panel = page.getByRole('dialog', { name: 'DWAI·ON conversation and support panel' });
  const question = 'Can I work remotely next Friday?';
  await panel.getByRole('textbox', { name: 'Ask DWAI·ON' }).fill(question);
  const requestPromise = page.waitForRequest('**/api/agent/v1/ask/stream');
  await panel.getByRole('button', { name: 'Send question' }).click();
  const request = await requestPromise;
  expect(request.postDataJSON()).toMatchObject({
    query: question,
    agentKey: 'DWP_ASSISTANT',
  });

  await expect(panel.getByTestId('dwaion-answer')).toContainText(ASK_RUNTIME_FIXTURE.answer);
  await expect(panel.getByText('2 sources')).toBeVisible();
  await panel.getByRole('button', { name: 'Review evidence and sources' }).click();
  await expect(page).toHaveURL(
    (url) => url.pathname === '/dwaion/new' && url.searchParams.get('q') === question
  );
});

test('DWAI·ON exposes configuration truthfully and links status to the app catalog', async ({
  page,
}) => {
  await page.route('**/api/agent/v1/ask/stream', (route) => {
    const request = route.request().postDataJSON() as { requestId: string };
    return fulfillAskStream(route, {
      ...ASK_RUNTIME_FIXTURE,
      requestId: request.requestId,
      state: 'CONFIGURATION_REQUIRED',
      answer: null,
      confidence: null,
      citations: [],
      sourceCount: 12,
      modelRoute: {
        state: 'CONFIGURATION_REQUIRED',
        provider: null,
        model: null,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        latencyMs: 0,
      },
      statusCode: 'MODEL_ROUTE_CONFIGURATION_REQUIRED',
    });
  });

  await page.goto('/');
  await page
    .getByTestId('dwaion-launcher')
    .getByRole('button', { name: /^Open DWAI·ON/ })
    .click();
  const panel = page.getByTestId('dwaion-panel');
  await panel.getByRole('button', { name: 'Where do I request software access?' }).click();

  await expect(
    panel.getByText('An administrator must complete the AI runtime configuration')
  ).toBeVisible();
  await expect(panel.getByText(/No substitute answer was generated/)).toBeVisible();
  await panel.getByRole('button', { name: 'Service status' }).click();
  await panel.getByRole('button', { name: 'Review status by app' }).click();
  await expect(page).toHaveURL(/\/apps$/);
});

test('DWAI·ON restores its original floating motion when motion is allowed', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');

  const mascotMotion = page.getByTestId('dwaion-mascot-motion');
  const mascotGreeting = page.getByTestId('dwaion-mascot-greeting');
  await expect(mascotMotion).not.toHaveCSS('animation-name', 'none');
  await expect(mascotGreeting).not.toHaveCSS('animation-name', 'none');
  const motionAnimation = await mascotMotion.evaluate((element) => {
    const animation = element.getAnimations()[0];
    return {
      currentTime: Number(animation?.currentTime ?? -1),
      playState: animation?.playState,
    };
  });
  const greetingAnimation = await mascotGreeting.evaluate((element) => {
    const animation = element.getAnimations()[0];
    return {
      currentTime: Number(animation?.currentTime ?? -1),
      playState: animation?.playState,
    };
  });
  expect(motionAnimation.playState).toBe('running');
  expect(greetingAnimation.playState).toBe('running');
  await expect
    .poll(async () =>
      mascotMotion.evaluate((element) => Number(element.getAnimations()[0]?.currentTime ?? -1))
    )
    .toBeGreaterThan(motionAnimation.currentTime);
  await expect
    .poll(async () =>
      mascotGreeting.evaluate((element) => Number(element.getAnimations()[0]?.currentTime ?? -1))
    )
    .toBeGreaterThan(greetingAnimation.currentTime);

  await page
    .getByTestId('dwaion-launcher')
    .getByRole('button', { name: /^Open DWAI·ON/ })
    .click();
  await expect(mascotGreeting).toHaveCSS('animation-name', 'none');
  await expect(mascotMotion).not.toHaveCSS('animation-name', 'none');
});

test('DWAI·ON respects compact viewport and safe-area spacing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const launcher = page.getByTestId('dwaion-launcher');
  const launcherBounds = await launcher.boundingBox();
  expect(launcherBounds?.x ?? 0).toBeGreaterThanOrEqual(300);
  expect((launcherBounds?.x ?? 0) + (launcherBounds?.width ?? 0)).toBeLessThanOrEqual(376);
  expect((launcherBounds?.y ?? 0) + (launcherBounds?.height ?? 0)).toBeLessThanOrEqual(830);

  await launcher.getByRole('button', { name: 'Open DWAI·ON' }).click();
  const panelBounds = await page.getByTestId('dwaion-panel').boundingBox();
  expect(panelBounds?.x ?? 0).toBeGreaterThanOrEqual(12);
  expect((panelBounds?.x ?? 0) + (panelBounds?.width ?? 0)).toBeLessThanOrEqual(378);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
