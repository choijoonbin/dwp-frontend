import { expect, test } from '@playwright/test';

import {
  expectMinimumTarget,
  expectNoBlockingA11y,
  expectNoHorizontalOverflow,
} from './support/video-meeting-visual-accessibility';
import {
  MEETING_VISUAL_ID,
  mockMeetingVisualPublishedRecap,
  mockMeetingVisualSession,
} from './support/video-meeting-visual-fixtures';

test('U08 puts governed evidence before optional analysis on mobile and survives 200 percent text', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockMeetingVisualSession(page, { locale: 'ko', reducedMotion: true });
  await mockMeetingVisualPublishedRecap(page);
  await page.goto(`/meetings/history?meeting=${MEETING_VISUAL_ID}`);

  const evidence = page.getByTestId('meeting-recap-evidence-rail');
  const analysis = page.getByTestId('meeting-recap-analysis');
  const toggle = page.getByTestId('meeting-recap-analysis-toggle');
  await expect(evidence).toBeVisible();
  await expect(analysis).not.toHaveAttribute('open', '');
  const order = await Promise.all([
    evidence.evaluate((element) => element.getBoundingClientRect().top),
    analysis.evaluate((element) => element.getBoundingClientRect().top),
  ]);
  expect(order[0]).toBeLessThan(order[1]);
  await expectMinimumTarget(toggle, 'mobile recap analysis disclosure');
  await toggle.click();
  await expect(analysis).toHaveAttribute('open', '');
  await expect(page.getByRole('heading', { name: '주요 주제' })).toBeVisible();
  await expectNoHorizontalOverflow(page, 'U08 recap 390 progressive analysis');
  await expectNoBlockingA11y(page, 'U08 recap 390 progressive analysis');

  await page.setViewportSize({ width: 320, height: 720 });
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
  await expect(toggle).toBeVisible();
  await expectNoHorizontalOverflow(page, 'U08 recap 320 at 200 percent text');
  await expectNoBlockingA11y(page, 'U08 recap 320 at 200 percent text');
});
