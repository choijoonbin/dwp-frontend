import { mkdir } from 'node:fs/promises';

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

async function prepare(page: Page, roles: string[] = ['WORKSPACE_MEMBER']) {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await mockShellSession(page, roles, {
    locale: 'ko',
    displayName: '김민서',
    jobTitle: '플랫폼 운영 리드',
    email: 'minseo.kim@example.com',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
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

  await page.route('**/api/platform/v1/personal-settings/**', async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/workspace')) {
      return fulfillSuccess(route, { favorites, recentActivity });
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
      return fulfillSuccess(route, privacyRequests);
    }
    if (request.method() === 'POST' && path.endsWith('/privacy/requests')) {
      requestWrites += 1;
      const payload = request.postDataJSON();
      const privacyRequest = {
        requestId: `privacy-request-${requestWrites}`,
        requestType: payload.requestType,
        requestState: 'RECEIVED',
        requestedScope: payload.requestedScope,
        fulfillmentAvailable: false,
        fulfillmentBoundary: 'PRIVACY_OWNER_EXECUTION_NOT_CONNECTED',
        version: 0,
        createdAt: '2026-09-17T09:00:00Z',
        updatedAt: '2026-09-17T09:00:00Z',
      };
      privacyRequests.unshift(privacyRequest);
      return fulfillSuccess(route, privacyRequest);
    }
    if (request.method() === 'PATCH' && path.endsWith('/cancel')) {
      const target = privacyRequests.find((entry) => path.includes(String(entry.requestId)));
      if (target) target.requestState = 'CANCELLED';
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
  await expect(account.getByRole('button', { name: '로그아웃' })).toBeVisible();
});

test('S02 settings home renders observed state and explicit owner boundaries', async ({ page }) => {
  const owner = await prepare(page);
  await page.goto('/account/settings');

  await expect(page.getByRole('heading', { name: '개인 설정', level: 1 })).toBeVisible();
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

  await page.getByRole('textbox', { name: '개인 설정 검색' }).fill('보안');
  await expect(page.getByRole('heading', { name: '보안 및 세션', level: 3 })).toBeVisible();
  await expect(page.getByRole('heading', { name: '프로필', level: 3 })).toHaveCount(0);
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
  await expect(page.getByText('현재 인증 응답에서 제공되지 않음').first()).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '연결된 업무 앱 및 데이터 권한', level: 2 })
  ).toBeVisible();
  await expect(page.getByText('Microsoft 365', { exact: true })).toBeVisible();
  await expect(page.getByText(/Mail.ReadBasic, Calendars.Read/)).toBeVisible();
  await expect(page.locator('[data-transfer-coverage="productivity-only"]')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '개인정보 및 데이터 동의', level: 2 })
  ).toBeVisible();
  await expect(page.getByRole('switch', { name: '제품 사용성 분석 동의' })).toBeVisible();
  await expect(page.getByRole('button', { name: '내보내기 요청' })).toBeVisible();
  await expect(page.getByRole('button', { name: '삭제 검토 요청' })).toBeVisible();
  await expect(page.getByText(/완료로 표시하지 않습니다/)).toBeVisible();

  await page.getByRole('switch', { name: '제품 사용성 분석 동의' }).click();
  await expect.poll(personalOwner.consentWrites).toBe(1);
  expect(personalOwner.consentState()).toBe('GRANTED');
  await expect(page.getByText(/^동의함 ·/)).toBeVisible();

  await page.getByRole('button', { name: '내보내기 요청' }).click();
  await expect.poll(personalOwner.requestWrites).toBe(1);
  await expect(page.getByText('내부 접수', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '요청 취소' }).click();
  await expect(page.getByText('취소됨', { exact: true })).toBeVisible();

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
