import { mkdir } from 'node:fs/promises';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';

const EVIDENCE_DIRECTORY =
  '/Users/a10697/Work/DWP/output/account-settings-truth-fix-2026-09-17/screenshots';
const CONNECTOR_ID = '90000000-0000-4000-8000-000000000001';

const sessions = [
  {
    sessionId: 'session-current',
    current: true,
    ipAddress: '203.0.113.10',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
    startedAt: '2026-09-17T00:00:00Z',
    lastSeenAt: '2026-09-17T09:00:00Z',
    idleExpiresAt: '2026-09-17T10:00:00Z',
    expiresAt: '2026-09-18T00:00:00Z',
  },
  {
    sessionId: 'session-mobile',
    current: false,
    ipAddress: '203.0.113.20',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1',
    startedAt: '2026-09-16T00:00:00Z',
    lastSeenAt: '2026-09-17T08:00:00Z',
    idleExpiresAt: '2026-09-17T10:00:00Z',
    expiresAt: '2026-09-18T00:00:00Z',
  },
] as const;

async function prepare(
  page: Page,
  roles: string[] = ['WORKSPACE_MEMBER'],
  appearance: { mode: 'light' | 'dark'; highContrast: boolean } = {
    mode: 'light',
    highContrast: false,
  }
) {
  await page.emulateMedia({ colorScheme: appearance.mode, reducedMotion: 'reduce' });
  await mockShellSession(page, roles, {
    locale: 'ko',
    displayName: '김민서',
    jobTitle: '플랫폼 운영 리드',
    department: '디지털 플랫폼',
    workerNumber: 'SK-2026-1042',
    identitySourceType: 'HRIS',
    email: 'minseo.kim@example.com',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: appearance.mode,
      density: 'standard',
      highContrast: appearance.highContrast,
      reduceMotion: true,
    },
  });
  await page.route('**/api/auth/sessions', (route) => fulfillSuccess(route, sessions));
  return routePersonalSettingsOwners(page);
}

