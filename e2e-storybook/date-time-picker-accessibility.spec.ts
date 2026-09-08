import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const STORY_ID = 'dwp-enterprise-date-and-time--product-policy';

async function openDateTimeStory(page: Page, globals = 'density:standard') {
  const search = new URLSearchParams({ id: STORY_ID, viewMode: 'story', globals });
  await page.goto(`/iframe.html?${search}`);
  await expect(page.locator('#storybook-root')).toBeVisible();
}

function pickerButtons(page: Page) {
  return page.locator('.MuiPickersInputBase-root .MuiIconButton-root');
}

test('desktop picker triggers retain standard density and keyboard focus visibility', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Fine-pointer desktop density is covered by the Chromium project.');
  await page.setViewportSize({ width: 1280, height: 800 });
  await openDateTimeStory(page);

  const trigger = pickerButtons(page).first();
  await expect(trigger).toBeVisible();
  await expect
    .poll(() => trigger.evaluate((element) => element.getBoundingClientRect().width))
    .toBe(38);
  await expect
    .poll(() => trigger.evaluate((element) => element.getBoundingClientRect().height))
    .toBe(38);

  await trigger.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(trigger).toBeFocused();
  const outline = await trigger.evaluate((element) => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });
  expect(outline).toEqual({ style: 'solid', width: '3px' });

  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('mobile and 200% reflow expose 44px picker targets without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await openDateTimeStory(page);

  const triggers = pickerButtons(page);
  await expect(triggers).toHaveCount(4);
  for (const trigger of await triggers.all()) {
    const box = await trigger.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(overflow.content).toBeLessThanOrEqual(overflow.viewport);
});

test('forced-colors preserves a visible picker focus indicator and has no serious violations', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await openDateTimeStory(page, 'density:standard;contrast:high');

  const trigger = pickerButtons(page).first();
  await trigger.focus();
  const outline = await trigger.evaluate((element) => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });
  expect(outline.style).not.toBe('none');
  expect(Number.parseFloat(outline.width)).toBeGreaterThanOrEqual(2);

  const results = await new AxeBuilder({ page }).include('#storybook-root').analyze();
  expect(
    results.violations
      .filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')
      .map((violation) => violation.id)
  ).toEqual([]);
});
