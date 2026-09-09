import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';
import { PROPOSAL_DESIGN_ITEMS } from './support/dwaion-proposal-design-fixtures';

async function setup(
  page: Page,
  options: { status?: number; paged?: boolean; dark?: boolean; locale?: 'en' | 'ko' } = {}
) {
  await page.clock.setFixedTime(new Date('2026-09-08T01:00:00Z'));
  await page.emulateMedia({
    reducedMotion: 'reduce',
    colorScheme: options.dark ? 'dark' : 'light',
  });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: options.locale ?? 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
    appearance: {
      mode: options.dark ? 'dark' : 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  const designItems =
    options.locale === 'ko'
      ? PROPOSAL_DESIGN_ITEMS.map((item, index) => ({
          ...item,
          content: {
            ...item.content,
            title: index === 0 ? '내일 회의 준비 항목 확인' : '고객 안내 초안 메일 회신 검토',
            summary:
              index === 0
                ? '내일 회의 전 미결 항목과 관련 자료를 다시 확인합니다.'
                : '고객 안내 전에 초안과 남은 결정을 검토합니다.',
            rationale:
              index === 0
                ? '회의가 내일 예정되어 있고 준비 업무가 아직 열려 있습니다.'
                : '제품 검토 일정 전 사용자의 판단이 필요한 결정이 남아 있습니다.',
            evidence: item.content.evidence.map((evidence, evidenceIndex) => ({
              ...evidence,
              label:
                index === 0
                  ? evidenceIndex === 0
                    ? '회의 준비 업무'
                    : '내일 고객 회의 일정'
                  : '제품 검토 일정',
            })),
          },
        }))
      : PROPOSAL_DESIGN_ITEMS;
  const lookups: string[] = [];
  await page.route('**/api/agent/v1/proposals/preferences', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          proactiveAnalysisEnabled: options.locale === 'ko',
          revision: 0,
          updatedAt: null,
        },
      },
    })
  );
  await page.route('**/api/agent/v1/proposals?**', (route) => {
    const url = new URL(route.request().url());
    const all = url.searchParams.get('view') === 'ALL';
    const selectionLookup = all && url.searchParams.get('limit') === '100';
    const cursor = url.searchParams.get('cursor');
    if (selectionLookup) lookups.push(cursor ?? 'first');
    if (selectionLookup && options.status)
      return route.fulfill({ status: options.status, json: { detail: 'Unavailable' } });
    const items =
      selectionLookup && options.paged
        ? cursor
          ? [designItems[1]]
          : [designItems[0]]
        : url.searchParams.get('view') === 'SNOOZED'
          ? []
          : designItems;
    return route.fulfill({
      json: {
        success: true,
        data: {
          items,
          summary: { active: 2, highPriority: 1, snoozed: 0, handled: 0 },
          nextCursor: selectionLookup && options.paged && !cursor ? 'opaque-page-2' : null,
        },
      },
    });
  });
  return lookups;
}

const dialog = (page: Page) => page.getByRole('dialog', { name: 'DWAI·ON proposal' });
const selectedUrl = `/dwaion/proposals?proposal=${PROPOSAL_DESIGN_ITEMS[1].proposalId}`;
const selectedHighUrl = `/dwaion/proposals?proposal=${PROPOSAL_DESIGN_ITEMS[0].proposalId}`;

test('opaque deep link resolves the exact proposal across scoped inbox pages', async ({ page }) => {
  const lookups = await setup(page, { paged: true });
  await page.goto(selectedUrl);
  await expect(
    dialog(page).getByRole('heading', { name: PROPOSAL_DESIGN_ITEMS[1].content.title })
  ).toBeVisible();
  await expect(dialog(page)).not.toContainText(PROPOSAL_DESIGN_ITEMS[0].content.title);
  expect(lookups).toEqual(['first', 'opaque-page-2']);
  await expect(page).toHaveURL(new RegExp(`proposal=${PROPOSAL_DESIGN_ITEMS[1].proposalId}$`));
  await page.getByRole('button', { name: 'Close proposal details' }).click();
  await expect(page).toHaveURL(/\/dwaion\/proposals$/);
  await page.goBack();
  await expect(dialog(page)).toBeVisible();
  await page.reload();
  await expect(
    dialog(page).getByRole('heading', { name: PROPOSAL_DESIGN_ITEMS[1].content.title })
  ).toBeVisible();
});

