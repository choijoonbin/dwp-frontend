import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { mockShellSession } from './support/shell-session';
import { mockApprovalProductSurfaceAuthority } from './support/product-surface-authority';
import {
  APPROVAL_HOME_FIXTURE,
  APPROVAL_MEMBER_PERMISSIONS,
} from './support/approval-command-center-fixtures';

const views = [
  { width: 1920, dark: false, locale: 'ko', presentation: 'balanced' },
  { width: 1440, dark: false, locale: 'en', presentation: 'balanced' },
  { width: 1280, dark: true, locale: 'ko', presentation: 'expressive' },
  { width: 390, dark: true, locale: 'en', presentation: 'expressive' },
  { width: 320, dark: false, locale: 'ko', presentation: 'focused' },
] as const;

async function prepare(
  page: Page,
  view: (typeof views)[number],
  empty = false,
  displayName = '이서연'
) {
  await page.setViewportSize({ width: view.width, height: 960 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: view.locale,
    displayName,
    permissions: APPROVAL_MEMBER_PERMISSIONS,
    appearance: {
      mode: view.dark ? 'dark' : 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  await mockApprovalProductSurfaceAuthority(page, { surfaceUi: false });
  await page.route('**/api/approvals/v1/home', (route) =>
    route.fulfill({
      json: {
        status: 'SUCCESS',
        data: {
          ...APPROVAL_HOME_FIXTURE,
          metrics: {
            ...APPROVAL_HOME_FIXTURE.metrics,
            pending: empty ? 0 : 1,
            dueToday: 0,
            overdue: empty ? 0 : 1,
          },
          focusQueue: empty ? [] : [{ ...APPROVAL_HOME_FIXTURE.focusQueue[1], riskScore: 69 }],
          recentRequests: empty ? [] : APPROVAL_HOME_FIXTURE.recentRequests,
          flow: empty ? [] : APPROVAL_HOME_FIXTURE.flow,
          insights: empty ? [] : APPROVAL_HOME_FIXTURE.insights,
        },
      },
    })
  );
  await page.route('**/api/platform/v1/home-preferences/surfaces/approval-home', (route) =>
    route.fulfill({
      json: {
        status: 'SUCCESS',
        data: {
          schemaVersion: 4,
          surfaceKey: 'approval-home',
          customized: false,
          layout: { appLayout: null, presentation: view.presentation, widgets: [] },
          version: 0,
          updatedAt: null,
        },
      },
    })
  );
}

for (const view of views) {
  test(`home publishing ${view.width} ${view.locale} ${view.presentation}`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await prepare(page, view);
    await page.goto('/approvals/home');
    const briefing = page.getByTestId('approval-daily-briefing');
    await expect(briefing).toBeVisible();
    const homeSurfaces = page.locator('[data-workspace-widget-content] > section.MuiPaper-root');
    expect(await homeSurfaces.count()).toBeGreaterThan(0);
    expect(
      await homeSurfaces.evaluateAll((elements) =>
        elements.every((element) => getComputedStyle(element).boxShadow === 'none')
      )
    ).toBe(true);
    const quickActions = page.getByTestId('approval-quick-actions').getByRole('button');
    await expect(quickActions).toHaveCount(4);
    const quickActionBounds = await quickActions.evaluateAll((elements) =>
      elements.map((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          x: bounds.x,
          y: bounds.y,
          right: bounds.right,
          bottom: bounds.bottom,
          border: parseFloat(getComputedStyle(element).borderTopWidth),
        };
      })
    );
    for (const [index, bounds] of quickActionBounds.entries()) {
      expect(bounds.border).toBeGreaterThan(0);
      for (const other of quickActionBounds.slice(index + 1)) {
        expect(bounds.right < other.x || other.right < bounds.x || bounds.bottom < other.y).toBe(
          true
        );
      }
    }
    const briefingStyle = await page.getByTestId('approval-briefing-band').evaluate((element) => ({
      background: getComputedStyle(element).backgroundColor,
      decoration: getComputedStyle(element, '::after').content,
    }));
    if (!view.dark) expect(briefingStyle.background).toBe('rgb(255, 255, 255)');
    expect(briefingStyle.decoration).toBe('none');
    if (view.width >= 1280) {
      const primary = page.locator('[data-approval-primary-column]');
      const support = page.locator('[data-approval-support-column]');
      const [left, right] = await Promise.all([primary.boundingBox(), support.boundingBox()]);
      expect(left).not.toBeNull();
      expect(right).not.toBeNull();
      expect(left!.width / right!.width).toBeCloseTo(2, 1);
      const focus = await primary.locator('[data-workspace-widget="focus-queue"]').boundingBox();
      const requests = await primary.locator('[data-workspace-widget="my-requests"]').boundingBox();
      expect(requests!.y - (focus!.y + focus!.height)).toBeLessThanOrEqual(20);
    }
    await expect(page.getByRole('heading', { level: 1 })).toContainText('이서연');
    await expect(
      briefing.getByRole('button', { name: /긴급 결재 보기|View urgent approvals/u })
    ).toHaveCount(0);
    await expect(briefing.getByRole('button', { name: /결재함|Decision inbox/u })).toBeVisible();
    const risk = page.getByText(view.locale === 'ko' ? '위험 69' : 'Risk 69', { exact: true });
    expect(
      await risk.evaluateAll(
        (elements) => new Set(elements.map((element) => getComputedStyle(element).color)).size
      )
    ).toBe(1);
    const metricCards = page.getByTestId('approval-kpi-card');
    await expect(metricCards).toHaveCount(4);
    const colors = await metricCards.evaluateAll((elements) =>
      elements.map((element) => getComputedStyle(element, '::before').backgroundColor)
    );
    expect(new Set(colors).size).toBe(4);
    const measurements = await metricCards.evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        return {
          radius: parseFloat(style.borderTopLeftRadius),
          border: parseFloat(style.borderTopWidth),
          background: style.backgroundColor,
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
        };
      })
    );
    await info.attach('publishing-measurements', {
      body: JSON.stringify(measurements, null, 2),
      contentType: 'application/json',
    });
    for (const card of measurements) {
      expect.soft(card.radius).toBeGreaterThan(0);
      expect.soft(card.radius).toBeLessThanOrEqual(8);
      expect.soft(card.border).toBeGreaterThan(0);
      expect.soft(card.background).not.toBe('rgba(0, 0, 0, 0)');
      expect.soft(card.width).toBeGreaterThan(0);
    }
    if (view.dark) {
      const background = await page
        .locator('[data-workspace-presentation]')
        .first()
        .evaluate((element) => getComputedStyle(element).backgroundColor);
      expect.soft(background).not.toBe('rgb(244, 247, 251)');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect.soft(accessibility.violations).toEqual([]);
    expect(errors).toEqual([]);
    await page.screenshot({ path: info.outputPath('approval-home.png'), fullPage: true });
  });
}

