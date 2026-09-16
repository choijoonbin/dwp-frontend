import { expect, test, type Page, type Route } from '@playwright/test';

import {
  RECEIPT_CONVERSATION,
  RECEIPT_OWN_MESSAGE,
  RECEIPT_REPLY,
  mockMessagingReceipts,
} from './support/messaging-receipt-fixture';
import {
  clickResponsiveMessageAction,
  messagingMessageRow,
} from './support/messaging-ui-contracts';
import { fulfillSuccess } from './support/shell-session';
import { mockWorkHubFoundation } from './support/work-hub-foundation-fixtures';

const MESSAGING_PERMISSIONS = ['VIEW', 'CREATE', 'UPDATE'].map((permissionCode) => ({
  resourceType: 'APP',
  resourceKey: 'APP.MESSAGING',
  permissionCode,
  effect: 'ALLOW' as const,
}));
const MESSAGE_BODY = 'Please review the launch plan.';
const MISSING_MESSAGE = '72000000-0000-0000-0000-000000000099';
const SOURCE_REFERENCE = {
  sourceSystem: 'MESSAGING_MESSAGE',
  sourceReference: RECEIPT_CONVERSATION,
  obligationKey: RECEIPT_OWN_MESSAGE,
};
const SOURCE = {
  availability: 'AVAILABLE' as const,
  reference: SOURCE_REFERENCE,
  title: MESSAGE_BODY,
  sourceRoute: `/messages/inbox?conversation=${RECEIPT_CONVERSATION}&message=${RECEIPT_OWN_MESSAGE}`,
  status: 'MESSAGE',
  dueAt: null,
  channelName: 'Launch coordination',
  senderName: 'Mina Kim',
  receivedAt: '2026-08-19T08:30:00Z',
  excerpt: MESSAGE_BODY,
  sourceMessageId: RECEIPT_OWN_MESSAGE,
  sourceVersion: 1,
  sourceEditedAt: null,
};

async function installCaptureRuntime(
  page: Page,
  preflight: (route: Route) => Promise<unknown> = (route) => fulfillSuccess(route, SOURCE),
  locale: 'en' | 'ko' = 'en'
) {
  const work = await mockWorkHubFoundation(page, {
    locale,
    additionalPermissions: MESSAGING_PERMISSIONS,
  });
  await mockMessagingReceipts(page, locale, [], false);
  const preflights: unknown[] = [];
  await page.route(
    '**/api/platform/v1/workspace/work-hub/personal-tasks/source-preflight',
    async (route) => {
      preflights.push(route.request().postDataJSON());
      await preflight(route);
    }
  );
  return { work, preflights };
}

async function trackOwnMessage(
  page: Page,
  options: { width?: number; actionLabel?: string; locale?: 'en' | 'ko' } = {}
) {
  await page.setViewportSize({ width: options.width ?? 1440, height: 900 });
  await page.goto(`/messages/inbox?conversation=${RECEIPT_CONVERSATION}`);
  await expect(page.getByRole('heading', { name: 'Launch coordination' })).toBeVisible();
  const korean = options.locale === 'ko';
  const row = korean
    ? page
        .getByRole('feed', { name: '메시지', exact: true })
        .getByText(MESSAGE_BODY, { exact: true })
        .locator('xpath=ancestor::*[.//button[@aria-label="반응 추가"]][1]')
    : messagingMessageRow(page, MESSAGE_BODY);
  await row.hover();
  const actionLabel = options.actionLabel ?? 'Track as personal task';
  if (korean) {
    const directAction = row.getByRole('button', { name: actionLabel });
    if (await directAction.isVisible()) await directAction.click();
    else {
      await row.getByRole('button', { name: '메시지 작업 더보기' }).click();
      await page.getByRole('menuitem', { name: actionLabel }).click();
    }
  } else {
    await clickResponsiveMessageAction(page, row, actionLabel);
  }
  await expect(page).toHaveURL(/\/work\/queue\?compose=task$/u);
}