test('row selection, Escape, history and view changes keep the URL synchronized', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/dwaion/proposals');
  const row = page.getByRole('button', {
    name: new RegExp(PROPOSAL_DESIGN_ITEMS[0].content.title),
  });
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(dialog(page)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`proposal=${PROPOSAL_DESIGN_ITEMS[0].proposalId}$`));
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
  await expect(row).toBeFocused();
  await page.getByRole('button', { name: 'Snoozed', exact: true }).click();
  await expect(page).toHaveURL(/\?view=SNOOZED$/);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Snoozed', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(dialog(page)).toHaveCount(0);
});

for (const value of [
  'not-an-identifier',
  '019d8cb0-27a6-7b11-82d1-9eb8a26c1299',
  `${PROPOSAL_DESIGN_ITEMS[0].proposalId}&proposal=${PROPOSAL_DESIGN_ITEMS[1].proposalId}`,
]) {
  test(`unavailable or ambiguous selection never opens another proposal: ${value}`, async ({
    page,
  }) => {
    await setup(page);
    await page.goto(`/dwaion/proposals?proposal=${value}`);
    await expect(
      page.getByRole('alert').filter({ hasText: 'The requested proposal is unavailable' })
    ).toContainText('The requested proposal is unavailable');
    await expect(dialog(page)).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: new RegExp(PROPOSAL_DESIGN_ITEMS[0].content.title) })
    ).toBeVisible();
  });
}

for (const status of [403, 503]) {
  test(`selection lookup ${status} hides the inspector without replacing it`, async ({ page }) => {
    await setup(page, { status });
    await page.goto(selectedUrl);
    await expect(
      page.getByRole('alert').filter({ hasText: 'The requested proposal is unavailable' })
    ).toContainText('The requested proposal is unavailable');
    await expect(dialog(page)).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`proposal=${PROPOSAL_DESIGN_ITEMS[1].proposalId}$`));
  });
}

test('Stitch U05 hierarchy keeps triage, filters and a selected preview together on desktop', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await setup(page);
  await page.goto('/dwaion/proposals');
  const controls = page.locator('#dwaion-proposal-controls-title');
  const metrics = page.getByTestId('dwaion-proposal-metrics');
  const filters = page.locator('section[aria-label="AI proposal search and filters"]');
  const preview = page.getByTestId('dwaion-proposal-preview');
  const firstRow = page.getByRole('button', {
    name: new RegExp(PROPOSAL_DESIGN_ITEMS[0].content.title),
  });
  await expect(controls).toBeVisible();
  await expect(metrics).toBeVisible();
  await expect(filters).toBeVisible();
  await expect(preview).toContainText(PROPOSAL_DESIGN_ITEMS[0].content.rationale);
  await expect(preview).toContainText(PROPOSAL_DESIGN_ITEMS[0].content.evidence[0].label);
  const [controlsBox, metricsBox, filtersBox, rowBox, previewBox] = await Promise.all([
    controls.boundingBox(),
    metrics.boundingBox(),
    filters.boundingBox(),
    firstRow.boundingBox(),
    preview.boundingBox(),
  ]);
  expect(metricsBox?.y ?? 0).toBeGreaterThan(controlsBox?.y ?? Infinity);
  expect(filtersBox?.y ?? 0).toBeGreaterThan(metricsBox?.y ?? Infinity);
  expect(rowBox?.y ?? 0).toBeGreaterThan(filtersBox?.y ?? Infinity);
  expect(previewBox?.x ?? 0).toBeGreaterThan(rowBox?.x ?? Infinity);

  await page.getByRole('textbox', { name: 'Search proposals' }).fill('product review');
  await expect(firstRow).toHaveCount(0);
  await expect(
    page.getByRole('button', {
      name: new RegExp(PROPOSAL_DESIGN_ITEMS[1].content.title),
    })
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath('proposal-inbox-stitch-u05-desktop.png'),
    fullPage: true,
    animations: 'disabled',
  });
});

