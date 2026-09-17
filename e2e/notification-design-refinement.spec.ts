import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  mockNotificationAdminGovernance,
  NOTIFICATION_GOVERNANCE_PERMISSIONS,
} from './support/notification-admin-governance-fixtures';
import {
  mockNotificationOperationsAndSuppressions,
  NOTIFICATION_OPERATIONS_PERMISSIONS,
} from './support/notification-design-completion-fixtures';
import {
  expectNoHorizontalOverflow,
  fulfillSuccess,
  mockNotificationAttentionR2,
  mockNotificationCenter,
  mockNotificationNoiseQuality,
  mockNotificationPreferences,
  NOTIFICATION_PERMISSION,
} from './support/notification-fixtures';
import { mockShellSession } from './support/shell-session';

const ROUTES = [
  '/notifications/home',
  '/notifications/center',
  '/notifications/settings',
  '/notifications/admin/overview',
  '/notifications/admin/contracts',
  '/notifications/admin/policies',
  '/notifications/admin/templates',
  '/notifications/admin/operations',
  '/notifications/admin/suppressions',
] as const;

test('Mobile browser retains home, detail and receiving settings workflows', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Native mobile WebKit workflow.');
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: NOTIFICATION_PERMISSION,
  });
  await mockNotificationCenter(page);
  await mockNotificationPreferences(page);
  await page.goto('/notifications/home');
  await expect(page.getByRole('heading', { name: '알림 홈', level: 1 })).toBeVisible();
  await expect(page.locator('[data-notification-card]').first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.goto('/notifications/center/notification-e2e-1?view=all');
  const detail = page.getByRole('complementary', { name: '선택한 알림 상세' });
  const footer = detail.getByTestId('notification-detail-primary-action');
  await expect(footer).toBeInViewport();
  await detail.getByRole('button', { name: '뒤로', exact: true }).click();
  await expect(page).toHaveURL(/\/notifications\/center\?view=all/);
  await page.goto('/notifications/settings');
  await expect(page.getByTestId('notification-channel-grid').getByRole('switch')).toHaveCount(6);
  await expect(page.getByTestId('notification-channel-EMAIL').getByRole('switch')).toBeDisabled();
  await page.getByRole('tab', { name: '내 수신 상태', exact: true }).click();
  await expect(page.getByTestId('notification-delivery-diagnostics')).toBeVisible();
  await page.getByRole('button', { name: '연결 및 기기 진단 접기' }).click();
  await expect(page.getByTestId('notification-delivery-diagnostics')).toBeHidden();
  await page.getByRole('tab', { name: '알림 설정', exact: true }).click();
  await page.getByRole('tab', { name: '내 수신 상태', exact: true }).click();
  await expect(page.getByTestId('notification-delivery-diagnostics')).toBeHidden();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('receiving-settings-webkit.png'),
    fullPage: true,
  });
});

