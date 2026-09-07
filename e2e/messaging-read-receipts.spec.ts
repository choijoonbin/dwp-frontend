import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectInsideViewport } from './support/messaging-ui-contracts';
import {
  mockMessagingReceipts,
  RECEIPT_CONVERSATION,
  RECEIPT_OTHER_MESSAGE,
  RECEIPT_REPLY,
} from './support/messaging-receipt-fixture';

test('sender can inspect read, unconfirmed and private recipients without confusing them', async ({
  page,
}, testInfo) => {
  const state = await mockMessagingReceipts(page);
  await page.goto(`/messages/inbox?conversation=${RECEIPT_CONVERSATION}`);
  await page.getByRole('button', { name: 'Read status: Read by 1', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Message read status' });
  await expect(dialog.getByText('Alex Park', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Read', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Not confirmed', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Not shared', { exact: true })).toBeVisible();
  await expectInsideViewport(dialog.getByRole('button', { name: 'Close', exact: true }), page);
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    []
  );
  await page.screenshot({ path: testInfo.outputPath('read-status-details.png') });
  if (testInfo.project.name === 'chromium') {
    for (const width of [1440, 1280, 320, 720]) {
      await page.setViewportSize({ width, height: width === 720 ? 450 : 900 });
      await expectInsideViewport(dialog.getByRole('button', { name: 'Close', exact: true }), page);
      expect(
        await dialog.evaluate((node) => node.scrollWidth - node.clientWidth)
      ).toBeLessThanOrEqual(1);
      await page.screenshot({ path: testInfo.outputPath(`read-status-${width}.png`) });
    }
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    await expect(dialog.getByText('Not shared', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('read-status-high-contrast.png') });
  }
  state.failReceipts = true;
  await dialog.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('could not be loaded');
  await expect(dialog.getByText('Alex Park', { exact: true })).toHaveCount(0);
});

test('company-wide sharing persists and failed preference writes do not masquerade as success', async ({
  page,
}, testInfo) => {
  const state = await mockMessagingReceipts(page);
  await page.goto(`/messages/inbox?conversation=${RECEIPT_CONVERSATION}`);
  await page.getByRole('button', { name: 'Open conversation settings', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: 'Privacy', exact: true }).click();
  const sharing = dialog.getByRole('switch', { name: 'Share my read status' });
  await expect(sharing).toBeChecked();
  await sharing.click();
  await expect(sharing).not.toBeChecked();
  expect(state.privacyRequests[0]).toEqual({ readReceiptsEnabled: false, version: 0 });
  await expect(dialog.getByText(/Your unread conversations and reading position/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('privacy-settings.png') });
  if (testInfo.project.name === 'chromium') {
    await page.setViewportSize({ width: 320, height: 740 });
    await expectInsideViewport(sharing, page);
    expect(
      (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations
    ).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('privacy-settings-320.png') });
  }
  state.failPrivacy = true;
  await sharing.click();
  await expect(sharing).not.toBeChecked();
  expect(state.privacy.readReceiptsEnabled).toBe(false);
  await page.reload();
  await page.getByRole('button', { name: 'Open conversation settings', exact: true }).click();
  await page.getByRole('tab', { name: 'Privacy', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Share my read status' })).not.toBeChecked();
});

test('only visible focused messages produce observations and closed thread replies stay unconfirmed', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => false });
  });
  const state = await mockMessagingReceipts(page);
  await page.goto(`/messages/inbox?conversation=${RECEIPT_CONVERSATION}`);
  await expect(
    page.getByRole('feed').getByText('I will review it this afternoon.', { exact: true })
  ).toBeVisible();
  await page.waitForTimeout(1_000);
  expect(state.observations).toEqual([]);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => true });
    window.dispatchEvent(new Event('focus'));
  });
  await expect.poll(() => state.observations.flat()).toContain(RECEIPT_OTHER_MESSAGE);
  expect(state.observations.flat()).not.toContain(RECEIPT_REPLY);
  await page.getByRole('button', { name: '1 replies', exact: true }).click();
  await expect(page.getByText('The private thread reply.', { exact: true })).toBeVisible();
  await expect.poll(() => state.observations.flat()).toContain(RECEIPT_REPLY);
});
