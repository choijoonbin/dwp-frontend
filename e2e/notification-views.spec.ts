import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { fulfillSuccess, mockShellSession } from './support/shell-session';
import {
  expectNoHorizontalOverflow,
  mockNotificationCenter,
  mockNotificationProfile,
  notification,
  NOTIFICATION_PERMISSION,
} from './support/notification-fixtures';

const reasons = [
  'DIRECT',
  'MENTION',
  'ROLE',
  'ORGANIZATION',
  'SUBSCRIPTION',
  'MANDATORY_POLICY',
] as const;
const reasonLabels = [
  '직접 수신',
  '나를 멘션함',
  '담당 역할에 포함됨',
  '소속 조직에 전달됨',
  '구독 중인 소식',
  '필수 정책 알림',
];
const items = reasons.map((kind, index) => ({
  ...notification,
  notificationId: `reason-${kind}`,
  threadKey: `thread:${kind.toLocaleLowerCase('en-US')}`,
  testContexts: {
    ACTOR: [index % 2 === 0 ? 'user:42' : 'user:84'],
    THREAD: [`thread:${kind.toLocaleLowerCase('en-US')}`],
    RESOURCE: [index < 2 ? 'project:renewal' : 'project:other'],
    TOPIC_TOKEN: [`topic-${kind.toLocaleLowerCase('en-US')}`],
  },
  title: `수신 이유 ${kind}`,
  readAt: null,
  actionable: index === 0,
  attentionEffect: index < 2 ? ('PRIORITIZE' as const) : ('FOLLOW' as const),
  reason: { kind, label: reasonLabels[index] },
}));

type NotificationSavedView = {
  savedViewId: string;
  surfaceKey: string;
  name: string;
  scope: 'PERSONAL' | 'TEAM' | 'TENANT';
  ownerUserId: number | null;
  ownerGroupRef: string | null;
  lifecycleState: 'ACTIVE';
  retentionUntil: null;
  editable: boolean;
  favorite: boolean;
  defaultView: boolean;
  configuration: Record<string, unknown>;
  version: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type SavedViewUpdateRequest = {
  savedViewId: string;
  payload: Record<string, unknown>;
};

async function mockNotificationSavedViews(page: Page, initialViews: NotificationSavedView[] = []) {
  let views = [...initialViews];
  let createdPayload: Record<string, unknown> | null = null;
  let usedViewId: string | null = null;
  const updateRequests: SavedViewUpdateRequest[] = [];
  const preferenceRequests: SavedViewUpdateRequest[] = [];

  await page.route('**/api/platform/v1/workspace/saved-views**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    if (url.pathname.endsWith('/saved-views') && method === 'GET') {
      return fulfillSuccess(route, views);
    }
    if (url.pathname.endsWith('/saved-views') && method === 'POST') {
      createdPayload = request.postDataJSON() as Record<string, unknown>;
      const created: NotificationSavedView = {
        savedViewId: 'notification-saved-view-1',
        surfaceKey: url.searchParams.get('surfaceKey') ?? '',
        name: String(createdPayload.name),
        scope: 'PERSONAL',
        ownerUserId: 900018,
        ownerGroupRef: null,
        lifecycleState: 'ACTIVE',
        retentionUntil: null,
        editable: true,
        favorite: Boolean(createdPayload.favorite),
        defaultView: Boolean(createdPayload.defaultView),
        configuration: createdPayload.configuration as Record<string, unknown>,
        version: 1,
        lastUsedAt: null,
        createdAt: '2026-09-08T13:00:00Z',
        updatedAt: '2026-09-08T13:00:00Z',
      };
      views = [created];
      return fulfillSuccess(route, created);
    }
    if (url.pathname.endsWith('/preference') && method === 'PUT') {
      const savedViewId = url.pathname.split('/').at(-2) ?? '';
      const payload = request.postDataJSON() as Record<string, unknown>;
      preferenceRequests.push({ savedViewId, payload });
      const updated = views.find((view) => view.savedViewId === savedViewId);
      if (!updated) return route.fulfill({ status: 404 });
      const next = {
        ...updated,
        favorite: Boolean(payload.favorite),
        defaultView: Boolean(payload.defaultView),
        version: updated.version + 1,
      };
      views = views.map((view) => (view.savedViewId === savedViewId ? next : view));
      return fulfillSuccess(route, next);
    }
    if (method === 'PUT') {
      const savedViewId = url.pathname.split('/').at(-1) ?? '';
      const payload = request.postDataJSON() as Record<string, unknown>;
      updateRequests.push({ savedViewId, payload });
      const updated = views.find((view) => view.savedViewId === savedViewId);
      if (!updated) return route.fulfill({ status: 404 });
      const next: NotificationSavedView = {
        ...updated,
        name: String(payload.name),
        scope: payload.scope as NotificationSavedView['scope'],
        ownerGroupRef: (payload.ownerGroupRef as string | null) ?? null,
        configuration: payload.configuration as Record<string, unknown>,
        version: updated.version + 1,
      };
      views = views.map((view) => (view.savedViewId === savedViewId ? next : view));
      return fulfillSuccess(route, next);
    }
    if (url.pathname.endsWith('/use') && method === 'POST') {
      usedViewId = url.pathname.split('/').at(-2) ?? null;
      return route.fulfill({ status: 204 });
    }
    return route.abort('failed');
  });

  return {
    get createdPayload() {
      return createdPayload;
    },
    get usedViewId() {
      return usedViewId;
    },
    get views() {
      return views;
    },
    updateRequests,
    preferenceRequests,
  };
}

