import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Route } from '@playwright/test';

import { ASK_RUNTIME_FIXTURE } from './support/runtime-access';
import { mockQuestionLaunches } from './support/question-launch';
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
  await mockQuestionLaunches(page);
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
    (url) => url.pathname === '/dwaion/new' && !url.searchParams.has('q')
  );
  expect(page.url()).not.toContain(encodeURIComponent(question));
  await expect(page.getByTestId('dwaion-workspace-answer')).toContainText(
    ASK_RUNTIME_FIXTURE.answer
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

test('DWAI·ON uses one event-driven mascot response and never loops', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');

  const mascotMotion = page.getByTestId('dwaion-mascot-motion');
  const mascotGreeting = page.getByTestId('dwaion-mascot-greeting');
  await expect(mascotMotion).toHaveCSS('animation-name', 'none');
  await expect(mascotGreeting).toHaveCSS('animation-name', 'none');

  await page
    .getByTestId('dwaion-launcher')
    .getByRole('button', { name: /^Open DWAI·ON/ })
    .click();
  await expect(mascotMotion).not.toHaveCSS('animation-name', 'none');
  await expect(mascotMotion).toHaveCSS('animation-iteration-count', '1');
  await expect(mascotGreeting).toHaveCSS('animation-name', 'none');
  await page.waitForTimeout(650);
  expect(
    await mascotMotion.evaluate((element) =>
      element.getAnimations().every((animation) => animation.playState !== 'running')
    )
  ).toBe(true);
});

