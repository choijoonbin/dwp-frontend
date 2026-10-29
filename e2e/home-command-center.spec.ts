import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  FULL_PRODUCT_PERMISSIONS,
  HOME_COMMUNICATIONS_FIXTURE,
  createHomeOverviewFixture,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';
import { routeCanonicalHomeWorkspaceApps } from './support/home-launchpad-contract-fixture';
import {
  routeHomeWave2HealthyFlowContributions,
  routeHomeWave2NewsOverview,
  routeHomeWave2WidgetCatalog,
} from './support/home-wave2-acceptance-fixtures';
import { routeHomeWave4ShadowRuntime } from './support/home-wave4-runtime-fixtures';
import { mockUnreadAppBadge } from './support/ui-contracts';
import { CALENDAR_EVENT_FIXTURE } from './support/product-area-fixtures';

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

test('home turns live work signals into a keyboard-operable next action', async ({ page }) => {
  await routeHomeWave4ShadowRuntime(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');

  const organizationPortal = page.getByRole('region', { name: 'Organization portal' });
  await expect(organizationPortal).toBeVisible();
  await expect(
    organizationPortal.getByRole('heading', { name: 'DWP Workplace organization portal' })
  ).toBeVisible();
  await expect(page.getByTestId('home-hero')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Company news and notices' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'My work flow' })).toBeVisible();
  const priority = page.getByRole('link', { name: /Approve software access request/u });
  await expect(priority).toBeVisible();
  const launchpadGrid = page.getByRole('list', { name: 'Start work apps' });
  await expect(launchpadGrid).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Work' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Work tools' })).toBeVisible();

  const accessibility = await new AxeBuilder({ page })
    .include('[data-testid="classic-home"]')
    .analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);

  await priority.focus();
  await expect(priority).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/work\/queue\?item=WK-1042/);
});

test('home preserves the tenant-managed hero image source', async ({ page }) => {
  await page.route('**/api/platform/v1/home-experience', (route) =>
    fulfillSuccess(route, {
      headline: null,
      subheadline: null,
      localizedContent: {},
      defaultLocale: 'en',
      backgroundPosition: 'RIGHT',
      overlayOpacity: 18,
      backgroundUrl: '/api/platform/v1/home-experience/background?v=7',
      backgroundOriginalName: 'skax-home.webp',
      version: 7,
    })
  );

  await page.goto('/');

  await expect(page.getByTestId('home-hero')).toHaveCSS(
    'background-image',
    /\/api\/platform\/v1\/home-experience\/background\?v=7/
  );
});

test('home news banner cross-fades stories without a blank replacement frame', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const overview = createHomeOverviewFixture(['WORKSPACE_MEMBER']);
  await page.route('**/api/platform/v1/home/overview**', (route) =>
    fulfillSuccess(route, {
      ...overview,
      communications: {
        ...overview.communications,
        generatedAt: HOME_COMMUNICATIONS_FIXTURE.generatedAt,
        data: HOME_COMMUNICATIONS_FIXTURE,
      },
    })
  );
  await page.goto('/');

  const carousel = page.getByTestId('home-news-carousel');
  await expect(
    carousel.locator('[data-news-layer="active"][data-news-story-id="4104"]')
  ).toBeVisible();
  await carousel.getByRole('button', { name: 'Pause automatic story rotation' }).click();
  await carousel.getByRole('button', { name: 'Show story 2' }).click();

  await expect(carousel).toHaveAttribute('data-news-transitioning', 'true');
  await expect(
    carousel.locator('[data-news-layer="outgoing"][data-news-story-id="4104"]')
  ).toHaveCount(1);
  await expect(
    carousel.locator('[data-news-layer="active"][data-news-story-id="4103"]')
  ).toHaveCount(1);

  await expect(carousel).toHaveAttribute('data-news-transitioning', 'false', { timeout: 1500 });
  await expect(carousel.locator('[data-news-layer="outgoing"]')).toHaveCount(0);
});

