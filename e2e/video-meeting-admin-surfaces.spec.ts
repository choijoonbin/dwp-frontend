import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expandMeetingPolicySection } from './support/video-meeting-admin-policy';

import {
  mockMeetingVisualAdminReadiness,
  mockMeetingVisualSession,
} from './support/video-meeting-visual-fixtures';

import type { Page, TestInfo } from '@playwright/test';

function success(data: unknown) {
  return JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data });
}

async function mockOperations(page: Page) {
  await page.route('**/api/meetings/v1/admin/overview?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: success({
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
      }),
    })
  );
  await page.route('**/api/meetings/v1/admin/operations/export?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/csv;charset=UTF-8',
      headers: {
        'Content-Disposition': 'attachment; filename="dwp-meeting-operations-20260908T020000Z.csv"',
      },
      body: 'schemaVersion,liveMeetings\r\n"meeting-admin-operations-v1","2"\r\n',
    })
  );
}

async function expectResponsiveAndAccessible(page: Page, label: string) {
  const overflow = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    main:
      (document.querySelector<HTMLElement>('#dwp-main-content')?.scrollWidth ?? 0) -
      (document.querySelector<HTMLElement>('#dwp-main-content')?.clientWidth ?? 0),
  }));
  expect(overflow.page, `${label}: page overflow`).toBeLessThanOrEqual(1);
  expect(overflow.main, `${label}: main overflow`).toBeLessThanOrEqual(1);
  const results = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    ),
    `${label}: blocking accessibility violations`
  ).toEqual([]);
}

async function expectFluidWorkspace(page: Page, expectedGutter: number) {
  const canvas = page.locator('[data-dwp-page-canvas="workspace"]').first();
  await expect(canvas).toBeVisible();
  const layout = await canvas.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      left: Number.parseFloat(style.paddingLeft),
      right: Number.parseFloat(style.paddingRight),
      maxWidth: style.maxWidth,
    };
  });
  expect(layout.left).toBe(expectedGutter);
  expect(layout.right).toBe(expectedGutter);
  expect(layout.maxWidth).toBe('none');
}

async function expectPolicySnapshot(page: Page, testInfo: TestInfo, mobile: boolean) {
  const viewport = page.viewportSize();
  if (mobile) {
    const savebar = page.getByTestId('meeting-admin-policy-savebar');
    await expect(savebar).toBeVisible();
    const box = await savebar.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual((viewport?.height ?? 0) + 1);
    await testInfo.attach('U14-real-mobile-viewport', {
      body: await page.screenshot({ animations: 'disabled', scale: 'css' }),
      contentType: 'image/png',
    });
    const finalSection = page.getByRole('region', {
      name: 'Policy limits and unavailable controls',
      exact: true,
    });
    await finalSection.scrollIntoViewIfNeeded();
    const finalBox = await finalSection.boundingBox();
    const finalSavebarBox = await savebar.boundingBox();
    expect(finalBox).not.toBeNull();
    expect(finalSavebarBox).not.toBeNull();
    expect((finalBox?.y ?? 0) + (finalBox?.height ?? 0)).toBeLessThanOrEqual(
      (finalSavebarBox?.y ?? 0) + 1
    );
    await testInfo.attach('U14-real-mobile-end-clearance', {
      body: await page.screenshot({ animations: 'disabled', scale: 'css' }),
      contentType: 'image/png',
    });
    // Preserve the real sticky-savebar evidence above, then place that bar at
    // the document end for a whole-document review instead of over its middle.
    const height = await page.evaluate(() =>
      Math.ceil(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight))
    );
    expect(height).toBeLessThan(32_000);
    await page.setViewportSize({ width: 390, height });
  }
  try {
    await page.evaluate(() => window.scrollTo(0, 0));
    await testInfo.attach('U14-implementation-review', {
      body: await page.screenshot({ fullPage: true, animations: 'disabled', scale: 'css' }),
      contentType: 'image/png',
    });
    await expect(page).toHaveScreenshot(`meeting-u14-policy-${mobile ? 'mobile' : 'desktop'}.png`, {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      maxDiffPixelRatio: 0.002,
    });
  } finally {
    if (mobile && viewport) await page.setViewportSize(viewport);
  }
}

test('U13 presents user impact, provider readiness, and a content-free exception inspector on desktop and mobile', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile';
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1_440, height: 960 });
  await mockMeetingVisualSession(page, { locale: 'en', admin: true, reducedMotion: true });
  await mockMeetingVisualAdminReadiness(page, 'BLOCKED');
  await mockOperations(page);

  await page.goto('/meetings/admin/operations');
  await expect(page.getByRole('heading', { level: 1, name: 'Meeting operations' })).toBeVisible();
  const impact = page.getByTestId('meeting-admin-impact-primary');
  await expect(impact).toBeVisible({ visible: !mobile });
  const mobileSignal = page.getByTestId('meeting-admin-mobile-signal');
  await expect(mobileSignal).toBeVisible({ visible: mobile });
  await expect(page.getByRole('heading', { name: 'Service readiness' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Exceptions and next action' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Selected diagnostic' })).toBeVisible();
  const serviceReadiness = page.getByRole('region', { name: 'Service readiness' });
  await expect(serviceReadiness.getByText('Recording processing')).toBeVisible();
  await expect(serviceReadiness.getByText('AI analysis')).toBeVisible();
  await expect(
    page.getByTestId('meeting-admin-telemetry-inspector').getByText('Not measured', { exact: true })
  ).toHaveCount(3);
  if (mobile) {
    await expect(mobileSignal).toContainText('2 Live meetings');
    const readinessTop = await page
      .getByTestId('meeting-admin-service-readiness')
      .evaluate((element) => element.getBoundingClientRect().top);
    expect(readinessTop).toBeLessThan(844);
  }
  await expectFluidWorkspace(page, mobile ? 16 : 24);
  await expectResponsiveAndAccessible(page, `U13 ${mobile ? 'mobile' : 'desktop'}`);
  await expect(page).toHaveScreenshot(
    `meeting-u13-operations-${mobile ? 'mobile' : 'desktop'}.png`,
    {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      maxDiffPixelRatio: 0.002,
    }
  );
  if (mobile) {
    await page.setViewportSize({ width: 320, height: 720 });
    await expectResponsiveAndAccessible(page, 'U13 mobile 320');
    await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
    await expectResponsiveAndAccessible(page, 'U13 mobile 320 at 200 percent text');
  }
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export operations report', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('dwp-meeting-operations.csv');
});