async function routePersonalSettingsOwners(page: Page) {
  let favorites: Array<{
    settingKey: string;
    favorite: boolean;
    version: number;
    updatedAt: string;
  }> = [];
  let consentState: 'GRANTED' | 'WITHDRAWN' | null = null;
  const consents: Array<Record<string, unknown>> = [];
  const privacyRequests: Array<Record<string, unknown>> = [];
  let consentWrites = 0;
  let requestWrites = 0;
  let workspaceVersion = 0;
  let workspaceFreshness: 'UNCONFIRMED' | 'CURRENT' | 'CHANGED_SINCE_CONFIRMATION' = 'UNCONFIRMED';
  let workspaceConfirmedAt: string | null = null;
  const recentActivity = [
    {
      activityId: 'activity-security-view',
      settingKey: 'security',
      activityType: 'VIEW',
      changedFields: [],
      occurredAt: '2026-09-17T08:45:00Z',
    },
    {
      activityId: 'activity-appearance-change',
      settingKey: 'appearance',
      activityType: 'CHANGE',
      changedFields: ['mode'],
      occurredAt: '2026-09-17T08:30:00Z',
    },
  ];
  const workspace = () => ({
    favorites,
    recentActivity,
    observation: {
      sourceState: 'AVAILABLE',
      freshnessState: workspaceFreshness,
      observedAt: '2026-09-17T09:00:00Z',
      lastChangeAt: '2026-09-17T08:30:00Z',
      lastConfirmedAt: workspaceConfirmedAt,
      reviewDueAt: workspaceConfirmedAt ? '2026-10-17T09:00:00Z' : null,
      version: workspaceVersion,
      offlineBehavior: 'MEMORY_ONLY_READ_ONLY',
    },
  });

  await page.route('**/api/platform/v1/personal-settings/**', async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/workspace')) {
      return fulfillSuccess(route, workspace());
    }
    if (request.method() === 'POST' && path.endsWith('/workspace/reconfirm')) {
      workspaceVersion += 1;
      workspaceFreshness = 'CURRENT';
      workspaceConfirmedAt = '2026-09-17T09:00:00Z';
      return fulfillSuccess(route, workspace());
    }
    if (request.method() === 'PUT' && path.includes('/favorites/')) {
      const settingKey = path.split('/').at(-1) ?? 'profile';
      const payload = request.postDataJSON() as { favorite: boolean; version: number };
      const entry = {
        settingKey,
        favorite: payload.favorite,
        version: payload.version + 1,
        updatedAt: '2026-09-17T09:00:00Z',
      };
      favorites = [...favorites.filter((item) => item.settingKey !== settingKey), entry];
      workspaceVersion += 1;
      workspaceFreshness = workspaceConfirmedAt ? 'CHANGED_SINCE_CONFIRMATION' : 'UNCONFIRMED';
      return fulfillSuccess(route, entry);
    }
    if (request.method() === 'POST' && path.endsWith('/activity/view')) {
      const settingKey = (request.postDataJSON() as { settingKey: string }).settingKey;
      return fulfillSuccess(route, {
        activityId: `activity-${settingKey}`,
        settingKey,
        activityType: 'VIEW',
        changedFields: [],
        occurredAt: '2026-09-17T09:00:00Z',
      });
    }
    if (request.method() === 'GET' && path.endsWith('/privacy/consents')) {
      return fulfillSuccess(route, {
        currentProductAnalytics: consents[0] ?? null,
        history: consents,
        historyHasMore: false,
        historyLimit: 50,
        coveredPurposes: ['PRODUCT_ANALYTICS'],
        coverageState: 'PRODUCT_LOCAL',
        coverageBoundary: 'CROSS_PRODUCT_CONSENT_SOURCES_NOT_CONNECTED',
      });
    }
    if (request.method() === 'PUT' && path.endsWith('/privacy/consents/product-analytics')) {
      consentWrites += 1;
      consentState = request.postDataJSON().granted ? 'GRANTED' : 'WITHDRAWN';
      const consent = {
        consentId: `consent-${consentWrites}`,
        purposeKey: 'PRODUCT_ANALYTICS',
        consentState,
        noticeVersion: request.postDataJSON().noticeVersion,
        source: 'ACCOUNT_SETTINGS',
        occurredAt: '2026-09-17T09:00:00Z',
      };
      consents.unshift(consent);
      return fulfillSuccess(route, consent);
    }
    if (request.method() === 'GET' && path.endsWith('/privacy/requests')) {
      return fulfillSuccess(route, {
        items: privacyRequests,
        hasMore: false,
        limit: 50,
      });
    }
    if (request.method() === 'POST' && path.endsWith('/privacy/requests')) {
      requestWrites += 1;
      const payload = request.postDataJSON();
      const privacyRequest = {
        requestId: `privacy-request-${requestWrites}`,
        requestType: payload.requestType,
        requestState: 'RECEIVED',
        requestedScope: payload.requestedScope,
        reason: payload.reason ?? null,
        fulfillmentAvailable: false,
        fulfillmentBoundary: 'PRIVACY_OWNER_EXECUTION_NOT_CONNECTED',
        version: 0,
        createdAt: '2026-09-17T09:00:00Z',
        updatedAt: '2026-09-17T09:00:00Z',
        receipt: {
          receiptId: `privacy-receipt-${requestWrites}`,
          receiptType: 'INTAKE',
          evidenceState: 'INTAKE_ONLY',
          fulfillmentBoundary: 'PRIVACY_OWNER_EXECUTION_NOT_CONNECTED',
          requestFingerprint: 'a'.repeat(64),
          issuedAt: '2026-09-17T09:00:00Z',
        },
        lifecycle: [
          {
            eventId: `privacy-event-${requestWrites}-received`,
            eventType: 'REQUEST_RECEIVED',
            requestState: 'RECEIVED',
            detailKey: 'PRIVACY_REQUEST_INTAKE_RECORDED',
            occurredAt: '2026-09-17T09:00:00Z',
          },
          {
            eventId: `privacy-event-${requestWrites}-boundary`,
            eventType: 'FULFILLMENT_BOUNDARY_RECORDED',
            requestState: 'RECEIVED',
            detailKey: 'PRIVACY_OWNER_EXECUTION_NOT_CONNECTED',
            occurredAt: '2026-09-17T09:00:01Z',
          },
        ],
        lifecycleHasMore: false,
        lifecycleLimit: 50,
      };
      privacyRequests.unshift(privacyRequest);
      return fulfillSuccess(route, privacyRequest);
    }
    if (request.method() === 'PATCH' && path.endsWith('/cancel')) {
      const target = privacyRequests.find((entry) => path.includes(String(entry.requestId)));
      if (target) {
        target.requestState = 'CANCELLED';
        target.version = Number(target.version) + 1;
        (target.lifecycle as Array<Record<string, unknown>>).push({
          eventId: `privacy-event-${String(target.requestId)}-cancelled`,
          eventType: 'REQUEST_CANCELLED',
          requestState: 'CANCELLED',
          detailKey: 'CANCELLED_BY_REQUEST_OWNER',
          occurredAt: '2026-09-17T09:01:00Z',
        });
      }
      return fulfillSuccess(route, target);
    }
    return route.fallback();
  });

  return {
    consentWrites: () => consentWrites,
    requestWrites: () => requestWrites,
    consentState: () => consentState,
    favorites: () => favorites,
  };
}