function notificationSavedView(
  savedViewId: string,
  name: string,
  displayOrder: number,
  options: Partial<
    Pick<NotificationSavedView, 'scope' | 'editable' | 'favorite' | 'ownerUserId'>
  > = {}
): NotificationSavedView {
  return {
    savedViewId,
    surfaceKey: 'notifications.work',
    name,
    scope: options.scope ?? 'PERSONAL',
    ownerUserId: options.ownerUserId ?? 900018,
    ownerGroupRef: null,
    lifecycleState: 'ACTIVE',
    retentionUntil: null,
    editable: options.editable ?? true,
    favorite: options.favorite ?? false,
    defaultView: false,
    configuration: {
      contract: 'dwp.notifications.center.saved-view',
      version: 5,
      scope: {
        view: 'ALL',
        query: savedViewId,
        appKey: '',
        priority: 'ALL',
        readState: 'ALL',
        reason: 'ALL',
        attentionEffect: 'ALL',
      },
      presentation: {
        density: 'DETAILED',
        grouping: 'NONE',
        icon: 'BELL',
        color: 'BLUE',
        displayOrder,
      },
      includedTypes: [],
      contextMatch: 'ALL_KINDS_ANY_VALUE',
      contextFilters: [],
    },
    version: 1,
    lastUsedAt: null,
    createdAt: '2026-09-08T13:00:00Z',
    updatedAt: '2026-09-08T13:00:00Z',
  };
}