test('Stitch U05 Korean desktop preserves the full triage and evidence hierarchy', async ({
  page,
}, info) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await setup(page, { locale: 'ko' });
  await page.goto('/dwaion/proposals');
  await expect(page.getByText('실제 API 데이터', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: '분석 엔진: 정상 · 분석 허용됨' })).toBeVisible();
  await expect(page.getByTestId('dwaion-proposal-metrics')).toBeVisible();
  await expect(page.getByText('트리아지 후보 2건')).toBeVisible();
  await expect(page.getByTestId('dwaion-proposal-preview')).toContainText('근거 2개');
  expect(consoleErrors).toEqual([]);
  await page.screenshot({
    path: info.outputPath('U05-proposal-inbox-1440-ko.png'),
    fullPage: true,
    animations: 'disabled',
  });
});

test('Stitch U05 Korean mobile keeps compact analysis, tabs and first decision in one viewport', async ({
  page,
}, info) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, { locale: 'ko' });
  await page.goto('/dwaion/proposals');
  await expect(page.getByRole('heading', { name: 'AI 제안함', exact: true })).toBeVisible();
  const filters = page.getByRole('button', { name: '제안 필터 열기' });
  await expect(filters).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: '전체', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  const firstProposal = page.getByRole('button', { name: /내일 회의 준비 항목 확인/ });
  await expect(firstProposal).toBeVisible();
  expect((await firstProposal.boundingBox())?.y ?? Infinity).toBeLessThan(650);
  await expect(firstProposal).toContainText('만료 시각');
  await expect(firstProposal).toContainText('제안 상세 검토');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const audit = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    audit.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))
  ).toEqual([]);
  expect(consoleErrors).toEqual([]);
  await page.screenshot({
    path: info.outputPath('U05-proposal-inbox-390x844-ko.png'),
    animations: 'disabled',
  });
  const fullHeight = await page.evaluate(() =>
    Math.max(1600, document.documentElement.scrollHeight)
  );
  await page.setViewportSize({ width: 390, height: fullHeight });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: info.outputPath('U05-proposal-inbox-390-full-ko.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await filters.click();
  await expect(page.getByRole('textbox', { name: '제안 검색' })).toBeVisible();
});

test('Stitch U06 desktop is a standalone evidence and decision workspace', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await setup(page);
  await page.goto(selectedUrl);
  const detail = page.getByTestId('dwaion-proposal-detail-page');
  const evidence = page.locator('section[aria-labelledby="dwaion-proposal-evidence-title"]');
  const decision = page.locator('aside[aria-labelledby="dwaion-proposal-decision-title"]');
  await expect(detail).toBeVisible();
  await expect(page.locator('.MuiBackdrop-root')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'AI proposals', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Close proposal details' })).toBeVisible();
  const [detailBox, evidenceBox, decisionBox] = await Promise.all([
    detail.boundingBox(),
    evidence.boundingBox(),
    decision.boundingBox(),
  ]);
  expect(detailBox?.width ?? 0).toBeGreaterThan(1000);
  expect(decisionBox?.x ?? 0).toBeGreaterThan(evidenceBox?.x ?? Infinity);
  expect(decisionBox?.y ?? 0).toBeGreaterThanOrEqual(evidenceBox?.y ?? Infinity);
  await page.screenshot({
    path: info.outputPath('proposal-review-stitch-u06-desktop.png'),
    fullPage: true,
    animations: 'disabled',
  });
});

