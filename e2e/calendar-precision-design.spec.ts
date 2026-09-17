import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { mockCalendarShellSession as mockShellSession } from './support/calendar-shell-session';
import { FULL_PRODUCT_PERMISSIONS } from './support/shell-session';

async function openSchedule(
  page: Page,
  viewport: Readonly<{ width: number; height: number }>,
  media: Readonly<{
    colorScheme: 'dark' | 'light';
    forcedColors: 'active' | 'none';
    reducedMotion?: 'no-preference' | 'reduce';
  }>
) {
  await page.setViewportSize(viewport);
  await page.clock.setFixedTime(new Date('2026-08-11T00:20:00Z'));
  await page.emulateMedia({
    colorScheme: media.colorScheme,
    forcedColors: media.forcedColors,
    reducedMotion: media.reducedMotion ?? 'reduce',
  });
  await mockShellSession(page, ['CALENDAR_ADMIN'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: 'system',
      density: 'standard',
      highContrast: media.forcedColors === 'active',
      reduceMotion: media.reducedMotion !== 'no-preference',
    },
  });
  await page.goto('/calendar/schedule?view=week&date=2026-08-11');
  const calendar = page.getByTestId('interactive-calendar');
  await expect(calendar).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.MuiSkeleton-root')).toHaveCount(0, { timeout: 15_000 });
  return calendar;
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, animations: 'disabled', caret: 'hide' });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

test('precision calendar keeps documented desktop geometry, ranges, and command surface', async ({
  page,
}, testInfo) => {
  const calendar = await openSchedule(
    page,
    { width: 1440, height: 1000 },
    { colorScheme: 'light', forcedColors: 'none', reducedMotion: 'no-preference' }
  );

  const sourceRail = page.getByTestId('calendar-source-panel');
  await expect(sourceRail).toBeVisible();
  expect((await sourceRail.boundingBox())?.width).toBeCloseTo(256, 0);

  await expect(calendar.locator('.precision-calendar-slot').first()).toBeVisible();
  const geometry = await calendar.evaluate((root) => {
    const slot = root.querySelector<HTMLElement>('.precision-calendar-slot');
    const axis = root.querySelector<HTMLElement>('.precision-calendar-slot-header');
    const nowLine = root.querySelector<HTMLElement>('.precision-calendar-now-line');
    const tokenProbe = document.createElement('span');
    tokenProbe.style.color = 'var(--precision-calendar-primary)';
    root.append(tokenProbe);
    const semanticNowColor = getComputedStyle(tokenProbe).color;
    tokenProbe.remove();
    return {
      slotHeight: slot?.getBoundingClientRect().height ?? 0,
      axisWidth: axis?.getBoundingClientRect().width ?? 0,
      nowColor: nowLine ? getComputedStyle(nowLine).borderTopColor : '',
      semanticNowColor,
    };
  });
  expect(geometry.slotHeight).toBeGreaterThanOrEqual(31);
  expect(geometry.slotHeight).toBeLessThanOrEqual(34);
  expect(geometry.axisWidth).toBeGreaterThanOrEqual(54);
  expect(geometry.axisWidth).toBeLessThanOrEqual(58);
  expect(geometry.nowColor).toBe(geometry.semanticNowColor);

  const scheduleEvent = calendar.getByRole('button', {
    name: /Digital workplace operating review/u,
  });
  await scheduleEvent.hover();
  const liftedEventStyle = await scheduleEvent.evaluate((element) => ({
    boxShadow: getComputedStyle(element).boxShadow,
    transform: getComputedStyle(element).transform,
  }));
  expect(liftedEventStyle.boxShadow).not.toBe('none');
  expect(liftedEventStyle.transform).not.toBe('none');
  await scheduleEvent.press('Enter');
  const inspector = page.getByRole('dialog', { name: 'Digital workplace operating review' });
  await expect(inspector).toBeVisible();
  expect((await inspector.boundingBox())?.width).toBeCloseTo(320, 0);
  await inspector.getByRole('button', { name: 'Close', exact: true }).click();

  await calendar.getByRole('tab', { name: '3 days view', exact: true }).click();
  await expect(page).toHaveURL(/view=threeDay/u);
  await expect(calendar.locator('.precision-calendar-day-lane')).toHaveCount(3);
  await calendar.getByRole('tab', { name: '4 days view', exact: true }).click();
  await expect(page).toHaveURL(/view=fourDay/u);
  await expect(calendar.locator('.precision-calendar-day-lane')).toHaveCount(4);

  await page.getByRole('button', { name: 'Quick actions', exact: true }).click();
  const palette = page.getByRole('dialog', { name: 'Calendar quick actions' });
  await expect(palette).toHaveClass(/DwpCommandPalette-inverted/u);
  await expect(palette.locator('kbd')).toHaveCount(9);
  const paletteStyle = await palette.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    backdropFilter: getComputedStyle(element).backdropFilter,
  }));
  expect(paletteStyle.background).toBe('rgba(15, 23, 42, 0.9)');
  expect(paletteStyle.backdropFilter).toContain('blur(16px)');

  const accessibility = await new AxeBuilder({ page }).include('body').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
  await attachScreenshot(page, testInfo, 'calendar-precision-1440-command');
});

test('precision calendar exposes the mobile day and agenda navigation at 390 and 320', async ({
  page,
}, testInfo) => {
  await openSchedule(
    page,
    { width: 390, height: 844 },
    { colorScheme: 'dark', forcedColors: 'none' }
  );
  const navigation = page.getByTestId('calendar-mobile-navigation');
  await expect(navigation).toBeVisible();
  await expect(page.getByRole('button', { name: 'New event', exact: true })).toHaveCount(1);
  await expect(
    navigation.getByRole('button', {
      name: 'New event — Calendar view and actions',
      exact: true,
    })
  ).toBeVisible();
  await expect(page).toHaveURL(/view=day/u);
  await expect(page.locator('.precision-calendar-day-lane')).toHaveCount(1);
  await expect(navigation.getByRole('button', { name: 'Day', exact: true })).toBeVisible();
  await expect(navigation.getByRole('button', { name: 'Agenda', exact: true })).toBeVisible();
  const navigationBounds = await navigation.boundingBox();
  expect(navigationBounds).not.toBeNull();
  expect(Math.round(navigationBounds!.y + navigationBounds!.height)).toBe(844);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await attachScreenshot(page, testInfo, 'calendar-precision-390-dark');

  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({
    colorScheme: 'light',
    forcedColors: 'active',
    reducedMotion: 'reduce',
  });
  await expect(navigation).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
  await attachScreenshot(page, testInfo, 'calendar-precision-320-forced-colors');
});

test('precision calendar reflows at the 200 percent width proxy with reduced motion', async ({
  page,
}, testInfo) => {
  const calendar = await openSchedule(
    page,
    { width: 640, height: 900 },
    { colorScheme: 'dark', forcedColors: 'none' }
  );
  await expect(page.getByTestId('calendar-mobile-navigation')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(640);
  const event = calendar.locator('.precision-calendar-event').first();
  if ((await event.count()) > 0) {
    expect(await event.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe(
      '0s'
    );
  }
  await attachScreenshot(page, testInfo, 'calendar-precision-200-percent-reflow');
});
