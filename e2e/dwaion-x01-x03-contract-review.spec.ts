import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import {
  DWAION_PERSONAL_PERMISSIONS,
  mockDwaionPersonalIntelligence,
} from './support/dwaion-personal-intelligence-fixtures';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

const SURFACES = [
  {
    id: 'X01-routines',
    path: '/dwaion/routines',
    heading: '나의 AI 루틴',
    contractText: '예약 엔진 미연결',
  },
  {
    id: 'X02-controls',
    path: '/dwaion/personal-controls',
    heading: '나의 AI 제어',
    contractText: '현재 버전은 삭제 요청 접수까지만 지원합니다.',
  },
  {
    id: 'X03-artifacts',
    path: '/dwaion/artifacts',
    heading: '결과물 스튜디오',
    contractText: '서버는 제목·본문·출처 참조만 저장합니다.',
  },
] as const;

async function prepare(page: Page, path: string, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.clock.setFixedTime(new Date('2026-09-04T00:05:00Z'));
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce', forcedColors: 'none' });
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
  await mockDwaionPersonalIntelligence(page, { locale: 'ko' });
  await page.goto(path);
  await expect(page.locator('#dwp-main-content .MuiSkeleton-root')).toHaveCount(0);
}

for (const viewport of [
  { name: '1440', width: 1440, height: 1000 },
  { name: '390', width: 390, height: 844 },
  { name: '1280', width: 1280, height: 1000 },
  { name: '320', width: 320, height: 844 },
] as const) {
  for (const surface of SURFACES) {
    test(`${surface.id} exposes honest contracts and Stitch hierarchy at ${viewport.name}`, async ({
      page,
    }, testInfo: TestInfo) => {
      await prepare(page, surface.path, viewport);
      await expect(page.getByRole('heading', { name: surface.heading })).toBeVisible();
      await expect(page.getByText(surface.contractText, { exact: false }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        viewport.width
      );

      if (surface.id === 'X01-routines') {
        await expect(page.getByText('알림 전달 미지원').first()).toBeVisible();
        await expect(page.getByRole('button', { name: /아침 우선순위 검토/ })).toBeVisible();
      }
      if (surface.id === 'X02-controls') {
        await expect(page.getByRole('heading', { name: '보안 경계 증거' })).toBeVisible();
        await expect(page.getByText('완료 주장 권한 없음')).toBeVisible();
      }
      if (surface.id === 'X03-artifacts') {
        await expect(page.getByRole('heading', { name: '문서 검토 구조' })).toBeVisible();
        await expect(page.getByText('위험 레코드 API 미제공')).toBeVisible();
        await expect(page.getByText('실행 항목 API 미제공 · 업무 생성 0건')).toBeVisible();
      }

      const violations = (
        await new AxeBuilder({ page }).include('#dwp-main-content').analyze()
      ).violations.filter((entry) => ['critical', 'serious'].includes(entry.impact ?? ''));
      expect(violations).toEqual([]);

      await page.screenshot({
        path: testInfo.outputPath(`${surface.id}-${viewport.name}-ko.png`),
        fullPage: true,
        animations: 'disabled',
        caret: 'hide',
      });
    });
  }
}

for (const scenario of [
  {
    name: 'empty',
    status: 200,
    body: { success: true, data: [] },
    expected: '아직 만든 루틴이 없습니다',
  },
  {
    name: 'error',
    status: 503,
    body: { detail: 'Routine service unavailable.' },
    expected: '루틴을 불러오지 못했습니다',
  },
  {
    name: '403',
    status: 403,
    body: { detail: 'Routine access denied.' },
    expected: '루틴을 볼 권한이 없습니다',
  },
] as const) {
  test(`X01-routines keeps ${scenario.name} distinct from live routine records`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockShellSession(page, ['WORKSPACE_MEMBER'], {
      locale: 'ko',
      displayName: '김민아',
      permissions: [...FULL_PRODUCT_PERMISSIONS, ...DWAION_PERSONAL_PERMISSIONS],
    });
    await mockDwaionPersonalIntelligence(page, { locale: 'ko' });
    await page.route(
      (url) => url.pathname === '/api/agent/v1/routines',
      (route) =>
        route.fulfill({
          status: scenario.status,
          contentType: 'application/json',
          body: JSON.stringify(scenario.body),
        })
    );

    await page.goto('/dwaion/routines');
    await expect(page.getByText(scenario.expected, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /아침 우선순위 검토/ })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
  });
}