async function mockNotificationContextCatalog(page: Page) {
  await page.route('**/api/notifications/v1/me/attention-contexts**', async (route) => {
    const url = new URL(route.request().url());
    const kind = url.searchParams.get('kind');
    const items =
      kind === 'RESOURCE'
        ? [
            {
              scopeKind: 'RESOURCE',
              contextKind: 'PROJECT',
              scopeKey: 'project:roadmap',
              displayLabel: 'Roadmap project',
              lastSeenAt: '2026-09-17T00:00:00Z',
            },
          ]
        : [
            {
              scopeKind: 'TOPIC_TOKEN',
              contextKind: 'TOPIC',
              scopeKey: 'security',
              displayLabel: 'Security topic',
              lastSeenAt: '2026-09-17T00:00:00Z',
            },
          ];
    return fulfillSuccess(route, {
      items,
      limit: 50,
      generatedAt: '2026-09-17T00:00:00Z',
    });
  });
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Explicit desktop and mobile viewport matrix.');
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    permissions: NOTIFICATION_PERMISSION,
  });
  await mockNotificationCenter(page, {
    totalUnread: 6,
    viewCounts: { PRIORITY: 1, ALL: 6, MENTIONS: 1, SAVED: 0, SNOOZED: 0, DONE: 0 },
    inboxItems: () => items,
    inboxPage: (url) => {
      const p = new URL(url).searchParams;
      const contextKinds = p.getAll('contextKind');
      const contextKeys = p.getAll('contextKey');
      const includedTypes = p.getAll('includedType');
      const contextsByKind = contextKinds.reduce<Map<string, string[]>>((contexts, kind, index) => {
        const key = contextKeys[index];
        if (!key) return contexts;
        contexts.set(kind, [...(contexts.get(kind) ?? []), key]);
        return contexts;
      }, new Map());
      const filtered = items.filter(
        (item) =>
          (p.get('view') !== 'MENTIONS' || item.reason.kind === 'MENTION') &&
          (p.get('view') !== 'PRIORITY' || item.actionable) &&
          (includedTypes.length === 0 ||
            includedTypes.includes(item.reason.kind === 'ROLE' ? 'ASSIGNED' : item.reason.kind)) &&
          (!p.get('appKey') || item.source.appKey === p.get('appKey')) &&
          (!p.get('reason') || item.reason.kind === p.get('reason')) &&
          (!p.get('attentionEffect') || item.attentionEffect === p.get('attentionEffect')) &&
          [...contextsByKind].every(([kind, keys]) =>
            keys.some((key) =>
              item.testContexts[kind as keyof typeof item.testContexts].includes(key)
            )
          ) &&
          (!p.get('query') || item.title.includes(p.get('query')!))
      );
      return {
        items: filtered,
        nextCursor: null,
        hasMore: false,
        approximateTotal: filtered.length,
      };
    },
  });
  await mockNotificationProfile(page);
  await mockNotificationContextCatalog(page);
});

test('홈 요약 선택은 해당 알림을 서버 조회하고 홈 안에서 바로 전환한다', async ({
  page,
}, testInfo) => {
  await page.goto('/notifications/home');
  const mentions = page
    .getByRole('group', { name: '알림 요약' })
    .getByRole('button', { name: /나를 멘션/ });
  await mentions.click();
  await expect(mentions).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/\/notifications\/home$/);
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: '수신 이유 MENTION', exact: true })).toBeVisible();
  await mentions.click();
  await expect(page.getByRole('article')).toHaveCount(5);
  await expect(page.getByRole('link', { name: '1건 더 보기' })).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(page.locator('.MuiTouchRipple-rippleVisible')).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('notification-home-action-first.png'),
    animations: 'disabled',
    fullPage: true,
  });
});

test('수신 이유 6종은 서버 query와 표시를 일치시키고 필터 초기화로 복원한다', async ({ page }) => {
  await page.goto('/notifications/center?view=all');
  for (const [index, reason] of reasons.entries()) {
    const response = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname.endsWith('/inbox') &&
        new URL(r.url()).searchParams.get('reason') === reason
    );
    await page.getByRole('combobox', { name: '수신 이유', exact: true }).click();
    await page.getByRole('option', { name: reasonLabels[index], exact: true }).click();
    await response;
    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(
      page
        .getByRole('list', { name: '알림 목록' })
        .getByRole('heading', { name: `수신 이유 ${reason}`, exact: true })
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`reason=${reason.toLowerCase()}`));
  }
  await page.getByRole('button', { name: '필터 초기화' }).click();
  await expect(page.getByRole('article')).toHaveCount(6);
});

test('수신 이유 전환은 이전 범위의 일괄 선택을 해제하고 숨겨진 알림을 처리하지 않는다', async ({
  page,
}) => {
  const bulkRequests: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/inbox/bulk-actions')) {
      bulkRequests.push(request.postData() ?? '');
    }
  });
  await page.goto('/notifications/center?view=all&reason=direct');
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('checkbox').check();
  await expect(page.getByRole('toolbar')).toBeVisible();
  await page.getByRole('combobox', { name: '수신 이유', exact: true }).click();
  await page.getByRole('option', { name: reasonLabels[2], exact: true }).click();
  await expect(
    page
      .getByRole('list', { name: '알림 목록' })
      .getByRole('heading', { name: '수신 이유 ROLE', exact: true })
  ).toBeVisible();
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await expect(page.getByRole('toolbar')).toHaveCount(0);
  expect(bulkRequests).toEqual([]);
});

