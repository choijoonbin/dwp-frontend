import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';

import {
  RECEIPT_CONVERSATION,
  RECEIPT_OWN_MESSAGE,
  mockMessagingReceipts,
} from './support/messaging-receipt-fixture';
import { fulfillSuccess } from './support/shell-session';
import { mockWorkHubFoundation } from './support/work-hub-foundation-fixtures';

const evidenceDirectory = path.resolve(
  process.cwd(),
  'docs/05-features/DWP-R1-WRK-001-unified-work-execution/implementation-evidence/2026-09-16-stitch-delta-closeout/screens/missing-reference-frames'
);
const reviewRef = 'IDENTITY_GOVERNANCE:f1111111-1111-4111-8111-111111111111:';
const reviewRoute = `/work/queue?work=${encodeURIComponent(reviewRef)}`;
const messageBody = 'Please review the launch plan.';
const sourceReference = {
  sourceSystem: 'MESSAGING_MESSAGE',
  sourceReference: RECEIPT_CONVERSATION,
  obligationKey: RECEIPT_OWN_MESSAGE,
};
const source = {
  availability: 'AVAILABLE' as const,
  reference: sourceReference,
  title: messageBody,
  sourceRoute: `/messages/inbox?conversation=${RECEIPT_CONVERSATION}&message=${RECEIPT_OWN_MESSAGE}`,
  status: 'MESSAGE',
  dueAt: null,
  channelName: 'Launch coordination',
  senderName: 'Mina Kim',
  receivedAt: '2026-08-19T08:30:00Z',
  excerpt: messageBody,
  sourceMessageId: RECEIPT_OWN_MESSAGE,
  sourceVersion: 1,
  sourceEditedAt: null,
};

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
  });
}