test('home news banner starts with the latest story, rotates, and preserves navigation', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const overview = createHomeOverviewFixture(['WORKSPACE_MEMBER']);
  await page.route('**/api/platform/v1/home/overview**', (route) =>
    fulfillSuccess(route, {
      ...overview,
      communications: {
        ...overview.communications,
        generatedAt: HOME_COMMUNICATIONS_FIXTURE.generatedAt,
        data: HOME_COMMUNICATIONS_FIXTURE,
      },
    })
  );
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');

  const carousel = page.getByTestId('home-news-carousel');
  await expect(carousel.locator('[data-news-story-id="4104"]')).toBeVisible();
  await expect(carousel.locator('img')).toHaveAttribute(
    'src',
    '/media/communications/innovation-lab.jpg'
  );
  await expect(carousel.getByText('Digital Workplace', { exact: true })).toBeVisible();
  await expect(carousel.getByText('4 stories', { exact: true })).toBeVisible();

  const priorityCards = page.getByTestId('home-priority-rail').locator(':scope > div');
  await expect(priorityCards).toHaveCount(3);
  const cardRows = await priorityCards.evaluateAll((cards) =>
    cards.map((card) => Math.round(card.getBoundingClientRect().top))
  );
  expect(new Set(cardRows).size).toBe(1);

  await expect(carousel.locator('[data-news-story-id="4103"]')).toBeVisible({ timeout: 4500 });
  await carousel.locator('[data-news-story-id="4103"]').click();
  await expect(page).toHaveURL(/\/communications\/for-you\/4103$/);

  await page.goto('/');
  await carousel.getByRole('link', { name: 'View all news' }).click();
  await expect(page).toHaveURL(/\/communications\/for-you$/);

  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  await expect(
    page.getByRole('heading', {
      name: 'A new way to collaborate with colleagues in the AI era',
    })
  ).toBeVisible();
  const mobileOverflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    offenders: Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((node) => node.offsetParent !== null)
      .flatMap((node) => {
        const bounds = node.getBoundingClientRect();
        return bounds.left < -1 || bounds.right > document.documentElement.clientWidth + 1
          ? [
              {
                tag: node.tagName,
                text: node.textContent?.trim().slice(0, 40),
                left: Math.round(bounds.left),
                right: Math.round(bounds.right),
                width: Math.round(bounds.width),
              },
            ]
          : [];
      })
      .slice(0, 12),
  }));
  expect(mobileOverflow.offenders).toEqual([]);
  expect(mobileOverflow.documentWidth).toBeLessThanOrEqual(mobileOverflow.viewport);
});

test('home section text metadata uses one shared visual hierarchy', async ({ page }) => {
  const overview = createHomeOverviewFixture(['WORKSPACE_MEMBER']);
  await page.route('**/api/platform/v1/home/overview**', (route) =>
    fulfillSuccess(route, {
      ...overview,
      communications: {
        ...overview.communications,
        generatedAt: HOME_COMMUNICATIONS_FIXTURE.generatedAt,
        data: HOME_COMMUNICATIONS_FIXTURE,
      },
    })
  );
  await page.goto('/');

  const metadata = [
    page.getByTestId('home-news-carousel').locator('[data-dwp-section-header-meta-text]'),
    page.getByTestId('home-command-area').locator('[data-dwp-section-header-meta-text]'),
    page
      .locator('section[aria-labelledby="priority-heading"]')
      .locator('[data-dwp-section-header-meta-text]'),
  ];

  const metrics = [];
  for (const item of metadata) {
    await expect(item).toHaveCount(1);
    metrics.push(
      await item.evaluate((node) => {
        const style = window.getComputedStyle(node);
        return {
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: style.lineHeight,
          letterSpacing: style.letterSpacing,
          color: style.color,
        };
      })
    );
  }

  expect(new Set(metrics.map((metric) => JSON.stringify(metric))).size).toBe(1);
  expect(metrics[0]).toMatchObject({
    fontSize: '12px',
    fontWeight: '500',
    lineHeight: '18px',
    letterSpacing: 'normal',
  });
});