async function routeProductivityConnections(page: Page) {
  let consentState: 'CONNECTED' | 'REVOKED' = 'CONNECTED';
  let syncRequests = 0;
  let disconnectRequests = 0;
  const connection = () => ({
    connectorId: CONNECTOR_ID,
    connectorKey: 'MICROSOFT_365',
    displayName: 'Microsoft 365',
    providerType: 'MICROSOFT_GRAPH',
    lifecycleState: 'ACTIVE',
    healthState: 'HEALTHY',
    consentState,
    requestedScopes: ['Mail.ReadBasic', 'Calendars.Read'],
    grantedScopes: consentState === 'CONNECTED' ? ['Mail.ReadBasic', 'Calendars.Read'] : [],
    lastSuccessfulSyncAt: consentState === 'CONNECTED' ? '2026-09-17T08:30:00Z' : null,
    actionRequiredCode: consentState === 'CONNECTED' ? null : 'REVOKED',
  });

  await page.route('**/api/platform/v1/workspace/productivity/**', async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/connections')) {
      return fulfillSuccess(route, [connection()]);
    }
    if (request.method() === 'POST' && path.endsWith('/sync')) {
      syncRequests += 1;
      return fulfillSuccess(route, {
        runId: `sync-${syncRequests}`,
        connectorId: CONNECTOR_ID,
        userId: 1,
        resourceKind: request.postDataJSON().resourceKind,
        syncMode: 'DELTA',
        runState: 'RUNNING',
        startedAt: '2026-09-17T09:00:00Z',
        completedAt: null,
        upsertCount: 0,
        deleteCount: 0,
        skipCount: 0,
        errorCount: 0,
        partialResult: false,
        retryAfterAt: null,
        safeErrorCode: null,
        correlationId: null,
      });
    }
    if (request.method() === 'DELETE' && path.endsWith(`/connections/${CONNECTOR_ID}`)) {
      disconnectRequests += 1;
      consentState = 'REVOKED';
      return fulfillSuccess(route, connection());
    }
    return route.fallback();
  });

  return {
    syncRequests: () => syncRequests,
    disconnectRequests: () => disconnectRequests,
  };
}

test.beforeAll(async () => {
  await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
});

async function expectKeyboardReachable(
  page: Page,
  target: ReturnType<Page['locator']>,
  context: string
) {
  await target.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });

  let reached = false;
  for (let index = 0; index < 100; index += 1) {
    await page.keyboard.press('Tab');
    reached = await target.evaluate((element) => document.activeElement === element);
    if (reached) break;
  }

  expect(reached, `${context}: keyboard traversal did not reach the expected action`).toBe(true);
  expect(
    await target.evaluate((element) => element.matches(':focus-visible')),
    `${context}: the keyboard-focused action has no focus-visible state`
  ).toBe(true);
}

async function expectNoSeriousAccessibilityViolations(page: Page, context: string) {
  const result = await new AxeBuilder({ page }).analyze();
  const blocking = result.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious'
  );
  expect(blocking, `${context}: serious or critical accessibility violations`).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(
    geometry.scrollWidth,
    `${context}: document width ${geometry.scrollWidth}px exceeds ${geometry.clientWidth}px`
  ).toBeLessThanOrEqual(geometry.clientWidth + 1);
}

test('S01 account menu renders authoritative identity and permitted control-plane actions', async ({
  page,
}) => {
  await prepare(page, ['TENANT_ADMIN']);
  await page.goto('/account/settings');

  await page.getByRole('button', { name: /계정: 김민서/ }).click();
  const account = page.getByRole('dialog', { name: '계정 및 세션' });
  await expect(account.getByText('김민서', { exact: true })).toBeVisible();
  await expect(account.getByText('minseo.kim@example.com', { exact: true })).toBeVisible();
  await expect(account.getByText('워크스페이스 · SKAX', { exact: true })).toBeVisible();
  await expect(account.getByRole('menuitem', { name: '계정 설정' })).toBeVisible();
  await expect(account.getByRole('menuitem', { name: '세션 모니터' })).toBeVisible();
  await expect(account.getByText('활성 세션 2개', { exact: true })).toBeVisible();
  await expect(account.getByRole('menuitem', { name: '관리 콘솔' })).toBeVisible();
  const logout = account.getByRole('button', { name: '로그아웃' });
  await expect(logout).toBeVisible();
  const logoutBox = await logout.boundingBox();
  expect(logoutBox?.width).toBeGreaterThanOrEqual(44);
  expect(logoutBox?.height).toBeGreaterThanOrEqual(44);
});