for (const viewport of [
  { name: '1440', width: 1440, height: 1000 },
  { name: '390', width: 390, height: 844 },
] as const) {
  test(`Stitch U06 Korean standalone review ${viewport.name}`, async ({ page }, info) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await setup(page, { locale: 'ko' });
    await page.goto(selectedHighUrl);
    const detail = page.getByTestId('dwaion-proposal-detail-page');
    await expect(detail).toBeVisible();
    await expect(page.locator('.MuiBackdrop-root')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '내일 회의 준비 항목 확인' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '추천 근거 및 원문 데이터' })).toBeVisible();
    if (viewport.width === 1440)
      await expect(page.getByRole('heading', { name: '의사결정 패널' })).toBeVisible();
    else await expect(page.getByTestId('dwaion-proposal-mobile-decisions')).toBeVisible();
    await expect(page.getByRole('button', { name: '검토할 업무로 수락' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    const audit = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
    expect(
      audit.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))
    ).toEqual([]);
    expect(consoleErrors).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`U06-proposal-review-${viewport.name}-ko.png`),
      fullPage: viewport.width === 1440,
      animations: 'disabled',
    });
  });
}

test('Stitch U05 and U06 mobile composition exposes work before opening a full-width review', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await setup(page);
  await page.goto('/dwaion/proposals');
  await expect(page.getByTestId('dwaion-proposal-metrics')).toBeHidden();
  await expect(page.locator('section[aria-label="AI proposal search and filters"]')).toBeHidden();
  const firstRow = page.getByRole('button', {
    name: new RegExp(PROPOSAL_DESIGN_ITEMS[0].content.title),
  });
  const rowBox = await firstRow.boundingBox();
  expect(rowBox?.y ?? Infinity).toBeLessThan(900);
  await firstRow.click();
  const inspector = dialog(page);
  await expect(inspector).toBeVisible();
  expect((await inspector.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(350);
  await expect(page.locator('.MuiBackdrop-root')).toHaveCount(0);
  await expect(page.getByTestId('dwaion-proposal-detail-page')).toBeVisible();
  const closeButton = page.getByRole('button', { name: 'Close proposal details' });
  await expect(closeButton).toBeVisible();
  expect((await closeButton.boundingBox())?.y ?? Infinity).toBeLessThan(320);
  await expect(inspector.getByText('Evidence and original sources')).toBeVisible();
  await expect(inspector.getByRole('heading', { name: 'Recommended action effect' })).toBeVisible();
  await expect(inspector.getByRole('heading', { name: 'Estimated time saved' })).toBeVisible();
  await page.screenshot({
    path: info.outputPath('proposal-review-stitch-u06-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  });
});

for (const view of [
  { width: 1440, name: 'desktop' },
  { width: 390, name: 'mobile' },
  { width: 320, name: 'small' },
  { width: 1280, name: 'dark', dark: true },
  { width: 640, name: 'zoom-200', large: true },
  { width: 390, name: 'forced-colors', forced: true },
]) {
  test(`proposal inspector reflows with keyboard and accessibility: ${view.name}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: view.width, height: 900 });
    await setup(page, { dark: view.dark });
    if (view.forced) await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/dwaion/proposals');
    await expect(
      page.getByRole('button', { name: new RegExp(PROPOSAL_DESIGN_ITEMS[0].content.title) })
    ).toBeVisible();
    if (view.large)
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    const firstRow = page.getByRole('button', {
      name: new RegExp(PROPOSAL_DESIGN_ITEMS[0].content.title),
    });
    expect((await firstRow.boundingBox())?.y ?? Infinity).toBeLessThan(900);
    await expect(firstRow).toContainText('Work item');
    await expect(firstRow).toContainText('Expires:');
    const inboxViolations = (await new AxeBuilder({ page }).include('#dwp-main-content').analyze())
      .violations;
    expect(inboxViolations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual(
      []
    );
    await page.screenshot({
      path: info.outputPath(`proposal-inbox-${view.name}.png`),
      fullPage: true,
      animations: 'disabled',
    });
    await page.goto(selectedUrl);
    await expect(dialog(page)).toBeVisible();
    if (view.large)
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    expect(await dialog(page).evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await dialog(page).evaluate((el) => el.contains(document.activeElement))).toBe(true);
    const violations = (await new AxeBuilder({ page }).include('[role="dialog"]').analyze())
      .violations;
    expect(violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`proposal-${view.name}.png`),
      fullPage: true,
      animations: 'disabled',
    });
  });
}

test('clearing the inbox removes cached selected content on browser Back', async ({ page }) => {
  await setup(page);
  let cleared = false;
  await page.route('**/api/agent/v1/proposals?**', (route) =>
    cleared
      ? route.fulfill({
          json: {
            success: true,
            data: {
              items: [],
              summary: { active: 0, highPriority: 0, snoozed: 0, handled: 0 },
              nextCursor: null,
            },
          },
        })
      : route.fallback()
  );
  await page.route('**/api/agent/v1/proposals/clear', (route) => {
    cleared = true;
    return route.fulfill({
      json: { success: true, data: { hiddenCount: 2, clearedAt: '2026-09-08T01:01:00Z' } },
    });
  });
  await page.goto(selectedUrl);
  await expect(dialog(page)).toBeVisible();
  await page.getByRole('button', { name: 'Close proposal details' }).click();
  await page.getByRole('button', { name: 'Clear proposal data', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Clear proposal data?' })
    .getByRole('button', { name: 'Clear proposal data', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'There are no proposals' })).toBeVisible();
  // Clearing creates a canonical closed selection; navigate through its history entries.
  await page.goBack();
  if (!new URL(page.url()).searchParams.has('proposal')) await page.goBack();
  await expect(
    page.getByRole('alert').filter({ hasText: 'The requested proposal is unavailable' })
  ).toContainText('The requested proposal is unavailable');
  await expect(dialog(page)).toHaveCount(0);
});

test('a late selected lookup cannot restore content after clearing the inbox', async ({ page }) => {
  await setup(page);
  let lookupStarted = false;
  let cleared = false;
  let releaseLookup: () => void = () => undefined;
  const pendingLookup = new Promise<void>((resolve) => {
    releaseLookup = resolve;
  });
  await page.route('**/api/agent/v1/proposals?**', async (route) => {
    const url = new URL(route.request().url());
    const selectionLookup =
      url.searchParams.get('view') === 'ALL' && url.searchParams.get('limit') === '100';
    if (selectionLookup && !cleared) {
      lookupStarted = true;
      await pendingLookup;
      await route.fulfill({
        json: {
          success: true,
          data: {
            items: PROPOSAL_DESIGN_ITEMS,
            summary: { active: 2, highPriority: 1, snoozed: 0, handled: 0 },
            nextCursor: null,
          },
        },
      });
      return;
    }
    if (cleared) {
      await route.fulfill({
        json: {
          success: true,
          data: {
            items: [],
            summary: { active: 0, highPriority: 0, snoozed: 0, handled: 0 },
            nextCursor: null,
          },
        },
      });
      return;
    }
    await route.fallback();
  });
  await page.route('**/api/agent/v1/proposals/clear', (route) => {
    cleared = true;
    return route.fulfill({
      json: { success: true, data: { hiddenCount: 2, clearedAt: '2026-09-08T01:01:00Z' } },
    });
  });
  await page.goto(selectedUrl);
  await expect.poll(() => lookupStarted).toBe(true);
  await page.getByRole('button', { name: 'Clear proposal data', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Clear proposal data?' })
    .getByRole('button', { name: 'Clear proposal data', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'There are no proposals' })).toBeVisible();
  releaseLookup();
  await page.goBack();
  await expect(
    page.getByRole('alert').filter({ hasText: 'The requested proposal is unavailable' })
  ).toBeVisible();
  await expect(dialog(page)).toHaveCount(0);
});