test('home app actions occupy the hero utility position without refresh controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const hero = page.getByTestId('home-hero');
  const workTools = page.getByRole('region', { name: 'Work tools' });
  const actions = hero.locator('[data-launchpad-actions]');
  const assignmentCount = actions.locator('[data-launchpad-assignment-count]');
  const allApps = actions.getByRole('button', { name: 'All apps' });
  const editHome = actions.getByRole('button', { name: 'Edit home' });
  await expect(workTools.locator('[data-launchpad-actions]')).toHaveCount(0);
  await expect(workTools.getByRole('heading', { name: 'Work tools' })).toHaveCount(0);
  await expect(assignmentCount).toHaveText(/^\d+ assigned$/);
  await expect(allApps).toBeVisible();
  await expect(editHome).toBeVisible();
  await expect(actions.getByRole('button')).toHaveText(['All apps', 'Edit home']);
  await expect(actions.locator('[data-home-action-policy="PERSONAL"]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Edit home' })).toHaveCount(1);
  const segmentHeights = await Promise.all(
    [assignmentCount, allApps, editHome].map((segment) =>
      segment.evaluate((node) => Math.round(node.getBoundingClientRect().height))
    )
  );
  expect(new Set(segmentHeights).size).toBe(1);
  await expect(hero.getByText(/^Updated /)).toHaveCount(0);
  await expect(hero.getByRole('button', { name: 'Try again' })).toHaveCount(0);

  await page.setViewportSize({ width: 320, height: 720 });
  await expect(allApps).toBeVisible();
  await expect(editHome).toBeVisible();
  const mobileOverflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    offenders: Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((node) => node.offsetParent !== null)
      .flatMap((node) => {
        const bounds = node.getBoundingClientRect();
        return bounds.left < -1 || bounds.right > document.documentElement.clientWidth + 1
          ? [
              {
                tag: node.tagName,
                testId: node.dataset.testid,
                className: node.className.toString().slice(0, 80),
                text: node.textContent?.trim().slice(0, 80),
                href: node instanceof HTMLAnchorElement ? node.getAttribute('href') : undefined,
                parentClass: node.parentElement?.className.toString().slice(0, 80),
                left: Math.round(bounds.left),
                right: Math.round(bounds.right),
                width: Math.round(bounds.width),
              },
            ]
          : [];
      })
      .slice(0, 20),
  }));
  expect(mobileOverflow.offenders).toEqual([]);
  expect(mobileOverflow.documentWidth).toBeLessThanOrEqual(mobileOverflow.viewport);

  await editHome.click();
  await expect(page.locator('[data-workspace-composer-placement="floating"]')).toBeVisible();
});

test('home composer enforces semantic height tokens without creating nested scroll owners', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit home' }).click();

  const activityWidget = page.locator('[data-workspace-widget="activity"]');
  const activityContent = activityWidget.locator(':scope > [data-workspace-widget-content]');
  const activitySurface = activityContent.locator(':scope > section');
  await expect(activityWidget).toHaveAttribute('data-workspace-widget-height', 'tall');
  await expect(activityWidget).toHaveCSS('height', '348px');
  await page.getByRole('button', { name: 'Select Live activity widget size' }).click();

  const footprintDialog = page.getByRole('dialog', { name: 'Live activity widget size' });
  await expect(
    footprintDialog.getByRole('group', { name: 'Live activity widget width' })
  ).toBeVisible();
  await expect(
    footprintDialog.getByRole('group', { name: 'Live activity widget height' })
  ).toBeVisible();
  await footprintDialog.getByRole('button', { name: 'Short' }).click();

  await expect(activityWidget).toHaveAttribute('data-workspace-widget-height', 'short');
  await expect(activityWidget).toHaveCSS('height', '212px');
  await expect(activityContent).toHaveCSS('overflow-y', 'hidden');
  await expect(activitySurface).toHaveCSS('overflow-y', 'hidden');
  expect(await activitySurface.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(
    true
  );

  await page.setViewportSize({ width: 320, height: 720 });
  await expect(activityWidget).not.toHaveCSS('height', '212px');
  await expect(activityContent).toHaveCSS('overflow-y', 'hidden');
  await expect(activitySurface).toHaveCSS('overflow-y', 'hidden');
  expect(await activitySurface.evaluate((node) => node.scrollHeight === node.clientHeight)).toBe(
    true
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth)
  );

  await page.keyboard.press('Escape');
  await expect(footprintDialog).not.toBeVisible();
  await page.locator('button[aria-label="Cancel changes"]').click();
  await page.getByRole('button', { name: 'Discard changes' }).click();
  await expect(page.getByRole('button', { name: 'Edit home' })).toBeVisible();
});

