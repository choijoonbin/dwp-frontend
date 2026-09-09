import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type { DwaionConversation, DwaionConversationSummary } from '@dwp-frontend/shared-utils';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';
import { ASK_RUNTIME_FIXTURE, WORKSPACE_QUEUE_FIXTURE } from './support/runtime-access';

async function fixture(
  page: Page,
  options: { width?: number; locale?: 'ko' | 'en'; dark?: boolean } = {}
) {
  await page.setViewportSize({ width: options.width ?? 1440, height: 900 });
  await page.clock.setFixedTime(new Date('2026-09-08T09:00:00Z'));
  await page.emulateMedia({
    reducedMotion: 'reduce',
    colorScheme: options.dark ? 'dark' : 'light',
  });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: options.locale ?? 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: options.dark ? 'dark' : 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  let items: DwaionConversationSummary[] = Array.from({ length: 18 }, (_, index) => ({
    conversationId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    title: `${index % 2 ? 'Customer' : 'Project'} review ${String(index + 1).padStart(2, '0')}`,
    locale: 'en',
    messageCount: index + 1,
    agentKey: 'DWP_ASSISTANT',
    sourceSystems: index % 2 ? ['Microsoft Outlook'] : ['Work item'],
    evidenceCount: 1,
    summaryExcerpt: `Verified summary for review ${String(index + 1).padStart(2, '0')}`,
    lastAnswerStatus: 'COMPLETED',
    retentionUntil: null,
    legalHold: false,
    createdAt: '2026-09-07T01:00:00Z',
    updatedAt: '2026-09-07T01:00:00Z',
    lastMessageAt: '2026-09-07T01:00:00Z',
  }));
  let renameStatus = 200;
  const renames: Array<{ id: string; title: string }> = [];
  await page.route('**/api/agent/v1/conversations', (route) =>
    route.fulfill({ json: { success: true, data: items } })
  );
  await page.route('**/api/agent/v1/conversations/*', (route) => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1) ?? '';
    const current = items.find((item) => item.conversationId === id);
    if (!current) return route.fulfill({ status: 404, json: { detail: 'Missing' } });
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as { title: string };
      renames.push({ id, title: body.title });
      if (renameStatus !== 200)
        return route.fulfill({
          status: renameStatus,
          json: { detail: 'Rename unavailable' },
        });
      items = items.map((item) =>
        item.conversationId === id
          ? { ...item, title: body.title, updatedAt: '2026-09-08T09:00:00Z' }
          : item
      );
    }
    const result: DwaionConversation = {
      summary: items.find((item) => item.conversationId === id)!,
      messages: [
        {
          messageId: 'question-1',
          role: 'USER',
          content: 'Saved question for this conversation',
          citations: [],
          runId: null,
          statusCode: null,
          createdAt: '2026-09-07T01:00:00Z',
        },
      ],
    };
    return route.fulfill({ json: { success: true, data: result } });
  });
  await page.route('**/api/platform/v1/workspace/work-items', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          ...WORKSPACE_QUEUE_FIXTURE,
          items: WORKSPACE_QUEUE_FIXTURE.items.map((item) => ({
            ...item,
            dueAt: '2026-09-09T04:00:00Z',
          })),
        },
      },
    })
  );
  await page.route('**/api/agent/v1/actions', (route) =>
    route.fulfill({ json: { success: true, data: [] } })
  );
  return {
    renames,
    setRenameStatus: (status: number) => {
      renameStatus = status;
    },
  };
}

async function openRename(page: Page) {
  const trigger = page.getByTestId('dwaion-archive-row').first().getByRole('button');
  await trigger.click();
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  return {
    trigger,
    dialog: page.getByRole('dialog', {
      name: 'Rename conversation',
      exact: true,
    }),
  };
}

