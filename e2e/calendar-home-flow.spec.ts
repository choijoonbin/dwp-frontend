import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { CALENDAR_EVENT_FIXTURE, CALENDAR_HOME_FIXTURE } from './support/product-area-fixtures';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

const NOW = '2026-08-11T00:55:00Z';
const snapshot = () => ({
  date: '2026-08-11',
  timeZone: 'Asia/Seoul',
  generatedAt: NOW,
  validUntil: '2026-08-11T00:55:30Z',
  source: 'DWP_NATIVE_CALENDAR',
  scope: 'SHARED_WITH_ME',
  hasMore: false,
  members: [
    {
      personPublicId: 'person-minseo-kim',
      displayName: 'Minseo Kim',
      status: 'AVAILABLE',
      busyUntil: null,
      nextAvailableAt: NOW,
      busyMinutes: 0,
      busyWindows: [],
    },
    {
      personPublicId: 'person-sarah',
      displayName: 'Sarah Jenkins',
      status: 'FOCUS',
      busyUntil: '2026-08-11T02:00:00Z',
      nextAvailableAt: '2026-08-11T02:00:00Z',
      busyMinutes: 65,
      busyWindows: [{ startsAt: NOW, endsAt: '2026-08-11T02:00:00Z' }],
    },
  ],
});

async function prepare(
  page: Page,
  options: { denied?: boolean; appearance?: 'light' | 'dark' } = {}
) {
  await page.clock.setFixedTime(new Date(NOW));
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: options.denied
      ? FULL_PRODUCT_PERMISSIONS.filter((p) => p.resourceKey !== 'APP.PEOPLE_DIRECTORY')
      : FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: options.appearance ?? 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  await page.route('**/api/platform/v1/calendar/home**', (route) =>
    route.fulfill({
      json: { status: 'SUCCESS', data: { ...CALENDAR_HOME_FIXTURE, generatedAt: NOW } },
    })
  );
  await page.route('**/api/platform/v1/calendar/team-availability/snapshot**', (route) =>
    route.fulfill({ json: { status: 'SUCCESS', data: snapshot() } })
  );
}

async function showTeam(page: Page) {
  const panel = page.getByTestId('calendar-home-team-panel');
  const open = page.getByRole('button', { name: 'Open today briefing', exact: true });
  await expect(panel.or(open).first()).toBeVisible();
  if (await open.isVisible()) await open.click();
  await expect(panel).toBeVisible();
  return panel;
}

test('today flow joins a real meeting, copies its URL and opens the agenda', async ({ page }) => {
  await prepare(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          document.documentElement.dataset.copiedMeeting = value;
        },
      },
    });
    window.open = (url) => {
      document.documentElement.dataset.joinedMeeting = String(url);
      return null;
    };
  });
  await page.goto('/calendar/home');
  const hero = page.getByTestId('calendar-today-now');
  await hero.getByRole('button', { name: 'Copy meeting link' }).click();
  await expect(page.locator('html')).toHaveAttribute(
    'data-copied-meeting',
    CALENDAR_EVENT_FIXTURE.conferenceUrl
  );
  await hero.getByRole('button', { name: 'Join meeting' }).click();
  await expect(page.locator('html')).toHaveAttribute(
    'data-joined-meeting',
    CALENDAR_EVENT_FIXTURE.conferenceUrl
  );
  await hero.getByRole('button', { name: 'Preview agenda' }).click();
  await expect(page.getByRole('dialog')).toContainText(CALENDAR_EVENT_FIXTURE.description);
});

test('shared member action opens the full scheduling page with the selected person', async ({
  page,
}) => {
  await prepare(page);
  await page.route('**/api/people/v1/people/person-minseo-kim**', (route) =>
    route.fulfill({
      json: {
        status: 'SUCCESS',
        data: {
          person: {
            personId: 'person-minseo-kim',
            displayName: 'Minseo Kim',
            workEmail: 'minseo@example.invalid',
            organizationName: 'Design',
            businessTitle: 'Designer',
            workerStatus: 'ACTIVE',
          },
        },
      },
    })
  );
  await page.goto('/calendar/home');
  const team = await showTeam(page);
  await expect(team).toContainText('Sarah Jenkins');
  await expect(team).not.toContainText(/online now/i);
  await team.getByRole('link', { name: 'Find time with Minseo Kim' }).click();
  await expect(page).toHaveURL(/\/calendar\/availability\?person=person-minseo-kim/);
  await expect(
    page.locator('#dwp-main-content').getByText('Minseo Kim', { exact: true })
  ).toBeVisible();
});