test('S02 settings home renders observed state and explicit owner boundaries', async ({ page }) => {
  const owner = await prepare(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/account/settings');

  await expect(page.getByRole('heading', { name: '개인 설정', level: 1 })).toBeVisible();
  const freshness = page.getByTestId('personal-settings-workspace-freshness');
  await expect(freshness.getByText('검토 필요', { exact: true })).toBeVisible();
  await expect(freshness.getByText(/아직 확인되지 않았습니다/)).toBeVisible();
  await freshness.getByRole('button', { name: '설정 검토 완료' }).click();
  await expect(freshness.getByText('최신 상태', { exact: true })).toBeVisible();
  const status = page.getByTestId('settings-status-summary');
  await expect(status.getByText('신원 컨텍스트')).toBeVisible();
  await expect(status.getByText('2개 세션')).toBeVisible();
  await expect(status.getByText('화면 환경')).toBeVisible();
  await expect(status.getByText('조직 관리 정책')).toBeVisible();
  const boundaries = page.getByTestId('settings-owner-boundaries');
  await expect(boundaries.getByText('보안 확인 과업')).toBeVisible();
  await expect(boundaries.getByText('최근 설정 활동')).toBeVisible();
  await expect(boundaries.getByText(/보안 및 세션 · 열람/)).toBeVisible();
  await expect(boundaries.getByText(/화면 모양 · 변경/)).toBeVisible();

  await page.getByRole('button', { name: '보안 및 세션 즐겨찾기에 추가' }).click();
  await expect
    .poll(() => owner.favorites().some((entry) => entry.settingKey === 'security'))
    .toBe(true);
  await expect(page.getByRole('button', { name: '보안 및 세션 즐겨찾기에서 제거' })).toBeVisible();
  const favoriteBox = await page
    .getByRole('button', { name: '보안 및 세션 즐겨찾기에서 제거' })
    .boundingBox();
  expect(favoriteBox?.width).toBeGreaterThanOrEqual(44);
  expect(favoriteBox?.height).toBeGreaterThanOrEqual(44);
  await expect(freshness.getByText('검토 필요', { exact: true })).toBeVisible();

  await page.getByRole('textbox', { name: '개인 설정 검색' }).fill('보안');
  await expect(page.getByRole('heading', { name: '보안 및 세션', level: 3 })).toBeVisible();
  await expect(page.getByRole('heading', { name: '프로필', level: 3 })).toHaveCount(0);

  await page.screenshot({
    path: `${EVIDENCE_DIRECTORY}/S02-settings-home-1440.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  await page.screenshot({
    path: `${EVIDENCE_DIRECTORY}/S02-settings-home-390.png`,
    fullPage: true,
    animations: 'disabled',
  });
});

test('S03 profile binds identity, connections, consent, and internal privacy request ownership', async ({
  page,
}) => {
  const personalOwner = await prepare(page);
  const owner = await routeProductivityConnections(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/account/profile');

  await expect(page.getByRole('heading', { name: '프로필 및 계정', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: '신원 상세', level: 2 })).toBeVisible();
  await expect(
    page.getByTestId('account-main').getByText('minseo.kim@example.com', { exact: true })
  ).toBeVisible();
  await expect(page.getByText('소속 부서', { exact: true })).toBeVisible();
  await expect(page.getByText('사원번호', { exact: true })).toBeVisible();
  await expect(page.getByText('디지털 플랫폼', { exact: true })).toBeVisible();
  await expect(page.getByText('SK-2026-1042', { exact: true })).toBeVisible();
  await expect(page.getByText('워크스페이스 구성원', { exact: true })).toBeVisible();
  await expect(page.getByText('WORKSPACE_MEMBER', { exact: true })).toHaveCount(0);
  await expect(page.getByText('인력 디렉터리', { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '연결된 업무 앱 및 데이터 권한', level: 2 })
  ).toBeVisible();
  await expect(page.getByText('Microsoft 365', { exact: true })).toBeVisible();
  await expect(page.getByText(/메일 기본 정보 읽기, 캘린더 읽기/)).toBeVisible();
  await expect(page.getByText(/Mail\.ReadBasic|Calendars\.Read/)).toHaveCount(0);
  await expect(page.locator('[data-transfer-coverage="productivity-only"]')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '개인정보 및 데이터 동의', level: 2 })
  ).toBeVisible();
  await expect(page.getByRole('switch', { name: '제품 사용성 분석 동의' })).toBeVisible();
  await expect(page.getByRole('button', { name: '내보내기 요청' })).toBeVisible();
  await expect(page.getByRole('button', { name: '삭제 검토 요청' })).toBeVisible();
  await expect(page.getByText(/완료로 표시하지 않습니다/)).toBeVisible();
  await expect(page.getByText(/DWP 제품 사용성 분석 동의만 포함합니다/)).toBeVisible();

  await page.getByRole('switch', { name: '제품 사용성 분석 동의' }).click();
  await expect.poll(personalOwner.consentWrites).toBe(1);
  expect(personalOwner.consentState()).toBe('GRANTED');
  await expect(page.getByText(/^동의함 ·/)).toBeVisible();

  await page.getByRole('button', { name: '내보내기 요청' }).click();
  await expect.poll(personalOwner.requestWrites).toBe(1);
  await expect(page.getByText('내부 접수', { exact: true })).toBeVisible();
  await expect(page.getByText(/접수 영수증 privacy-receipt-1/)).toBeVisible();
  await expect(page.getByText(/요청 접수 기록/)).toBeVisible();
  await expect(page.getByText(/외부 소유 서비스 연결 필요/)).toBeVisible();
  await page.getByRole('button', { name: '요청 취소' }).click();
  await expect(page.getByText('취소됨', { exact: true })).toBeVisible();
  await expect(page.getByText(/요청자 취소 기록/)).toBeVisible();

  await page.screenshot({
    path: `${EVIDENCE_DIRECTORY}/S03-profile-account-1440.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: '프로필 및 계정', level: 1 })).toBeVisible();
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  await page.screenshot({
    path: `${EVIDENCE_DIRECTORY}/S03-profile-account-390.png`,
    fullPage: true,
    animations: 'disabled',
  });

  await page.getByRole('button', { name: '지금 동기화' }).click();
  await expect.poll(owner.syncRequests).toBe(2);
  await page.getByRole('button', { name: '연결 해제' }).click();
  const dialog = page.getByRole('dialog', { name: '업무 앱 연결 해제' });
  await dialog.getByRole('button', { name: '연결 해제' }).click();
  await expect.poll(owner.disconnectRequests).toBe(1);
  await expect(page.getByText('연결 해제됨', { exact: true })).toBeVisible();
});