test('Messenger capture carries identity only, verifies provenance, and creates the exact linked task', async ({
  page,
}) => {
  const runtime = await installCaptureRuntime(page);
  await trackOwnMessage(page);

  const url = page.url();
  expect(url).not.toContain(RECEIPT_CONVERSATION);
  expect(url).not.toContain(RECEIPT_OWN_MESSAGE);
  expect(url).not.toContain(encodeURIComponent(MESSAGE_BODY));
  const transfer = await page.evaluate(() => window.history.state?.usr);
  expect(Object.keys(transfer)).toEqual(['workMessengerCapture']);
  expect(Object.keys(transfer.workMessengerCapture).sort()).toEqual([
    'conversationId',
    'createdAt',
    'messageId',
    'owner',
    'version',
  ]);
  expect(transfer.workMessengerCapture).toMatchObject({
    version: 1,
    conversationId: RECEIPT_CONVERSATION,
    messageId: RECEIPT_OWN_MESSAGE,
  });
  expect(JSON.stringify(transfer)).not.toContain(MESSAGE_BODY);
  expect(JSON.stringify(transfer)).not.toContain('Mina Kim');

  const dialog = page.getByRole('dialog', { name: 'Add a personal task' });
  await expect(dialog).toBeVisible();
  const modeGroup = dialog.getByRole('group', { name: 'Personal task mode' });
  const newMode = modeGroup.getByRole('button', { name: 'A. Create new task' });
  const sourceMode = modeGroup.getByRole('button', { name: 'B. Track from source' });
  await expect(modeGroup.getByRole('button', { name: 'C. Edit existing task' })).toBeDisabled();
  await expect(sourceMode).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.locator('ol[aria-label="Personal task creation progress"]')).toHaveCount(0);
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox?.width).toBeGreaterThanOrEqual(630);
  expect(dialogBox?.width).toBeLessThanOrEqual(650);

  await newMode.focus();
  await page.keyboard.press('Enter');
  await expect(newMode).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByText('Saving will remove the link to the source item.')).toBeVisible();
  await sourceMode.focus();
  await page.keyboard.press('Enter');
  await expect(sourceMode).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => runtime.preflights.length).toBeGreaterThanOrEqual(1);
  expect(
    runtime.preflights.every(
      (request) => JSON.stringify(request) === JSON.stringify(SOURCE_REFERENCE)
    )
  ).toBe(true);
  await expect(dialog.getByText('Captured source · AVAILABLE')).toBeVisible();
  await expect(dialog.getByText('Launch coordination', { exact: true })).toBeVisible();
  await expect(dialog.getByText('From Mina Kim', { exact: false })).toBeVisible();
  await expect(dialog.getByText(MESSAGE_BODY, { exact: true })).toBeVisible();
  await expect(
    dialog.getByText(`Message ID: ${RECEIPT_OWN_MESSAGE}`, { exact: false })
  ).toBeVisible();

  const unlink = dialog.getByRole('checkbox', { name: 'Remove source link' });
  await unlink.check();
  await expect(dialog.getByText('Saving will remove the link to the source item.')).toBeVisible();
  await unlink.uncheck();

  await dialog.getByRole('button', { name: 'Open original message' }).click();
  await expect(page).toHaveURL(
    new RegExp(
      `/messages/inbox\\?conversation=${RECEIPT_CONVERSATION}&message=${RECEIPT_OWN_MESSAGE}$`,
      'u'
    )
  );
  const linkedMessage = page.locator(
    `[data-msg-receipt-id="${RECEIPT_OWN_MESSAGE}"][data-message-target="true"]`
  );
  await expect(linkedMessage).toBeVisible();
  await expect(linkedMessage).toHaveAttribute('aria-current', 'true');
  await expect(linkedMessage).toBeFocused();
  await page.goBack();
  const restored = page.getByRole('dialog', { name: 'Add a personal task' });
  await expect(restored).toBeVisible();
  await restored
    .getByRole('textbox', { name: 'Title', exact: true })
    .fill('Review captured launch plan');
  await restored.getByRole('button', { name: 'Add task', exact: true }).click();

  await expect.poll(() => runtime.work.creations.length).toBe(1);
  const created = runtime.work.creations[0]!.body;
  expect(created).toMatchObject({
    title: 'Review captured launch plan',
    priority: 'NORMAL',
    sourceReference: SOURCE_REFERENCE,
  });
  expect(created).not.toHaveProperty('sourceReferences');
  const serialized = JSON.stringify(created);
  expect(serialized).not.toContain(MESSAGE_BODY);
  expect(serialized).not.toContain('Mina Kim');
  expect(serialized).not.toContain('Launch coordination');

  await expect(page).not.toHaveURL(/(?:\?|&)compose=task(?:&|$)/u);
  await expect.poll(() => page.evaluate(() => window.history.state?.usr ?? null)).toBeNull();
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Add a personal task' })).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Launch coordination' })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('dialog', { name: 'Add a personal task' })).toHaveCount(0);
  expect(runtime.work.creations).toHaveLength(1);
});