test('멘션 보기는 일반 대화를 제외하고 읽음 조건과 URL 범위를 보존하며 뒤로 이동한다', async ({
  page,
}) => {
  await page.goto('/notifications/center?view=all&read=unread&contextProbe=keep');
  const views = page.getByRole('navigation', { name: '알림 센터 보기' });
  await views.getByRole('button', { name: /^나를 멘션/ }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(
    page
      .getByRole('list', { name: '알림 목록' })
      .getByRole('heading', { name: '수신 이유 MENTION', exact: true })
  ).toBeVisible();
  await expect(page).toHaveURL(/contextProbe=keep/);
  await expect(page).toHaveURL(/view=mentions&read=unread/);
  await expect(page.getByRole('combobox', { name: '수신 이유', exact: true })).toHaveAttribute(
    'aria-disabled',
    'true'
  );
  await views.getByRole('button', { name: /^저장됨/ }).click();
  await expect(page).toHaveURL(/view=saved/);
  await page.goBack();
  await expect(page).toHaveURL(/view=mentions&read=unread/);
  await expect(views.getByRole('button', { name: /^나를 멘션/ })).toHaveAttribute(
    'aria-current',
    'page'
  );
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page).toHaveURL(/contextProbe=keep/);
});

test('필터 결과 없음은 받은 알림이 없는 상태와 구분한다', async ({ page }) => {
  await page.goto('/notifications/center?view=all&q=unmatched');
  await expect(page.getByRole('heading', { name: '조건에 맞는 알림이 없습니다' })).toBeVisible();
  await page.getByRole('button', { name: '필터 초기화' }).click();
  await expect(page.getByRole('article')).toHaveCount(6);
});

test('우선 규칙 정본 필터와 실제 결과 수를 URL·reload에 유지한다', async ({ page }) => {
  await page.goto('/notifications/center?view=all');
  await expect(page.getByText('현재 표시 6 / 필터 결과 총 6', { exact: true })).toBeVisible();
  await expect(
    page
      .getByTestId('notification-desktop-inspector')
      .getByRole('heading', { name: '수신 이유 DIRECT', exact: true })
  ).toBeVisible();

  const response = page.waitForResponse((candidate) => {
    const url = new URL(candidate.url());
    return (
      url.pathname.endsWith('/inbox') && url.searchParams.get('attentionEffect') === 'PRIORITIZE'
    );
  });
  await page.getByRole('combobox', { name: '우선 규칙 적용' }).click();
  await page.getByRole('option', { name: '중요 인물·우선 규칙 적용' }).click();
  await response;

  await expect(page).toHaveURL(/attentionEffect=prioritize/);
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(page.getByText('현재 표시 2 / 필터 결과 총 2', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(2);
});

test('모바일 최초 진입은 목록을 유지하고 상세를 자동으로 열지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/notifications/center?view=all');

  await expect(page.getByRole('article')).toHaveCount(6);
  await expect(page.getByRole('complementary', { name: '알림 상세' })).toHaveCount(0);
});

test('업무 맥락 필터는 정확한 스레드 범위를 URL과 서버 조회에 보존한다', async ({ page }) => {
  const matchingRequest = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname.endsWith('/inbox') &&
      url.searchParams.get('contextKind') === 'THREAD' &&
      url.searchParams.get('contextKey') === 'thread:mention'
    );
  });

  await page.goto('/notifications/center?view=all');
  await page.getByRole('combobox', { name: '업무 맥락 필터' }).click();
  await page.getByRole('option', { name: '수신 이유 MENTION', exact: true }).click();
  await page.keyboard.press('Escape');
  await matchingRequest;

  await expect(page).toHaveURL(/context=thread/);
  await expect(page).toHaveURL(/contextKey=thread%3Amention/);
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(
    page
      .getByRole('list', { name: '알림 목록' })
      .getByRole('heading', { name: '수신 이유 MENTION', exact: true })
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(1);
});