async function captureEvidence(
  page: Page,
  testInfo: TestInfo,
  fileName: string,
  expectedWidth: number
) {
  await mkdir(evidenceDirectory, { recursive: true });
  await settle(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, `${fileName} must not clip horizontally`).toBeLessThanOrEqual(1);
  const outputPath = path.join(evidenceDirectory, fileName);
  await page.screenshot({
    path: outputPath,
    fullPage: true,
    animations: 'disabled',
  });
  const png = await readFile(outputPath);
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  expect(width).toBe(expectedWidth);
  expect(height).toBeGreaterThanOrEqual(page.viewportSize()?.height ?? 1);
  console.log(
    JSON.stringify({ evidenceCapture: fileName, width, height, bytes: png.byteLength, overflow })
  );
  await testInfo.attach(fileName, { path: outputPath, contentType: 'image/png' });
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(90_000);

test('D02 desktop/mobile and M1 decision states use the governed access-review flow', async ({
  page,
}, testInfo) => {
  const runtime = await mockWorkHubFoundation(page, {
    locale: 'ko',
    designDetails: true,
    accessReview: true,
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(reviewRoute);
  await expect(page.getByRole('heading', { name: '접근 권한 검토', exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText('재경팀 · EMP-88219', { exact: true })).toBeVisible();
  await expect(page.getByText('REV-3', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '접근 유지', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '접근 회수', exact: true })).toBeVisible();
  await captureEvidence(page, testInfo, 'wrk-d02-1440.png', 1440);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(reviewRoute);
  const progress = page.getByRole('navigation', { name: '접근권한 검토 진행 단계' });
  await expect(progress).toBeVisible();
  for (const step of ['큐 선택', '상세 검토', '결정 제출', '결과 반영']) {
    await expect(progress.getByText(step, { exact: true })).toBeVisible();
  }
  await expect(page.getByText('검토 마감', { exact: true })).toBeVisible();
  await captureEvidence(page, testInfo, 'wrk-d02-390.png', 390);

  await page.getByRole('button', { name: '접근 회수', exact: true }).click();
  const reason = page.getByRole('textbox', { name: '결정 사유' });
  await reason.fill(
    '업무 역할 변경으로 재무 보고 시스템 접근이 더 이상 필요하지 않아 회수를 요청합니다.'
  );
  await expect(reason).toHaveAttribute('maxlength', '500');
  const preview = page.getByRole('button', { name: '결정 제출 내용 확인' });
  await expect(preview).toBeEnabled();
  await captureEvidence(page, testInfo, 'wrk-m1-390.png', 390);
  await preview.click();
  await expect(page.getByRole('dialog', { name: '이 접근 권한을 회수할까요?' })).toBeVisible();
  expect(runtime.sourceMutations).toEqual([]);
});

test('F01 captures a Messenger source, preflights it, and persists the exact link', async ({
  page,
}, testInfo) => {
  const permissions = ['VIEW', 'CREATE', 'UPDATE'].map((permissionCode) => ({
    resourceType: 'APP',
    resourceKey: 'APP.MESSAGING',
    permissionCode,
    effect: 'ALLOW' as const,
  }));
  const runtime = await mockWorkHubFoundation(page, {
    locale: 'ko',
    additionalPermissions: permissions,
  });
  await mockMessagingReceipts(page, 'ko', [], false);
  const preflights: unknown[] = [];
  await page.route(
    '**/api/platform/v1/workspace/work-hub/personal-tasks/source-preflight',
    async (route: Route) => {
      preflights.push(route.request().postDataJSON());
      await fulfillSuccess(route, source);
    }
  );

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/messages/inbox?conversation=${RECEIPT_CONVERSATION}`);
  await expect(page.getByRole('heading', { name: 'Launch coordination' })).toBeVisible();
  const row = page
    .getByRole('feed', { name: '메시지', exact: true })
    .getByText(messageBody, { exact: true })
    .locator('xpath=ancestor::*[.//button[@aria-label="반응 추가"]][1]');
  await row.hover();
  const directCapture = row.getByRole('button', { name: '개인 작업으로 추적' });
  if (await directCapture.isVisible()) await directCapture.click();
  else {
    await row.getByRole('button', { name: '메시지 작업 더보기' }).click();
    await page.getByRole('menuitem', { name: '개인 작업으로 추적' }).click();
  }
  await expect(page).toHaveURL(/\/work\/queue\?compose=task$/u);

  const dialog = page.getByRole('dialog', { name: '개인 할 일 추가' });
  await expect(dialog).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox?.width).toBeGreaterThanOrEqual(630);
  expect(dialogBox?.width).toBeLessThanOrEqual(650);
  await expect.poll(() => preflights.length).toBe(1);
  expect(preflights).toEqual([sourceReference]);
  const modes = dialog.getByRole('group', { name: '개인 할 일 작업 모드' });
  await expect(modes.getByRole('button', { name: 'A. 새 할 일 작성' })).toBeVisible();
  await expect(modes.getByRole('button', { name: 'B. 원문에서 추적' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(modes.getByRole('button', { name: 'C. 기존 할 일 수정' })).toBeDisabled();
  await expect(dialog.locator('ol[aria-label="개인 할 일 생성 진행 단계"]')).toHaveCount(0);
  await expect(dialog.getByText('캡처된 소스 · 사용 가능')).toBeVisible();
  await expect(dialog.getByText('Launch coordination', { exact: true })).toBeVisible();
  await expect(dialog.getByText(messageBody, { exact: true })).toBeVisible();
  expect(page.url()).not.toContain(RECEIPT_CONVERSATION);
  expect(page.url()).not.toContain(RECEIPT_OWN_MESSAGE);
  await captureEvidence(page, testInfo, 'wrk-f01-1440.png', 1440);

  await dialog
    .getByRole('textbox', { name: '제목', exact: true })
    .fill('Review captured launch plan');
  await dialog.getByRole('button', { name: '할 일 추가', exact: true }).click();
  await expect.poll(() => runtime.creations.length).toBe(1);
  expect(runtime.creations[0]?.body).toMatchObject({
    title: 'Review captured launch plan',
    priority: 'NORMAL',
    sourceReference,
  });
});

test('M2 empty queue exposes the four-step quick capture and exact scheduling handoff', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 });
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
  let planVersion = 0;
  await page.route('**/api/platform/v1/workspace/work-hub/day-plans/**', async (route) => {
    const date = new URL(route.request().url()).pathname.split('/').at(-1) ?? '';
    if (route.request().method() !== 'PUT') {
      return fulfillSuccess(route, { date, version: planVersion, items: [], updatedAt: null });
    }
    const body = route.request().postDataJSON() as {
      items: Array<{ sourceSystem: string; sourceReference: string }>;
    };
    planSaves.push({
      idempotencyKey: route.request().headers()['idempotency-key'],
      items: body.items,
    });
    planVersion += 1;
    return fulfillSuccess(route, {
      date,
      version: planVersion,
      items: body.items.map((reference, position) => ({
        position,
        selectionReference: reference,
        source: {
          availability: 'AVAILABLE',
          reference,
          title: '분기 고객 안내 초안 정리',
          status: 'OPEN',
          sourceRoute: `/work/queue?work=PERSONAL_TASK%3A${reference.sourceReference}%3A`,
          dueAt: null,
        },
      })),
      updatedAt: new Date().toISOString(),
    });
  });
  await page.goto('/work/queue');
  await expect(page.getByText('현재 확인된 업무가 없습니다', { exact: true })).toBeVisible({
    timeout: 20_000,
  });
  const heading = page.getByRole('heading', { name: '빠른 할 일 생성 (M2)' });
  await expect(heading).toBeVisible();
  const quickCapture = heading.locator('xpath=ancestor::section[1]');
  await expect(quickCapture.getByRole('listitem')).toHaveCount(4);
  await expect(quickCapture.locator('[aria-current="step"]')).toContainText('1. 빈 큐');
  const navigation = page.getByTestId('work-mobile-bottom-navigation');
  await expect(navigation.getByRole('button')).toHaveCount(5);
  await captureEvidence(page, testInfo, 'wrk-m2-320.png', 320);

  const title = quickCapture.getByRole('textbox', { name: '제목', exact: false });
  await title.fill('분기 고객 안내 초안 정리');
  await expect(quickCapture.locator('[aria-current="step"]')).toContainText('2. 추가');
  await expect(quickCapture.getByRole('checkbox', { name: '오늘 계획에 바로 추가' })).toBeChecked();
  await title.press('Tab');
  await expect(quickCapture.locator('[aria-current="step"]')).toContainText('3. 계획');
  await quickCapture.getByRole('button', { name: '할 일 저장', exact: true }).click();
  const schedule = page.getByRole('dialog', { name: '수행 시간 잡기' });
  await expect(schedule).toBeVisible({ timeout: 20_000 });
  await expect(schedule.getByRole('textbox', { name: '일정 제목', exact: true })).toHaveValue(
    '집중: 분기 고객 안내 초안 정리'
  );
  await expect.poll(() => runtime.creations.length).toBe(1);
  await expect.poll(() => planSaves.length).toBe(1);
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