for (const width of [1440, 1280, 390, 320]) {
  test(`Notification design and controls at ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    test.skip(testInfo.project.name !== 'chromium', 'Explicit viewport matrix.');
    await mockShellSession(page, ['WORKSPACE_MEMBER', 'PRODUCT_ADMIN'], {
      locale: 'ko',
      permissions: [...NOTIFICATION_GOVERNANCE_PERMISSIONS, ...NOTIFICATION_OPERATIONS_PERMISSIONS],
    });
    await mockNotificationCenter(page);
    await mockNotificationPreferences(page);
    await mockNotificationAttentionR2(page);
    await mockNotificationNoiseQuality(page);
    await mockNotificationAdminGovernance(page);
    await mockNotificationOperationsAndSuppressions(page);
    await page.setViewportSize({ width, height: 960 });

    for (const route of ROUTES) {
      await page.goto(route);
      const frame = page.getByTestId('notification-page-frame');
      await expect(frame).toBeVisible({ timeout: 15_000 });
      await expect(frame.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
      if (route === '/notifications/home') {
        const card = frame.locator('[data-notification-card]').first();
        await expect(card).toBeVisible();
        const radius = await card.evaluate((element) =>
          parseFloat(getComputedStyle(element).borderTopRightRadius)
        );
        expect(radius).toBeGreaterThan(0);
        expect(radius).toBeLessThanOrEqual(8);
        expect(radius).toBe(8);
        await expect(card).toHaveCSS('box-shadow', 'none');
        await expect(card).toHaveCSS('border-left-width', '5px');
        await expect(frame.getByRole('heading', { name: '알림 홈', level: 1 })).toHaveCSS(
          'font-size',
          '20px'
        );
        await expect(frame.getByTestId('notification-home-header').locator('time')).toHaveCount(1);
        await expect(frame.getByRole('progressbar')).toHaveCount(0);
        if (width >= 1280) {
          const workspace = frame.getByTestId('notification-home-workspace');
          const feed = await workspace.locator(':scope > div').first().boundingBox();
          const rail = await frame.getByTestId('notification-home-insights').boundingBox();
          expect(feed).not.toBeNull();
          expect(rail).not.toBeNull();
          expect((feed?.width ?? 0) / Math.max(1, rail?.width ?? 0)).toBeGreaterThan(1.8);
          expect((feed?.width ?? 0) / Math.max(1, rail?.width ?? 0)).toBeLessThan(2.2);
        }
      }
      if (route === '/notifications/settings') {
        const nav = page.getByRole('navigation', { name: '알림 설정 바로가기' });
        await nav.getByRole('button', { name: '전역 전달 채널' }).click();
        await expect(page.getByTestId('notification-channel-grid')).toBeVisible();
        await expect(page.getByTestId('notification-channel-grid').getByRole('switch')).toHaveCount(
          6
        );
        await expect(
          page.getByTestId('notification-channel-EMAIL').getByRole('switch')
        ).toBeDisabled();
        await page.evaluate(() => {
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
          window.scrollTo(0, 0);
        });
        await page.screenshot({
          path: testInfo.outputPath(`settings-viewport-${width}.png`),
          animations: 'disabled',
        });
        await page.screenshot({
          path: testInfo.outputPath(`settings-channels-${width}.png`),
          fullPage: true,
          animations: 'disabled',
        });
        await nav.getByRole('button', { name: '앱별 알림' }).click();
        await expect(page.locator('#notification-preferences-apps')).toBeVisible();
        await expect(
          page.locator('#notification-preferences-apps').getByRole('combobox').first()
        ).toBeEnabled();
      }
      await expectNoHorizontalOverflow(page);
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        window.scrollTo(0, 0);
      });
      await page.screenshot({
        path: testInfo.outputPath(`${route.replaceAll('/', '-')}-${width}.png`),
        fullPage: true,
        animations: 'disabled',
      });
    }
  });
}

test('Notification settings retain readable dark and high-contrast states at 200% zoom', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Explicit accessibility matrix.');
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    permissions: NOTIFICATION_PERMISSION,
    appearance: { mode: 'dark', density: 'standard', highContrast: true, reduceMotion: true },
  });
  await mockNotificationCenter(page);
  await mockNotificationPreferences(page);
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.goto('/notifications/settings');
  await page
    .getByRole('navigation', { name: 'Notification settings shortcuts' })
    .getByRole('button', { name: 'Global delivery channels' })
    .click();
  await page.locator('body').evaluate((body) => {
    body.style.zoom = '2';
  });
  await expectNoHorizontalOverflow(page);
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter((violation) =>
      ['critical', 'serious'].includes(violation.impact ?? '')
    )
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('settings-dark-high-contrast-200.png'),
    fullPage: true,
    animations: 'disabled',
  });
});

test('Desktop inspector keeps primary actions in the viewport as toolbars and height change', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: NOTIFICATION_PERMISSION,
  });
  await mockNotificationCenter(page);
  await page.goto('/notifications/center/notification-e2e-1?view=all');
  for (const { width, height } of [
    { width: 1440, height: 960 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize({ width, height });
    const inspector = page.getByTestId('notification-desktop-inspector');
    const footer = inspector.getByTestId('notification-detail-primary-action');
    await expect(footer).toBeVisible();
    const expectContained = async () => {
      await expect
        .poll(async () => {
          const bounds = await footer.boundingBox();
          return bounds ? bounds.y + bounds.height : Infinity;
        })
        .toBeLessThanOrEqual(height);
    };
    await expectContained();
    await page.locator('[data-notification-card]').first().getByRole('checkbox').check();
    await expect(page.getByRole('toolbar', { name: '선택한 알림 작업' })).toBeVisible();
    await expectContained();
    await page.locator('[data-notification-card]').first().getByRole('checkbox').uncheck();
    await expectContained();
    await expectNoHorizontalOverflow(page);
  }
});

for (const width of [1440, 390]) {
  test(`Notification channel matrix preserves managed controls and save recovery at ${width}px`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Explicit interaction matrix.');
    await mockShellSession(page, ['WORKSPACE_MEMBER'], {
      locale: 'ko',
      permissions: NOTIFICATION_PERMISSION,
    });
    await mockNotificationCenter(page);
    await mockNotificationPreferences(page);
    const channels = ['IN_APP', 'EMAIL', 'WEB_PUSH', 'MOBILE_PUSH', 'TEAMS', 'SLACK'];
    const value = (effectiveValue: boolean | string, managed = false) => ({
      effectiveValue,
      managed,
      exceptionAllowed: !managed,
      source: managed ? 'TENANT_POLICY' : 'USER',
      ownerLabel: managed ? 'SKAX IT' : null,
    });
    const typeNames = [
      '운영 채널의 직접 멘션',
      '보안 정책상 필수 수신',
      '글로벌 프로젝트의 아주 긴 한국어 English collaboration update 알림',
    ];
    let emailEnabled = true;
    let failSave = false;
    let releaseSave: (() => void) | undefined;
    const profile = () => ({
      channels: Object.fromEntries(
        channels.map((channel) => [channel, channel === 'EMAIL' ? emailEnabled : true])
      ),
      quietHours: {
        enabled: true,
        start: '22:00',
        end: '07:00',
        timeZone: 'Asia/Seoul',
        days: [1, 2, 3, 4, 5],
        allowUrgentBypass: true,
      },
      digest: { mode: 'DAILY', deliveryTime: '09:00', dayOfWeek: null },
      presentation: { bannerMode: 'SMART', previewMode: 'FULL' },
      version: '2',
      updatedAt: '2026-09-14T03:00:00Z',
    });
    await page.route('**/api/notifications/v1/capabilities', (route) =>
      fulfillSuccess(route, {
        enabledChannels: channels,
        unavailableChannels: [],
        canonicalStore: 'POSTGRESQL',
        realtimeTransport: 'SSE_HINT_WITH_DURABLE_SYNC',
        externalDeliveryState: 'ENABLED',
        generatedAt: '2026-09-14T03:00:00Z',
      })
    );
    await page.route('**/api/notifications/v1/me/effective-settings', (route) =>
      fulfillSuccess(route, {
        partial: false,
        unavailableSources: [],
        globalChannels: Object.fromEntries(
          channels.map((channel) => [
            channel,
            value(channel === 'EMAIL' ? emailEnabled : true, channel === 'IN_APP'),
          ])
        ),
        apps: [
          {
            appKey: 'messaging',
            appName: 'Space Messenger',
            types: typeNames.map((typeName, index) => ({
              typeKey: `E2E_MATRIX_${index}`,
              typeName,
              description: '설정된 정책과 사용자 선택에 따라 채널별로 전달됩니다.',
              mode: value('IMMEDIATE', index === 1),
              channels: Object.fromEntries(
                channels.map((channel) => [channel, value(true, index === 1)])
              ),
              mandatory: index === 1,
              quietHoursBypass: index === 1,
              ruleId: null,
              ruleVersion: null,
            })),
          },
        ],
        generatedAt: '2026-09-14T03:00:00Z',
      })
    );
    await page.route('**/api/notifications/v1/me/delivery-profile', async (route) => {
      if (route.request().method() !== 'PUT') return fulfillSuccess(route, profile());
      const body = route.request().postDataJSON() as { channels: { EMAIL: boolean } };
      await new Promise<void>((resolve) => {
        releaseSave = resolve;
      });
      if (failSave)
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', message: 'Temporary save failure' }),
        });
      emailEnabled = body.channels.EMAIL;
      return fulfillSuccess(route, profile());
    });
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/notifications/settings');
    const nav = page.getByRole('navigation', { name: '알림 설정 바로가기' });
    await nav.getByRole('button', { name: '앱별 알림' }).click();
    const matrix = page.locator('#notification-preferences-apps');
    await expect(matrix.getByRole('combobox')).toHaveCount(3);
    await expect(matrix.getByRole('combobox').nth(0)).toBeEnabled();
    await expect(matrix.getByRole('combobox').nth(1)).toBeDisabled();
    await expect(matrix.getByRole('switch')).toHaveCount(18);
    await expect(
      matrix.getByRole('switch', { name: `${typeNames[1]}의 이메일 사용 설정` })
    ).toBeDisabled();
    await expectNoHorizontalOverflow(page);
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: testInfo.outputPath(`settings-matrix-${width}.png`),
      fullPage: true,
      animations: 'disabled',
    });
    await nav.getByRole('button', { name: '전역 전달 채널' }).click();
    const email = page.getByTestId('notification-channel-EMAIL').getByRole('switch');
    await expect(
      page.getByTestId('notification-channel-IN_APP').getByRole('switch')
    ).toBeDisabled();
    await expect(email).toBeChecked();
    const saved = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' && response.url().endsWith('/me/delivery-profile')
    );
    await email.uncheck();
    await expect(email).not.toBeChecked();
    await expect(email).toBeDisabled();
    await expect.poll(() => typeof releaseSave).toBe('function');
    releaseSave?.();
    await saved;
    await expect(email).toBeEnabled();
    await expect(email).not.toBeChecked();
    releaseSave = undefined;
    failSave = true;
    const failed = page.waitForResponse(
      (response) => response.status() === 503 && response.url().endsWith('/me/delivery-profile')
    );
    await email.check();
    await expect(email).toBeChecked();
    await expect.poll(() => typeof releaseSave).toBe('function');
    releaseSave?.();
    await failed;
    await expect(email).toBeEnabled();
    await expect(email).not.toBeChecked();
  });
}
