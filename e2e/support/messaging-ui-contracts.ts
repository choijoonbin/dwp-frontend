import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page, type Route, type TestInfo } from '@playwright/test';

import type {
  MessagingConversationDisplayPreference,
  MessagingDisplayPreference,
  MessagingMessage,
} from '@dwp-frontend/shared-utils';

type DisplayPreferenceState = {
  displayPreference: MessagingDisplayPreference;
  conversationDisplayPreferences: Map<string, MessagingConversationDisplayPreference>;
};

export function fulfillMessagingRoute(route: Route, data: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data }),
  });
}

export function messagingMessage(
  input: Partial<MessagingMessage> & Pick<MessagingMessage, 'messageId' | 'body'>
) {
  return {
    conversationId: '71000000-0000-0000-0000-000000000001',
    senderUserId: 42,
    senderPersonPublicId: 'person-mina',
    senderName: 'Mina Kim',
    contentType: 'TEXT' as const,
    messageKind: 'USER' as const,
    replyToMessageId: null,
    editedAt: null,
    deletedAt: null,
    createdAt: '2026-08-19T08:30:00Z',
    sequence: 1,
    version: 1,
    reactions: [],
    attachments: [],
    replyCount: 0,
    rootPreview: null,
    ...input,
  } satisfies MessagingMessage;
}

export function conversationDisplayPreference(
  state: DisplayPreferenceState,
  conversationId: string
): MessagingConversationDisplayPreference {
  return (
    state.conversationDisplayPreferences.get(conversationId) ?? {
      conversationId,
      layoutMode: 'INHERIT',
      density: 'INHERIT',
      theme: 'INHERIT',
      effectiveLayoutMode: 'COLLABORATIVE',
      effectiveDensity: state.displayPreference.density,
      effectiveTheme: state.displayPreference.theme,
      showAvatars: state.displayPreference.showAvatars,
      timestampMode: state.displayPreference.timestampMode,
      messagePreview: state.displayPreference.messagePreview,
      policyLocked: false,
      policyReason: null,
      version: 0,
    }
  );
}

export function messagingMessageRow(page: Page, body: string): Locator {
  return page
    .getByRole('feed', { name: 'Messages', exact: true })
    .getByText(body, { exact: true })
    .locator('xpath=ancestor::*[.//button[@aria-label="Add reaction"]][1]');
}

export async function clickResponsiveMessageAction(page: Page, row: Locator, label: string) {
  const directAction = row.getByRole('button', { name: label });
  if (await directAction.isVisible()) {
    await directAction.click();
    return;
  }
  await row.getByRole('button', { name: 'More message actions' }).click();
  await page.getByRole('menuitem', { name: label }).click();
}

export async function expectInsideViewport(locator: Locator, page: Page) {
  await locator.scrollIntoViewIfNeeded();
  const viewport = page.viewportSize();
  const box = await locator.boundingBox();
  expect(viewport).not.toBeNull();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.y).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
}

export async function expectCompactComposer(locator: Locator, maxHeight = 160) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeLessThanOrEqual(maxHeight);
}

export async function openMessagingConversation(page: Page) {
  await page.goto('/messages/inbox?conversation=71000000-0000-0000-0000-000000000001');
  await expect(page.getByRole('heading', { name: 'Launch coordination' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Compose message' })).toBeVisible();
}

export async function captureMessagingWorkspaceModes(page: Page, testInfo: TestInfo) {
  if (testInfo.project.name !== 'chromium') return;
  const composer = page.getByRole('textbox', { name: 'Compose message' });
  await composer.fill('```ts\nconst ready = true;\n```');
  await composer.press('Enter');
  await expect(page.getByRole('feed').locator('pre code')).toHaveText('const ready = true;');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copy code' }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('const ready = true;');
  await expect(
    page
      .getByTestId('messaging-context-rail')
      .getByRole('button', { name: 'Open thread: Mina Kim' })
  ).toBeVisible();
  for (const width of [1440, 1280, 390, 320, 720]) {
    await page.setViewportSize({ width, height: width === 720 ? 450 : 900 });
    await page.getByRole('button', { name: /^(Copy code|Code copied)$/u }).click();
    await expectInsideViewport(page.getByRole('textbox', { name: 'Compose message' }), page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, `Messenger overflow at ${width}px`).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: testInfo.outputPath(`messaging-workspace-${width}.png`),
      animations: 'disabled',
    });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  const accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(accessibility.violations).toEqual([]);
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await expectInsideViewport(page.getByRole('textbox', { name: 'Compose message' }), page);
  await page.screenshot({
    path: testInfo.outputPath('messaging-workspace-forced-colors.png'),
    animations: 'disabled',
  });

  await page.emulateMedia({ forcedColors: 'none', colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.evaluate(async () => {
    const path = '/api/platform/v1/personal-preferences';
    const current = await fetch(path).then((response) => response.json());
    const response = await fetch(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: current.data.version,
        patch: { appearance: { mode: 'dark' }, accessibility: { reduceMotion: true } },
      }),
    });
    if (!response.ok) throw new Error('Could not update the Messenger test theme');
  });
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Compose message' })).toBeVisible();
  const darkAccessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(darkAccessibility.violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('messaging-workspace-dark.png'),
    animations: 'disabled',
  });
}