test('rename uses the real PATCH contract, preserves failed edits, and saves with Enter', async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto('/dwaion/conversations');
  const { dialog, trigger } = await openRename(page);
  const title = dialog.getByRole('textbox', {
    name: 'Conversation title',
    exact: true,
  });
  const draft = 'Customer review with the delivery team';
  await title.fill(draft);
  state.setRenameStatus(503);
  await title.press('Enter');
  await expect(dialog.getByRole('alert')).toContainText('Your title is still here');
  await expect(title).toHaveValue(draft);
  await expect(page.getByTestId('dwaion-archive-row').first()).not.toContainText(draft);
  state.setRenameStatus(200);
  await title.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('dwaion-archive-row').first()).toContainText(draft);
  await expect(trigger).toBeFocused();
  expect(state.renames).toEqual([
    { id: '00000000-0000-4000-8000-000000000001', title: draft },
    { id: '00000000-0000-4000-8000-000000000001', title: draft },
  ]);
});

for (const status of [403, 404, 409]) {
  test(`rename ${status} protects inaccessible data or retains a recoverable draft`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.setRenameStatus(status);
    await page.goto('/dwaion/conversations');
    const { dialog } = await openRename(page);
    const title = dialog.getByRole('textbox', { name: 'Conversation title' });
    await title.fill('Revised title');
    await title.press('Enter');
    await expect(dialog.getByRole('alert')).toBeVisible();
    const save = dialog.getByRole('button', { name: 'Save', exact: true });
    if (status === 409) {
      await expect(title).toHaveValue('Revised title');
      await expect(save).toBeEnabled();
    } else {
      await expect(title).toHaveCount(0);
      await expect(save).toBeDisabled();
    }
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(state.renames).toHaveLength(1);
  });
}

test('archive retains private filters, sorting and scroll on return without browser storage or URL search text', async ({
  page,
}) => {
  await fixture(page, { width: 390 });
  await page.goto('/dwaion/conversations');
  const archive = page.getByTestId('dwaion-archive');
  await archive.getByRole('textbox', { name: 'Search conversations' }).fill('Customer');
  await archive.getByRole('tab', { name: 'Past 7 days', exact: true }).click();
  await archive.getByRole('combobox', { name: 'Sort conversations' }).click();
  await page.getByRole('option', { name: 'Most messages', exact: true }).click();
  const row = archive.getByTestId('dwaion-archive-row').nth(5);
  await page.evaluate(() => window.scrollTo({ top: 1_000, behavior: 'instant' }));
  const scrolledPosition = await page.evaluate(() =>
    (document.getElementById('dwp-main-content')?.scrollHeight ?? 0) >
    (document.getElementById('dwp-main-content')?.clientHeight ?? 0) + 1
      ? (document.getElementById('dwp-main-content')?.scrollTop ?? 0)
      : window.scrollY
  );
  expect(scrolledPosition).toBeGreaterThan(300);
  let departureScroll = 0;
  await page.exposeFunction('recordArchiveDepartureScroll', (value: number) => {
    departureScroll = value;
  });
  // Locator clicks may scroll again. Record the user's actual departure before navigation.
  await row.getByRole('link').evaluate((link) => {
    link.addEventListener(
      'click',
      () => {
        const scrollTop =
          (document.getElementById('dwp-main-content')?.scrollHeight ?? 0) >
          (document.getElementById('dwp-main-content')?.clientHeight ?? 0) + 1
            ? (document.getElementById('dwp-main-content')?.scrollTop ?? 0)
            : window.scrollY;
        void (
          window as typeof window & {
            recordArchiveDepartureScroll: (value: number) => Promise<void>;
          }
        ).recordArchiveDepartureScroll(scrollTop);
      },
      { capture: true, once: true }
    );
  });
  await row.getByRole('link').click();
  await expect.poll(() => departureScroll).toBeGreaterThan(0);
  await expect(page.getByText('Saved question for this conversation')).toBeVisible();
  await page.goBack();
  await expect(archive.getByRole('textbox', { name: 'Search conversations' })).toHaveValue(
    'Customer'
  );
  await expect(archive.getByRole('tab', { name: 'Past 7 days', exact: true })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(archive.getByRole('combobox', { name: 'Sort conversations' })).toContainText(
    'Most messages'
  );
  await expect
    .poll(async () =>
      Math.abs(
        (await page.evaluate(() =>
          (document.getElementById('dwp-main-content')?.scrollHeight ?? 0) >
          (document.getElementById('dwp-main-content')?.clientHeight ?? 0) + 1
            ? (document.getElementById('dwp-main-content')?.scrollTop ?? 0)
            : window.scrollY
        )) - departureScroll
      )
    )
    .toBeLessThan(10);
  expect(new URL(page.url()).search).toBe('');
  expect(
    await page.evaluate(() =>
      JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
      }).includes('Customer')
    )
  ).toBe(false);
});

