import { expect, test } from '@playwright/test';

import { fulfillSuccess } from './support/shell-session';
import { mockWorkHubFoundation } from './support/work-hub-foundation-fixtures';

for (const width of [320, 390]) {
  test(`M2 empty queue creates, plans, and opens exact scheduling at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    const runtime = await mockWorkHubFoundation(page, {
      locale: 'ko',
      designDetails: true,
      personal: false,
      sourceOwned: false,
    });
    const planSaves: Array<{
      idempotencyKey: string | undefined;
      items: Array<{ sourceSystem: string; sourceReference: string }>;
    }> = [];
    let savedPlan:
      | {
          date: string;
          version: number;
          items: Array<{
            position: number;
            selectionReference: { sourceSystem: string; sourceReference: string };
            source: {
              availability: 'AVAILABLE';
              reference: { sourceSystem: string; sourceReference: string };
              title: string;
              status: 'OPEN';
              sourceRoute: string;
              dueAt: null;
            };
          }>;
          updatedAt: string | null;
        }
      | undefined;
    await page.route('**/api/platform/v1/workspace/work-hub/day-plans/**', async (route) => {
      const request = route.request();
      const date = new URL(request.url()).pathname.split('/').at(-1) ?? '';
      if (request.method() === 'PUT') {
        const body = request.postDataJSON() as {
          version: number;
          items: Array<{ sourceSystem: string; sourceReference: string }>;
        };
        planSaves.push({
          idempotencyKey: request.headers()['idempotency-key'],
          items: body.items,
        });
        savedPlan = {
          date,
          version: body.version + 1,
          items: body.items.map((reference, position) => ({
            position,
            selectionReference: reference,
            source: {
              availability: 'AVAILABLE',
              reference,
              title: '분기 고객 안내 초안 정리 및 부서별 피드백 취합 검토',
              status: 'OPEN',
              sourceRoute: `/work/queue?work=PERSONAL_TASK%3A${reference.sourceReference}%3A`,
              dueAt: null,
            },
          })),
          updatedAt: new Date().toISOString(),
        };
      }
      return fulfillSuccess(route, savedPlan ?? { date, version: 0, items: [], updatedAt: null });
    });
    await page.goto('/work/queue');

    await expect(page.getByText('현재 확인된 업무가 없습니다', { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    const quickHeading = page.getByRole('heading', { name: '빠른 할 일 생성 (M2)' });
    await expect(quickHeading).toBeVisible();
    const quickCapture = quickHeading.locator('xpath=ancestor::section[1]');
    await expect(quickCapture.getByRole('listitem')).toHaveCount(4);
    await expect(quickCapture.locator('[aria-current="step"]')).toContainText('1. 빈 큐');

    const mobileNavigation = page.getByTestId('work-mobile-bottom-navigation');
    await expect(mobileNavigation.getByRole('button')).toHaveCount(5);
    for (const label of ['홈', '업무함', '캘린더', '알림', '프로필']) {
      await expect(
        mobileNavigation.getByRole('button', { name: label, exact: true })
      ).toBeVisible();
    }
    await expect(
      mobileNavigation.getByRole('button', { name: '업무함', exact: true })
    ).toHaveAttribute('aria-current', 'page');

    const title = quickCapture.getByRole('textbox', { name: '제목', exact: false });
    const taskTitle =
      width === 320 ? '고객'.repeat(250) : '분기 고객 안내 초안 정리 및 부서별 피드백 취합 검토';
    await expect(title).toHaveAttribute('maxlength', '500');
    await title.fill(taskTitle);
    await expect(quickCapture.locator('[aria-current="step"]')).toContainText('2. 추가');
    const todayPlan = quickCapture.getByRole('checkbox', { name: '오늘 계획에 바로 추가' });
    await expect(todayPlan).toBeChecked();
    await expect(quickCapture.getByRole('checkbox')).toHaveCount(1);
    await expect(
      quickCapture.getByRole('status', { name: '수행 시간 잡기 / Calendar 연동' })
    ).toContainText('자동 연결 준비');
    await page.keyboard.press('Tab');
    await expect(quickCapture.locator('[aria-current="step"]')).toContainText('3. 계획');

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    ).toBeLessThanOrEqual(1);
    for (const control of await quickCapture.getByRole('button').all()) {
      const box = await control.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({
      path: testInfo.outputPath(`m2-empty-quick-${width}.png`),
      fullPage: true,
    });

    await page.setViewportSize({ width, height: 440 });
    await title.focus();
    const save = quickCapture.getByRole('button', { name: '할 일 저장', exact: true });
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(save).toBeFocused();
    await expect
      .poll(async () => {
        const [saveBox, navigationBox] = await Promise.all([
          save.boundingBox(),
          mobileNavigation.boundingBox(),
        ]);
        return Boolean(saveBox && navigationBox && saveBox.y + saveBox.height <= navigationBox.y);
      })
      .toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`m2-keyboard-reflow-${width}.png`),
      fullPage: false,
    });
    await save.click();

    const scheduleDialog = page.getByRole('dialog', { name: '수행 시간 잡기' });
    await expect(scheduleDialog).toBeVisible({
      timeout: 20_000,
    });
    const calendarTitle = scheduleDialog.getByRole('textbox', { name: '일정 제목', exact: true });
    await expect(calendarTitle).toBeVisible();
    const calendarTitleValue = await calendarTitle.inputValue();
    expect(calendarTitleValue).toMatch(/^집중: /u);
    expect(Array.from(calendarTitleValue).length).toBeLessThanOrEqual(300);
    await expect(page).toHaveURL(/work=PERSONAL_TASK%3Ab3333333-3333-4333-8333-333333333333%3A/u);
    expect(runtime.creations).toHaveLength(1);
    expect(runtime.creations[0]?.body).toMatchObject({
      title: taskTitle,
      priority: 'NORMAL',
    });
    expect(runtime.creations[0]?.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
    );
    expect(planSaves).toHaveLength(1);
    expect(planSaves[0]?.items).toEqual([
      {
        sourceSystem: 'PERSONAL_TASK',
        sourceReference: 'b3333333-3333-4333-8333-333333333333',
      },
    ]);
    expect(planSaves[0]?.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
    );
    expect(runtime.calendarCommands).toHaveLength(0);
  });
}

test('M2 five-tab navigation opens granted product routes and disables unavailable apps', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await mockWorkHubFoundation(page, {
    locale: 'ko',
    designDetails: true,
    personal: false,
    sourceOwned: false,
  });

  for (const [label, path] of [
    ['홈', '/'],
    ['업무함', '/work/queue'],
    ['캘린더', '/calendar/home'],
    ['프로필', '/account/profile'],
  ] as const) {
    await page.goto('/work/queue');
    const navigation = page.getByTestId('work-mobile-bottom-navigation');
    await expect(navigation).toBeVisible({ timeout: 20_000 });
    await navigation.getByRole('button', { name: label, exact: true }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(path);
  }
  await page.goto('/work/queue');
  await expect(
    page
      .getByTestId('work-mobile-bottom-navigation')
      .getByRole('button', { name: '알림', exact: true })
  ).toBeDisabled();
});

test('M2 quick capture reflows at 200% zoom in dark high-contrast mode', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 640, height: 900 });
  await mockWorkHubFoundation(page, {
    locale: 'ko',
    designDetails: true,
    personal: false,
    sourceOwned: false,
    mode: 'dark',
    highContrast: true,
  });
  await page.emulateMedia({
    colorScheme: 'dark',
    forcedColors: 'active',
    reducedMotion: 'reduce',
  });
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.zoom = '2';
    });
  });
  await page.goto('/work/queue');
  const quickHeading = page.getByRole('heading', { name: '빠른 할 일 생성 (M2)' });
  await expect(quickHeading).toBeVisible({ timeout: 20_000 });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );

  const quickCapture = quickHeading.locator('xpath=ancestor::section[1]');
  await expect(quickCapture.getByRole('listitem')).toHaveCount(4);
  const title = quickCapture.getByRole('textbox', { name: '제목', exact: false });
  for (let index = 0; index < 40; index += 1) {
    await page.keyboard.press('Tab');
    if (await title.evaluate((element) => element === document.activeElement)) break;
  }
  await expect(title).toBeFocused();
  expect(await title.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
  await title.fill(
    '분기 고객 안내 초안과 부서별 피드백을 취합하고 영어 안내 문구까지 검토하는 긴 개인 할 일'
  );
  await expect(quickCapture.getByRole('checkbox', { name: '오늘 계획에 바로 추가' })).toBeChecked();
  await expect(quickCapture.getByRole('checkbox')).toHaveCount(1);
  await expect(
    quickCapture.getByRole('status', { name: '수행 시간 잡기 / Calendar 연동' })
  ).toContainText('자동 연결 준비');
  const save = quickCapture.getByRole('button', { name: '할 일 저장', exact: true });
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(save).toBeFocused();
  const [saveBox, navigationBox] = await Promise.all([
    save.boundingBox(),
    page.getByTestId('work-mobile-bottom-navigation').boundingBox(),
  ]);
  expect(saveBox && navigationBox && saveBox.y + saveBox.height <= navigationBox.y).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: testInfo.outputPath('m2-quick-200-dark-high-contrast.png'),
    fullPage: true,
  });
});
