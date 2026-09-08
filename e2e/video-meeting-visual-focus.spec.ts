import { expect, test } from '@playwright/test';

import { expectFocusClearance, expectKeyboardFocusVisible } from './support/meeting-visual-focus';

// Assertion-helper regressions only, not product screenshots or design approval evidence.
test('Meeting focus helper accepts a visible keyboard indicator', async ({ page }) => {
  await page.setContent(`
    <style>input { outline: none; } input:focus-visible { outline: 3px solid blue; }</style>
    <input aria-label="Review evidence" />
  `);
  await expectKeyboardFocusVisible(page, page.getByRole('textbox'), 'visible indicator');
});

test('Meeting focus helper rejects a keyboard target without a visual indicator', async ({
  page,
}) => {
  await page.setContent(
    '<style>input { outline: none !important; }</style><input aria-label="Review" />'
  );
  await expect(
    expectKeyboardFocusVisible(page, page.getByRole('textbox'), 'missing indicator')
  ).rejects.toThrow('focus indicator');
});

test('Meeting clearance helper accepts padding around a clipping ancestor', async ({ page }) => {
  await page.setContent('<div style="overflow:hidden;padding:8px"><button>Review</button></div>');
  await expectFocusClearance(page.getByRole('button'), 'padded target');
});

test('Meeting clearance helper rejects a clipped focus target', async ({ page }) => {
  await page.setContent('<div style="overflow:hidden;padding:0"><button>Review</button></div>');
  await expect(expectFocusClearance(page.getByRole('button'), 'clipped target')).rejects.toThrow(
    'left focus clearance'
  );
});