test('home edit mode settles widgets once and honors reduced-motion preferences', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit home' }).click();

  const appGlyph = page.locator('[data-launchpad-tile] [data-launchpad-glyph]').first();
  const personalWidget = page
    .locator('[data-workspace-widget-policy="PERSONAL"] > [data-workspace-widget-content]')
    .first();
  const governedWidget = page
    .locator('[data-workspace-widget-policy="GOVERNED"] > [data-workspace-widget-content]')
    .first();

  await expect(appGlyph).toBeVisible();
  await expect(personalWidget).toBeVisible();
  const motion = await Promise.all(
    [appGlyph, personalWidget, governedWidget].map((locator) =>
      locator.evaluate((node) => {
        const style = window.getComputedStyle(node);
        return {
          name: style.animationName,
          duration: style.animationDuration,
          iterationCount: style.animationIterationCount,
          timingFunction: style.animationTimingFunction,
        };
      })
    )
  );
  expect(motion[0]?.name).not.toBe('none');
  expect(motion[0]?.duration).toBe('0.46s');
  expect(motion[0]?.iterationCount).toBe('1');
  expect(motion[0]?.timingFunction).toContain('linear(');
  expect(motion[1]?.name).not.toBe('none');
  expect(motion[1]?.duration).toBe('0.46s');
  expect(motion[1]?.iterationCount).toBe('1');
  expect(motion[1]?.timingFunction).toContain('linear(');
  expect(motion[2]?.name).toBe('none');
  expect(
    await personalWidget.evaluate((node) => {
      const style = window.getComputedStyle(node.parentElement ?? node, '::after');
      return {
        duration: style.animationDuration,
        iterationCount: style.animationIterationCount,
      };
    })
  ).toEqual({ duration: '0.46s', iterationCount: '1' });

  await page.waitForTimeout(750);
  const settledTransforms = await page
    .locator('[data-workspace-widget-policy="PERSONAL"] > [data-workspace-widget-content]')
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        content: window.getComputedStyle(node).transform,
        frame: window.getComputedStyle(node.parentElement ?? node, '::after').transform,
      }))
    );
  expect(settledTransforms).toEqual(
    Array.from({ length: settledTransforms.length }, () => ({ content: 'none', frame: 'none' }))
  );
  await page.locator('html').evaluate((node) => {
    node.dataset.motion = 'reduced';
  });
  await expect
    .poll(() => appGlyph.evaluate((node) => window.getComputedStyle(node).animationName))
    .toBe('none');
  await expect
    .poll(() => personalWidget.evaluate((node) => window.getComputedStyle(node).animationName))
    .toBe('none');
  await expect
    .poll(() =>
      personalWidget.evaluate(
        (node) => window.getComputedStyle(node.parentElement ?? node, '::after').animationName
      )
    )
    .toBe('none');

  await page.locator('html').evaluate((node) => {
    node.dataset.motion = 'full';
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect
    .poll(() => appGlyph.evaluate((node) => window.getComputedStyle(node).animationName))
    .toBe('none');
  await expect
    .poll(() => personalWidget.evaluate((node) => window.getComputedStyle(node).animationName))
    .toBe('none');
  await expect
    .poll(() =>
      personalWidget.evaluate(
        (node) => window.getComputedStyle(node.parentElement ?? node, '::after').animationName
      )
    )
    .toBe('none');
});