test('question limits retain oversized input and follow the server Unicode character contract', async ({
  page,
}) => {
  await fixture(page);
  let requests = 0;
  let query = '';
  await page.route('**/api/agent/v1/ask/stream', (route) => {
    requests += 1;
    query = route.request().postDataJSON().query;
    return route.fulfill({
      contentType: 'text/event-stream',
      body: `event: result\ndata: ${JSON.stringify({ data: ASK_RUNTIME_FIXTURE })}\n\n`,
    });
  });
  await page.goto('/dwaion/new');
  const input = page.getByRole('textbox', {
    name: 'Ask a work question',
    exact: true,
  });
  const send = page
    .getByTestId('dwaion-workspace-composer')
    .getByRole('button', { name: 'Send question', exact: true });
  await input.fill('x');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(send).toBeDisabled();
  const oversized = '🙂'.repeat(4001);
  await input.fill(oversized);
  await expect(input).toHaveValue(oversized);
  await expect(page.getByText(/4,001 \/ 4,000/)).toBeVisible();
  await input.press('Enter');
  expect(requests).toBe(0);
  await input.fill('🙂'.repeat(4000));
  await expect(send).toBeEnabled();
  await input.press('Enter');
  await expect.poll(() => requests).toBe(1);
  expect(Array.from(query)).toHaveLength(4000);
});

for (const view of [
  { width: 1440, name: 'desktop', locale: 'ko' },
  { width: 390, name: 'mobile', locale: 'ko' },
  { width: 320, name: 'small', locale: 'en' },
  { width: 1280, name: 'dark', locale: 'ko', dark: true },
  { width: 640, name: 'zoom', locale: 'en', zoom: true },
  { width: 390, name: 'forced', locale: 'ko', forced: true },
] as const) {
  test(`question controls and archive rename visual ${view.name}`, async ({ page }, testInfo) => {
    await fixture(page, view);
    if ('forced' in view) await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/dwaion/new');
    const composer = page.getByTestId('dwaion-workspace-composer');
    await expect(composer).toBeVisible();
    if ('zoom' in view)
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });
    await expect(page.locator('time[datetime="2026-09-09T04:00:00Z"]').first()).toBeVisible();
    const controls = await composer
      .locator('[aria-pressed]:visible')
      .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
    expect(controls.every((height) => height >= 44)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    expect(
      (
        await new AxeBuilder({ page })
          .include('[data-testid="dwaion-workspace-composer"]')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`studio-controls-${view.name}.png`),
      fullPage: true,
      animations: 'disabled',
    });
    await page.goto('/dwaion/conversations');
    if ('zoom' in view) {
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });
      await expect
        .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize))
        .toBe('32px');
    }
    await page.getByTestId('dwaion-archive-row').first().getByRole('button').click();
    await page
      .getByRole('menuitem', {
        name: view.locale === 'ko' ? '이름 변경' : 'Rename',
        exact: true,
      })
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('textbox')).toBeFocused();
    await dialog.getByRole('textbox').fill('제목 검토 / Review the title '.repeat(10));
    await expect(
      dialog.getByRole('button', {
        name: view.locale === 'ko' ? '저장' : 'Save',
        exact: true,
      })
    ).toBeDisabled();
    expect(
      (
        await new AxeBuilder({ page })
          .include('[role="dialog"]')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).toBeTruthy();
    expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(view.width);
    await page.screenshot({
      path: testInfo.outputPath(`archive-rename-${view.name}.png`),
      animations: 'disabled',
    });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });
}