test('expired shared data is removed on denial without breaking the home', async ({ page }) => {
  await prepare(page);
  await page.clock.install({ time: new Date(NOW) });
  let calls = 0;
  let revoked = false;
  await page.route('**/api/platform/v1/calendar/team-availability/snapshot**', (route) => {
    calls += 1;
    return !revoked
      ? route.fulfill({
          json: { status: 'SUCCESS', data: snapshot() },
        })
      : route.fulfill({ status: 403, json: { status: 'ERROR', message: 'Access revoked' } });
  });
  await page.goto('/calendar/home');
  const panel = await showTeam(page);
  await expect(panel).toContainText('Minseo Kim');
  revoked = true;
  await page.clock.fastForward(31_000);
  await expect(panel.getByText('Minseo Kim')).toHaveCount(0);
  await expect(panel).toContainText('permission');
  const deniedCalls = calls;
  await page.clock.fastForward(60_000);
  expect(calls).toBe(deniedCalls);
  if (await page.getByRole('dialog').count()) await page.keyboard.press('Escape');
  await expect(page.getByTestId('calendar-today-now')).toBeVisible();
});

test('directory permission is required before requesting shared identities', async ({ page }) => {
  await prepare(page, { denied: true });
  let calls = 0;
  page.on('request', (request) => {
    if (request.url().includes('team-availability/snapshot')) calls += 1;
  });
  await page.goto('/calendar/home');
  const panel = await showTeam(page);
  await expect(panel).toContainText('permission');
  expect(calls).toBe(0);
});

for (const change of ['removed', 'busy-only'] as const) {
  test(`home discards an open inspector after a successful ${change} authority response`, async ({
    page,
  }) => {
    await prepare(page);
    await page.clock.install({ time: new Date(NOW) });
    let revoked = false;
    await page.route('**/api/platform/v1/calendar/home**', (route) => {
      const redacted = {
        ...CALENDAR_EVENT_FIXTURE,
        title: 'Busy',
        description: null,
        location: null,
        attendees: [],
        conferenceUrl: null,
        redacted: true,
        detailLevel: 'FREE_BUSY',
        capabilities: {
          canViewDetails: false,
          canEdit: false,
          canDelete: false,
          canRestore: false,
          canRespond: false,
          canStar: false,
        },
      };
      const events = change === 'removed' ? [] : [redacted];
      return route.fulfill({
        json: {
          status: 'SUCCESS',
          data: {
            ...CALENDAR_HOME_FIXTURE,
            generatedAt: NOW,
            ...(revoked ? { today: events, nextEvent: events[0] ?? null } : {}),
          },
        },
      });
    });
    await page.goto('/calendar/home');
    await page
      .getByTestId('calendar-today-now')
      .getByRole('button', { name: 'Preview agenda' })
      .click();
    await expect(page.getByRole('dialog')).toContainText(CALENDAR_EVENT_FIXTURE.description);
    revoked = true;
    await page.clock.fastForward(31_000);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText(CALENDAR_EVENT_FIXTURE.title, { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('calendar-today-workspace')).toBeVisible();
  });
}

test('reference layout keeps the hero full width and independent briefing cards accessible', async ({
  page,
}, testInfo) => {
  await prepare(page);
  await page.goto('/calendar/home');
  await expect(page.getByTestId('calendar-today-week-outlook')).toBeVisible();
  if (testInfo.project.name === 'chromium') {
    const hero = await page.getByTestId('calendar-today-now').boundingBox();
    const rail = await page.getByTestId('calendar-workspace-rail').boundingBox();
    expect(hero!.y + hero!.height).toBeLessThan(rail!.y);
    expect(hero!.width).toBeGreaterThan(rail!.width * 2);
  }
  const main = page.locator('#dwp-main-content');
  const result = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(result.violations.filter((v) => ['critical', 'serious'].includes(v.impact ?? ''))).toEqual(
    []
  );
  await expect(main).toHaveScreenshot('calendar-today-flow-reference-light.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.002,
  });
});

test('reference home and briefing reflow at 320px with 200 percent text', async ({ page }) => {
  await prepare(page, { appearance: 'dark' });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/calendar/home');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await expect(page.getByTestId('calendar-today-now')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
  await showTeam(page);
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter((v) => ['critical', 'serious'].includes(v.impact ?? ''))).toEqual(
    []
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
});