test('S04 security renders posture, privileged access, and authoritative sessions', async ({
  page,
}) => {
  await prepare(page);
  await page.route('**/api/auth/me/policy', (route) =>
    fulfillSuccess(route, {
      tenantId: 1,
      defaultLoginType: 'SSO',
      allowedLoginTypes: ['LOCAL', 'SSO'],
      localLoginEnabled: true,
      ssoLoginEnabled: true,
      ssoProviderKey: 'enterprise-sso',
      requireMfa: true,
    })
  );
  await page.route('**/api/auth/idp', (route) => fulfillSuccess(route, []));
  await page.goto('/account/security');

  await expect(page.getByRole('heading', { name: '보안 및 세션', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: '로그인 보호', level: 2 })).toBeVisible();
  await expect(page.getByText('테넌트 정책에서 필수', { exact: true })).toBeVisible();
  const mfaEnrollmentRow = page.getByText('내 MFA 등록', { exact: true }).locator('..');
  await expect(mfaEnrollmentRow).toContainText('신원 디렉터리에 등록됨');
  await expect(mfaEnrollmentRow).toContainText(/외부 ID 공급자 등록 상태는 추정하지 않습니다/);
  const mfaPolicyRow = page.getByText('다중 인증 정책', { exact: true }).locator('..');
  await expect(mfaPolicyRow).toContainText('조직 관리');
  await expect(mfaPolicyRow).not.toContainText('준비 완료');
  await expect(
    page.getByText(/ID 공급자 소유 서비스가 공급자 세부 정보를 반환하지 않았습니다/)
  ).toBeVisible();
  await expect(page.getByText(/OIDC ID 공급자가 활성화/)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '내 특권 접근', level: 2 })).toBeVisible();
  await expect(page.getByText('활성화할 수 있는 특권 역할이 없습니다')).toBeVisible();
  await expect(page.getByRole('heading', { name: '활성 브라우저 세션', level: 2 })).toBeVisible();
  await expect(page.getByText('현재 세션', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '다른 세션 로그아웃' })).toBeEnabled();
});

