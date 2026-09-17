import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import {
  NOTIFICATION_ADMIN_PERMISSIONS,
  NOTIFICATION_PERMISSION,
  expectNoHorizontalOverflow,
  fulfillSuccess,
  mockNotificationAdminOverview,
  mockNotificationAttentionR2,
  mockNotificationCenter,
  mockNotificationPreferences,
} from './support/notification-fixtures';
import { mockShellSession } from './support/shell-session';

const VISUAL_ATTENTION_RULES = [
  {
    ruleId: 'visual-vip',
    scopeKind: 'ACTOR',
    scopeKey: 'user:kim-minseo',
    displayLabel: '김민서 수석',
    effect: 'PRIORITIZE',
    channels: { IN_APP: true, MOBILE_PUSH: true },
    startsAt: null,
    expiresAt: null,
    source: 'USER',
    managed: false,
    exceptionAllowed: true,
    enabled: true,
    version: '1',
    createdAt: '2026-09-16T01:00:00Z',
    updatedAt: '2026-09-16T01:00:00Z',
  },
  {
    ruleId: 'visual-follow',
    scopeKind: 'THREAD',
    scopeKey: 'approval:dwp-2026-0891',
    displayLabel: '결재 DWP-2026-0891',
    effect: 'FOLLOW',
    channels: { IN_APP: true },
    startsAt: null,
    expiresAt: '2099-09-30T09:00:00Z',
    source: 'USER',
    managed: false,
    exceptionAllowed: true,
    enabled: true,
    version: '1',
    createdAt: '2026-09-16T01:00:00Z',
    updatedAt: '2026-09-16T01:00:00Z',
  },
  {
    ruleId: 'visual-mute',
    scopeKind: 'APP_TYPE',
    scopeKey: 'hr:HR_POLICY_UPDATE',
    displayLabel: 'HR 사내공지 일반 채널',
    effect: 'MUTE',
    channels: { IN_APP: true },
    startsAt: null,
    expiresAt: '2099-09-30T09:00:00Z',
    source: 'TENANT_POLICY',
    managed: true,
    exceptionAllowed: false,
    enabled: true,
    version: '1',
    createdAt: '2026-09-16T01:00:00Z',
    updatedAt: '2026-09-16T01:00:00Z',
  },
  {
    ruleId: 'visual-topic',
    scopeKind: 'TOPIC_TOKEN',
    scopeKey: 'infra-deploy',
    displayLabel: '#infra-deploy',
    effect: 'FOLLOW',
    channels: { IN_APP: true },
    startsAt: null,
    expiresAt: null,
    source: 'USER',
    managed: false,
    exceptionAllowed: true,
    enabled: true,
    version: '1',
    createdAt: '2026-09-16T01:00:00Z',
    updatedAt: '2026-09-16T01:00:00Z',
  },
] as const;

async function mockAttentionVisualRules(page: Page) {
  await page.route('**/api/notifications/v1/me/attention-rules**', (route) => {
    const request = route.request();
    if (
      request.method() === 'GET' &&
      new URL(request.url()).pathname.endsWith('/me/attention-rules')
    ) {
      return fulfillSuccess(route, { items: VISUAL_ATTENTION_RULES, maxActiveRules: 25 });
    }
    return route.fallback();
  });
}

async function openAttentionSettings(page: Page) {
  await page.goto('/notifications/settings');
  await page
    .getByRole('navigation', { name: '알림 설정 바로가기' })
    .getByRole('button', { name: '수신 집중 규칙' })
    .click();
  return page.getByTestId('notification-test-diagnostics');
}

