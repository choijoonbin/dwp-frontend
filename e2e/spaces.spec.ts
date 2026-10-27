import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  DIRECTORY_SPACES,
  SPACE_SUMMARY,
  SPACE_TEMPLATE,
  deferredDirectoryResponse,
  directoryCards,
  envelope,
  expectNoDirectoryEmptyState,
  mockDirectorySession,
  mockSpaceSession,
} from './support/space-fixtures';

test('members receive an accessible responsive Space command center', async ({ page }) => {
  await mockSpaceSession(page);
  await page.route('**/api/spaces/v1/home', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        generatedAt: '2026-08-18T09:30:00Z',
        metrics: {
          mySpaces: 1,
          discoverableSpaces: 2,
          pendingRequests: 0,
          reviewQueue: 0,
          unreadSignals: 1,
        },
        focusSpaces: [SPACE_SUMMARY],
        recentActivity: [
          {
            activityId: 'c1000000-0000-0000-0000-000000000001',
            spaceKey: 'company-square',
            spaceNameKo: 'SKAX 타운스퀘어',
            spaceNameEn: 'SKAX Town Square',
            activityType: 'CONTENT_PUBLISHED',
            actorType: 'USER',
            actorName: 'Alex Park',
            objectType: 'POST',
            titleKo: '전사 소식이 게시되었습니다.',
            titleEn: 'A company update was published.',
            route: '/spaces/company-square/content',
            occurredAt: '2026-08-18T09:20:00Z',
          },
        ],
        recommendedTemplates: [SPACE_TEMPLATE],
        insights: [
          {
            key: 'freshness',
            tone: 'positive',
            titleKo: '활발한 참여',
            titleEn: 'Healthy participation',
            detailKo: '최근 활동과 콘텐츠가 안정적으로 이어지고 있습니다.',
            detailEn: 'Recent activity and content remain healthy.',
            route: '/spaces/my',
          },
        ],
        canCreate: true,
        canAdminister: false,
      }),
    })
  );
  await page.route('**/api/spaces/v1/templates', (route) =>
    route.fulfill({ contentType: 'application/json', body: envelope([SPACE_TEMPLATE]) })
  );

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/spaces/home');

  await expect(
    page.getByRole('heading', { name: "Where Mina Kim's work comes together" })
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'SKAX Town Square', exact: true })).toContainText(
    '2 access subjects'
  );
  await expect(page.getByRole('heading', { name: 'Collaboration insights' })).toBeVisible();

  await page.getByRole('button', { name: /Expert community/ }).click();
  await expect(page.getByRole('dialog', { name: 'Create a new space' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Expert community/ })).toBeChecked();
  await page.getByRole('button', { name: 'Cancel' }).click();

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileOverflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(mobileOverflow.documentWidth).toBeLessThanOrEqual(mobileOverflow.viewport);
});