test('S04 keeps the last successful session list visibly stale when refresh fails', async ({
  page,
}) => {
  await prepare(page);
  await page.unroute('**/api/auth/sessions');
  let reads = 0;
  await page.route('**/api/auth/sessions', async (route) => {
    reads += 1;
    if (reads === 1) return fulfillSuccess(route, sessions);
    return route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'owner unavailable' }),
    });
  });
  await page.route('**/api/auth/sessions/session-mobile', (route) => fulfillSuccess(route, null));
  await page.goto('/account/security');

  await page.getByRole('button', { name: '세션 종료' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '로그아웃' }).click();

  await expect(
    page.getByText(/마지막으로 정상 조회한 세션을 아래에 계속 표시합니다/)
  ).toBeVisible();
  await expect(page.getByText('현재 세션', { exact: true })).toBeVisible();
});

test('S04 renders an explicit empty state when the owner returns no sessions', async ({ page }) => {
  await prepare(page);
  await page.unroute('**/api/auth/sessions');
  await page.route('**/api/auth/sessions', (route) => fulfillSuccess(route, []));
  await page.goto('/account/security');

  await expect(page.getByText('반환된 활성 브라우저 세션이 없습니다')).toBeVisible();
  await expect(
    page.getByText(/소유 서비스가 빈 목록을 반환한 경우 세션을 추정하지 않습니다/)
  ).toBeVisible();
});

test('S02 provider identity reports tenant activity as out of scope without loading forever', async ({
  page,
}) => {
  await prepare(page, ['PROVIDER_ADMIN']);
  await page.goto('/account/settings');

  await expect(
    page.getByText(/프로바이더 신원에서는 개인 테넌트 설정 활동을 제공하지 않습니다/)
  ).toBeVisible();
  await expect(page.getByText('최근 활동을 불러오는 중입니다.')).toHaveCount(0);
});

test('S05 renders appearance, localization, and accessibility controls from real preferences', async ({
  page,
}) => {
  await prepare(page);

  await page.goto('/account/settings/appearance');
  await expect(page.getByRole('heading', { name: '화면 모양', level: 1 })).toBeVisible();
  await expect(page.getByText('색상 모드', { exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: '인터페이스 밀도' })).toBeVisible();

  await page.goto('/account/settings/language');
  await expect(page.getByRole('heading', { name: '언어 및 지역', level: 1 })).toBeVisible();
  await expect(page.getByRole('group', { name: '제품 언어' })).toBeVisible();
  await expect(page.getByText('시간대', { exact: true })).toBeVisible();
  await expect(page.getByText('날짜 형식', { exact: true })).toBeVisible();

  await page.goto('/account/settings/accessibility');
  await expect(page.getByRole('heading', { name: '접근성', level: 1 })).toBeVisible();
  await expect(page.getByRole('switch', { name: '고대비' })).toBeVisible();
  await expect(page.getByRole('switch', { name: '움직임 줄이기' })).toBeVisible();
  await expect(page.getByRole('switch', { name: '링크 항상 밑줄 표시' })).toBeVisible();
});