test('empty home keeps its heading, usable inbox link and coherent sections', async ({ page }) => {
  await prepare(page, views[0], true);
  await page.goto('/approvals/home');
  const briefing = page.getByTestId('approval-daily-briefing');
  await expect(briefing).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(briefing.getByRole('button', { name: '우선 결재 검토' })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('unavailable home retains page identity and recovers through its visible retry action', async ({
  page,
}) => {
  await prepare(page, views[4]);
  let unavailable = true;
  await page.route('**/api/approvals/v1/home', (route) =>
    unavailable
      ? route.fulfill({ status: 503, json: { status: 'ERROR', errorCode: 'SERVICE_UNAVAILABLE' } })
      : route.fulfill({ json: { status: 'SUCCESS', data: APPROVAL_HOME_FIXTURE } })
  );
  await page.goto('/approvals/home');
  await expect(
    page.getByRole('alert').filter({ hasText: '전자결재 현황을 불러오지 못했습니다.' })
  ).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: '전자결재 홈' })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  unavailable = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByTestId('approval-daily-briefing')).toBeVisible();
});

test('keyboard customization enters its toolbar and restores the opener after cancel and save', async ({
  page,
}) => {
  await prepare(page, views[2]);
  await page.goto('/approvals/home');
  const customize = page.getByRole('button', { name: '결재 홈 편집' });
  await expect(customize).toBeEnabled();
  await customize.focus();
  await customize.press('Enter');
  const toolbar = page.getByRole('navigation', { name: '홈 구성 편집 도구' });
  await expect(toolbar.getByRole('button', { name: '위젯 추가' })).toBeFocused();
  expect(
    (await new AxeBuilder({ page }).include('[data-workspace-composer-placement]').analyze())
      .violations
  ).toEqual([]);
  await toolbar.getByRole('button', { name: '변경 취소' }).focus();
  await page.keyboard.press('Enter');
  await expect(customize).toBeFocused();
  await customize.press('Enter');
  await toolbar.getByRole('button', { name: '저장', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(toolbar).toHaveCount(0);
  await expect(customize).toBeFocused();
});

test('home preference 409 preserves local edits and requires an explicit recovery choice', async ({
  page,
}) => {
  await prepare(page, views[0]);
  let currentVersion = 1;
  let writes = 0;
  let reappliedLayout: { presentation?: string } | undefined;
  await page.route('**/api/platform/v1/home-preferences/surfaces/approval-home', async (route) => {
    if (route.request().method() === 'PUT') {
      writes += 1;
      const body = route.request().postDataJSON() as {
        layout: { presentation?: string };
        version: number;
      };
      if (writes === 1) {
        currentVersion = 2;
        return route.fulfill({
          status: 409,
          json: { status: 'ERROR', errorCode: 'HOME_PREFERENCE_VERSION_CONFLICT' },
        });
      }
      reappliedLayout = body.layout;
      expect(body.version).toBe(2);
      currentVersion = 3;
      return route.fulfill({
        json: {
          status: 'SUCCESS',
          data: {
            schemaVersion: 4,
            surfaceKey: 'approval-home',
            customized: true,
            layout: body.layout,
            version: currentVersion,
            updatedAt: '2026-09-11T02:00:00Z',
          },
        },
      });
    }
    return route.fulfill({
      json: {
        status: 'SUCCESS',
        data: {
          schemaVersion: 4,
          surfaceKey: 'approval-home',
          customized: currentVersion > 1,
          layout: {
            appLayout: null,
            presentation: currentVersion > 1 ? 'expressive' : 'balanced',
            widgets: [],
          },
          version: currentVersion,
          updatedAt: null,
        },
      },
    });
  });

  await page.goto('/approvals/home');
  await page.getByRole('button', { name: '결재 홈 편집' }).click();
  await page.getByRole('button', { name: '집중', exact: true }).click();
  await page
    .getByRole('navigation', { name: '홈 구성 편집 도구' })
    .getByRole('button', { name: '저장', exact: true })
    .click();

  const conflict = page.getByRole('alert').filter({ hasText: '로컬 편집은 보존' });
  await expect(conflict).toBeVisible();
  await expect(page.getByRole('button', { name: '집중', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await conflict.getByRole('button', { name: '내 변경 다시 적용' }).click();
  await expect(conflict).toHaveCount(0);
  expect(writes).toBe(2);
  expect(reappliedLayout?.presentation).toBe('focused');
});

test('cancel after personalization failure focuses its actionable retry instead of the disabled opener', async ({
  page,
}) => {
  await page.clock.install();
  await prepare(page, views[0]);
  let unavailable = false;
  await page.route('**/api/platform/v1/home-preferences/surfaces/approval-home', (route) =>
    unavailable
      ? route.fulfill({ status: 503, json: { status: 'ERROR', errorCode: 'SERVICE_UNAVAILABLE' } })
      : route.fulfill({
          json: {
            status: 'SUCCESS',
            data: {
              schemaVersion: 4,
              surfaceKey: 'approval-home',
              customized: false,
              layout: { appLayout: null, presentation: 'balanced', widgets: [] },
              version: 0,
              updatedAt: null,
            },
          },
        })
  );
  await page.goto('/approvals/home');
  await page.getByRole('button', { name: '결재 홈 편집' }).click();
  unavailable = true;
  await page.clock.fastForward(300_001);
  await page.evaluate(() => {
    dispatchEvent(new Event('offline'));
    dispatchEvent(new Event('online'));
  });
  await expect(page.getByRole('alert').filter({ hasText: '개인화 설정' })).toBeVisible();
  await page.getByRole('button', { name: '변경 취소' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: '결재 홈 편집' })).toBeDisabled();
  await expect(
    page.getByRole('alert').getByRole('button', { name: '다시 시도', exact: true })
  ).toBeFocused();
});

test('long identifiers and 200 percent text fit locally and retain forced-color progress', async ({
  page,
}, info) => {
  await prepare(
    page,
    views[4],
    false,
    'ApprovalManagerWithAnExceptionallyLongUnbrokenName'.repeat(2)
  );
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.route('**/api/approvals/v1/home', (route) =>
    route.fulfill({
      json: {
        status: 'SUCCESS',
        data: {
          ...APPROVAL_HOME_FIXTURE,
          recentRequests: [
            {
              ...APPROVAL_HOME_FIXTURE.recentRequests[0],
              currentStepName: 'ProcurementApprovalStageWithAnUnbrokenIdentifier'.repeat(2),
            },
          ],
        },
      },
    })
  );
  await page.goto('/approvals/home');
  await expect(page.getByTestId('approval-daily-briefing')).toBeVisible();
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  const metrics = page.getByTestId('approval-kpi-card');
  await expect(metrics).toHaveCount(4);
  await expect
    .poll(() =>
      metrics.evaluateAll(
        (elements) => new Set(elements.map((element) => element.getBoundingClientRect().x)).size
      )
    )
    .toBe(2);
  expect(
    await metrics.evaluateAll((elements) =>
      elements.every((element) => element.scrollWidth <= element.clientWidth + 1)
    )
  ).toBe(true);
  await metrics
    .first()
    .locator('..')
    .screenshot({ path: info.outputPath('approval-metrics-forced-200.png') });
  const meters = page.getByRole('progressbar');
  await expect(meters).toHaveCount(4);
  for (const meter of await meters.all()) {
    const style = await meter.evaluate((element) => {
      const computed = getComputedStyle(element);
      const fill = element.querySelector('.MuiLinearProgress-bar')!;
      const frame = element.parentElement!;
      return {
        track: computed.backgroundColor,
        fill: getComputedStyle(fill).backgroundColor,
        outline: computed.outlineWidth,
        forcedColors: matchMedia('(forced-colors: active)').matches,
        supportsAdjustment: CSS.supports('forced-color-adjust', 'none'),
        adjustment: computed.getPropertyValue('forced-color-adjust'),
        fits: frame.scrollWidth <= frame.clientWidth + 1,
        height: element.getBoundingClientRect().height,
      };
    });
    expect(style.fill).not.toBe(style.track);
    if (style.forcedColors && style.supportsAdjustment) {
      expect(style.adjustment).toBe('none');
      expect(parseFloat(style.outline)).toBeGreaterThan(0);
    }
    expect(style.height).toBeGreaterThan(0);
    expect(style.fits).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const requests = page.locator('[data-workspace-widget="my-requests"]');
  const row = requests.getByRole('button').last();
  await requests.getByRole('button', { name: '전체 보기', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(row).toBeFocused();
  await expect(row).toHaveCSS('outline-offset', '-3px');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath('approval-progress-forced-200.png') });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath('approval-home-forced-200.png') });
});

test('saved queue height changes the visible row budget and survives reload', async ({ page }) => {
  await prepare(page, views[0]);
  await page.route('**/api/approvals/v1/home', (route) =>
    route.fulfill({
      json: {
        status: 'SUCCESS',
        data: {
          ...APPROVAL_HOME_FIXTURE,
          focusQueue: Array.from({ length: 6 }, (_, index) => ({
            ...APPROVAL_HOME_FIXTURE.focusQueue[0],
            taskId: `queue-${index}`,
            title: `검토 문서 ${index + 1}`,
          })),
        },
      },
    })
  );
  let layout: unknown = { appLayout: null, presentation: 'balanced', widgets: [] };
  let customized = false;
  let version = 0;
  await page.route('**/api/platform/v1/home-preferences/surfaces/approval-home', (route) => {
    if (route.request().method() === 'PUT') {
      layout = route.request().postDataJSON().layout;
      customized = true;
      version++;
    }
    return route.fulfill({
      json: {
        status: 'SUCCESS',
        data: {
          schemaVersion: 4,
          surfaceKey: 'approval-home',
          customized,
          layout,
          version,
          updatedAt: null,
        },
      },
    });
  });
  await page.goto('/approvals/home');
  const queue = page.locator('[data-workspace-widget="focus-queue"]');
  await expect(queue.getByRole('button', { name: /검토 문서/u })).toHaveCount(4);
  for (const [height, count] of [
    ['표준', 2],
    ['확장', 6],
  ] as const) {
    await page.getByRole('button', { name: '결재 홈 편집' }).click();
    await queue.getByRole('button', { name: /위젯 크기 선택/u }).click();
    await page.getByRole('dialog').getByRole('button', { name: height, exact: true }).click();
    await page.keyboard.press('Escape');
    await page
      .getByRole('navigation', { name: '홈 구성 편집 도구' })
      .getByRole('button', { name: '저장', exact: true })
      .click();
    await expect(page.getByRole('navigation', { name: '홈 구성 편집 도구' })).toHaveCount(0);
    await page.reload();
    await expect(queue.getByRole('button', { name: /검토 문서/u })).toHaveCount(count);
  }
});