test('Space discover cards keep full-width aligned headers at supported widths', async ({
  page,
}, testInfo) => {
  await mockDirectorySession(page, { roles: ['TENANT_ADMIN'] });
  await page.route(/\/api\/spaces\/v1\/spaces\?/, (route) =>
    route.fulfill({ contentType: 'application/json', body: envelope(DIRECTORY_SPACES) })
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/spaces/discover');
  await expect(page.getByRole('heading', { name: 'Discover spaces', exact: true })).toBeVisible();
  await expect(page.getByLabel('5 results', { exact: true })).toBeVisible();

  for (const space of DIRECTORY_SPACES) {
    const card = page.getByRole('link', { name: space.nameEn, exact: true });
    await expect(card).toHaveAttribute('href', `/spaces/${space.spaceKey}/overview`);
    await expect(card).toHaveAccessibleName(space.nameEn);
    await expect(card.getByRole('heading', { name: space.nameEn, exact: true })).toBeVisible();
    await expect(card.getByText(/^Last activity /)).toBeVisible();
    await expect(card.getByText('Joined', { exact: true })).toHaveCount(space.memberRole ? 1 : 0);
  }
  await expect(
    page.getByRole('link', { name: DIRECTORY_SPACES[2].nameEn, exact: true })
  ).toContainText('Private');
  await expect(
    page.getByRole('link', { name: DIRECTORY_SPACES[4].nameEn, exact: true })
  ).toContainText('Hidden');
  await expect(page.getByRole('link', { name: SPACE_SUMMARY.nameEn, exact: true })).toContainText(
    '2 access subjects'
  );

  for (const width of [1440, 1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('main')).toHaveCSS(
      'width',
      `${width - (width < 1200 ? 0 : 248)}px`
    );
    await expect(page.getByRole('main')).toHaveCSS('margin-left', width < 1200 ? '0px' : '248px');
    await page.evaluate(() => document.fonts.ready);
    const metrics = await directoryCards(page).evaluateAll((cards) =>
      cards.map((card) => {
        const bounds = card.getBoundingClientRect();
        const style = getComputedStyle(card);
        const header = card.querySelector(':scope > div')!;
        const headerBounds = header.getBoundingClientRect();
        const glyph = header.firstElementChild!.getBoundingClientRect();
        const badges = header.lastElementChild!.getBoundingClientRect();
        return {
          name: card.getAttribute('aria-label'),
          width: bounds.width,
          innerWidth:
            bounds.width - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth),
          innerLeft: bounds.left + parseFloat(style.borderLeftWidth),
          innerTop: bounds.top + parseFloat(style.borderTopWidth),
          headerWidth: headerBounds.width,
          headerLeft: headerBounds.left,
          headerTop: headerBounds.top,
          centerDifference: Math.abs(glyph.top + glyph.height / 2 - badges.top - badges.height / 2),
          overflow: card.scrollWidth - card.clientWidth,
        };
      })
    );
    expect(metrics).toHaveLength(DIRECTORY_SPACES.length);
    for (const metric of metrics) {
      const context = `${width}px: ${metric.name}`;
      expect(Math.abs(metric.headerWidth - metric.innerWidth), context).toBeLessThanOrEqual(1);
      expect(Math.abs(metric.headerLeft - metric.innerLeft), context).toBeLessThanOrEqual(1);
      expect(Math.abs(metric.headerTop - metric.innerTop), context).toBeLessThanOrEqual(1);
      expect(Math.abs(metric.width - metrics[0].width), context).toBeLessThanOrEqual(1);
      expect(metric.centerDifference, context).toBeLessThanOrEqual(1);
      expect(metric.overflow, context).toBeLessThanOrEqual(1);
    }
    const overflow = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    expect(overflow.documentWidth, `${width}px document overflow`).toBeLessThanOrEqual(
      overflow.viewport
    );
    await page.screenshot({
      path: testInfo.outputPath(`space-discover-${width}.png`),
      fullPage: true,
    });
  }
});