test('pressing and holding a work tool enters personal editing without launching it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const workTool = page.getByRole('button', { name: 'Open Work', exact: true });
  const bounds = await workTool.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;

  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  try {
    await page.waitForTimeout(650);
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove Work from home' })).toBeVisible();
    await expect(page).toHaveURL(
      (url) => url.pathname === '/' && url.searchParams.get('edit') === 'home'
    );
  } finally {
    await page.mouse.up();
  }

  await page.waitForTimeout(350);
  await expect(page).toHaveURL(
    (url) => url.pathname === '/' && url.searchParams.get('edit') === 'home'
  );
  await page.locator('button[aria-label="Cancel changes"]').click();
  await expect(page.getByRole('button', { name: 'Edit home' })).toBeVisible();
  await expect(page).toHaveURL((url) => url.pathname === '/' && url.search === '');
});

test('home app hover lifts the icon without adding a surface over its label', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await routeHomeWave2NewsOverview(page);
  await routeCanonicalHomeWorkspaceApps(page);
  await routeHomeWave2HealthyFlowContributions(page);
  await routeHomeWave2WidgetCatalog(page);
  await routeHomeWave4ShadowRuntime(page);
  await page.goto('/');

  const workButton = page.getByRole('button', { name: 'Open Work' });
  await workButton.hover();
  const hoverGeometry = await workButton.evaluate((button) => {
    const frame = button.querySelector<HTMLElement>('[data-launchpad-edit-frame]');
    const glyph = button.querySelector<HTMLElement>('[data-launchpad-glyph]');
    const label = button.querySelector<HTMLElement>('[data-launchpad-item-label]');
    if (!frame || !glyph || !label) return null;
    const buttonStyle = window.getComputedStyle(button);
    const framePseudoStyle = window.getComputedStyle(frame, '::after');
    const glyphStyle = window.getComputedStyle(glyph);
    const labelStyle = window.getComputedStyle(label);
    const glyphBounds = glyph.getBoundingClientRect();
    const labelBounds = label.getBoundingClientRect();
    return {
      frame: [frame.offsetWidth, frame.offsetHeight],
      framePseudoContent: framePseudoStyle.content,
      glyphTransform: glyphStyle.transform,
      glyphBoxShadow: glyphStyle.boxShadow,
      labelZIndex: labelStyle.zIndex,
      labelClearance: Math.round(labelBounds.top - glyphBounds.bottom),
      tileBackground: buttonStyle.backgroundColor,
      tileBoxShadow: buttonStyle.boxShadow,
    };
  });

  expect(hoverGeometry).toEqual({
    frame: [52, 52],
    framePseudoContent: 'none',
    glyphTransform: expect.not.stringMatching(/^none$/u),
    glyphBoxShadow: expect.not.stringMatching(/^none$/u),
    labelZIndex: '2',
    labelClearance: expect.any(Number),
    tileBackground: 'rgba(0, 0, 0, 0)',
    tileBoxShadow: 'none',
  });
  expect(hoverGeometry?.labelClearance ?? -1).toBeGreaterThanOrEqual(0);
});