test('다중 업무 맥락은 같은 종류 OR와 종류 간 AND를 URL·reload에 유지한다', async ({ page }) => {
  const query =
    'view=all&context=actor&contextKey=user%3A42&context=actor&contextKey=user%3A84' +
    '&context=resource&contextKey=project%3Arenewal';
  const matchingRequest = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname.endsWith('/inbox') &&
      url.searchParams.getAll('contextKind').join(',') === 'ACTOR,ACTOR,RESOURCE' &&
      url.searchParams.getAll('contextKey').join(',') === 'user:42,user:84,project:renewal'
    );
  });

  await page.goto(`/notifications/center?${query}`);
  await matchingRequest;
  await expect(page.getByRole('article')).toHaveCount(2);
  const list = page.getByRole('list', { name: '알림 목록' });
  await expect(list.getByRole('heading', { name: '수신 이유 DIRECT', exact: true })).toBeVisible();
  await expect(list.getByRole('heading', { name: '수신 이유 MENTION', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(page).not.toHaveURL(/contextLabel=/);
});

test('현재 알림 조건을 개인 보기로 저장하고 동일한 서버 조회 범위를 복원한다', async ({
  page,
}, testInfo) => {
  const store = await mockNotificationSavedViews(page);
  await page.goto(
    '/notifications/center?view=all&read=unread&app=approvals&reason=direct' +
      '&context=actor&contextKey=user%3A42&context=actor&contextKey=user%3A84' +
      '&context=resource&contextKey=project%3Arenewal'
  );

  await page.getByRole('button', { name: /^저장된 뷰:/ }).click();
  await page.getByRole('menuitem', { name: '현재 조건 저장' }).click();
  await expect(page.locator('.MuiDrawer-paperAnchorRight')).toBeVisible();
  await expect(page.getByRole('form', { name: '현재 조건을 뷰로 저장' })).toBeVisible();
  await page.getByLabel('뷰 이름').fill('직접 수신 미확인');
  await page.getByRole('button', { name: 'AT_SIGN' }).click();
  await page.getByRole('button', { name: 'VIOLET' }).click();
  await page.getByRole('combobox', { name: '포함 알림 유형' }).last().click();
  await page.locator('[role="option"][data-value="ASSIGNED"]').click();
  await page.keyboard.press('Escape');
  await page.getByRole('combobox', { name: '업무 맥락 필터' }).last().click();
  await page.getByRole('option', { name: 'Security topic' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '간결하게', exact: true }).click();
  await page
    .getByRole('form', { name: '현재 조건을 뷰로 저장' })
    .getByRole('combobox', { name: /알림 묶기/ })
    .click();
  await page.getByRole('option', { name: '업무 앱별', exact: true }).click();
  await page.getByRole('button', { name: '생성', exact: true }).click();

  await expect(page.getByRole('button', { name: '저장된 뷰: 직접 수신 미확인' })).toBeVisible();
  expect(store.createdPayload).toMatchObject({
    name: '직접 수신 미확인',
    scope: 'PERSONAL',
    configuration: {
      contract: 'dwp.notifications.center.saved-view',
      version: 5,
      scope: {
        view: 'ALL',
        query: '',
        appKey: 'approvals',
        priority: 'ALL',
        readState: 'UNREAD',
        reason: 'ALL',
        attentionEffect: 'ALL',
      },
      presentation: {
        density: 'DENSE',
        grouping: 'SOURCE',
        icon: 'AT_SIGN',
        color: 'VIOLET',
        displayOrder: 0,
      },
      includedTypes: ['DIRECT', 'ASSIGNED'],
      contextMatch: 'ALL_KINDS_ANY_VALUE',
      contextFilters: [
        { kind: 'ACTOR', key: 'user:42', label: '' },
        { kind: 'ACTOR', key: 'user:84', label: '' },
        { kind: 'RESOURCE', key: 'project:renewal', label: '' },
        { kind: 'TOPIC_TOKEN', key: 'security', label: 'Security topic' },
      ],
    },
  });

  await page
    .getByRole('navigation', { name: '알림 센터 보기' })
    .getByRole('button', { name: /^조치 필요/ })
    .click();
  await expect(page).toHaveURL(/view=priority/);
  await page.getByRole('button', { name: /^저장된 뷰:/ }).click();
  await page.getByRole('menuitem').filter({ hasText: '직접 수신 미확인' }).click();

  await expect(page).toHaveURL(/view=all&read=unread&app=approvals&type=direct&type=assigned/);
  await expect(page.getByRole('button', { name: '저장된 뷰: 직접 수신 미확인' })).toBeVisible();
  await expect(page.getByLabel('활성 저장 보기 스타일')).toBeVisible();
  await expect.poll(() => store.usedViewId).toBe('notification-saved-view-1');
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('notification-saved-view-applied.png'),
    animations: 'disabled',
    fullPage: true,
  });
});