test('Space discover search replaces history and survives detail navigation and browser back', async ({
  page,
}) => {
  await mockDirectorySession(page);
  await page.route(/\/api\/spaces\/v1\/spaces\?/, (route) => {
    const query = new URL(route.request().url()).searchParams.get('q')?.toLowerCase() ?? '';
    const results = DIRECTORY_SPACES.filter((space) =>
      `${space.nameEn} ${space.summaryEn}`.toLowerCase().includes(query)
    );
    return route.fulfill({ contentType: 'application/json', body: envelope(results) });
  });
  await page.goto('/spaces/discover?q=Engineering&context=review');
  const search = page.getByRole('textbox', {
    name: 'Search space name or description',
    exact: true,
  });
  await expect(search).toHaveValue('Engineering');
  await expect(directoryCards(page)).toHaveCount(1);
  const initialHistoryLength = await page.evaluate(() => window.history.length);

  await search.fill('AI');
  await expect(page).toHaveURL(/\/spaces\/discover\?q=AI&context=review$/);
  await expect(directoryCards(page)).toHaveCount(1);
  await expect(page.getByLabel('1 result', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.history.length)).toBe(initialHistoryLength);
  await page.getByRole('link', { name: DIRECTORY_SPACES[1].nameEn, exact: true }).click();
  await expect(page).toHaveURL(/\/spaces\/ai-transformation\/overview$/);
  await expect(
    page.getByRole('heading', { name: DIRECTORY_SPACES[1].nameEn, exact: true })
  ).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/spaces\/discover\?q=AI&context=review$/);
  await expect(search).toHaveValue('AI');
  await expect(directoryCards(page)).toHaveCount(1);
  await expect(
    page.getByRole('link', { name: DIRECTORY_SPACES[1].nameEn, exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(page).toHaveURL(/\/spaces\/discover\?context=review$/);
  await expect(search).toHaveValue('');
  await expect(page.getByLabel('5 results', { exact: true })).toBeVisible();
});

test('Space discover announces pending searches and keeps prior cards without false zero or empty states', async ({
  page,
}) => {
  await mockDirectorySession(page);
  const initialResponse = deferredDirectoryResponse();
  const searchResponse = deferredDirectoryResponse();
  await page.route(/\/api\/spaces\/v1\/spaces\?/, async (route) => {
    const query = new URL(route.request().url()).searchParams.get('q');
    await (query ? searchResponse.promise : initialResponse.promise);
    return route.fulfill({
      contentType: 'application/json',
      body: envelope(query ? [DIRECTORY_SPACES[1]] : DIRECTORY_SPACES),
    });
  });

  try {
    await page.goto('/spaces/discover');
    const status = page
      .getByRole('region', { name: 'Space directory', exact: true })
      .getByRole('status');
    await expect(status).toHaveText('Searching…');
    await expect(page.locator('main [aria-busy="true"]')).toBeVisible();
    await expect(directoryCards(page)).toHaveCount(0);
    await expectNoDirectoryEmptyState(page);

    initialResponse.release();
    await expect(directoryCards(page)).toHaveCount(5);
    await expect(page.getByLabel('5 results', { exact: true })).toBeVisible();
    await page
      .getByRole('textbox', { name: 'Search space name or description', exact: true })
      .fill('AI');
    await expect(status).toHaveText('Searching…');
    await expect(directoryCards(page)).toHaveCount(5);
    await expect(page.locator('main [aria-busy="true"]')).toBeVisible();
    await expectNoDirectoryEmptyState(page);

    searchResponse.release();
    await expect(page.getByLabel('1 result', { exact: true })).toBeVisible();
    await expect(directoryCards(page)).toHaveCount(1);
    await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
    await expect(status).not.toContainText('Searching…');
  } finally {
    initialResponse.release();
    searchResponse.release();
  }
});

test('Space discover failed loads offer Retry without claiming the directory is empty', async ({
  page,
}) => {
  await mockDirectorySession(page);
  let fail = true;
  await page.route(/\/api\/spaces\/v1\/spaces\?/, (route) =>
    fail
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Fixture directory outage' }),
        })
      : route.fulfill({ contentType: 'application/json', body: envelope(DIRECTORY_SPACES) })
  );
  await page.goto('/spaces/discover?q=AI');
  await expect(page.getByText('We could not load the spaces.', { exact: true })).toBeVisible();
  await expectNoDirectoryEmptyState(page);
  await expect(directoryCards(page)).toHaveCount(0);

  fail = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByLabel('5 results', { exact: true })).toBeVisible();
  await expect(page.getByText('We could not load the spaces.', { exact: true })).toHaveCount(0);
  await expectNoDirectoryEmptyState(page);
});

test('Space discover warns on a failed refresh while keeping the last successful cards', async ({
  page,
}) => {
  await page.clock.install();
  await mockDirectorySession(page);
  let fail = false;
  await page.route(/\/api\/spaces\/v1\/spaces\?/, (route) =>
    fail
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Fixture refresh outage' }),
        })
      : route.fulfill({ contentType: 'application/json', body: envelope(DIRECTORY_SPACES) })
  );
  await page.goto('/spaces/discover');
  await expect(page.getByLabel('5 results', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: SPACE_SUMMARY.nameEn, exact: true }).click();
  await expect(page).toHaveURL(/\/spaces\/company-square\/overview$/);
  await expect(
    page.getByRole('heading', { name: SPACE_SUMMARY.nameEn, level: 1, exact: true })
  ).toBeVisible();
  // Expire the directory cache while it is unmounted; returning triggers a refresh.
  await page.clock.fastForward(31_000);
  fail = true;
  await page.goBack();
  const warning = page.getByRole('alert').filter({
    hasText: 'We could not refresh the directory. Previous results are shown.',
  });
  await expect(warning).toBeVisible();
  await expect(directoryCards(page)).toHaveCount(5);
  await expectNoDirectoryEmptyState(page);

  fail = false;
  await warning.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(warning).toHaveCount(0);
  await expect(page.getByLabel('5 results', { exact: true })).toBeVisible();
});