test('F01 keeps Korean A/B/C semantics readable at desktop, 390px, and 320px', async ({ page }) => {
  await installCaptureRuntime(page, (route) => fulfillSuccess(route, SOURCE), 'ko');

  for (const width of [1440, 390, 320]) {
    await trackOwnMessage(page, { width, actionLabel: '개인 작업으로 추적', locale: 'ko' });
    const dialog = page.getByRole('dialog', { name: '개인 할 일 추가' });
    const modeGroup = dialog.getByRole('group', { name: '개인 할 일 작업 모드' });
    await expect(modeGroup.getByRole('button', { name: 'A. 새 할 일 작성' })).toBeVisible();
    await expect(modeGroup.getByRole('button', { name: 'B. 원문에서 추적' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(modeGroup.getByRole('button', { name: 'C. 기존 할 일 수정' })).toBeVisible();
    await expect(dialog.locator('ol[aria-label="개인 할 일 생성 진행 단계"]')).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() =>
          Math.max(
            document.documentElement.scrollWidth - window.innerWidth,
            document.body.scrollWidth - window.innerWidth
          )
        )
      )
      .toBeLessThanOrEqual(1);

    const evidenceDirectory = process.env.WORK_F01_EVIDENCE_DIR;
    if (evidenceDirectory) {
      await page.screenshot({
        path: `${evidenceDirectory}/wrk-f01-ko-${width}.png`,
        fullPage: false,
      });
    }
    await dialog.getByRole('button', { name: '취소', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  }
});

test('Messenger source preflight failure can retry and close without creating or reopening a task', async ({
  page,
}) => {
  let sourceAvailable = false;
  const runtime = await installCaptureRuntime(page, (route) => {
    if (sourceAvailable) return fulfillSuccess(route, SOURCE);
    sourceAvailable = true;
    return route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ERROR', success: false, message: 'source access revoked' }),
    });
  });
  await trackOwnMessage(page);

  const dialog = page.getByRole('dialog', { name: 'Add a personal task' });
  await expect(dialog).toBeVisible();
  await expect.poll(() => runtime.preflights.length).toBe(1);
  await expect(dialog.getByRole('button', { name: 'Add task', exact: true })).toBeDisabled();
  await expect(
    dialog.getByText(
      'The original message is no longer available to you. This task has not been created.'
    )
  ).toBeVisible();
  await expect(dialog.getByText('Captured source · AVAILABLE')).toHaveCount(0);
  await expect(dialog.getByText(MESSAGE_BODY, { exact: true })).toHaveCount(0);
  expect(runtime.work.creations).toHaveLength(0);
  expect(page.url()).not.toContain(RECEIPT_CONVERSATION);
  expect(page.url()).not.toContain(RECEIPT_OWN_MESSAGE);

  await dialog.getByRole('button', { name: 'Retry source check' }).click();
  await expect.poll(() => runtime.preflights.length).toBe(2);
  await expect(dialog.getByText('Captured source · AVAILABLE')).toBeVisible();
  const title = dialog.getByRole('textbox', { name: 'Title', exact: true });
  await expect(title).toBeEnabled();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).not.toHaveURL(/(?:\?|&)compose=task(?:&|$)/u);
  await expect.poll(() => page.evaluate(() => window.history.state?.usr ?? null)).toBeNull();
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Add a personal task' })).toHaveCount(0);
  expect(runtime.work.creations).toHaveLength(0);
});