test('legacy governed policy cannot hide member-owned workspace tools', async ({ page }) => {
  await page.route('**/api/platform/v1/home-experience', (route) =>
    fulfillSuccess(route, {
      headline: null,
      subheadline: null,
      localizedContent: {},
      defaultLocale: 'en',
      backgroundPosition: 'RIGHT',
      overlayOpacity: 18,
      backgroundUrl: null,
      compositionPolicy: {
        schemaVersion: 1,
        personalCustomizationEnabled: true,
        governedZones: [
          {
            zoneKey: 'workspace-tools',
            placement: 'HERO',
            visible: false,
            size: 'full',
            sortOrder: 10,
          },
          {
            zoneKey: 'announcements',
            placement: 'CANVAS',
            visible: true,
            size: 'compact',
            sortOrder: 20,
          },
        ],
      },
      version: 3,
    })
  );
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Work tools' })).toBeVisible();
  const workspace = page.getByTestId('home-workspace-grid');
  await expect(page.getByRole('button', { name: 'Edit home' })).toBeVisible();
  await expect(workspace.locator('[data-workspace-widget-policy="GOVERNED"]')).toHaveCount(1);
  await expect(workspace.locator('[data-workspace-widget-policy="PERSONAL"]')).toHaveCount(5);
});
test('tenant policy disables personal editing even when the edit URL is requested directly', async ({
  page,
}) => {
  await page.route('**/api/platform/v1/home-experience', (route) =>
    fulfillSuccess(route, {
      headline: null,
      subheadline: null,
      localizedContent: {},
      defaultLocale: 'en',
      backgroundPosition: 'RIGHT',
      overlayOpacity: 18,
      backgroundUrl: null,
      compositionPolicy: {
        schemaVersion: 1,
        personalCustomizationEnabled: false,
        governedZones: [
          {
            zoneKey: 'workspace-tools',
            placement: 'HERO',
            visible: true,
            size: 'full',
            sortOrder: 10,
          },
          {
            zoneKey: 'announcements',
            placement: 'CANVAS',
            visible: true,
            size: 'compact',
            sortOrder: 20,
          },
        ],
      },
      version: 4,
    })
  );
  await page.goto('/?edit=home');
  await expect(page.getByRole('button', { name: 'Edit home' })).toHaveCount(0);
  await expect(page.locator('[data-workspace-composer-placement="floating"]')).toHaveCount(0);
  await expect(page).toHaveURL('/');
});