test('S01-S05 unique journeys are keyboard reachable and axe clean', async ({ page, isMobile }) => {
  await prepare(page, ['TENANT_ADMIN']);
  await routeProductivityConnections(page);
  await page.route('**/api/auth/me/policy', (route) =>
    fulfillSuccess(route, {
      tenantId: 1,
      defaultLoginType: 'SSO',
      allowedLoginTypes: ['LOCAL', 'SSO'],
      localLoginEnabled: true,
      ssoLoginEnabled: true,
      ssoProviderKey: 'enterprise-sso',
      requireMfa: true,
    })
  );
  await page.route('**/api/auth/idp', (route) => fulfillSuccess(route, []));

  await page.goto('/account/settings');
  const accountButton = page.getByRole('button', { name: /계정: 김민서/ });
  if (isMobile) {
    await accountButton.focus();
    await expect(accountButton).toBeFocused();
  } else {
    await expectKeyboardReachable(page, accountButton, 'S01 account menu');
  }
  await accountButton.press('Enter');
  await expect(page.getByRole('dialog', { name: '계정 및 세션' })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page, 'S01 account menu');
  await page.keyboard.press('Escape');

  const settingsReview = page.getByRole('button', { name: '설정 검토 완료' });
  if (isMobile) {
    await settingsReview.focus();
    await expect(settingsReview).toBeFocused();
  } else {
    await expectKeyboardReachable(page, settingsReview, 'S02 settings review');
  }
  await expectNoSeriousAccessibilityViolations(page, 'S02 settings workspace');

  await page.goto('/account/profile');
  const privacyConsent = page.getByRole('switch', { name: '제품 사용성 분석 동의' });
  if (isMobile) {
    await privacyConsent.focus();
    await expect(privacyConsent).toBeFocused();
  } else {
    await expectKeyboardReachable(page, privacyConsent, 'S03 privacy consent');
  }
  await expectNoSeriousAccessibilityViolations(page, 'S03 profile and privacy');

  await page.goto('/account/security');
  const sessionControl = page.getByRole('button', { name: '다른 세션 로그아웃' });
  if (isMobile) {
    await sessionControl.focus();
    await expect(sessionControl).toBeFocused();
  } else {
    await expectKeyboardReachable(page, sessionControl, 'S04 session control');
  }
  await expectNoSeriousAccessibilityViolations(page, 'S04 security and sessions');

  await page.goto('/account/settings/appearance');
  const densityControl = page
    .getByRole('group', { name: '인터페이스 밀도' })
    .getByRole('button')
    .first();
  if (isMobile) {
    await densityControl.focus();
    await expect(densityControl).toBeFocused();
  } else {
    await expectKeyboardReachable(page, densityControl, 'S05 appearance');
  }
  await expectNoSeriousAccessibilityViolations(page, 'S05 appearance');

  await page.goto('/account/settings/language');
  const languageControl = page.getByRole('combobox').first();
  if (isMobile) {
    await languageControl.focus();
    await expect(languageControl).toBeFocused();
  } else {
    await expectKeyboardReachable(page, languageControl, 'S05 language and region');
  }
  await expectNoSeriousAccessibilityViolations(page, 'S05 language and region');

  await page.goto('/account/settings/accessibility');
  const highContrastControl = page.getByRole('switch', { name: '고대비' });
  if (isMobile) {
    await highContrastControl.focus();
    await expect(highContrastControl).toBeFocused();
  } else {
    await expectKeyboardReachable(page, highContrastControl, 'S05 accessibility preferences');
  }
  await expectNoSeriousAccessibilityViolations(page, 'S05 accessibility preferences');
});

const accountTruthViewports = [
  { name: '1440', width: 1440, height: 900, zoom: 1 },
  { name: '1280', width: 1280, height: 800, zoom: 1 },
  { name: '390', width: 390, height: 844, zoom: 1 },
  { name: '320', width: 320, height: 720, zoom: 1 },
  { name: '1440-200pct', width: 1440, height: 900, zoom: 2 },
] as const;