test('Space discover exposes localized full names and keyboard focus with dark contrast and reduced motion', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => window.localStorage.setItem('dwp.locale', 'ko'));
  await page.emulateMedia({ colorScheme: 'dark', forcedColors: 'active', reducedMotion: 'reduce' });
  await mockDirectorySession(page, {
    roles: ['TENANT_ADMIN'],
    locale: 'ko',
    preferences: { mode: 'dark', highContrast: true, reduceMotion: true },
  });
  await page.route(/\/api\/spaces\/v1\/spaces\?/, (route) =>
    route.fulfill({ contentType: 'application/json', body: envelope(DIRECTORY_SPACES) })
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/spaces/discover');
  const search = page.getByRole('textbox', { name: 'Space 이름 또는 설명 검색', exact: true });
  await expect(directoryCards(page)).toHaveCount(5);
  await search.focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: SPACE_SUMMARY.nameKo, exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  const longName = DIRECTORY_SPACES[1].nameKo;
  const card = page.getByRole('link', { name: longName, exact: true });
  await expect(card).toBeFocused();
  await expect(card).toHaveAccessibleName(longName);
  await expect(page.getByRole('tooltip', { name: longName, exact: true })).toBeVisible();
  await expect(card).toHaveCSS('transition-property', 'none');
  const focus = await card.evaluate((element) => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
  });
  expect(focus.style).not.toBe('none');
  expect(focus.width).toBeGreaterThanOrEqual(2);
  await page.screenshot({
    path: testInfo.outputPath('space-discover-dark-contrast-keyboard-ko.png'),
    fullPage: true,
  });
});

