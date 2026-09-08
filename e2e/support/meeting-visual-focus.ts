import { expect, type Locator, type Page } from '@playwright/test';

export async function expectFocusClearance(locator: Locator, label: string, minimum = 4) {
  const clearance = await locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const clippingAncestors: Array<{ left: number; right: number }> = [];
    let ancestor = element.parentElement;
    while (ancestor) {
      const style = getComputedStyle(ancestor);
      if (/(?:auto|clip|hidden|scroll)/u.test(style.overflowX)) {
        const ancestorBounds = ancestor.getBoundingClientRect();
        clippingAncestors.push({
          left: bounds.left - ancestorBounds.left,
          right: ancestorBounds.right - bounds.right,
        });
      }
      ancestor = ancestor.parentElement;
    }
    return clippingAncestors.length
      ? {
          left: Math.min(...clippingAncestors.map((item) => item.left)),
          right: Math.min(...clippingAncestors.map((item) => item.right)),
        }
      : null;
  });
  expect(clearance, `${label}: clipping ancestor found`).not.toBeNull();
  expect(clearance!.left, `${label}: left focus clearance`).toBeGreaterThanOrEqual(minimum);
  expect(clearance!.right, `${label}: right focus clearance`).toBeGreaterThanOrEqual(minimum);
}

export async function expectKeyboardFocusVisible(page: Page, locator: Locator, label: string) {
  const visualSignature = async () =>
    locator.evaluate((element) => {
      const read = (pseudo?: '::before' | '::after') => {
        const style = getComputedStyle(element, pseudo);
        return {
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
          outlineColor: style.outlineColor,
          boxShadow: style.boxShadow,
          backgroundColor: style.backgroundColor,
          borderColor: style.borderColor,
          borderWidth: style.borderWidth,
          content: style.content,
          opacity: style.opacity,
        };
      };
      return [read(), read('::before'), read('::after')];
    });
  const restingVisual = await visualSignature();
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await locator.evaluate((element) => document.activeElement === element)) break;
    await page.keyboard.press('Tab');
  }
  await expect(locator, `${label}: keyboard focus`).toBeFocused();
  expect(
    await locator.evaluate((element) => element.matches(':focus-visible')),
    `${label}: :focus-visible`
  ).toBe(true);
  const focusedVisual = await visualSignature();
  const hasVisibleOutline = focusedVisual.some(
    (style) => style.outlineStyle !== 'none' && (Number.parseFloat(style.outlineWidth) || 0) >= 2
  );
  expect(
    hasVisibleOutline || JSON.stringify(focusedVisual) !== JSON.stringify(restingVisual),
    `${label}: focus indicator`
  ).toBe(true);
}
