import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import {
  mockMeetingVisualPublishedRecap,
  mockMeetingVisualSession,
  MEETING_VISUAL_ID,
} from './support/video-meeting-visual-fixtures';
import {
  expectNoBlockingA11y,
  expectNoHorizontalOverflow,
} from './support/video-meeting-visual-accessibility';

const reportId = '88000000-0000-0000-0000-000000000301';
const secondCandidate = '89000000-0000-4000-8000-000000000302';
test.beforeEach(async ({ page, isMobile }) => {
  await page.setViewportSize({ width: isMobile ? 390 : 1440, height: isMobile ? 844 : 960 });
  await mockMeetingVisualSession(page, { locale: 'en', reducedMotion: true });
  await mockMeetingVisualPublishedRecap(page, true);
});

test('library keeps gated audience navigation and applies authoritative server evidence filters', async ({
  page,
  isMobile,
}) => {
  const historyReads: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'GET' && request.url().includes('/api/meetings/v1/history?'))
      historyReads.push(request.url());
  });
  await page.goto('/meetings/history');
  await expect(page.getByTestId('meeting-library-list')).toBeVisible();
  const navigation = page.getByRole('tablist', { name: 'Meeting library navigation' });
  await expect(navigation.getByRole('tab', { name: /^All / })).toBeEnabled();
  await navigation.getByRole('tab', { name: /^I participate / }).click();
  await expect(navigation.getByRole('tab', { name: /^I participate / })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(
    page.getByText(
      'Meetings on this page with a confirmed participation role. This does not confirm actual attendance.'
    )
  ).toBeVisible();
  for (const name of ['Shared with me', 'Needs review'])
    await expect(navigation.getByRole('tab', { name, exact: true })).toBeDisabled();
  await expect(navigation.getByRole('tab', { name: 'Favorites', exact: true })).toBeEnabled();
  if (isMobile)
    await page.getByRole('button', { name: 'Meeting library filters', exact: true }).click();
  const publication = page.getByRole('combobox', { name: 'Publication status' });
  const retention = page.getByRole('combobox', { name: 'Retention status' });
  await expect(publication).toBeEnabled();
  await expect(retention).toBeEnabled();
  await publication.click();
  await page.getByRole('option', { name: 'Published', exact: true }).click();
  await retention.click();
  await page.getByRole('option', { name: 'Expires within 30 days', exact: true }).click();
  await expect
    .poll(() => historyReads.some((url) => url.includes('publication=PUBLISHED')))
    .toBe(true);
  await expect
    .poll(() => historyReads.some((url) => url.includes('retention=EXPIRING_SOON')))
    .toBe(true);
  await expectNoHorizontalOverflow(page, 'U07 original navigation and secondary facets');
  await expectNoBlockingA11y(page, 'U07 original navigation and secondary facets');
});

test('each published action opens its exact candidate and hands creation to the authority-ready workspace', async ({
  page,
}) => {
  const writes: string[] = [];
  const exactReads: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET' && /\/api\/(meetings|work)/.test(request.url()))
      writes.push(request.url());
    if (request.method() === 'GET' && request.url().endsWith(`/intelligence/reports/${reportId}`))
      exactReads.push(request.url());
  });
  await page.goto(`/meetings/history?meeting=${MEETING_VISUAL_ID}`);
  const candidates = page.getByRole('button', { name: 'Review candidate', exact: true });
  await expect(candidates).toHaveCount(2);
  await expect(candidates.nth(1)).toBeEnabled();
  await candidates.nth(1).click();
  await expect(page).toHaveURL(
    new RegExp(`meeting=${MEETING_VISUAL_ID}&reportId=${reportId}&candidateId=${secondCandidate}`)
  );
  const review = page.getByRole('dialog', { name: 'Candidate review' });
  await expect(review).toBeVisible();
  await expect(review).toContainText('최종 출시 체크리스트와 담당자 인계 내용을 팀에 공유합니다.');
  await expect(review).not.toContainText('Verify regional capacity before external expansion.');
  const continueCreation = review.getByRole('button', {
    name: 'Continue creation in follow-up work',
  });
  await expect(continueCreation).toBeEnabled();
  expect(exactReads).toHaveLength(1);
  expect(writes).toEqual([]);
  await expectNoBlockingA11y(page, 'U08 exact candidate review and locked authority');
  await continueCreation.click();
  await expect(page).toHaveURL(
    new RegExp(`/meetings/follow-ups\\?scope=CANDIDATES&candidateId=${secondCandidate}$`)
  );
  expect(writes).toEqual([]);
});