test('home work-tool groups and app columns adapt for tablet width', async ({ page }) => {
  await page.route('**/api/auth/permissions', (route) =>
    fulfillSuccess(route, FULL_PRODUCT_PERMISSIONS)
  );
  await mockUnreadAppBadge(page, 'approvals', 3);
  await page.setViewportSize({ width: 963, height: 900 });
  await page.goto('/');
  const launchpad = page.getByRole('region', { name: 'Work tools' });
  const groupCards = launchpad.locator('section[aria-labelledby^="app-group-"]');
  await expect(groupCards).toHaveCount(4);
  const cardRows = await groupCards.evaluateAll((cards) =>
    cards.map((card) => Math.round(card.getBoundingClientRect().top))
  );
  expect(new Set(cardRows).size).toBe(2);
  const compactGrid = launchpad.getByRole('list', { name: 'Start work apps' });
  await expect
    .poll(() =>
      compactGrid.evaluate(
        (node) => window.getComputedStyle(node).gridTemplateColumns.split(' ').length
      )
    )
    .toBe(4);
  const reservedGridHeights = await launchpad
    .getByRole('list')
    .evaluateAll((lists) => lists.map((list) => Math.round(list.getBoundingClientRect().height)));
  expect(new Set(reservedGridHeights)).toEqual(new Set([184]));
  const surface = await launchpad.evaluate((node) => {
    const style = window.getComputedStyle(node);
    return { borderWidth: style.borderWidth, backgroundColor: style.backgroundColor };
  });
  expect(surface.borderWidth).toBe('0px');
  expect(surface.backgroundColor).toBe('rgba(0, 0, 0, 0)');
  const firstCardSurface = await groupCards.first().evaluate((node) => {
    const style = window.getComputedStyle(node);
    return { borderRadius: style.borderRadius, backgroundColor: style.backgroundColor };
  });
  expect(firstCardSurface.borderRadius).toBe('8px');
  expect(firstCardSurface.backgroundColor).toMatch(/rgba\(.+, 0\.2\)$/);
  const badge = launchpad.locator('[data-launchpad-badge]').first();
  await expect(badge).toBeVisible();
  const badgeClip = await badge.evaluate((badge) => {
    const badgeBounds = badge.getBoundingClientRect();
    const gridBounds = badge.closest('ul')?.getBoundingClientRect();
    return gridBounds ? gridBounds.top - badgeBounds.top : null;
  });
  expect(badgeClip).not.toBeNull();
  expect(badgeClip ?? 1).toBeLessThanOrEqual(0);
});
test('home exposes every core section across mobile and tablet widths', async ({ page }) => {
  for (const width of [320, 768, 1024]) {
    await page.setViewportSize({ width, height: width === 320 ? 720 : 900 });
    await page.goto('/');
    for (const heading of [
      'Command rail',
      'Fresh from the newsroom',
      'Live activity',
      'Focus now',
      'Schedule',
      'Workday insights',
    ]) {
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    }
    const launchpad = page.getByRole('region', { name: 'Work tools' });
    await expect(launchpad).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Work tools' })).toHaveCount(0);
    const groupCards = launchpad.locator('section[aria-labelledby^="app-group-"]');
    await expect(groupCards).toHaveCount(4);
    await expect(page.getByTestId('home-priority-rail').locator(':scope > div')).toHaveCount(3);
    await expect(
      page.locator('[data-testid="home-workspace-grid"] [data-workspace-widget]')
    ).toHaveCount(6);
    await expect(
      page.locator('[data-testid="home-workspace-grid"] [data-workspace-widget-policy="GOVERNED"]')
    ).toHaveCount(1);
    await expect(
      page.locator('[data-testid="home-workspace-grid"] [data-workspace-widget-policy="PERSONAL"]')
    ).toHaveCount(5);
    const groupRows = await groupCards.evaluateAll((cards) =>
      cards.map((card) => Math.round(card.getBoundingClientRect().top))
    );
    expect(new Set(groupRows).size).toBe(width < 600 ? 4 : 2);
    if (width === 320) {
      const mobileAppGrid = launchpad.getByRole('list', { name: 'Start work apps' });
      const mobileLayout = await mobileAppGrid.evaluate((node) => ({
        columns: window.getComputedStyle(node).gridTemplateColumns.split(' ').length,
        groupHeight: node.closest('section')?.getBoundingClientRect().height ?? Infinity,
      }));
      expect(mobileLayout.columns).toBe(4);
      expect(mobileLayout.groupHeight).toBeLessThanOrEqual(200);
    }
    const overflow = await page.evaluate(() => {
      const viewport = document.documentElement.clientWidth;
      const interactiveOverflow = Array.from(
        document.querySelectorAll<HTMLElement>('main button, main a[href]')
      )
        .filter((node) => node.offsetParent !== null)
        .some((node) => {
          const bounds = node.getBoundingClientRect();
          return bounds.left < -1 || bounds.right > viewport + 1;
        });
      return {
        viewport,
        documentWidth: document.documentElement.scrollWidth,
        interactiveOverflow,
      };
    });
    expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewport);
    expect(overflow.interactiveOverflow).toBe(false);

    const sectionHeaderOverlap = await page
      .locator('[data-dwp-section-header]')
      .evaluateAll((headers) =>
        headers.some((header) => {
          const title = header.querySelector<HTMLElement>('h2');
          const meta = header.querySelector<HTMLElement>('[data-dwp-section-header-meta]');
          if (!title || !meta) return false;
          const titleBounds = title.getBoundingClientRect();
          const metaBounds = meta.getBoundingClientRect();
          return !(
            titleBounds.right <= metaBounds.left ||
            metaBounds.right <= titleBounds.left ||
            titleBounds.bottom <= metaBounds.top ||
            metaBounds.bottom <= titleBounds.top
          );
        })
      );
    expect(sectionHeaderOverlap).toBe(false);

    if (width === 320) {
      await page.getByRole('button', { name: 'Edit home' }).click();
      const toolbar = page.locator('[data-workspace-composer-placement="floating"]');
      await expect(toolbar).toBeVisible();
      const toolbarBounds = await toolbar.boundingBox();
      expect(toolbarBounds?.width ?? Infinity).toBeLessThanOrEqual(width - 24);
      const editingOverflow = await page.evaluate(() => {
        const viewport = document.documentElement.clientWidth;
        return Array.from(document.querySelectorAll<HTMLElement>('main button, main a[href]'))
          .filter((node) => node.offsetParent !== null)
          .flatMap((node) => {
            const bounds = node.getBoundingClientRect();
            return bounds.left < -1 || bounds.right > viewport + 1
              ? [
                  {
                    name:
                      node.getAttribute('aria-label') ?? node.textContent?.trim() ?? node.tagName,
                    left: Math.round(bounds.left),
                    right: Math.round(bounds.right),
                    viewport,
                  },
                ]
              : [];
          });
      });
      expect(editingOverflow).toEqual([]);
      await toolbar.getByRole('button', { name: 'Cancel' }).click();
    }
  }
});