test('Space control-center routes preserve separation of duties', async ({ page }) => {
  let templateWrites = 0;
  let templatePayload: Record<string, unknown> | null = null;
  await mockSpaceSession(page, {
    roles: ['SPACE_TEMPLATE_ADMIN'],
    permissions: [
      {
        resourceType: 'APP',
        resourceKey: 'APP.ADMINISTRATION',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
      {
        resourceType: 'APP',
        resourceKey: 'APP.SPACES',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
      {
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.SPACE_TEMPLATES',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
      {
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.SPACE_TEMPLATES',
        permissionCode: 'CREATE',
        effect: 'ALLOW',
      },
    ],
  });
  await page.route('**/api/spaces/v1/admin/templates', (route) => {
    if (route.request().method() === 'POST') {
      templateWrites += 1;
      templatePayload = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill({
        contentType: 'application/json',
        body: envelope({ ...SPACE_TEMPLATE, ...templatePayload }),
      });
    }
    return route.fulfill({ contentType: 'application/json', body: envelope([SPACE_TEMPLATE]) });
  });

  await page.goto('/admin/spaces');
  await expect(page).toHaveURL(/\/spaces\/admin\/templates$/);
  await expect(page.getByRole('heading', { name: 'Space templates', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'New template' }).click();
  const templateDialog = page.getByRole('dialog', { name: 'Create Space template' });
  await templateDialog.getByLabel('Template key').fill('delivery-community');
  await templateDialog.getByLabel('Korean name').fill('딜리버리 커뮤니티');
  await templateDialog.getByLabel('English name').fill('Delivery community');
  await templateDialog.getByLabel('Korean description').fill('배포 경험과 운영 지식을 공유합니다.');
  await templateDialog
    .getByLabel('English description')
    .fill('Share delivery practices and operational knowledge.');
  await templateDialog.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => templateWrites).toBe(1);
  expect(templatePayload).toMatchObject({
    templateKey: 'delivery-community',
    nameEn: 'Delivery community',
  });
  await expect(templateDialog).toBeHidden();

  const openSpaceNavigation = page.getByRole('button', { name: 'Open Space navigation' });
  if (await openSpaceNavigation.isVisible()) {
    await openSpaceNavigation.click();
  }
  await expect(page.getByRole('link', { name: 'Templates' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Content reviews' })).toHaveCount(0);

  await page.goto('/admin/spaces/content-reviews');
  await expect(
    page.getByRole('heading', { name: 'This page is outside your access', exact: true })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Content reviews', exact: true })).toHaveCount(0);
});

test('Space lifecycle approvers can record decisions without broad manage authority', async ({
  page,
}) => {
  const review = {
    lifecycleReviewId: 'b2000000-0000-0000-0000-000000000001',
    spaceId: SPACE_SUMMARY.spaceId,
    spaceKey: SPACE_SUMMARY.spaceKey,
    spaceNameKo: SPACE_SUMMARY.nameKo,
    spaceNameEn: SPACE_SUMMARY.nameEn,
    reviewType: 'ACCESS',
    dueAt: '2026-08-31T00:00:00Z',
    status: 'OPEN',
    recommendation: null,
    evidence: { activeMemberships: 2 },
  };
  let decisionWrites = 0;
  let decisionPayload: Record<string, unknown> | null = null;
  await mockSpaceSession(page, {
    roles: ['SPACE_ACCESS_REVIEWER'],
    permissions: [
      {
        resourceType: 'APP',
        resourceKey: 'APP.ADMINISTRATION',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
      {
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.SPACE_ACCESS_REVIEW',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
      {
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.SPACE_ACCESS_REVIEW',
        permissionCode: 'APPROVE',
        effect: 'ALLOW',
      },
    ],
  });
  await page.route('**/api/spaces/v1/admin/lifecycle**', (route) => {
    if (route.request().method() === 'POST') {
      decisionWrites += 1;
      decisionPayload = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill({ contentType: 'application/json', body: envelope(null) });
    }
    return route.fulfill({ contentType: 'application/json', body: envelope([review]) });
  });

  await page.goto('/spaces/admin/lifecycle');
  await expect(page.getByRole('heading', { name: 'Lifecycle reviews', level: 1 })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Lifecycle and access certification', level: 2 })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Review' }).click();
  const decisionDialog = page.getByRole('dialog', { name: 'Record lifecycle decision' });
  await decisionDialog
    .getByLabel('Decision rationale')
    .fill('Access evidence supports retaining this governed Space.');
  await decisionDialog.getByRole('button', { name: 'Record decision' }).click();
  await expect.poll(() => decisionWrites).toBe(1);
  expect(decisionPayload).toEqual({
    recommendation: 'KEEP',
    note: 'Access evidence supports retaining this governed Space.',
  });
});

test('Space moderators can inspect membership without receiving owner controls', async ({
  page,
}) => {
  await mockSpaceSession(page);
  await page.route(/\/api\/spaces\/v1\/spaces\/company-square$/, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        space: { ...SPACE_SUMMARY, memberRole: 'MODERATOR' },
        contentPolicy: 'OWNER_REVIEW',
        appPolicy: 'OWNER_REVIEW',
        aiPolicy: 'MEMBER_SCOPED',
        canContribute: true,
        canModerate: true,
        canManage: false,
        featuredContent: [],
        apps: [
          {
            bindingId: 'd1000000-0000-0000-0000-000000000001',
            appKey: 'CALENDAR',
            displayNameKo: '캘린더',
            displayNameEn: 'Calendar',
            launchTarget: '/calendar/home',
            iconKey: 'calendar',
            dataAccessScope: 'SPACE_ONLY',
            lifecycleState: 'ACTIVE',
          },
        ],
        activity: [],
      }),
    })
  );
  await page.route(/\/api\/spaces\/v1\/spaces\/company-square\/owner\/members$/, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope([
        {
          membershipId: 'e1000000-0000-0000-0000-000000000001',
          principalType: 'GROUP',
          principalRef: 'SKAX_COMMUNICATIONS_EDITORS',
          memberRole: 'MODERATOR',
          membershipSource: 'GROUP',
          lifecycleState: 'ACTIVE',
          validFrom: '2026-08-18T00:00:00Z',
          validUntil: null,
          version: 1,
        },
      ]),
    })
  );
  await page.route(/\/api\/spaces\/v1\/access-requests\?status=PENDING$/, (route) =>
    route.fulfill({ contentType: 'application/json', body: envelope([]) })
  );

  await page.goto('/spaces/company-square/people');
  await expect(page.getByText('SKAX_COMMUNICATIONS_EDITORS')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Owner Studio' })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Connected apps' }).click();
  await expect(page.getByText('Data access scope: This Space only')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open app' })).toHaveAttribute(
    'href',
    '/calendar/home'
  );
});

test('governance admins recover ownerless Spaces through an evidence-bound flow', async ({
  page,
}) => {
  await mockSpaceSession(page, {
    roles: ['SPACE_GOVERNANCE_ADMIN'],
    permissions: [
      {
        resourceType: 'APP',
        resourceKey: 'APP.ADMINISTRATION',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
      {
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.SPACE_GOVERNANCE',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
      {
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.SPACE_GOVERNANCE',
        permissionCode: 'MANAGE',
        effect: 'ALLOW',
      },
    ],
  });
  await page.route('**/api/spaces/v1/admin/operations', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        generatedAt: '2026-08-19T00:00:00Z',
        entitlementProviderConfigured: true,
        metrics: {
          queuedDeliveries: 0,
          deadLetters: 0,
          openFindings: 1,
          highRiskFindings: 1,
          ownerlessSpaces: 1,
          overdueReviews: 0,
          synchronizedLast24Hours: 8,
        },
        recentRuns: [],
        findings: [
          {
            findingId: 'f1000000-0000-0000-0000-000000000001',
            spaceId: SPACE_SUMMARY.spaceId,
            membershipId: null,
            findingType: 'OWNERLESS_SPACE',
            severity: 'CRITICAL',
            lifecycleState: 'OPEN',
            targetType: 'SPACE',
            targetRef: SPACE_SUMMARY.spaceId,
            title: 'OWNERLESS_SPACE',
            evidence: {
              spaceKey: SPACE_SUMMARY.spaceKey,
              spaceName: SPACE_SUMMARY.nameEn,
            },
            firstDetectedAt: '2026-08-18T23:30:00Z',
            lastDetectedAt: '2026-08-19T00:00:00Z',
          },
        ],
        deliveries: [],
      }),
    })
  );
  await page.route('**/api/people/v1/people**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        items: [
          {
            personId: 'e1000000-0000-0000-0000-000000000001',
            displayName: 'Mina Kim',
            lifecycleState: 'ACTIVE',
            workerStatus: 'ACTIVE',
            businessTitle: 'Network Operations Lead',
            organizationName: 'Network Operations',
            workEmail: 'mina.kim@sk.com',
            directReportCount: 4,
            dataAccess: {
              classification: 'DIRECTORY',
              workerNumberMasked: true,
              excludedFieldGroups: [],
            },
          },
        ],
        nextCursor: null,
        size: 8,
        hasMore: false,
        asOf: '2026-08-19',
      }),
    })
  );

  await page.goto('/admin/spaces/operations');
  await page.getByRole('button', { name: 'Inspect evidence' }).click();
  await page.getByRole('button', { name: 'Assign owner' }).click();

  await expect(page).toHaveURL(/\/spaces\/admin\/operations$/);
  await expect(page.getByRole('dialog', { name: 'Recover accountable ownership' })).toBeVisible();
  const submit = page.getByRole('button', { name: 'Recover ownership' });
  await expect(submit).toBeDisabled();

  await page.getByRole('textbox', { name: 'Find an active member' }).fill('Mina');
  await page.getByRole('button', { name: /Mina Kim Network Operations Lead/ }).click();
  await page
    .getByRole('textbox', { name: 'Recovery rationale' })
    .fill('The owning team approved Mina as the accountable recovery owner.');
  await expect(submit).toBeEnabled();

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileOverflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(mobileOverflow.documentWidth).toBeLessThanOrEqual(mobileOverflow.viewport);
});