async function mockActiveDiagnosticChannels(page: Page) {
  await page.route('**/api/notifications/v1/capabilities', (route) =>
    fulfillSuccess(route, {
      enabledChannels: ['IN_APP', 'WEB_PUSH', 'MOBILE_PUSH'],
      unavailableChannels: [],
      canonicalStore: 'POSTGRESQL',
      realtimeTransport: 'SSE_HINT_WITH_DURABLE_SYNC',
      externalDeliveryState: 'ENABLED',
      generatedAt: '2026-09-17T00:00:00Z',
    })
  );
  await page.route('**/api/notifications/v1/me/effective-settings', (route) =>
    fulfillSuccess(route, {
      partial: false,
      unavailableSources: [],
      globalChannels: Object.fromEntries(
        ['IN_APP', 'WEB_PUSH', 'MOBILE_PUSH'].map((channel) => [
          channel,
          {
            effectiveValue: true,
            source: 'USER',
            managed: false,
            exceptionAllowed: true,
          },
        ])
      ),
      apps: [],
      generatedAt: '2026-09-17T00:00:00Z',
    })
  );
  await page.route('**/api/notifications/v1/me/delivery-endpoints**', (route) =>
    fulfillSuccess(route, [
      {
        endpointId: 'web-active',
        channel: 'WEB_PUSH',
        displayName: '업무용 Chrome',
        platform: 'WEB',
        endpointHint: 'Chrome',
        state: 'ACTIVE',
        lastSeenAt: '2026-09-17T00:00:00Z',
        createdAt: '2026-09-16T00:00:00Z',
        version: '1',
      },
      {
        endpointId: 'mobile-active',
        channel: 'MOBILE_PUSH',
        displayName: '업무용 iPhone',
        platform: 'IOS',
        endpointHint: 'iOS',
        state: 'ACTIVE',
        lastSeenAt: '2026-09-17T00:00:00Z',
        createdAt: '2026-09-16T00:00:00Z',
        version: '1',
      },
    ])
  );
}

async function prepareAttentionSettings(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: NOTIFICATION_PERMISSION,
  });
  await mockNotificationCenter(page);
  await mockNotificationPreferences(page);
  await mockNotificationAttentionR2(page);
}

test('수신 집중 규칙은 서버 미리보기, 저장, 진단 흐름을 완결한다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop authoring is covered on Chromium.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: NOTIFICATION_PERMISSION,
  });
  await mockNotificationCenter(page);
  await mockNotificationPreferences(page);

  await page.goto('/notifications/settings');
  await page
    .getByRole('navigation', { name: '알림 설정 바로가기' })
    .getByRole('button', { name: '수신 집중 규칙' })
    .click();

  const dashboard = page.getByTestId('notification-attention-dashboard');
  await expect(dashboard.getByRole('heading', { name: '수신 집중 규칙' })).toBeVisible();
  await expect(dashboard.getByRole('heading', { name: '김민서', exact: true })).toBeVisible();
  await dashboard.getByRole('button', { name: '규칙 추가' }).click();

  const dialog = page.getByRole('dialog', { name: '수신 집중 규칙 추가' });
  await dialog.getByRole('combobox', { name: '앱 알림 유형', exact: true }).click();
  await page.getByRole('option', { name: /Approvals \/ Approval action required/ }).click();
  await dialog.getByRole('button', { name: '영향도 미리보기' }).click();
  await expect(
    dialog.getByText(
      '정책 검증을 통과했습니다. 개인정보 기준에 따라 예상 건수는 표시하지 않습니다.'
    )
  ).toBeVisible();

  const created = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().endsWith('/me/attention-rules')
  );
  await dialog.getByRole('button', { name: '저장' }).click();
  expect((await created).ok()).toBe(true);
  await expect(
    dashboard.getByRole('heading', {
      name: 'Approvals / Approval action required',
      exact: true,
    })
  ).toBeVisible();

  const diagnostic = page.getByTestId('notification-test-diagnostics');
  await expect(diagnostic.getByText('외부 Provider 운영 승인이 완료되지 않아')).toHaveCount(2);
  await expect(diagnostic.getByRole('checkbox', { name: /브라우저 푸시/ })).toBeDisabled();
  await expect(diagnostic.getByRole('checkbox', { name: /모바일 푸시/ })).toBeDisabled();
  const started = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().endsWith('/me/test-deliveries')
  );
  await diagnostic.getByRole('button', { name: '테스트 실행' }).click();
  const startedResponse = await started;
  expect(startedResponse.ok()).toBe(true);
  expect(startedResponse.request().postDataJSON()).toMatchObject({ channels: ['IN_APP'] });
  await expect(diagnostic.getByText('진단 완료', { exact: true }).first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(
    diagnostic.getByText('Provider 비활성', { exact: true }).filter({ visible: true }).first()
  ).toBeVisible();

  await expectNoHorizontalOverflow(page);
  const accessibility = await new AxeBuilder({ page })
    .include('[data-testid="notification-attention-dashboard"]')
    .include('[data-testid="notification-test-diagnostics"]')
    .analyze();
  expect(
    accessibility.violations.filter((violation) =>
      ['critical', 'serious'].includes(violation.impact ?? '')
    )
  ).toEqual([]);
});