test('DWAI·ON respects compact viewport and safe-area spacing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const launcher = page.getByTestId('dwaion-launcher');
  const headerActions = page.getByTestId('shell-global-actions');
  const main = page.locator('#dwp-main-content');
  await expect(launcher).toHaveAttribute('data-shell-auxiliary-placement', 'header');
  const launcherBounds = await launcher.boundingBox();
  const headerBounds = await headerActions.boundingBox();
  const mainBounds = await main.boundingBox();
  expect(launcherBounds?.x ?? 0).toBeGreaterThanOrEqual(headerBounds?.x ?? 0);
  expect((launcherBounds?.x ?? 0) + (launcherBounds?.width ?? 0)).toBeLessThanOrEqual(
    (headerBounds?.x ?? 0) + (headerBounds?.width ?? 0)
  );
  expect((launcherBounds?.y ?? 0) + (launcherBounds?.height ?? 0)).toBeLessThanOrEqual(
    mainBounds?.y ?? 0
  );

  await launcher.getByRole('button', { name: 'Open DWAI·ON' }).click();
  const panel = page.getByTestId('dwaion-panel');
  await expect
    .poll(async () => (await panel.boundingBox())?.width ?? 0)
    .toBeGreaterThanOrEqual(389);
  const panelBounds = await panel.boundingBox();
  expect(panelBounds?.x ?? -1).toBeLessThanOrEqual(1);
  expect(panelBounds?.y ?? -1).toBeLessThanOrEqual(1);
  expect(panelBounds?.width ?? 0).toBeGreaterThanOrEqual(389);
  expect(panelBounds?.height ?? 0).toBeGreaterThanOrEqual(843);
  await panel.getByRole('button', { name: 'User guide' }).click();
  const undersizedActions = await panel
    .locator(
      '[aria-labelledby="dwaion-suggestions-title"] button, [aria-labelledby="dwaion-support-tools-title"] button'
    )
    .evaluateAll((buttons) =>
      buttons
        .filter((button) => {
          const bounds = button.getBoundingClientRect();
          return bounds.width > 0 && bounds.height > 0 && (bounds.width < 44 || bounds.height < 44);
        })
        .map((button) => button.getAttribute('aria-label') || button.textContent?.trim())
    );
  expect(undersizedActions).toEqual([]);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('DWAI·ON full-screen panel reflows internally at 200% text', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 900 });
  await page.goto('/');
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });

  const launcher = page.getByTestId('dwaion-launcher');
  await expect(launcher).toHaveAttribute('data-shell-auxiliary-placement', 'header');
  await launcher.getByRole('button', { name: 'Open DWAI·ON' }).click();
  const panel = page.getByTestId('dwaion-panel');
  await expect
    .poll(async () => (await panel.boundingBox())?.width ?? 0)
    .toBeGreaterThanOrEqual(639);
  const geometry = await panel.evaluate((element) => ({
    overflow: element.scrollWidth - element.clientWidth,
    bounds: element.getBoundingClientRect().toJSON(),
  }));
  expect(geometry.overflow).toBeLessThanOrEqual(1);
  expect(geometry.bounds.height).toBeGreaterThanOrEqual(899);
  await expect(panel.getByRole('textbox', { name: 'Ask DWAI·ON' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Close DWAI·ON' })).toBeVisible();
});

test('DWAI·ON reserves the shell edge without covering compact content or bottom actions', async ({
  page,
}) => {
  const scenarios = [
    { label: '320px Home', path: '/', width: 320, height: 720, textScale: 100 },
    { label: '390px', path: '/', width: 390, height: 844, textScale: 100 },
    { label: '768px', path: '/', width: 768, height: 1024, textScale: 100 },
    { label: '390px at 200% text', path: '/', width: 390, height: 844, textScale: 200 },
  ] as const;

  for (const scenario of scenarios) {
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await page.goto(scenario.path);
    if (scenario.textScale === 200) {
      await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
    }

    const main = page.locator('#dwp-main-content');
    const launcher = page.getByTestId('dwaion-launcher');
    await expect(main).toBeVisible();
    await expect(launcher).toBeVisible();
    await expect(launcher).toHaveAttribute('data-shell-auxiliary-placement', 'header');
    await page.evaluate(() => {
      const mainElement = document.getElementById('dwp-main-content');
      if (!mainElement) throw new Error('Shell main content is missing.');
      const actions = [...mainElement.querySelectorAll<HTMLElement>('a[href], button')].filter(
        (element) => {
          const style = getComputedStyle(element);
          const bounds = element.getBoundingClientRect();
          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            bounds.width > 0 &&
            bounds.height > 0
          );
        }
      );
      const bottomAction = actions.at(-1);
      if (!bottomAction) throw new Error('Shell bottom action is missing.');
      bottomAction.dataset.dwaionBottomActionProbe = '';
      bottomAction.scrollIntoView({ block: 'center' });
    });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    );

    const geometry = await page.evaluate(() => {
      const mainElement = document.getElementById('dwp-main-content');
      const launcherElement = document.querySelector<HTMLElement>(
        '[data-testid="dwaion-launcher"]'
      );
      const headerElement = launcherElement?.closest<HTMLElement>('header');
      const bottomAction = mainElement?.querySelector<HTMLElement>(
        '[data-dwaion-bottom-action-probe]'
      );
      if (!mainElement || !launcherElement || !bottomAction) {
        throw new Error('Shell safety elements are missing.');
      }

      const launcherRect = launcherElement.getBoundingClientRect();
      const headerRect = headerElement?.getBoundingClientRect();
      const actionRect = bottomAction.getBoundingClientRect();
      const overlapsHorizontally =
        actionRect.left < launcherRect.right && launcherRect.left < actionRect.right;
      const overlapsVertically =
        actionRect.top < launcherRect.bottom && launcherRect.top < actionRect.bottom;

      return {
        bottomActionCovered: overlapsHorizontally && overlapsVertically,
        fixedHeaderContentOffset:
          !headerElement ||
          !headerRect ||
          getComputedStyle(headerElement).position !== 'fixed' ||
          Number.parseFloat(getComputedStyle(mainElement).paddingTop) >= headerRect.height,
        launcherContainedByHeader:
          !headerRect ||
          (launcherRect.left >= headerRect.left &&
            launcherRect.right <= headerRect.right &&
            launcherRect.top >= headerRect.top &&
            launcherRect.bottom <= headerRect.bottom),
        launcherInsideViewport:
          launcherRect.left >= 0 && launcherRect.right <= document.documentElement.clientWidth,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        overflowSources: [...document.querySelectorAll<HTMLElement>('body *')]
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              element: [
                element.tagName.toLowerCase(),
                element.getAttribute('data-testid'),
                element.getAttribute('aria-label'),
                element.id,
                typeof element.className === 'string'
                  ? element.className.split(/\s+/).slice(0, 3).join('.')
                  : '',
                element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 60),
              ]
                .filter(Boolean)
                .join(' | '),
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
              minWidth: getComputedStyle(element).minWidth,
            };
          })
          .filter(
            ({ left, right, width }) =>
              width > 0 && (left < -1 || right > document.documentElement.clientWidth + 1)
          )
          .sort((left, right) => right.right - left.right)
          .slice(0, 12),
      };
    });

    expect(geometry.launcherContainedByHeader, `${scenario.label} shell header dock`).toBe(true);
    expect(geometry.launcherInsideViewport, `${scenario.label} launcher viewport edge`).toBe(true);
    expect(
      geometry.pageOverflow,
      `${scenario.label} page horizontal overflow: ${JSON.stringify(geometry.overflowSources)}`
    ).toBeLessThanOrEqual(1);
    expect(geometry.fixedHeaderContentOffset, `${scenario.label} fixed header offset`).toBe(true);
    expect(geometry.bottomActionCovered, `${scenario.label} bottom action overlap`).toBe(false);
  }
});