for (const viewport of accountTruthViewports) {
  test(`S01-S05 unique surfaces remain usable at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.addInitScript((zoom) => {
      document.documentElement.style.zoom = String(zoom);
    }, viewport.zoom);
    await prepare(page, ['TENANT_ADMIN']);
    await routeProductivityConnections(page);
    await page.route('**/api/auth/me/policy', (route) =>
      fulfillSuccess(route, {
        tenantId: 1,
        defaultLoginType: 'SSO',
        allowedLoginTypes: ['LOCAL', 'SSO'],
        localLoginEnabled: true,
        ssoLoginEnabled: true,
        ssoProviderKey: 'enterprise-sso',
        requireMfa: true,
      })
    );
    await page.route('**/api/auth/idp', (route) => fulfillSuccess(route, []));

    const surfaces = [
      {
        key: 'S01-account-menu',
        path: '/account/settings',
        heading: '개인 설정',
        action: () => page.getByRole('button', { name: /계정: 김민서/ }),
      },
      {
        key: 'S02-settings-workspace',
        path: '/account/settings',
        heading: '개인 설정',
        action: () => page.getByRole('button', { name: '설정 검토 완료' }),
      },
      {
        key: 'S03-profile',
        path: '/account/profile',
        heading: '프로필 및 계정',
        action: () => page.getByRole('switch', { name: '제품 사용성 분석 동의' }),
      },
      {
        key: 'S04-security',
        path: '/account/security',
        heading: '보안 및 세션',
        action: () => page.getByRole('button', { name: '다른 세션 로그아웃' }),
      },
      {
        key: 'S05-appearance',
        path: '/account/settings/appearance',
        heading: '화면 모양',
        action: () =>
          page.getByRole('group', { name: '인터페이스 밀도' }).getByRole('button').first(),
      },
      {
        key: 'S05-language',
        path: '/account/settings/language',
        heading: '언어 및 지역',
        action: () => page.getByRole('combobox').first(),
      },
      {
        key: 'S05-accessibility',
        path: '/account/settings/accessibility',
        heading: '접근성',
        action: () => page.getByRole('switch', { name: '고대비' }),
      },
    ] as const;

    for (const surface of surfaces) {
      await page.goto(surface.path);
      await expect(page.getByRole('heading', { name: surface.heading, level: 1 })).toBeVisible();
      const action = surface.action();
      await action.scrollIntoViewIfNeeded();
      await action.focus();
      await expect(action).toBeFocused();
      if (surface.key === 'S01-account-menu') {
        await action.press('Enter');
        await expect(page.getByRole('dialog', { name: '계정 및 세션' })).toBeVisible();
      }
      await expectNoHorizontalOverflow(page, `${surface.key} ${viewport.name}`);
      await expectNoSeriousAccessibilityViolations(page, `${surface.key} ${viewport.name}`);
      await page.screenshot({
        path: `${EVIDENCE_DIRECTORY}/${surface.key}-${viewport.name}.png`,
        fullPage: true,
        animations: 'disabled',
      });
      if (surface.key === 'S01-account-menu') await page.keyboard.press('Escape');
    }
  });
}

for (const appearance of [
  { name: 'dark', mode: 'dark', highContrast: false },
  { name: 'high-contrast', mode: 'light', highContrast: true },
] as const) {
  test(`S01-S05 unique surfaces support ${appearance.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await prepare(page, ['TENANT_ADMIN'], appearance);
    await routeProductivityConnections(page);
    await page.route('**/api/auth/me/policy', (route) =>
      fulfillSuccess(route, {
        tenantId: 1,
        defaultLoginType: 'SSO',
        allowedLoginTypes: ['LOCAL', 'SSO'],
        localLoginEnabled: true,
        ssoLoginEnabled: true,
        ssoProviderKey: 'enterprise-sso',
        requireMfa: true,
      })
    );
    await page.route('**/api/auth/idp', (route) => fulfillSuccess(route, []));

    const surfaces = [
      {
        key: 'S01-account-menu',
        path: '/account/settings',
        heading: '개인 설정',
        action: () => page.getByRole('button', { name: /계정: 김민서/ }),
      },
      {
        key: 'S02-settings-workspace',
        path: '/account/settings',
        heading: '개인 설정',
        action: () => page.getByRole('button', { name: '설정 검토 완료' }),
      },
      {
        key: 'S03-profile',
        path: '/account/profile',
        heading: '프로필 및 계정',
        action: () => page.getByRole('switch', { name: '제품 사용성 분석 동의' }),
      },
      {
        key: 'S04-security',
        path: '/account/security',
        heading: '보안 및 세션',
        action: () => page.getByRole('button', { name: '다른 세션 로그아웃' }),
      },
      {
        key: 'S05-appearance',
        path: '/account/settings/appearance',
        heading: '화면 모양',
        action: () =>
          page.getByRole('group', { name: '인터페이스 밀도' }).getByRole('button').first(),
      },
      {
        key: 'S05-language',
        path: '/account/settings/language',
        heading: '언어 및 지역',
        action: () => page.getByRole('combobox').first(),
      },
      {
        key: 'S05-accessibility',
        path: '/account/settings/accessibility',
        heading: '접근성',
        action: () => page.getByRole('switch', { name: '고대비' }),
      },
    ] as const;

    for (const surface of surfaces) {
      await page.goto(surface.path);
      await expect(page.getByRole('heading', { name: surface.heading, level: 1 })).toBeVisible();
      const action = surface.action();
      await action.scrollIntoViewIfNeeded();
      await action.focus();
      await expect(action).toBeFocused();
      if (surface.key === 'S01-account-menu') {
        await action.press('Enter');
        await expect(page.getByRole('dialog', { name: '계정 및 세션' })).toBeVisible();
      }
      await expectNoHorizontalOverflow(page, `${surface.key} ${appearance.name}`);
      await expectNoSeriousAccessibilityViolations(page, `${surface.key} ${appearance.name}`);
      await page.screenshot({
        path: `${EVIDENCE_DIRECTORY}/${surface.key}-${appearance.name}.png`,
        fullPage: true,
        animations: 'disabled',
      });
      if (surface.key === 'S01-account-menu') await page.keyboard.press('Escape');
    }
  });
}
