import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  fulfillSuccess,
  FULL_PRODUCT_PERMISSIONS,
  mockShellSession,
} from './support/shell-session';

import type { CalendarTeamAvailabilitySnapshot } from '@dwp-frontend/shared-utils';

const cases = [
  { name: '1440-light', width: 1440, mode: 'light', forced: false, zoom: false },
  { name: '1280-dark', width: 1280, mode: 'dark', forced: false, zoom: false },
  { name: '390-light', width: 390, mode: 'light', forced: false, zoom: false },
  { name: '320-dark', width: 320, mode: 'dark', forced: false, zoom: false },
  { name: '320-forced', width: 320, mode: 'light', forced: true, zoom: false },
  { name: '1280-forced', width: 1280, mode: 'light', forced: true, zoom: false },
  { name: '1440-at-200-percent-reflow', width: 720, mode: 'light', forced: false, zoom: true },
  { name: '1280-at-200-percent-reflow', width: 640, mode: 'dark', forced: false, zoom: true },
  {
    name: '1280-text-200-forced',
    width: 1280,
    mode: 'light',
    forced: true,
    zoom: false,
    textZoom: true,
  },
] as const;

for (const scenario of cases) {
  test(`calendar briefing cards ${scenario.name}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium');
    await page.setViewportSize({ width: scenario.width, height: scenario.zoom ? 450 : 900 });
    await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
    await page.emulateMedia({
      colorScheme: scenario.mode,
      forcedColors: scenario.forced ? 'active' : 'none',
      reducedMotion: 'reduce',
    });
    await mockShellSession(page, ['CALENDAR_ADMIN'], {
      locale: 'ko',
      permissions: FULL_PRODUCT_PERMISSIONS,
      appearance: {
        mode: scenario.mode,
        density: 'standard',
        highContrast: false,
        reduceMotion: true,
      },
    });
    const snapshot: CalendarTeamAvailabilitySnapshot = {
      date: '2026-08-11',
      timeZone: 'Asia/Seoul',
      generatedAt: '2026-08-11T00:20:00Z',
      validUntil: '2026-08-11T00:20:30Z',
      source: 'DWP_NATIVE_CALENDAR',
      scope: 'SHARED_WITH_ME',
      hasMore: false,
      members: [
        {
          personPublicId: 'person-available',
          displayName: '공유 구성원 김가용',
          status: 'AVAILABLE',
          busyUntil: null,
          nextAvailableAt: '2026-08-11T00:20:00Z',
          busyMinutes: 0,
          busyWindows: [],
        },
        {
          personPublicId: 'person-busy',
          displayName: 'Sarah Long-Enterprise-Platform-Team-Name',
          status: 'BUSY',
          busyUntil: '2026-08-11T01:00:00Z',
          nextAvailableAt: '2026-08-11T01:00:00Z',
          busyMinutes: 40,
          busyWindows: [],
        },
        {
          personPublicId: 'person-focus',
          displayName: '집중 시간을 보호 중인 구성원',
          status: 'FOCUS',
          busyUntil: '2026-08-11T02:00:00Z',
          nextAvailableAt: '2026-08-11T02:00:00Z',
          busyMinutes: 100,
          busyWindows: [],
        },
      ],
    };
    await page.route('**/api/platform/v1/calendar/team-availability/snapshot?*', (route) =>
      fulfillSuccess(route, snapshot)
    );
    await page.goto('/calendar/home?scope=shared');
    if ('textZoom' in scenario) await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    if (scenario.width < 1280) {
      await page.getByRole('button', { name: '오늘 브리핑 열기', exact: true }).click();
    }
    const rail = page.getByTestId('calendar-workspace-rail');
    await expect(rail).toBeVisible();
    const team = rail.getByTestId('calendar-home-team-panel');
    await expect(team.getByText('공유 구성원 김가용', { exact: true })).toBeVisible();
    await expect(team).toContainText('접속 상태가 아닙니다');
    const personLink = team.getByRole('link', { name: '공유 구성원 김가용님과 시간 찾기' });
    await expect(personLink).toHaveAttribute(
      'href',
      '/calendar/availability?person=person-available&scope=shared'
    );
    await expect(rail.getByRole('meter')).toHaveAttribute('aria-valuenow', '63');
    const meterTrack = rail.getByRole('meter').locator('circle').first();
    expect(await meterTrack.evaluate((node) => getComputedStyle(node).stroke)).not.toBe('none');
    expect(await rail.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(
      1
    );
    const bounds = await rail.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(scenario.width + 1);
    if (scenario.width >= 1280) {
      expect(bounds!.width).toBeGreaterThanOrEqual(300);
      // Home cards belong to page scrolling; only the narrow modal rail scrolls internally.
      const innerScrollers = await rail.evaluate(
        (node) =>
          Array.from(node.querySelectorAll('*')).filter((child) => {
            const overflow = getComputedStyle(child).overflowY;
            return (
              ['auto', 'scroll'].includes(overflow) && child.scrollHeight > child.clientHeight + 1
            );
          }).length
      );
      expect(innerScrollers).toBe(0);
    }
    const accessibility = await new AxeBuilder({ page })
      .include('[data-testid="calendar-workspace-rail"]')
      .analyze();
    expect(
      accessibility.violations.filter((issue) =>
        ['serious', 'critical'].includes(issue.impact ?? '')
      )
    ).toEqual([]);
    for (const [name, locator] of [
      ['insights', rail.getByTestId('calendar-workspace-insights')],
      ['team', team],
      ['shortcuts', rail.getByTestId('calendar-home-shortcuts')],
    ] as const) {
      const path = testInfo.outputPath(`${scenario.name}-${name}.png`);
      await locator.screenshot({ path, animations: 'disabled' });
      await testInfo.attach(`${scenario.name}-${name}`, { path, contentType: 'image/png' });
    }
    if (scenario.name === '1440-light') {
      // Visit below-fold cards before the full-page capture so Chromium paints their
      // ready content instead of reusing an offscreen loading-frame raster.
      await expect(team.locator('[data-calendar-team-state="READY"]')).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
      const path = testInfo.outputPath('1440-desktop-full.png');
      await page.screenshot({ path, fullPage: true, animations: 'disabled' });
      await testInfo.attach('1440-desktop-full', { path, contentType: 'image/png' });
    }
    await personLink.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(personLink).toBeFocused();
    const outline = await personLink.evaluate((node) => getComputedStyle(node).outlineStyle);
    expect(outline).not.toBe('none');
    if (scenario.width < 1280) {
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('button', { name: '오늘 브리핑 열기', exact: true })
      ).toBeFocused();
    }
  });
}