test('DWAI·ON keeps every recent Activity action reachable at the desktop shell edge', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 768 });
  await page.goto('/activity/home');

  const recent = page.getByRole('region', { name: 'Recent activity' });
  const launcher = page.getByTestId('dwaion-launcher');
  const actions = recent.getByRole('link', { name: 'Open', exact: true });
  await expect(recent).toBeVisible();
  await expect(launcher).toHaveAttribute('data-shell-auxiliary-placement', 'floating');
  expect(await actions.count()).toBeGreaterThan(0);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  );

  const geometry = await page.evaluate(() => {
    const launcherElement = document.querySelector<HTMLElement>('[data-testid="dwaion-launcher"]');
    const targets = [
      ...document.querySelectorAll<HTMLElement>(
        '[aria-labelledby="activity-home-recent"] [data-shell-auxiliary-avoidance]'
      ),
    ];
    if (!launcherElement || targets.length === 0) {
      throw new Error('Activity auxiliary-avoidance geometry is unavailable.');
    }
    const launcherRect = launcherElement.getBoundingClientRect();
    const intersectingTargets = targets.filter((target) => {
      const rect = target.getBoundingClientRect();
      return (
        rect.left < launcherRect.right &&
        rect.right > launcherRect.left &&
        rect.top < launcherRect.bottom &&
        rect.bottom > launcherRect.top
      );
    });
    const coveredActions = targets.flatMap((target) =>
      [...target.querySelectorAll<HTMLElement>('a, button')].filter((action) => {
        const rect = action.getBoundingClientRect();
        return (
          rect.left < launcherRect.right &&
          rect.right > launcherRect.left &&
          rect.top < launcherRect.bottom &&
          rect.bottom > launcherRect.top
        );
      })
    );
    return {
      launcher: {
        placement: launcherElement.dataset.shellAuxiliaryPlacement,
        edge: launcherElement.dataset.shellAuxiliaryEdge,
        rect: launcherRect.toJSON(),
      },
      targets: targets.map((target) => ({
        active: target.dataset.shellAuxiliaryAvoidanceActive,
        clearance: target.dataset.shellAuxiliaryClearance,
        rect: target.getBoundingClientRect().toJSON(),
      })),
      intersectingTargetCount: intersectingTargets.length,
      activeTargetCount: intersectingTargets.filter(
        (target) => target.dataset.shellAuxiliaryAvoidanceActive === 'true'
      ).length,
      coveredActionCount: coveredActions.length,
    };
  });

  expect(geometry.activeTargetCount, JSON.stringify(geometry)).toBe(
    geometry.intersectingTargetCount
  );
  expect(geometry.coveredActionCount).toBe(0);

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect
    .poll(() => recent.locator('[data-shell-auxiliary-avoidance-active="true"]').count())
    .toBe(0);
  expect(
    await recent
      .locator('[data-shell-auxiliary-avoidance]')
      .last()
      .evaluate((target) => Number.parseFloat(getComputedStyle(target).paddingInlineEnd) || 0)
  ).toBe(0);
});

test('DWAI·ON keeps the Apps count and catalog actions clear at the 1280px shell edge', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/apps');

  const catalog = page.getByRole('region', { name: 'Available apps' });
  const launcher = page.getByTestId('dwaion-launcher');
  await expect(catalog).toBeVisible();
  await expect(launcher).toHaveAttribute('data-shell-auxiliary-placement', 'floating');
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  );

  const geometry = await page.evaluate(() => {
    const launcherElement = document.querySelector<HTMLElement>('[data-testid="dwaion-launcher"]');
    const targets = [
      ...document.querySelectorAll<HTMLElement>(
        '[aria-labelledby="available-apps-heading"] [data-shell-auxiliary-avoidance]'
      ),
    ];
    if (!launcherElement || targets.length === 0) {
      throw new Error('Apps auxiliary-avoidance geometry is unavailable.');
    }
    const launcherRect = launcherElement.getBoundingClientRect();
    const intersectsLauncher = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      return (
        rect.left < launcherRect.right &&
        rect.right > launcherRect.left &&
        rect.top < launcherRect.bottom &&
        rect.bottom > launcherRect.top
      );
    };
    const intersectingTargets = targets.filter(intersectsLauncher);
    const coveredContent = intersectingTargets.flatMap((target) =>
      [...target.querySelectorAll<HTMLElement>('a, button, h2, h3, p')].filter(intersectsLauncher)
    );
    return {
      intersectingTargetCount: intersectingTargets.length,
      activeTargetCount: intersectingTargets.filter(
        (target) => target.dataset.shellAuxiliaryAvoidanceActive === 'true'
      ).length,
      coveredContentCount: coveredContent.length,
      minimumClearance: Math.min(
        ...intersectingTargets.map((target) =>
          Number.parseFloat(target.dataset.shellAuxiliaryClearance ?? '0')
        )
      ),
    };
  });

  expect(geometry.intersectingTargetCount, JSON.stringify(geometry)).toBeGreaterThan(0);
  expect(geometry.activeTargetCount, JSON.stringify(geometry)).toBe(
    geometry.intersectingTargetCount
  );
  expect(geometry.minimumClearance).toBeGreaterThan(0);
  expect(geometry.coveredContentCount).toBe(0);
});
