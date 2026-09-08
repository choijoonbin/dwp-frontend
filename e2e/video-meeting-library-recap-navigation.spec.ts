import { expect, test } from '@playwright/test';
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

test('library restores audience navigation and separates unprovided server filters from media', async ({
  page,
  isMobile,
}) => {
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
  await expect(page.getByRole('combobox', { name: 'Publication status' })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Retention status' })).toBeDisabled();
  await expectNoHorizontalOverflow(page, 'U07 original navigation and secondary facets');
  await expectNoBlockingA11y(page, 'U07 original navigation and secondary facets');
});

test('each published action opens its exact candidate and keeps Work creation authority locked', async ({
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
  await expect(review.getByRole('button', { name: 'Create work from candidate' })).toBeDisabled();
  await expect(review).toContainText(
    'current Meeting entitlement, scope, identity plane, and action authority'
  );
  expect(exactReads).toHaveLength(1);
  expect(writes).toEqual([]);
  await expectNoBlockingA11y(page, 'U08 exact candidate review and locked authority');
  await page.reload();
  await expect(review).toBeVisible();
  await review.getByRole('button', { name: 'Close review', exact: true }).click();
  await expect(page).not.toHaveURL(/candidateId=/);
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
  await expect(review.getByRole('button', { name: 'Create work from candidate' })).toBeDisabled();
  await expectNoBlockingA11y(page, 'U08 unavailable exact candidate');
});

test('mobile keeps actions and compact evidence before expandable detailed analysis', async ({
  page,
}) => {
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
});
