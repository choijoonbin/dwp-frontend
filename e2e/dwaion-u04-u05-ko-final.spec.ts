import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Download, type Page } from '@playwright/test';

import {
  DWAION_PERSONAL_PERMISSIONS,
  mockDwaionPersonalIntelligence,
} from './support/dwaion-personal-intelligence-fixtures';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

const OUTPUT = join(process.cwd(), 'output', 'dwaion-frontend-final-pass-20260917');

test.beforeAll(() => mkdirSync(OUTPUT, { recursive: true }));

for (const viewport of [
  { width: 1440, height: 1000, label: '1440' },
  { width: 390, height: 844, label: '390' },
] as const) {
  test(`U04 한국어 협업·검토 화면 최종 증빙 ${viewport.label}`, async ({ page }) => {
    await prepare(page, viewport);
    await mockDwaionPersonalIntelligence(page, { locale: 'ko' });
    await page.goto('/dwaion/artifacts');

    await expect(page.getByRole('heading', { name: '결과물 스튜디오' })).toBeVisible();
    await expect(page.getByRole('region', { name: '출시 준비 계획' })).toBeVisible();
    const governance = page.getByTestId('artifact-governance-review');
    await expect(governance).toContainText('검토 역할과 승인 경계');
    await expect(governance).toContainText('4대 거버넌스 게이트');
    for (const label of ['DLP', '출처 검증', '수신자 ACL', '불변 버전']) {
      await expect(governance).toContainText(label);
    }
    await expect(governance).toContainText('WORM 감사 서명');
    const decision = viewport.width === 1440 ? '단계 승인' : '단계 반려';
    const state = viewport.width === 1440 ? '승인' : '반려';
    await governance.getByRole('button', { name: decision, exact: true }).click();
    await expect(governance.getByText(state, { exact: true })).toBeVisible();
    await expect(
      page.getByText('환율 스트레스 테스트의 기준 시점을 다시 확인해 주세요.')
    ).toBeVisible();

    await verifySurface(page);
    await capture(page, `U04-ko-governed-collaboration-${viewport.label}.png`);
  });

  test(`U05 한국어 메모리·삭제 증거 화면 최종 증빙 ${viewport.label}`, async ({ page }) => {
    await prepare(page, viewport);
    await mockDwaionPersonalIntelligence(page, { locale: 'ko' });
    await page.goto('/dwaion/personal-controls');

    await expect(page.getByRole('heading', { name: '나의 AI 제어' })).toBeVisible();
    await expect(page.getByRole('tablist', { name: '메모리 분류' })).toBeVisible();
    const detail = page.getByTestId('dwaion-selected-memory-detail');
    await expect(detail).toContainText('USER_EXPLICIT_ENTRY');
    await expect(detail).toContainText('적용 횟수');
    await expect(detail).toContainText('AWS_KMS');
    await expect(detail).toContainText('검증 팩트 벡터 및 신뢰도');

    const history = page.getByTestId('dwaion-deletion-history');
    await expect(history).toContainText('삭제 처리 5단계');
    const receiptIndexButton = history.getByRole('button', {
      name: '현재 서버 삭제 이력 스냅샷 (JSON)',
      exact: true,
    });
    await expect(receiptIndexButton).toBeEnabled();
    const downloadEvent = page.waitForEvent('download');
    await receiptIndexButton.click();
    const receiptIndex = await downloadEvent;
    expect(receiptIndex.suggestedFilename()).toBe('dwaion-deletion-receipts.json');
    expect(await readDownloadedJson(receiptIndex)).toMatchObject({
      schemaVersion: 1,
      deletionJobs: [
        expect.objectContaining({
          deletionJobId: '66666666-6666-4666-8666-666666666666',
          state: 'COMPLETED',
        }),
      ],
    });

    await verifySurface(page);
    await capture(page, `U05-ko-memory-deletion-evidence-${viewport.label}.png`);
  });
}

async function prepare(page: Page, viewport: { readonly width: number; readonly height: number }) {
  await page.setViewportSize(viewport);
  await page.clock.setFixedTime(new Date('2026-09-17T03:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    displayName: '김민아',
    permissions: [...FULL_PRODUCT_PERMISSIONS, ...DWAION_PERSONAL_PERMISSIONS],
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  await page.route('**/api/platform/v1/workspace/work-items**', (route) =>
    route.fulfill({ json: { success: true, data: [] } })
  );
  await page.route('**/api/platform/v1/observability/web-vitals', (route) =>
    route.fulfill({ status: 202, json: { success: true } })
  );
}

async function readDownloadedJson(download: Download): Promise<unknown> {
  const path = await download.path();
  if (!path) throw new Error('Playwright did not retain the downloaded evidence file.');
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

async function verifySurface(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth + 1)
  );
  const audit = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    audit.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))
  ).toEqual([]);
}

async function capture(page: Page, fileName: string) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.mouse.move(0, 0);
  await page.screenshot({
    path: join(OUTPUT, fileName),
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
  });
}