test('알림 상세는 서버가 허용한 범위만 적용하고 정책 잠금을 보존한다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Context control is covered on Chromium.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: NOTIFICATION_PERMISSION,
  });
  await mockNotificationCenter(page);
  await mockNotificationPreferences(page);

  await page.goto('/notifications/center/notification-e2e-1?view=all');
  await page.getByText('앞으로 이런 알림을 받는 방식 조정', { exact: true }).click();

  const controls = page.getByTestId('notification-attention-controls');
  await expect(
    controls.getByText('김민서님이 회원님을 승인 담당자로 직접 지정했습니다.')
  ).toBeVisible();
  await expect(controls.getByText('정책 잠금', { exact: true })).toBeVisible();
  await expect(controls.getByRole('radio', { name: /필수 승인 요청/ })).toBeDisabled();
  const previewed = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/attention-controls/preview')
  );
  await controls.getByRole('button', { name: '영향도 미리보기' }).click();
  expect((await previewed).ok()).toBe(true);
  await expect(controls.getByText('예상 영향', { exact: true })).toBeVisible();

  const applied = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().endsWith('/attention-controls')
  );
  await controls.getByRole('button', { name: '제어 적용' }).click();
  const appliedResponse = await applied;
  expect(appliedResponse.ok()).toBe(true);
  expect(appliedResponse.request().postDataJSON()).toMatchObject({
    controlKey: 'FOLLOW_CONTEXT',
    effect: 'FOLLOW',
    previewFingerprint: 'a'.repeat(64),
  });
  await expect(page.getByText('수신 집중 제어를 적용했습니다.', { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('시험 알림은 실제 활성 브라우저·모바일 단말을 선택해 channels 배열로 전달한다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Channel diagnostics are covered on Chromium.');
  await prepareAttentionSettings(page);
  await mockActiveDiagnosticChannels(page);
  const diagnostic = await openAttentionSettings(page);

  await expect(diagnostic.getByText('업무용 Chrome')).toBeVisible();
  await expect(diagnostic.getByText('업무용 iPhone')).toBeVisible();
  await diagnostic.getByRole('checkbox', { name: /브라우저 푸시/ }).check();
  await diagnostic.getByRole('checkbox', { name: /모바일 푸시/ }).check();

  const started = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/me/test-deliveries')
  );
  await diagnostic.getByRole('button', { name: '테스트 실행' }).click();
  expect((await started).postDataJSON()).toMatchObject({
    channels: ['IN_APP', 'WEB_PUSH', 'MOBILE_PUSH'],
  });
});

for (const failure of [
  {
    status: 429,
    title: '시험 알림 실행 한도에 도달했습니다',
    message: 'Rate limited',
  },
  {
    status: 403,
    title: '시험 알림 실행 권한이 없습니다',
    message: 'Forbidden',
  },
] as const) {
  test(`시험 알림 ${failure.status} 실패는 성공처럼 보이지 않고 재시도할 수 있다`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Failure recovery is covered on Chromium.');
    await prepareAttentionSettings(page);
    let attempts = 0;
    await page.route('**/api/notifications/v1/me/test-deliveries**', (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      attempts += 1;
      return route.fulfill({
        status: failure.status,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', message: failure.message }),
      });
    });
    const diagnostic = await openAttentionSettings(page);

    await diagnostic.getByRole('button', { name: '테스트 실행' }).click();
    await expect(diagnostic.getByText(failure.title, { exact: true })).toBeVisible();
    await expect(diagnostic.getByRole('button', { name: '다시 시도' })).toBeEnabled();
    await diagnostic.getByRole('button', { name: '다시 시도' }).click();
    await expect.poll(() => attempts).toBe(2);
  });
}