test('home schedule opens the selected event in the calendar detail drawer', async ({ page }) => {
  await page.route('**/api/auth/permissions', (route) =>
    fulfillSuccess(route, FULL_PRODUCT_PERMISSIONS)
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const schedule = page.getByRole('region', { name: 'Schedule' });
  const event = schedule.getByRole('button', { name: /Digital workplace operating review/ });
  await expect(event).toBeVisible();
  await event.focus();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(
    new RegExp(`/calendar/schedule\\?event=${CALENDAR_EVENT_FIXTURE.eventId}`)
  );
  await expect(
    page.getByRole('heading', { name: 'Digital workplace operating review', level: 2 })
  ).toBeVisible();

  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page).toHaveURL(/\/calendar\/schedule$/);
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
      recommendationSection: {
        ...fixture.recommendationSection,
        data: [],
      },
    });
  });

  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');

  const commandArea = page.getByTestId('home-command-area');
  await expect(commandArea.getByText('There is no priority work right now')).toBeVisible();
  await expect(commandArea.getByRole('button', { name: 'Open priority in Work' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Work tools' })).toBeVisible();

  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
    priorityRail: (() => {
      const rail = document.querySelector('[data-testid="home-priority-rail"]');
      const style = rail ? window.getComputedStyle(rail) : null;
      return rail
        ? {
            clientWidth: rail.clientWidth,
            scrollWidth: rail.scrollWidth,
            scrollSnapType: style?.scrollSnapType,
          }
        : null;
    })(),
  }));
  expect(geometry.content).toBeLessThanOrEqual(geometry.viewport);
  expect(geometry.priorityRail?.scrollWidth).toBeLessThanOrEqual(
    geometry.priorityRail?.clientWidth ?? 0
  );
  expect(geometry.priorityRail?.scrollSnapType).toBe('none');
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

  const commandArea = page.getByTestId('home-command-area');
  const priorityRail = page.getByTestId('home-priority-rail');
  await expect(commandArea.getByText(/Work priorities could not be loaded/)).toBeVisible();
  await expect(priorityRail.getByRole('button', { name: 'Try again' })).toHaveCount(3);
  await expect(
    priorityRail.getByText('Recommended follow-up actions could not be loaded.')
  ).toBeVisible();
  await expect(
    priorityRail.getByText('There are no additional recommendations to review.')
  ).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Work tools' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Workday insights', exact: true })).toBeVisible();

  unavailable = false;
  await priorityRail.getByRole('button', { name: 'Try again' }).last().click();
  await expect(
    commandArea.getByRole('heading', { name: 'Approve software access request' })
  ).toBeVisible();
});

test('home isolates recommendation degradation from usable work and calendar data', async ({
  page,
}) => {
  await page.route('**/api/platform/v1/home/overview**', (route) => {
    const fixture = createHomeOverviewFixture();
    return fulfillSuccess(route, {
      ...fixture,
      recommendations: [],
      recommendationSection: {
        ...fixture.recommendationSection,
        status: 'UNAVAILABLE',
        data: null,
        reason: 'SOURCE_UNAVAILABLE',
      },
    });
  });

  await page.goto('/');

  const priorityRail = page.getByTestId('home-priority-rail');
  await expect(
    priorityRail.getByRole('heading', { name: 'Approve software access request' })
  ).toBeVisible();
  await expect(
    priorityRail.getByRole('heading', { name: 'Digital workplace operating review' })
  ).toBeVisible();
  await expect(
    priorityRail.getByText('Recommended follow-up actions could not be loaded.')
  ).toBeVisible();
  await expect(priorityRail.getByRole('button', { name: 'Try again' })).toHaveCount(1);

  const insights = page.getByRole('region', { name: 'Workday insights' });
  await expect(insights.getByText(/Workday insights could not be loaded/i)).toBeVisible();
  await expect(insights.getByRole('button', { name: 'Try again' })).toBeVisible();
});