test('expired or different-owner Messenger capture state cannot preflight or reopen the composer', async ({
  page,
}) => {
  const runtime = await installCaptureRuntime(page);
  await trackOwnMessage(page);
  const dialog = page.getByRole('dialog', { name: 'Add a personal task' });
  await expect(dialog).toBeVisible();
  await expect.poll(() => runtime.preflights.length).toBeGreaterThanOrEqual(1);
  const transfer = await page.evaluate(() => window.history.state?.usr);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  const validCapturePreflightCount = runtime.preflights.length;

  await page.evaluate((state) => {
    window.history.replaceState(
      {
        ...(window.history.state ?? {}),
        usr: {
          workMessengerCapture: {
            ...state.workMessengerCapture,
            createdAt: Date.now() - 15 * 60_000 - 1,
          },
        },
      },
      '',
      '/work/queue?compose=task'
    );
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  }, transfer);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Unified work inbox', exact: true })
  ).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Add a personal task' })).toHaveCount(0);
  await expect(page).not.toHaveURL(/(?:\?|&)compose=task(?:&|$)/u);
  await expect.poll(() => page.evaluate(() => window.history.state?.usr ?? null)).toBeNull();
  expect(runtime.preflights).toHaveLength(validCapturePreflightCount);

  await page.evaluate((state) => {
    window.history.replaceState(
      {
        ...(window.history.state ?? {}),
        usr: {
          workMessengerCapture: {
            ...state.workMessengerCapture,
            owner: `${state.workMessengerCapture.owner}:different-owner`,
            createdAt: Date.now(),
          },
        },
      },
      '',
      '/work/queue?compose=task'
    );
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  }, transfer);
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Add a personal task' })).toHaveCount(0);
  await expect(page).not.toHaveURL(/(?:\?|&)compose=task(?:&|$)/u);
  await expect.poll(() => page.evaluate(() => window.history.state?.usr ?? null)).toBeNull();
  expect(runtime.preflights).toHaveLength(validCapturePreflightCount);
  expect(runtime.work.creations).toHaveLength(0);
});

test('exact reply deep links focus and highlight safely at 390px and 320px with keyboard access', async ({
  page,
}) => {
  await installCaptureRuntime(page);

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(
      `/messages/inbox?conversation=${RECEIPT_CONVERSATION}&message=${RECEIPT_REPLY}`
    );
    const target = page.locator(
      `[data-msg-receipt-id="${RECEIPT_REPLY}"][data-message-target="true"]`
    );
    await expect(target).toBeVisible();
    await expect(target).toHaveAttribute('aria-current', 'true');
    await expect(target).toBeFocused();
    await expect
      .poll(() =>
        page.evaluate(() =>
          Math.max(
            document.documentElement.scrollWidth - window.innerWidth,
            document.body.scrollWidth - window.innerWidth
          )
        )
      )
      .toBeLessThanOrEqual(1);

    const moreActions = target.getByRole('button', { name: 'More message actions' });
    await moreActions.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(moreActions).toBeFocused();
  }
});

test('missing exact message deep links keep the conversation usable and can be dismissed', async ({
  page,
}) => {
  await installCaptureRuntime(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(
    `/messages/inbox?conversation=${RECEIPT_CONVERSATION}&message=${MISSING_MESSAGE}`
  );

  await expect(
    page.getByText('The linked message is no longer available in this conversation.')
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Compose message' })).toBeVisible();
  await expect(page.locator('[data-message-target="true"]')).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Math.max(
          document.documentElement.scrollWidth - window.innerWidth,
          document.body.scrollWidth - window.innerWidth
        )
      )
    )
    .toBeLessThanOrEqual(1);

  await page.getByRole('button', { name: 'Show conversation' }).click();
  await expect(page).not.toHaveURL(/(?:\?|&)message=/u);
  await expect(
    page.getByText('The linked message is no longer available in this conversation.')
  ).toBeHidden({ timeout: 15_000 });
  await expect(page.getByText(MESSAGE_BODY, { exact: true })).toBeVisible();
});