test('오프라인 채널은 모두 차단하고 연결 복구 후 시험 알림을 다시 허용한다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Offline recovery is covered on Chromium.');
  await prepareAttentionSettings(page);
  const diagnostic = await openAttentionSettings(page);
  await expect(diagnostic.getByRole('button', { name: '테스트 실행' })).toBeEnabled();

  await page.context().setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(diagnostic.getByText('오프라인', { exact: true })).toHaveCount(3);
  await expect(diagnostic.getByRole('button', { name: '테스트 실행' })).toBeDisabled();

  await page.context().setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(diagnostic.getByText('사용 가능', { exact: true })).toHaveCount(1);
  await expect(diagnostic.getByRole('button', { name: '테스트 실행' })).toBeEnabled();
});

for (const viewport of [
  { name: 'desktop-1440', width: 1440, height: 960 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-320', width: 320, height: 780 },
  { name: 'zoom-200-equivalent', width: 720, height: 900 },
] as const) {
  test(`수신 집중 규칙은 ${viewport.name}에서 Stitch 정보 우선순위와 무오버플로를 유지한다`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Explicit Chromium visual evidence matrix.');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await mockShellSession(page, ['WORKSPACE_MEMBER'], {
      locale: 'ko',
      permissions: NOTIFICATION_PERMISSION,
    });
    await mockNotificationCenter(page);
    await mockNotificationPreferences(page);
    await mockNotificationAttentionR2(page);
    await mockAttentionVisualRules(page);

    await page.goto('/notifications/settings');
    await page
      .getByRole('navigation', { name: '알림 설정 바로가기' })
      .getByRole('button', { name: '수신 집중 규칙' })
      .click();

    const dashboard = page.getByTestId('notification-attention-dashboard');
    await expect(dashboard.getByRole('heading', { name: '중요한 사람' })).toBeVisible();
    await expect(dashboard.getByRole('heading', { name: '팔로우 중인 업무' })).toBeVisible();
    await expect(dashboard.getByRole('heading', { name: '음소거 범위' })).toBeVisible();
    await expect(dashboard.getByRole('heading', { name: '관리 주제' })).toBeVisible();
    await expect(
      page.getByTestId('notification-test-diagnostics').getByText('외부 Provider 운영 승인이')
    ).toHaveCount(2);
    await expectNoHorizontalOverflow(page);

    if (viewport.width === 1440 || viewport.width === 390) {
      const accessibility = await new AxeBuilder({ page })
        .include('[data-testid="notification-attention-dashboard"]')
        .include('[data-testid="notification-test-diagnostics"]')
        .analyze();
      expect(
        accessibility.violations.filter((violation) =>
          ['critical', 'serious'].includes(violation.impact ?? '')
        )
      ).toEqual([]);
    }

    await page.screenshot({
      path: testInfo.outputPath(`notification-attention-${viewport.name}.png`),
      fullPage: true,
      animations: 'disabled',
    });
  });
}

for (const width of [1440, 390, 320]) {
  test(`관리자 알림 품질 화면은 ${width}px에서 개인정보 기준과 레이아웃을 보존한다`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Explicit responsive matrix.');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockShellSession(page, ['WORKSPACE_MEMBER', 'PRODUCT_ADMIN'], {
      locale: 'ko',
      permissions: NOTIFICATION_ADMIN_PERMISSIONS,
    });
    await mockNotificationCenter(page);
    await mockNotificationAdminOverview(page);
    await page.setViewportSize({ width, height: 900 });

    await page.goto('/notifications/admin/overview');
    const quality = page.getByTestId('notification-noise-quality-panel');
    await expect(quality.getByRole('heading', { name: '알림 품질 및 피로도' })).toBeVisible();
    await expect(
      quality.getByText('MESSAGE.MENTION', { exact: true }).filter({ visible: true }).first()
    ).toBeVisible();
    await expect(
      quality.getByText('MESSAGE.PRIVATE_THREAD', { exact: true }).filter({ visible: true }).first()
    ).toBeVisible();
    await expect(
      quality.getByText('비공개', { exact: true }).filter({ visible: true }).first()
    ).toBeVisible();
    await expect(quality.getByText(/개인정보 보호 기준: 최소 집단 20명/).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);

    if (width === 1440) {
      const accessibility = await new AxeBuilder({ page })
        .include('[data-testid="notification-noise-quality-panel"]')
        .analyze();
      expect(
        accessibility.violations.filter((violation) =>
          ['critical', 'serious'].includes(violation.impact ?? '')
        )
      ).toEqual([]);
    }
  });
}
