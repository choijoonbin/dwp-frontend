import { expect, test } from '@playwright/test';

import { detail, fulfill, mailOrganization, mockMailMember, thread } from './support/mail-fixtures';

import type { Page } from '@playwright/test';

test('Mail inbox keeps the approved desktop and mobile visual hierarchy', async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const organization = mailOrganization();
  const priority = thread('40000000-0000-0000-0000-000000000011', {
    subject: 'Customer launch review',
  });
  const shared = thread('40000000-0000-0000-0000-000000000012', {
    shared: true,
    subject: 'People policy clarification',
  });
  const prepareInbox = async (target: Page) => {
    await mockMailMember(target);
    await target.emulateMedia({ reducedMotion: 'reduce' });
    await target.route('**/api/platform/v1/mail/organization', (route) =>
      fulfill(route, organization)
    );
    await target.route('**/api/platform/v1/mail/home**', (route) =>
      fulfill(route, {
        accounts: organization.accounts,
        metrics: {
          unread: 6,
          urgent: 1,
          needsReply: 2,
          assigned: 1,
          snoozed: 1,
          activeProposals: 0,
        },
        focusQueue: [priority, shared],
        proposals: [],
        sharedInboxes: [],
        generatedAt: '2026-10-28T05:00:00.000Z',
      })
    );
    await target.route('**/api/platform/v1/mail/threads**', (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.endsWith('/mail/threads')) {
        return fulfill(route, { items: [priority, shared], total: 2, page: 0, pageSize: 30 });
      }
      return fulfill(route, detail(pathname.includes(priority.threadId) ? priority : shared));
    });
  };
  await prepareInbox(page);
  const scenarios =
    testInfo.project.name === 'mobile'
      ? ([
          { name: '390-light', width: 390, height: 844, colorScheme: 'light' },
          { name: '320-dark', width: 320, height: 740, colorScheme: 'dark' },
          {
            name: '320-forced-colors',
            width: 320,
            height: 740,
            colorScheme: 'light',
            forcedColors: 'active',
          },
        ] as const)
      : ([
          { name: '1440-light', width: 1440, height: 960, colorScheme: 'light' },
          { name: '1280-dark', width: 1280, height: 900, colorScheme: 'dark' },
          {
            name: '1280-200-percent',
            // A 1280 x 1024 physical display at 200% browser zoom exposes a
            // 640 x 512 CSS viewport, so responsive breakpoints must reflow.
            width: 640,
            height: 512,
            physicalWidth: 1280,
            physicalHeight: 1024,
            colorScheme: 'light',
          },
        ] as const);

  for (const [index, scenario] of scenarios.entries()) {
    const zoomContext =
      'physicalWidth' in scenario
        ? await browser.newContext({
            baseURL: process.env.E2E_BASE_URL || 'http://localhost:4200',
            viewport: { width: scenario.width, height: scenario.height },
            screen: { width: scenario.physicalWidth, height: scenario.physicalHeight },
            deviceScaleFactor: 2,
            colorScheme: scenario.colorScheme,
            reducedMotion: 'reduce',
          })
        : null;
    const scenarioPage = zoomContext ? await zoomContext.newPage() : page;
    if (zoomContext) await prepareInbox(scenarioPage);
    else await scenarioPage.setViewportSize({ width: scenario.width, height: scenario.height });
    await scenarioPage.emulateMedia({
      colorScheme: scenario.colorScheme,
      forcedColors: 'forcedColors' in scenario ? scenario.forcedColors : 'none',
      reducedMotion: 'reduce',
    });
    await scenarioPage.goto('/mail/inbox');
    if ('physicalWidth' in scenario) {
      await expect
        .poll(() =>
          scenarioPage.evaluate(() => ({
            cssWidth: window.innerWidth,
            physicalWidth: Math.round(window.innerWidth * window.devicePixelRatio),
            devicePixelRatio: window.devicePixelRatio,
          }))
        )
        .toEqual({ cssWidth: 640, physicalWidth: 1280, devicePixelRatio: 2 });
    }
    await expect(scenarioPage.getByRole('heading', { level: 1, name: 'Inbox' })).toBeVisible();
    await expect(
      scenarioPage.getByText('Customer launch review', { exact: true }).first()
    ).toBeVisible();
    await expect
      .poll(() =>
        scenarioPage.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        )
      )
      .toBeLessThanOrEqual(1);
    await scenarioPage.evaluate(async () => document.fonts.ready);

    await expect(scenarioPage).toHaveScreenshot(`mail-inbox-${scenario.name}.png`, {
      animations: 'disabled',
      fullPage: true,
      maxDiffPixelRatio: 0.01,
      scale: 'physicalWidth' in scenario ? 'device' : 'css',
    });
    if (index === 0) {
      await expect(scenarioPage).toHaveScreenshot('mail-inbox-approved.png', {
        animations: 'disabled',
        fullPage: true,
        maxDiffPixelRatio: 0.01,
      });
    }
    await zoomContext?.close();
  }
});