test('390px 저장 보기 편집기는 하단 시트로 열리고 실제 조건을 노출한다', async ({ page }) => {
  await mockNotificationSavedViews(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/notifications/center?view=all&read=unread');

  await page.getByRole('button', { name: /^저장된 뷰:/ }).click();
  await page.getByRole('menuitem', { name: '현재 조건 저장' }).click();

  await expect(page.locator('.MuiDrawer-paperAnchorBottom')).toBeVisible();
  const editor = page.getByRole('form', { name: '현재 조건을 뷰로 저장' });
  await expect(editor).toBeVisible();
  await expect(editor.getByLabel('안 읽음')).toBeChecked();
  await expect(editor.getByLabel('표시 밀도')).toBeVisible();
  await expect(editor.getByRole('button', { name: 'BELL' })).toBeVisible();
  await expect(editor.getByRole('button', { name: 'BLUE' })).toBeVisible();
  await expect(editor.getByRole('combobox', { name: '포함 알림 유형' })).toBeVisible();
  await expect(editor.getByText('저장 시 6건의 알림이 포함됩니다.')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('저장 보기 고정과 개인 순서는 실제 API에 낙관적으로 반영하고 조직 보기는 보호한다', async ({
  page,
}) => {
  const store = await mockNotificationSavedViews(page, [
    notificationSavedView('personal-first', '개인 보기 A', 0),
    notificationSavedView('personal-second', '개인 보기 B', 1),
    notificationSavedView('tenant-policy', '조직 표준 보기', 0, {
      scope: 'TENANT',
      editable: false,
      ownerUserId: null,
    }),
  ]);
  await page.goto('/notifications/center?view=all');

  await page.getByRole('button', { name: /^저장된 뷰:/ }).click();
  await page.getByRole('menuitem', { name: '저장된 뷰 관리' }).click();
  const manager = page.locator('.MuiDrawer-paper').filter({
    has: page.getByRole('heading', { name: '저장된 뷰 관리', exact: true }),
  });
  const rows = manager.getByTestId('notification-saved-view-row');
  await expect(manager.getByText('내 저장 보기 2 / 20', { exact: true })).toBeVisible();
  await expect(rows).toHaveCount(3);
  await expect(manager.getByRole('group', { name: '개인 보기 A', exact: true })).toBeVisible();
  await expect(manager.getByRole('group', { name: '개인 보기 B', exact: true })).toBeVisible();

  await manager
    .getByRole('group', { name: '개인 보기 B', exact: true })
    .getByRole('button', { name: '위로 이동' })
    .click();
  await expect
    .poll(async () =>
      (
        await rows.evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute('aria-label') ?? '')
        )
      ).filter((name) => name.startsWith('개인 보기'))
    )
    .toEqual(['개인 보기 B', '개인 보기 A']);
  await expect.poll(() => store.updateRequests.length).toBe(2);
  expect(
    store.updateRequests.map(({ savedViewId, payload }) => ({
      savedViewId,
      displayOrder: (payload.configuration as { presentation: { displayOrder: number } })
        .presentation.displayOrder,
    }))
  ).toEqual(
    expect.arrayContaining([
      { savedViewId: 'personal-second', displayOrder: 0 },
      { savedViewId: 'personal-first', displayOrder: 1 },
    ])
  );

  await manager
    .getByRole('group', { name: '개인 보기 B', exact: true })
    .getByRole('button', { name: '즐겨찾기에 추가' })
    .click();
  await expect.poll(() => store.preferenceRequests.length).toBe(1);
  expect(store.preferenceRequests[0]).toEqual({
    savedViewId: 'personal-second',
    payload: { favorite: true, defaultView: false },
  });

  const organization = manager.getByRole('group', { name: '조직 표준 보기', exact: true });
  await expect(organization.getByText('조직 공유', { exact: true })).toBeVisible();
  await expect(organization.getByRole('button', { name: '뷰 편집' })).toBeDisabled();
});

test('개인 저장 보기와 고정 보기의 한도를 초과하는 작업을 UI에서 차단한다', async ({ page }) => {
  const cappedViews = Array.from({ length: 20 }, (_, index) =>
    notificationSavedView(
      `capacity-${index + 1}`,
      `개인 한도 ${String(index + 1).padStart(2, '0')}`,
      index,
      { favorite: index < 8 }
    )
  );
  await mockNotificationSavedViews(page, cappedViews);
  await page.goto('/notifications/center?view=all');

  await page.getByRole('button', { name: /^저장된 뷰:/ }).click();
  await expect(page.getByRole('menuitem', { name: '현재 조건 저장' })).toHaveCount(0);
  await page.getByRole('menuitem', { name: '저장된 뷰 관리' }).click();
  const manager = page.locator('.MuiDrawer-paper').filter({
    has: page.getByRole('heading', { name: '저장된 뷰 관리', exact: true }),
  });
  await expect(manager.getByText('내 저장 보기 20 / 20', { exact: true })).toBeVisible();
  await expect(
    manager
      .getByRole('group', { name: '개인 한도 09', exact: true })
      .getByRole('button', { name: '즐겨찾기에 추가' })
  ).toBeDisabled();
});

test('알림 정리에 실패하면 낙관적으로 숨긴 항목을 복원한다', async ({ page }) => {
  await mockNotificationCenter(page, { triageFailureActions: ['COMPLETE'] });
  await mockNotificationProfile(page);
  await page.goto('/notifications/center');
  const list = page.getByRole('list', { name: '알림 목록' });
  await list.getByRole('button', { name: '알림 정리', exact: true }).click();
  await expect(list.getByRole('heading', { name: notification.title, exact: true })).toBeVisible();
  await expect(list.getByRole('button', { name: '알림 정리', exact: true })).toBeEnabled();
  await expect(
    page.getByText('알림 상태를 변경하지 못했습니다. 최신 상태를 확인한 뒤 다시 시도해 주세요.', {
      exact: true,
    })
  ).toBeVisible();
});

for (const width of [390, 320]) {
  test(`모바일 ${width}px에서 모든 보기와 수신 이유 필터에 접근한다`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/notifications/center?view=all');
    await page
      .getByRole('navigation', { name: '알림 센터 보기' })
      .getByRole('button', { name: /^나를 멘션/ })
      .click();
    await expect(page.getByRole('article')).toHaveCount(1);
    await page.getByRole('button', { name: '상세 필터', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '상세 필터' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('combobox', { name: '읽음 상태 필터' }).click();
    await page.getByRole('option', { name: '안 읽음', exact: true }).click();
    await dialog.getByRole('button', { name: '필터 닫기' }).click();
    await expect(page.getByRole('button', { name: '상세 필터', exact: true })).toBeFocused();
    await expect(page).toHaveURL(/view=mentions&read=unread/);
    await expectNoHorizontalOverflow(page);
    const violations = (
      await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze()
    ).violations;
    expect(violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`notification-views-${width}.png`),
      fullPage: true,
    });
  });
}

test('홈과 알림 센터는 200% 배율의 유효 화면 폭에서도 탐색할 수 있다', async ({
  page,
}, testInfo) => {
  // Browser zoom halves the CSS viewport; CSS zoom alone does not update media queries.
  await page.setViewportSize({ width: 640, height: 450 });
  for (const route of ['/notifications/home', '/notifications/center?view=all']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    if (route.includes('center')) {
      await expect(
        page
          .getByRole('navigation', { name: '알림 센터 보기' })
          .getByRole('button', { name: /^받은 알림/ })
      ).toBeVisible();
      await page.getByRole('button', { name: '상세 필터', exact: true }).click();
      await expect(page.getByRole('dialog', { name: '상세 필터' })).toBeVisible();
      await page.getByRole('button', { name: '필터 닫기' }).click();
    }
    await page.screenshot({
      path: testInfo.outputPath(`${route.includes('home') ? 'home' : 'center'}-zoom200.png`),
      fullPage: true,
    });
  }
});
