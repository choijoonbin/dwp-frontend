import { expect, test } from '@playwright/test';
import {
  MEETING_VISUAL_ID,
  mockMeetingVisualPublishedRecap,
  mockMeetingVisualSession,
} from './support/video-meeting-visual-fixtures';
import {
  expectNoBlockingA11y,
  expectNoHorizontalOverflow,
} from './support/video-meeting-visual-accessibility';

test('library facets filter the authorized page and reset restores all records', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile';
  await page.setViewportSize({ width: mobile ? 390 : 1280, height: 900 });
  await mockMeetingVisualSession(page, { locale: 'en', reducedMotion: true });
  await mockMeetingVisualPublishedRecap(page, true);
  await page.goto('/meetings/history');
  const records = page.getByTestId('meeting-library-list').locator('article');
  await expect(records).toHaveCount(3);
  await expect(records.first()).toContainText('김민아');
  if (mobile)
    await page.getByRole('button', { name: 'Meeting library filters', exact: true }).click();
  await page.getByRole('combobox', { name: /Sort order/u }).click();
  await page.getByRole('option', { name: 'Oldest meetings', exact: true }).click();
  await expect(records.first()).toContainText('일대일 성장 체크인');
  await page.getByRole('combobox', { name: /^Organizer/u }).click();
  await page.getByRole('option', { name: '박수석', exact: true }).click();
  await expect(records).toHaveCount(1);
  await expect(records.first()).toContainText('플랫폼 디자인 시스템 싱크');
  await page
    .getByRole('textbox', { name: 'Search this page by meeting or organizer' })
    .fill('no matched meeting');
  await expect(records).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'No records match these filters' })).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await expect(records).toHaveCount(3);
  await expect(records.first()).toContainText('분기 제품 출시 의사결정');
  await page.getByRole('combobox', { name: /^Date range/u }).click();
  await page.getByRole('option', { name: 'Last 7 days', exact: true }).click();
  await expect(records).toHaveCount(3);
  await expectNoHorizontalOverflow(page, 'library active facets');
  await expectNoBlockingA11y(page, 'library active facets');
  await records.first().getByRole('button', { name: 'Open meeting recap', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`meeting=${MEETING_VISUAL_ID}`, 'u'));
  await expect(page.getByTestId('meeting-recap-pipeline')).toBeVisible();
});

