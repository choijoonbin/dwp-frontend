import { expect, test } from '@playwright/test';

import { mockApprovedAdmin } from './support/meeting-approved-frame-evidence-fixtures';
import { expandMeetingPolicySection } from './support/video-meeting-admin-policy';
import {
  mockMeetingVisualAdminReadiness,
  mockMeetingVisualSession,
} from './support/video-meeting-visual-fixtures';
import {
  expectNoBlockingA11y,
  expectNoHorizontalOverflow,
} from './support/video-meeting-visual-accessibility';

import type { Page } from '@playwright/test';

const screens = [
  { id: 'U13', path: 'operations', title: '회의 운영 관리' },
  { id: 'U14', path: 'policies', title: '회의 정책 관리' },
  { id: 'U15', path: 'intelligence', title: 'AI 및 데이터 거버넌스' },
] as const;

async function ready(page: Page) {
  await expect(
    page.getByRole('progressbar', { name: /Loading page|페이지 불러오는 중/u })
  ).toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator('#dwp-main-content')).toBeVisible();
  await expect(page.locator('#dwp-main-content .MuiSkeleton-root')).toHaveCount(0);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

for (const screen of screens) {
  test(`${screen.id} controls stay accessible at 320px and 200 percent text`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'The test owns explicit viewport dimensions.');
    await page.setViewportSize({ width: 320, height: 720 });
    await mockApprovedAdmin(page, screen.id === 'U13');
    await page.goto(`/meetings/admin/${screen.path}`);
    await ready(page);
    await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
    await expectNoHorizontalOverflow(page, `${screen.id} 320 at 200 percent text`);
    await expectNoBlockingA11y(page, `${screen.id} 320 at 200 percent text`);
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    await expectNoHorizontalOverflow(page, `${screen.id} forced colors`);
    await expectNoBlockingA11y(page, `${screen.id} forced colors`);
  });
  for (const width of [1440, 1280, 390, 320]) {
    test(`${screen.id} approved content and interactions remain exposed at ${width}px`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== 'chromium',
        'The test owns explicit viewport dimensions.'
      );
      await page.setViewportSize({ width, height: 960 });
      await mockApprovedAdmin(page, screen.id === 'U13');
      await page.goto(`/meetings/admin/${screen.path}`);
      await ready(page);
      if (screen.id === 'U13') {
        await expect(page.locator('[data-testid^="meeting-admin-service-"]')).toHaveCount(5);
        await expect(page.getByTestId('meeting-admin-telemetry-inspector')).toBeVisible();
        await expect(
          page
            .getByTestId('meeting-admin-telemetry-inspector')
            .getByText('측정 전', { exact: true })
        ).toHaveCount(3);
        await expect(
          page.getByRole('button', { name: '네트워크 엣지 페일오버', exact: true })
        ).toBeDisabled();
        await expect(page.getByTestId('meeting-admin-mobile-signal')).toBeVisible({
          visible: width < 900,
        });
      } else if (screen.id === 'U14') {
        await expect(page.locator('details[role="region"]')).toHaveCount(8);
        for (const title of [
          '접근 및 대기실',
          '녹화 및 AI',
          'AI 회의록 분석 데이터 거버넌스',
          '보존 정책',
        ]) {
          const section = page.getByRole('region', { name: title, exact: true });
          if (width < 900 && title !== '접근 및 대기실')
            await expect(section).not.toHaveAttribute('open');
          await expandMeetingPolicySection(page, title);
          await expect(section).toHaveAttribute('open', '');
          if (width < 900)
            await expect(
              page
                .locator('details[id^="meeting-policy-section-0"][open]')
                .filter({ has: page.locator('h2') })
            ).toHaveCount(1);
          if (title === 'AI 회의록 분석 데이터 거버넌스')
            await expect(
              page.getByText('개인정보 마스킹 및 필터링', { exact: true })
            ).toBeVisible();
          if (title === '접근 및 대기실')
            await expect(
              page.getByText('호스트 부재 시 자동 종료 제한', { exact: true })
            ).toBeVisible();
        }
        for (const title of [
          '회의 중 협업',
          '수용 인원 및 한도',
          '조직 공용 회의 템플릿 배포 권한',
          '정책 제한 및 사용할 수 없는 제어',
        ]) {
          const region = page.getByRole('region', { name: title, exact: true });
          if (width < 900) await expect(region).not.toHaveAttribute('open');
          await expandMeetingPolicySection(page, title);
        }
        await expect(page.locator('details[open][role="region"]')).toHaveCount(width < 900 ? 5 : 8);
        await expect(page.getByText('조직 공용 템플릿 승인', { exact: true })).toBeVisible();
        await expandMeetingPolicySection(page, '접근 및 대기실');
        await expect(page.getByText('외부 게스트 도메인 허용 목록', { exact: true })).toBeVisible();
        await expect(
          page.getByText('호스트 부재 시 자동 종료 제한', { exact: true })
        ).toBeVisible();
        await expandMeetingPolicySection(page, '녹화 및 AI');
        await expect(page.getByText('참가자 녹화 동의 정책', { exact: true })).toBeVisible();
        await expect(page.getByText('녹화 중 고지 및 워터마크', { exact: true })).toBeVisible();
        await expect(page.getByTestId('meeting-admin-policy-savebar')).toBeVisible({
          visible: width < 900,
        });
      } else {
        await expect(page.locator('ol > li').filter({ has: page.locator('h3') })).toHaveCount(7);
        await expect(page.getByTestId('meeting-admin-destruction-ledger')).toBeVisible();
        await expect(page.getByTestId('meeting-admin-governance-actions')).toBeVisible();
        await expect(
          page.getByRole('button', { name: '만료 키 즉시 파기', exact: true, includeHidden: true })
        ).toBeDisabled();
        await expect(
          page.getByRole('button', {
            name: 'AI 파이프라인 긴급 차단',
            exact: true,
            includeHidden: true,
          })
        ).toBeDisabled();
      }
      await expectNoHorizontalOverflow(page, `${screen.id} ${width}`);
      await expectNoBlockingA11y(page, `${screen.id} ${width}`);
      await page.screenshot({
        path: testInfo.outputPath(`${screen.id}-${width}.png`),
        fullPage: true,
      });
    });
  }
}

