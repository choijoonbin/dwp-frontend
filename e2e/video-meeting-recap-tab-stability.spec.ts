import { expect, test, type Page } from '@playwright/test';
import {
  MEETING_VISUAL_ID,
  mockMeetingVisualPublishedRecap,
  mockMeetingVisualSession,
} from './support/video-meeting-visual-fixtures';
import { expectKeyboardFocusVisible } from './support/meeting-visual-focus';
import {
  expectNoBlockingA11y,
  expectNoHorizontalOverflow,
} from './support/video-meeting-visual-accessibility';

async function openRecap(page: Page) {
  await page.setViewportSize({ width: 1440, height: 960 });
  await mockMeetingVisualSession(page, { locale: 'en', colorScheme: 'dark', reducedMotion: true });
  await mockMeetingVisualPublishedRecap(page);
  await page.goto(`/meetings/history?meeting=${MEETING_VISUAL_ID}`);
  await expect(page.getByRole('progressbar', { name: /Loading page/u })).toHaveCount(0, {
    timeout: 15_000,
  });
  // The initial zero loader count may precede lazy route mounting; wait for actual recap data.
  await expect(page.getByText('The group approved a staged launch')).toBeVisible({
    timeout: 15_000,
  });
  await page.evaluate(() => document.fonts.ready);
}

test('recap desktop rail retains actual overflow geometry during focus and document capture', async ({
  page,
}, testInfo) => {
  await openRecap(page);
  const overview = page.getByRole('tab', { name: 'Overview' });
  const rail = overview.locator('xpath=ancestor::div[contains(@class, "MuiTabs-root")][1]');
  const entries: unknown[] = [];
  async function record(stage: string) {
    entries.push(
      await rail.evaluate((root, label) => {
        const rect = (element: Element | null) => {
          const bounds = element?.getBoundingClientRect();
          return bounds ? { x: bounds.x, y: bounds.y, w: bounds.width, h: bounds.height } : null;
        };
        const scroller = root.querySelector<HTMLElement>('.MuiTabs-scroller');
        const tabs = root.querySelectorAll('[role="tab"]');
        return {
          stage: label,
          arrows: root.querySelectorAll('.MuiTabs-scrollButtons').length,
          viewport: { width: innerWidth, height: innerHeight, x: scrollX, y: scrollY },
          root: rect(root),
          scroller: rect(scroller),
          first: rect(tabs[0]),
          last: rect(tabs[tabs.length - 1]),
          overflow: scroller ? scroller.scrollWidth - scroller.clientWidth : null,
          scrollLeft: scroller?.scrollLeft,
        };
      }, stage)
    );
  }
  await record('initial');
  await expectKeyboardFocusVisible(page, overview, 'recap overview tab');
  await record('focused');
  await expectNoBlockingA11y(page, 'recap rail diagnostic');
  await record('after-axe');
  for (let index = 0; index < 6; index += 1) {
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.querySelector('#dwp-main-content')?.scrollTo(0, 0);
    });
    await record(`before-capture-${index}`);
    await page.screenshot({
      path: testInfo.outputPath(`rail-${index}.png`),
      fullPage: true,
      animations: 'disabled',
    });
    await record(`after-capture-${index}`);
    await expect(rail.locator('.MuiTabs-scrollButtons')).toHaveCount(0);
    await expect
      .poll(() =>
        rail.locator('.MuiTabs-scroller').evaluate((node) => node.scrollWidth - node.clientWidth)
      )
      .toBeLessThanOrEqual(1);
  }
  await testInfo.attach('rail-geometry', {
    body: JSON.stringify(entries, null, 2),
    contentType: 'application/json',
  });
});

test('recap rail preserves real overflow and keyboard navigation at 390, 320 and 200 percent text', async ({
  page,
}, testInfo) => {
  await openRecap(page);
  const overview = page.getByRole('tab', { name: 'Overview' });
  const rail = overview.locator('xpath=ancestor::div[contains(@class, "MuiTabs-root")][1]');
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(rail.getByRole('tab')).toHaveCount(4);
    await expect(rail.locator('.MuiTabs-scrollButtons')).toHaveCount(2);
    await overview.focus();
    await page.keyboard.press('End');
    const attendance = page.getByRole('tab', { name: 'Attendance evidence', exact: true });
    await expect(attendance).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(attendance).toHaveAttribute('aria-selected', 'true');
    await expectNoHorizontalOverflow(page, `recap rail ${width}`);
  }
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await expect(rail.getByRole('tab')).toHaveCount(4);
  await expect(rail.locator('.MuiTabs-scrollButtons')).toHaveCount(2);
  await overview.focus();
  await page.keyboard.press('Enter');
  await expect(overview).toHaveAttribute('aria-selected', 'true');
  await expectNoHorizontalOverflow(page, 'recap rail 320 200 percent');
  await expectNoBlockingA11y(page, 'recap rail 320 200 percent');
  await rail.evaluate((node) => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const railBounds = await rail.boundingBox();
  const dockBounds = await page.getByTestId('meeting-mobile-navigation').boundingBox();
  expect(railBounds).not.toBeNull();
  expect(dockBounds).not.toBeNull();
  expect(railBounds!.y + railBounds!.height).toBeLessThanOrEqual(dockBounds!.y);
  await rail.screenshot({ path: testInfo.outputPath('rail-320-200-percent-detail.png') });
  await page.screenshot({ path: testInfo.outputPath('rail-320-200-percent.png') });
  await page.evaluate(() => {
    document.documentElement.style.removeProperty('font-size');
  });
  await page.setViewportSize({ width: 1440, height: 960 });
  await expect(rail.locator('.MuiTabs-scrollButtons')).toHaveCount(0);
  await expect(overview).toHaveAttribute('aria-selected', 'true');
  await expectNoHorizontalOverflow(page, 'recap rail restored desktop');
});
