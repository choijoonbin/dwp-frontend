import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';
import { ASK_RUNTIME_FIXTURE, WORKSPACE_QUEUE_FIXTURE } from './support/runtime-access';

const summaries = [
  ['brief', '오늘 가장 먼저 확인해야 할 업무는 무엇인가요?', '2026-09-04T08:00:00Z', 6],
  [
    'meeting',
    'Prepare a customer meeting and review the delivery risks',
    '2026-09-01T01:00:00Z',
    4,
  ],
  ['policy', '원격 근무 정책과 승인 절차를 확인해 주세요', '2026-08-01T01:00:00Z', 2],
].map(([conversationId, title, lastMessageAt, messageCount]) => ({
  conversationId,
  title,
  lastMessageAt,
  messageCount,
  locale: 'ko',
  createdAt: lastMessageAt,
  updatedAt: lastMessageAt,
}));

async function fixture(
  page: Page,
  {
    locale = 'en',
    dark = false,
    empty = false,
  }: { locale?: 'ko' | 'en'; dark?: boolean; empty?: boolean } = {}
) {
  await page.clock.setFixedTime(new Date('2026-09-04T09:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: dark ? 'dark' : 'light' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale,
    displayName: locale === 'ko' ? '최준빈' : 'Mina Kim',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: dark ? 'dark' : 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  let items = empty ? [] : [...summaries];
  let deletes = 0;
  let held = false;
  await page.route('**/api/agent/v1/conversations', (route) =>
    route.fulfill({ json: { success: true, data: items } })
  );
  await page.route('**/api/agent/v1/conversations/*', async (route) => {
    const id = route.request().url().split('/').at(-1);
    if (route.request().method() === 'DELETE') {
      deletes += 1;
      if (held)
        return route.fulfill({ status: 409, json: { success: false, message: 'retention hold' } });
      items = items.filter((item) => item.conversationId !== id);
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({
      json: {
        success: true,
        data: {
          summary: summaries.find((item) => item.conversationId === id) ?? summaries[0],
          messages: [
            {
              messageId: 'saved-question',
              role: 'USER',
              content: 'Previously saved work question',
              runId: null,
              statusCode: null,
              citations: [],
              createdAt: '2026-09-04T08:00:00Z',
            },
          ],
        },
      },
    });
  });
  await page.route('**/api/platform/v1/workspace/work-items', (route) =>
    route.fulfill({ json: { success: true, data: WORKSPACE_QUEUE_FIXTURE } })
  );
  await page.route('**/api/agent/v1/actions', (route) =>
    route.fulfill({ json: { success: true, data: [] } })
  );
  return {
    deleteCount: () => deletes,
    hold: () => {
      held = true;
    },
  };
}

test('studio scope controls match the actual request, including at mobile width', async ({
  page,
}) => {
  await fixture(page);
  let request: { query?: string; sourceScopes?: string[] } = {};
  await page.route('**/api/agent/v1/ask/stream', (route) => {
    request = route.request().postDataJSON();
    return route.fulfill({
      contentType: 'text/event-stream',
      body: `event: result\ndata: ${JSON.stringify({ data: ASK_RUNTIME_FIXTURE })}\n\n`,
    });
  });
  await page.goto('/dwaion/new');
  const rail = page.getByTestId('dwaion-studio-rail');
  await expect(page.getByText('Travel expense follow-up')).toHaveCount(0);
  await rail.getByRole('checkbox', { name: 'Mail', exact: true }).uncheck();
  await rail.getByRole('checkbox', { name: 'Calendar', exact: true }).uncheck();
  await expect(rail.getByRole('checkbox', { name: 'Work item', exact: true })).toBeDisabled();
  await expect(rail.getByText('1 selected')).toBeVisible();
  await page.getByRole('textbox', { name: 'Ask a work question' }).fill('Review my work queue');
  await page.getByRole('button', { name: 'Send question', exact: true }).click();
  await expect.poll(() => request.sourceScopes).toEqual(['WORK_ITEM']);
  expect(request.query).toBe('Review my work queue');
  expect(page.url()).not.toContain('Review');
});

test('studio does not show failed work as zero or retained data', async ({ page }) => {
  await fixture(page);
  await page.route('**/api/platform/v1/workspace/work-items', (route) =>
    route.fulfill({ status: 503, json: { success: false } })
  );
  await page.goto('/dwaion/new');
  await expect(page.getByTestId('dwaion-studio-rail').getByRole('alert')).toBeVisible();
  await expect(page.getByText('Approve software access')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Ask a work question' })).toBeVisible();
});

test('mobile answer announces once and opens evidence in a focus-restoring full-screen dialog', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await page.route('**/api/agent/v1/ask/stream', (route) => {
    const request = route.request().postDataJSON() as { requestId: string };
    return route.fulfill({
      contentType: 'text/event-stream',
      body: `event: result\ndata: ${JSON.stringify({
        data: {
          ...ASK_RUNTIME_FIXTURE,
          requestId: request.requestId,
          citations: ASK_RUNTIME_FIXTURE.citations.map((citation, index) => ({
            ...citation,
            route: index === 0 ? '/calendar' : null,
          })),
        },
      })}\n\n`,
    });
  });

  await page.goto('/dwaion/new');
  await page.getByRole('textbox', { name: 'Ask a work question' }).fill('Review my schedule');
  await page.getByRole('button', { name: 'Send question', exact: true }).click();
  await expect(page.getByTestId('dwaion-workspace-answer')).toContainText(
    ASK_RUNTIME_FIXTURE.answer
  );

  const announcement = page.getByTestId('dwaion-answer-announcement');
  await expect(announcement).toContainText(ASK_RUNTIME_FIXTURE.answer);
  await expect(
    page.locator('[aria-live="polite"]').filter({ hasText: ASK_RUNTIME_FIXTURE.answer })
  ).toHaveCount(1);

  const result = page.getByTestId('dwaion-workspace-result');
  const undersizedResultActions = await result.locator('button').evaluateAll((buttons) =>
    buttons
      .filter((button) => {
        const bounds = button.getBoundingClientRect();
        return bounds.width > 0 && bounds.height > 0 && (bounds.width < 44 || bounds.height < 44);
      })
      .map((button) => button.getAttribute('aria-label') || button.textContent?.trim())
  );
  expect(undersizedResultActions).toEqual([]);

  const evidenceTrigger = page.getByRole('button', { name: /Verification panel/ });
  const triggerBounds = await evidenceTrigger.boundingBox();
  expect(triggerBounds?.height ?? 0).toBeGreaterThanOrEqual(44);
  await evidenceTrigger.click();
  const evidenceDialog = page.getByRole('dialog', { name: 'Verification panel' });
  await expect(evidenceDialog).toBeVisible();
  const dialogBounds = await evidenceDialog.boundingBox();
  expect(dialogBounds?.width ?? 0).toBeGreaterThanOrEqual(389);
  expect(dialogBounds?.height ?? 0).toBeGreaterThanOrEqual(843);
  await expect(evidenceDialog.getByText('Flexible work guidance')).toBeVisible();
  const sourceAction = evidenceDialog.getByRole('button', { name: /Open source/ });
  const sourceActionBounds = await sourceAction.boundingBox();
  expect(sourceActionBounds?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(sourceActionBounds?.height ?? 0).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Escape');
  await expect(evidenceDialog).toBeHidden();
  await expect(evidenceTrigger).toBeFocused();
});

test('archive supports private title search, time filtering, sorting and continuation', async ({
  page,
}) => {
  await fixture(page);
  await page.goto('/dwaion/conversations');
  const archive = page.getByTestId('dwaion-archive');
  await expect(archive.getByTestId('dwaion-archive-row')).toHaveCount(3);
  await archive.getByRole('tab', { name: 'Past 7 days' }).click();
  await expect(archive.getByTestId('dwaion-archive-row')).toHaveCount(2);
  await archive.getByRole('textbox', { name: 'Search conversations' }).fill('customer');
  await expect(archive.getByTestId('dwaion-archive-row')).toHaveCount(1);
  expect(page.url()).not.toContain('customer');
  await archive.getByRole('textbox', { name: 'Search conversations' }).press('Escape');
  await archive.getByRole('tab', { name: 'Loaded conversations', exact: true }).click();
  await archive.getByRole('combobox', { name: 'Sort conversations' }).click();
  await page.getByRole('option', { name: 'Oldest first' }).click();
  await expect(archive.getByTestId('dwaion-archive-row').first()).toContainText('원격 근무');
  await archive.getByRole('link', { name: /Prepare a customer meeting/ }).click();
  await expect(page).toHaveURL(/\/dwaion\/conversations\/meeting$/);
  await expect(page.getByText('Previously saved work question')).toBeVisible();
});

test('archive deletion requires confirmation and updates cache', async ({ page }) => {
  const state = await fixture(page);
  await page.goto('/dwaion/conversations');
  await page.getByTestId('dwaion-archive-row').first().getByRole('button').click();
  expect(state.deleteCount()).toBe(0);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
  expect(state.deleteCount()).toBe(0);
  await page.getByTestId('dwaion-archive-row').first().getByRole('button').click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByTestId('dwaion-archive-row')).toHaveCount(2);
  expect(state.deleteCount()).toBe(1);
});

test('archive legal hold remains visible and never implies a successful deletion', async ({
  page,
}) => {
  const state = await fixture(page);
  state.hold();
  await page.goto('/dwaion/conversations');
  await page.getByTestId('dwaion-archive-row').first().getByRole('button').click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('alertdialog').getByRole('alert')).toContainText('legal hold');
  await expect(page.getByTestId('dwaion-archive-row')).toHaveCount(3);
});

test('archive refresh errors hide cached titles and recover with retry', async ({ page }) => {
  await fixture(page);
  await page.goto('/dwaion/conversations');
  await expect(page.getByTestId('dwaion-archive-row')).toHaveCount(3);
  await page.route('**/api/agent/v1/conversations', (route) =>
    route.fulfill({ status: 403, json: { success: false } })
  );
  await page.getByRole('button', { name: 'Refresh conversations' }).click();
  await expect(page.getByTestId('dwaion-archive').getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('dwaion-archive-row')).toHaveCount(0);
  await expect(page.getByText('There are no conversations yet')).toHaveCount(0);
  await page.route('**/api/agent/v1/conversations', (route) =>
    route.fulfill({ json: { success: true, data: summaries } })
  );
  await page.getByTestId('dwaion-archive').getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByTestId('dwaion-archive-row')).toHaveCount(3);
});

test('conversation access failure never offers a follow-up against an unverified thread', async ({
  page,
}) => {
  await fixture(page);
  await page.route('**/api/agent/v1/conversations/brief', (route) =>
    route.fulfill({ status: 403, json: { success: false } })
  );
  await page.goto('/dwaion/conversations/brief');
  await expect(page.getByTestId('dwaion-studio').getByRole('alert')).toContainText(
    'could not be verified'
  );
  await expect(page.getByRole('textbox', { name: 'Ask a work question' })).toHaveCount(0);
});

test('empty archive has a real new conversation action', async ({ page }) => {
  await fixture(page, { empty: true });
  await page.goto('/dwaion/conversations');
  await expect(page.getByText('There are no conversations yet')).toBeVisible();
  await page
    .getByTestId('dwaion-archive')
    .getByRole('button', { name: 'New conversation', exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(/\/dwaion\/new$/);
});

for (const [width, locale, dark, scale] of [
  [1440, 'ko', false, 1],
  [1280, 'en', false, 1],
  [390, 'ko', false, 1],
  [320, 'en', false, 1],
  [640, 'en', false, 2],
  [1440, 'en', true, 1],
] as const) {
  test(`studio and archive visual reflow ${width} ${locale} ${dark ? 'dark' : 'light'} ${scale}x`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await fixture(page, { locale, dark });
    for (const route of ['new', 'conversations']) {
      await page.goto(`/dwaion/${route}`);
      const surface = page.getByTestId(route === 'new' ? 'dwaion-studio' : 'dwaion-archive');
      await expect(surface).toBeVisible();
      if (route === 'conversations')
        await expect(page.getByTestId('dwaion-archive-row')).toHaveCount(3);
      else
        await expect(page.getByTestId('dwaion-studio-rail').getByRole('checkbox')).toHaveCount(3);
      if (scale === 2) await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
      ).toBe(true);
      const violations = (
        await new AxeBuilder({ page })
          .include(
            route === 'new' ? '[data-testid="dwaion-studio"]' : '[data-testid="dwaion-archive"]'
          )
          .analyze()
      ).violations;
      expect(
        violations.filter((entry) => ['serious', 'critical'].includes(entry.impact ?? ''))
      ).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(`${route}-${width}-${locale}-${scale}x.png`),
        fullPage: true,
      });
    }
  });
}

test('forced colors keeps studio and archive actions available', async ({ page }, testInfo) => {
  await fixture(page);
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  for (const route of ['new', 'conversations']) {
    await page.goto(`/dwaion/${route}`);
    const surface = page.getByTestId(route === 'new' ? 'dwaion-studio' : 'dwaion-archive');
    await expect(
      surface.getByRole('button', { name: 'New conversation', exact: true }).first()
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`${route}-forced-colors.png`),
      fullPage: true,
    });
  }
});