test('library and cited recap retain content at narrow widths, text zoom and high contrast', async ({
  page,
}, testInfo) => {
  await mockMeetingVisualSession(page, { locale: 'en', reducedMotion: true });
  await mockMeetingVisualPublishedRecap(page, true);
  for (const width of testInfo.project.name === 'mobile' ? [390, 320] : [1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/meetings/history');
    await expect(page.getByTestId('meeting-library-list').locator('article')).toHaveCount(3);
    await expectNoHorizontalOverflow(page, `library ${width}`);
    await page.goto(`/meetings/history?meeting=${MEETING_VISUAL_ID}`);
    const overview = page.getByTestId('meeting-recap-overview');
    const decision = overview.getByText('Launch the internal pilot on Monday.', { exact: true });
    const followUps = overview.getByRole('heading', { name: 'Follow-up actions', exact: true });
    const analysis = page.getByTestId('meeting-recap-analysis');
    await expect(decision).toBeVisible();
    await expect(followUps).toBeVisible();
    if (width < 600) {
      const disclosure = page.getByTestId('meeting-recap-analysis-disclosure');
      const toggle = page.getByTestId('meeting-recap-analysis-toggle');
      const evidence = page.getByTestId('meeting-recap-evidence-rail');
      await expect(overview.locator('details')).toHaveCount(1);
      await expect(disclosure).not.toHaveAttribute('open', '');
      await expect(analysis).toBeHidden();
      const tops = await Promise.all(
        [decision, followUps, evidence, disclosure].map((locator) =>
          locator.evaluate((element) => element.getBoundingClientRect().top)
        )
      );
      expect(tops[0]).toBeLessThan(tops[1]);
      expect(tops[1]).toBeLessThan(tops[2]);
      expect(tops[2]).toBeLessThan(tops[3]);
      await toggle.focus();
      await page.keyboard.press('Enter');
      await expect(disclosure).toHaveAttribute('open', '');
      await expect(analysis).toBeVisible();
      await expect(analysis.getByText('Staged launch readiness', { exact: true })).toBeVisible();
      await expect(decision).toBeVisible();
      await expect(followUps).toBeVisible();
    } else {
      await expect(overview.locator('details')).toHaveCount(0);
      await expect(analysis).toBeVisible();
    }
    await expectNoHorizontalOverflow(page, `recap ${width}`);
    await expectNoBlockingA11y(page, `recap ${width}`);
  }
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
  await expectNoHorizontalOverflow(page, 'recap 200 percent text');
  await expect(
    page.getByText('Launch the internal pilot on Monday.', { exact: true })
  ).toBeVisible();
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await expectNoHorizontalOverflow(page, 'recap high contrast');
  await page.screenshot({
    path: testInfo.outputPath('recap-text-zoom-high-contrast.png'),
    fullPage: true,
  });
});

test('published pipeline keeps green status text readable in dark mode at supported breakpoints', async ({
  page,
}, testInfo) => {
  const width = testInfo.project.name === 'mobile' ? 390 : 1440;
  await page.setViewportSize({ width, height: 900 });
  await mockMeetingVisualSession(page, { locale: 'en', colorScheme: 'dark', reducedMotion: true });
  await mockMeetingVisualPublishedRecap(page);
  await page.goto(`/meetings/history?meeting=${MEETING_VISUAL_ID}`);
  const pipeline = page.getByTestId('meeting-recap-pipeline');
  await expect(pipeline).toBeVisible();
  await expect(
    pipeline.getByRole('listitem', { name: 'Review: Verified', exact: true })
  ).toBeVisible();
  await expectNoHorizontalOverflow(page, `dark recap pipeline ${width}`);
  await expectNoBlockingA11y(page, `dark recap pipeline ${width}`);
  await pipeline.screenshot({
    path: testInfo.outputPath(`recap-pipeline-dark-${width}.png`),
    animations: 'disabled',
  });
});

test('the approved fourth recap tab opens current follow-ups without creating work or reading another report', async ({
  page,
}, testInfo) => {
  const widths = testInfo.project.name === 'mobile' ? [390, 320] : [1440, 1280];
  await mockMeetingVisualSession(page, { locale: 'en', reducedMotion: true });
  await mockMeetingVisualPublishedRecap(page, true);
  const reportId = '88000000-0000-0000-0000-000000000301';
  const sourcePath = `/api/meetings/v1/meetings/${MEETING_VISUAL_ID}/intelligence/reports/${reportId}`;
  const reads: string[] = [];
  const writes: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.includes('/intelligence/reports/')) reads.push(path);
    if (request.method() !== 'GET' && /\/api\/(meetings|work)/u.test(path)) writes.push(path);
  });
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/meetings/history?meeting=${MEETING_VISUAL_ID}&reportId=${reportId}`);
    const tabs = page.getByRole('tablist', { name: 'Meeting recap views' });
    await expect(tabs.getByRole('tab')).toHaveCount(4);
    const followUpsTab = tabs.getByRole('tab', { name: 'Follow-up work (2)', exact: true });
    await followUpsTab.focus();
    await page.keyboard.press('Enter');
    await expect(followUpsTab).toHaveAttribute('aria-selected', 'true');
    const followUps = page.getByRole('region', { name: 'Follow-up actions', exact: true });
    await expect(followUps).toBeFocused();
    await expect(
      followUps.getByRole('button', { name: 'Review candidate', exact: true })
    ).toHaveCount(2);
    await expect(followUps).toContainText('Verify regional capacity before external expansion.');
    await expectNoHorizontalOverflow(page, `fourth recap tab ${width}`);
    await expectNoBlockingA11y(page, `fourth recap tab ${width}`);
    await page.screenshot({ path: testInfo.outputPath(`U08-follow-ups-${width}.png`) });
  }
  expect(reads.length).toBeGreaterThan(0);
  expect(reads.every((path) => path === sourcePath)).toBe(true);
  expect(writes).toEqual([]);

  await page.route(`**${sourcePath}`, (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ERROR', success: false, message: 'Source unavailable' }),
    })
  );
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'The source meeting report is unavailable.' })
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Follow-up actions', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Follow-up work (2)', exact: true })).toHaveCount(0);
  await expect(
    page.getByText('Verify regional capacity before external expansion.', { exact: true })
  ).toHaveCount(0);
  expect(writes).toEqual([]);
});