test('U14 keeps the versioned policy workflow, impact boundary, and unavailable controls legible on desktop and mobile', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile';
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1_440, height: 960 });
  await mockMeetingVisualSession(page, { locale: 'en', admin: true, reducedMotion: true });
  await mockMeetingVisualAdminReadiness(page, 'BLOCKED');

  await page.goto('/meetings/admin/policies');
  await expect(page.getByRole('heading', { level: 1, name: 'Meeting policy' })).toBeVisible();
  for (const section of [
    'Access and lobby',
    'In-meeting collaboration',
    'Recording and AI',
    'Retention policy',
    'Capacity and limits',
  ]) {
    await expect(page.getByRole('region', { name: section })).toBeVisible();
  }
  await expect(page.getByRole('complementary', { name: 'Review change impact' })).toBeVisible();
  const impact = page.getByRole('complementary', { name: 'Review change impact' });
  await expect(impact.getByText('Current policy version 8')).toBeVisible();
  await expect(impact.getByText(/does not report affected-user counts/u)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save policy', exact: true })).toBeDisabled();
  if (mobile) {
    const access = page.getByRole('region', { name: 'Access and lobby' });
    await expect(access).toHaveAttribute('open', '');
    await expect(
      page.getByRole('region', { name: 'In-meeting collaboration', exact: true })
    ).not.toHaveAttribute('open');
    const summary = access.locator(':scope > summary');
    expect((await summary.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    const sectionNavigation = page.getByRole('navigation', { name: 'Policy sections' });
    await expect(sectionNavigation.getByRole('button')).toHaveCount(4);
    await expect(sectionNavigation.getByRole('button', { pressed: true })).toHaveText('01. Access');
    await expect(
      page.locator(
        '[id^="meeting-policy-section-0"]:is(#meeting-policy-section-01, #meeting-policy-section-02, #meeting-policy-section-03, #meeting-policy-section-04)[open]'
      )
    ).toHaveCount(1);
  }
  await expectFluidWorkspace(page, mobile ? 16 : 24);
  await expectResponsiveAndAccessible(page, `U14 ${mobile ? 'mobile' : 'desktop'}`);
  await expectPolicySnapshot(page, testInfo, mobile);
  if (mobile) {
    await expandMeetingPolicySection(page, 'Access and lobby');
    await page.getByRole('switch', { name: 'Enable video meetings' }).click();
    await expect(page.getByRole('button', { name: 'Save policy', exact: true })).toBeEnabled();
    for (const [label, title] of [
      ['02. Recording', 'Recording and AI'],
      ['03. AI governance', 'AI meeting analysis data governance'],
      ['04. Retention', 'Retention policy'],
      ['01. Access', 'Access and lobby'],
    ] as const) {
      const button = page
        .getByRole('navigation', { name: 'Policy sections' })
        .getByRole('button', { name: label, exact: true });
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('region', { name: title, exact: true })).toHaveAttribute(
        'open',
        ''
      );
      await expect(
        page.locator(
          '#meeting-policy-section-01[open], #meeting-policy-section-02[open], #meeting-policy-section-03[open], #meeting-policy-section-04[open]'
        )
      ).toHaveCount(1);
      if (label === '02. Recording') {
        await expect(page.getByRole('combobox', { name: /^Allow recording\b/u })).toBeDisabled();
      }
      if (label === '04. Retention') {
        await expect(
          page.getByRole('region', { name: title, exact: true }).getByRole('spinbutton')
        ).toHaveCount(3);
      }
    }
    await expect(page.getByRole('switch', { name: 'Enable video meetings' })).not.toBeChecked();
    await expect(page.getByRole('button', { name: 'Save policy', exact: true })).toBeEnabled();
    const collaboration = await expandMeetingPolicySection(page, 'In-meeting collaboration');
    await expect(collaboration.getByRole('switch')).toHaveCount(3);
    const capacity = await expandMeetingPolicySection(page, 'Capacity and limits');
    await expect(capacity.getByRole('spinbutton')).toBeVisible();
    await page.setViewportSize({ width: 320, height: 720 });
    await expectResponsiveAndAccessible(page, 'U14 mobile 320');
    await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
    await expectResponsiveAndAccessible(page, 'U14 mobile 320 at 200 percent text');
  }
  await expandMeetingPolicySection(page, 'Policy limits and unavailable controls');
  await expect(page.getByText(/override API is available/u)).toBeVisible();
  await expect(page.getByText(/audit-list API is not available/u)).toBeVisible();
});