test('U13 service attention filter updates the service matrix without hiding incident detail', async ({
  page,
}) => {
  await mockApprovedAdmin(page, true);
  await page.goto('/meetings/admin/operations');
  await ready(page);
  await page.getByRole('button', { name: '확인 필요 서비스만', exact: true }).click();
  await expect(page.getByTestId('meeting-admin-service-media')).toHaveCount(0);
  await expect(page.getByTestId('meeting-admin-service-recording')).toBeVisible();
  await expect(page.getByTestId('meeting-admin-telemetry-inspector')).toBeVisible();
  await page.getByRole('button', { name: '전체 서비스 표시', exact: true }).click();
  await expect(page.getByTestId('meeting-admin-service-media')).toBeVisible();
});

test('U15 chain refresh calls both authoritative queries and keeps destructive commands unavailable', async ({
  page,
}) => {
  await mockMeetingVisualSession(page, {
    locale: 'en',
    admin: true,
    colorScheme: 'dark',
    reducedMotion: true,
  });
  await mockMeetingVisualAdminReadiness(page, 'READY');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/meetings/admin/intelligence');
  await ready(page);
  const responses = Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/admin/intelligence/readiness')),
    page.waitForResponse((response) => response.url().endsWith('/admin/policy')),
  ]);
  await page.getByRole('button', { name: 'Refresh chain readiness', exact: true }).click();
  await responses;
  await expect(
    page.getByRole('button', { name: 'Destroy expired keys', exact: true, includeHidden: true })
  ).toBeDisabled();
  await expectNoHorizontalOverflow(page, 'U15 390 English dark');
  await expectNoBlockingA11y(page, 'U15 390 English dark');
});

for (const screen of screens.slice(0, 2)) {
  test(`${screen.id} English dark controls remain readable with partial readiness failure`, async ({
    page,
  }) => {
    await mockMeetingVisualSession(page, { locale: 'en', admin: true, colorScheme: 'dark' });
    await mockMeetingVisualAdminReadiness(page, 'BLOCKED');
    await page.route('**/api/meetings/v1/admin/overview?*', (route) =>
      route.fulfill({
        json: {
          status: 'SUCCESS',
          success: true,
          message: 'OK',
          data: {
            liveMeetings: 2,
            scheduledToday: 7,
            waitingParticipants: 3,
            meetingsLastSevenDays: 42,
            averageQualityScore: null,
            failedJoinAttempts: 4,
            capabilities: {
              video: true,
              screenShare: true,
              chat: true,
              captions: false,
              recordingConfigured: false,
              transcriptConfigured: false,
              aiNotesConfigured: false,
            },
          },
        },
      })
    );
    await page.route('**/api/meetings/v1/admin/intelligence/readiness', (route) =>
      route.fulfill({
        status: 503,
        json: { status: 'ERROR', success: false, message: 'Unavailable' },
      })
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/meetings/admin/${screen.path}`);
    await ready(page);
    if (screen.id === 'U13') {
      await expect(page.getByTestId('meeting-admin-mobile-signal')).toBeVisible();
      await expect(page.getByTestId('meeting-admin-service-media')).toBeVisible();
    } else {
      await expect(
        page.getByText('External guest domain allowlist', { exact: true })
      ).toBeVisible();
      await expect(page.locator('details[open][role="region"]')).toHaveCount(1);
      for (const title of [
        'In-meeting collaboration',
        'Capacity and limits',
        'Organization meeting template distribution',
        'Policy limits and unavailable controls',
      ]) {
        await expandMeetingPolicySection(page, title);
      }
      await expect(page.locator('details[open][role="region"]')).toHaveCount(5);
    }
    await expectNoHorizontalOverflow(page, `${screen.id} 390 English dark with partial failure`);
    await expectNoBlockingA11y(page, `${screen.id} 390 English dark with partial failure`);
  });
}
