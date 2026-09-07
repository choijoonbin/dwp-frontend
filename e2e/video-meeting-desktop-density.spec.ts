import { expect, test } from '@playwright/test';

import {
  mockMeetingVisualHome,
  mockMeetingVisualMine,
  mockMeetingVisualSession,
} from './support/video-meeting-visual-fixtures';

test.describe('Meeting desktop hierarchy and bounded density', () => {
  test('the home focus is prominent while neutral sections stay flat', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 960 });
    await mockMeetingVisualSession(page, { locale: 'en', reducedMotion: true });
    await mockMeetingVisualHome(page, 'SAMPLE');

    await page.goto('/meetings/home');
    const hero = page.getByTestId('meeting-command-primary');
    const timelineList = page.getByTestId('meeting-home-timeline').locator(':scope > div').last();
    await expect(hero).toBeVisible();
    await expect(timelineList).toBeVisible();

    const hierarchy = await Promise.all(
      [hero, timelineList].map((locator) =>
        locator.evaluate((element) => {
          const style = getComputedStyle(element);
          const accent = getComputedStyle(element, '::before');
          return {
            backgroundColor: style.backgroundColor,
            backgroundImage: style.backgroundImage,
            borderTopWidth: style.borderTopWidth,
            boxShadow: style.boxShadow,
            accentHeight: accent.height,
            accentBackgroundColor: accent.backgroundColor,
            accentBackgroundImage: accent.backgroundImage,
          };
        })
      )
    );
    expect(hierarchy[0].boxShadow).not.toBe('none');
    expect(hierarchy[0].backgroundImage).toBe('none');
    expect(hierarchy[0].borderTopWidth).toBe('1px');
    expect(hierarchy[0].accentHeight).toBe('3px');
    expect(hierarchy[0].accentBackgroundImage).toBe('none');
    expect(hierarchy[0].accentBackgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(hierarchy[0].backgroundColor).not.toBe(hierarchy[1].backgroundColor);
    expect(hierarchy[1].boxShadow).toBe('none');
  });

  test('My meetings requests and renders at most ten records per server page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 960 });
    await mockMeetingVisualSession(page, { locale: 'en', reducedMotion: true });
    await mockMeetingVisualMine(page, { totalItems: 12 });
    const requests: URL[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (request.method() === 'GET' && url.pathname.endsWith('/api/meetings/v1/meetings')) {
        requests.push(url);
      }
    });

    await page.goto('/meetings/mine');
    const list = page.getByTestId('my-meetings-list');
    const previous = page.getByRole('button', { name: 'Previous page' });
    const next = page.getByRole('button', { name: 'Next page' });
    await expect(page.getByTestId('my-meetings-page-status')).toHaveText('Page 1 of 2');
    await expect(previous).toBeDisabled();
    await expect(next).toBeEnabled();
    await expect(list.locator('[aria-pressed]')).toHaveCount(8);
    await expect(page.getByText('8 meetings on this page')).toBeVisible();
    await expect(
      page.getByText('Search and filters apply to the current server page.')
    ).toBeVisible();
    expect(requests[0].searchParams.get('page')).toBe('0');
    expect(requests[0].searchParams.get('pageSize')).toBe('10');

    await next.click();
    await expect(page.getByTestId('my-meetings-page-status')).toHaveText('Page 2 of 2');
    await expect(previous).toBeEnabled();
    await expect(next).toBeDisabled();
    await expect(list.locator('[aria-pressed]')).toHaveCount(2);
    await expect(page.getByText('2 meetings on this page')).toBeVisible();
    expect(requests.at(-1)?.searchParams.get('page')).toBe('1');
    expect(requests.at(-1)?.searchParams.get('pageSize')).toBe('10');

    await page.setViewportSize({ width: 390, height: 844 });
    await previous.click();
    await expect(page.getByTestId('my-meetings-page-status')).toHaveText('Page 1 of 2');
    await expect(list.locator('[aria-pressed]')).toHaveCount(8);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    ).toBeLessThanOrEqual(1);
  });
});
