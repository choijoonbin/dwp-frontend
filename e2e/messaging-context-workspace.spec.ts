import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  mockMessagingReceipts,
  RECEIPT_CONVERSATION,
  RECEIPT_OTHER_MESSAGE,
} from './support/messaging-receipt-fixture';
import { expectInsideViewport } from './support/messaging-ui-contracts';

test('conversation briefing is reachable on every viewport and jumps to the actual message', async ({
  page,
}, testInfo) => {
  await mockMessagingReceipts(page);
  await page.goto(`/messages/inbox?conversation=${RECEIPT_CONVERSATION}`);
  const toggle = page.getByRole('button', { name: 'Conversation context', exact: true });
  await expectInsideViewport(toggle, page);
  if (testInfo.project.name === 'mobile') await toggle.click();
  const rail = page.getByTestId('messaging-context-rail');
  await expect(rail.getByRole('heading', { name: 'Quick catch-up' })).toBeVisible();
  await expect(rail.getByRole('button', { name: 'Go to message from Alex Park' })).toContainText(
    'I will review it this afternoon.'
  );
  await rail.getByRole('button', { name: 'Collapse briefing' }).click();
  await expect(rail.getByRole('button', { name: 'Go to message from Alex Park' })).toBeHidden();
  await rail.getByRole('button', { name: 'Expand briefing' }).click();
  await rail.getByRole('button', { name: 'Go to message from Alex Park' }).click();
  await expect(page.locator(`[data-msg-receipt-id="${RECEIPT_OTHER_MESSAGE}"]`)).toBeFocused();
  if (testInfo.project.name === 'mobile')
    await expect(page.getByRole('dialog', { name: 'Conversation briefing' })).toHaveCount(0);
  else {
    await toggle.click();
    await expect(rail).toHaveCount(0);
    await toggle.click();
    await expect(rail).toBeVisible();
  }
  await page.screenshot({ path: testInfo.outputPath('messaging-inbox-refined.png') });
  expect(
    (await new AxeBuilder({ page }).include('[data-testid="messaging-workspace-canvas"]').analyze())
      .violations
  ).toEqual([]);
  if (testInfo.project.name === 'chromium') {
    for (const width of [1280, 390, 320, 720]) {
      await page.setViewportSize({ width, height: width === 720 ? 450 : 900 });
      await expectInsideViewport(toggle, page);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      ).toBeLessThanOrEqual(1);
      await page.screenshot({ path: testInfo.outputPath(`messaging-inbox-${width}.png`) });
    }
  }
});

test('navigator filters loaded conversations without hiding the way back', async ({ page }) => {
  await mockMessagingReceipts(page);
  await page.goto('/messages/inbox');
  const navigator = page.getByTestId('messaging-conversation-navigator');
  await navigator.getByRole('tab', { name: 'Favorites', exact: true }).click();
  await expect(navigator.getByText('No matching conversations', { exact: true })).toBeVisible();
  await navigator.getByRole('tab', { name: 'Unread', exact: true }).click();
  await expect(navigator.getByRole('button', { name: /Launch coordination/ })).toBeVisible();
  await navigator.getByRole('tab', { name: 'All', exact: true }).click();
  await expect(navigator.getByRole('button', { name: /Launch coordination/ })).toBeVisible();
});

test('formatting controls produce safe rich messages without disturbing the send contract', async ({
  page,
}) => {
  const state = await mockMessagingReceipts(page);
  state.messages[0]!.body =
    '**Release ready** and *reviewed*.\n\n- Check owners\n- Share results\n\n`<script>alert(1)</script>`\n\n[unsafe](javascript:alert(1))';
  await page.goto(`/messages/inbox?conversation=${RECEIPT_CONVERSATION}`);
  const feed = page.getByRole('feed');
  await expect(feed.locator('strong', { hasText: 'Release ready' })).toBeVisible();
  await expect(feed.locator('em', { hasText: 'reviewed' })).toBeVisible();
  await expect(feed.getByRole('listitem', { name: '' })).toHaveCount(2);
  await expect(feed.locator('a[href^="javascript:"]')).toHaveCount(0);
  const composer = page.getByRole('textbox', { name: 'Compose message', exact: true });
  await composer.fill('Ready for review');
  await composer.press('ControlOrMeta+a');
  await page
    .getByRole('toolbar', { name: 'Message formatting' })
    .getByRole('button', { name: 'Bold', exact: true })
    .click();
  await expect(composer).toHaveValue('**Ready for review**');
  await expect(composer).toBeFocused();
  await composer.press('Shift+Enter');
  await expect(composer).toHaveValue(/\n/);
});

test('Korean conversation keeps long content inside the stream and briefing', async ({ page }) => {
  const state = await mockMessagingReceipts(page, 'ko');
  state.messages[1]!.body =
    '**출시 준비 검토**\n\n구성원별 검토 결과와 다음 일정을 함께 확인해 주세요.\n\n' +
    '긴한글메시지'.repeat(50);
  state.messages[1]!.senderName = '디지털워크플레이스 운영 담당자';
  await page.goto(`/messages/inbox?conversation=${RECEIPT_CONVERSATION}`);
  await expect(
    page.getByRole('feed').locator('strong', { hasText: '출시 준비 검토' })
  ).toBeVisible();
  for (const width of [1440, 1280, 390, 320, 720]) {
    await page.setViewportSize({ width, height: width === 720 ? 450 : 900 });
    await expectInsideViewport(page.getByTestId('messaging-composer').getByRole('textbox'), page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    ).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: test.info().outputPath(`messaging-inbox-ko-${width}.png`),
      animations: 'disabled',
    });
  }
});