test('unknown candidate links never select another action or dispatch a mutation', async ({
  page,
}) => {
  const unknownCandidate = '89000000-0000-0000-0000-000000000399';
  await page.goto(
    `/meetings/history?meeting=${MEETING_VISUAL_ID}&reportId=${reportId}&candidateId=${unknownCandidate}`
  );
  const review = page.getByRole('dialog', { name: 'Candidate review' });
  await expect(review).toContainText(
    'This candidate is not available in the current source. Another candidate is not substituted.'
  );
  await expect(review).not.toContainText('Verify regional capacity');
  await expect(
    review.getByRole('button', { name: 'Continue creation in follow-up work' })
  ).toBeDisabled();
  await expectNoBlockingA11y(page, 'U08 unavailable exact candidate');
});

test('published recap export posts the exact observed version and downloads the audited file', async ({
  page,
}, testInfo) => {
  const exportRequests: Array<{ body: unknown; correlationId: string | null }> = [];
  const exportedBody = '# Published meeting recap\n';
  await page.route(
    `**/api/meetings/v1/meetings/${MEETING_VISUAL_ID}/intelligence/reports/${reportId}/exports`,
    async (route) => {
      exportRequests.push({
        body: route.request().postDataJSON(),
        correlationId: route.request().headers()['x-correlation-id'] ?? null,
      });
      await route.fulfill({
        status: 200,
        contentType: 'text/markdown;charset=UTF-8',
        body: exportedBody,
        headers: {
          'Cache-Control': 'no-store',
          'X-DWP-Report-Version': '2',
          'X-DWP-Content-SHA256': createHash('sha256').update(exportedBody).digest('hex'),
        },
      });
    }
  );
  await page.goto(`/meetings/history?meeting=${MEETING_VISUAL_ID}`);
  const distribution = page.getByTestId('meeting-recap-distribution');
  await expect(distribution).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(globalThis.crypto?.subtle))).toBe(true);

  const download = page.waitForEvent('download');
  await distribution.getByRole('button', { name: 'Download Markdown', exact: true }).click();
  await expect(
    distribution.getByText(
      'The report was downloaded after current access and the published version were verified and audit evidence was recorded.'
    )
  ).toBeVisible();
  expect((await download).suggestedFilename()).toBe(`dwp-meeting-recap-${reportId}-v2.md`);
  expect(exportRequests).toEqual([
    {
      body: { expectedReportVersion: 2, format: 'MARKDOWN' },
      correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/u),
    },
  ]);
  await expectNoHorizontalOverflow(page, 'U08 published recap distribution');
  await expectNoBlockingA11y(page, 'U08 published recap distribution');
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: testInfo.outputPath(
      `u08-published-recap-distribution-${page.viewportSize()?.width ?? 'unknown'}.png`
    ),
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
  });
});

test('mobile keeps actions and compact evidence before expandable detailed analysis', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/meetings/history?meeting=${MEETING_VISUAL_ID}`);
  const action = page.getByRole('button', { name: 'Review candidate', exact: true }).first();
  const evidence = page.getByTestId('meeting-recap-evidence-rail');
  const analysis = page.getByTestId('meeting-recap-analysis-disclosure');
  await expect(action).toBeVisible();
  await expect(analysis).not.toHaveAttribute('open', '');
  await expect(page.getByTestId('meeting-recap-analysis')).toBeHidden();
  const tops = await Promise.all(
    [action, evidence, analysis].map((locator) =>
      locator.evaluate((element) => element.getBoundingClientRect().top)
    )
  );
  expect(tops[0]).toBeLessThan(tops[1]);
  expect(tops[1]).toBeLessThan(tops[2]);
  await page.getByTestId('meeting-recap-analysis-toggle').click();
  await expect(page.getByTestId('meeting-recap-analysis')).toBeVisible();
  await expect(page.getByText('Staged launch readiness', { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page, 'U08 mobile priority');
  await expectNoBlockingA11y(page, 'U08 mobile priority');
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: testInfo.outputPath('u08-mobile-expanded-analysis-390.png'),
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
  });
});
