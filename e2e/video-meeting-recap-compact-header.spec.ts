import { expect, test } from '@playwright/test';
import {
  MEETING_VISUAL_ID,
  mockMeetingVisualPublishedRecap,
  mockMeetingVisualSession,
} from './support/video-meeting-visual-fixtures';
import {
  expectMinimumTarget,
  expectNoBlockingA11y,
  expectNoHorizontalOverflow,
} from './support/video-meeting-visual-accessibility';

for (const width of [390, 320]) {
  for (const locale of ['ko', 'en'] as const) {
    test(`U08 compact header ${width} ${locale} prioritizes outcomes without hiding governed details`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 720 });
      await mockMeetingVisualSession(page, { locale, reducedMotion: true });
      await mockMeetingVisualPublishedRecap(page, true);
      await page.goto(`/meetings/history?meeting=${MEETING_VISUAL_ID}`);
      const summary = page.getByRole('heading', {
        name: locale === 'ko' ? '핵심 요약' : 'Executive summary',
        exact: true,
      });
      const decisions = page.getByRole('heading', { name: /^(결정 사항|Decisions) \(3\)$/u });
      await expect(summary).toBeVisible();
      await expect(decisions).toBeVisible();
      const geometry = await Promise.all([
        summary.boundingBox(),
        decisions.boundingBox(),
        page.getByTestId('meeting-mobile-navigation').boundingBox(),
        page.getByTestId('meeting-recap-pipeline').boundingBox(),
      ]);
      await testInfo.attach('initial-outcome-geometry', {
        body: JSON.stringify({
          width,
          locale,
          summary: geometry[0],
          decisions: geometry[1],
          navigation: geometry[2],
          pipeline: geometry[3],
        }),
        contentType: 'application/json',
      });
      await page.screenshot({ path: testInfo.outputPath('U08-initial-viewport.png') });
      await page.screenshot({ path: testInfo.outputPath('U08-document.png'), fullPage: true });
      expect(geometry.every(Boolean)).toBe(true);
      // The approved mobile layout is 390px. At the additional 320px accessibility
      // width, preserve readable wrapping instead of shrinking or cutting content.
      const primary = width === 390 ? geometry[1]! : geometry[0]!;
      expect(
        primary.y + primary.height,
        width === 390
          ? 'decision heading is above fixed navigation at the approved width'
          : 'summary heading remains in the initial accessible viewport'
      ).toBeLessThan(geometry[2]!.y);
      await expect(page.getByTestId('meeting-recap-pipeline').getByRole('listitem')).toHaveCount(5);
      await expectNoHorizontalOverflow(page, `U08 ${width} ${locale}`);
      await expectNoBlockingA11y(page, `U08 ${width} ${locale}`);

      const tabs = page.getByRole('tablist', {
        name: locale === 'ko' ? '회의 회고 보기' : 'Meeting recap views',
      });
      await expect(tabs.getByRole('tab')).toHaveCount(4);
      const followUpsTab = tabs.getByRole('tab', {
        name: locale === 'ko' ? '후속 업무 (2)' : 'Follow-up work (2)',
        exact: true,
      });
      await followUpsTab.focus();
      await page.keyboard.press('Enter');
      await expect(followUpsTab).toHaveAttribute('aria-selected', 'true');
      const followUps = page.getByRole('region', {
        name: locale === 'ko' ? '후속 작업' : 'Follow-up actions',
        exact: true,
      });
      await expect(followUps).toBeFocused();
      await expect(
        followUps.getByRole('button', {
          name: locale === 'ko' ? '후보 검토' : 'Review candidate',
          exact: true,
        })
      ).toHaveCount(2);
      const followUpPosition = await followUps.getByRole('heading').boundingBox();
      expect(followUpPosition!.y).toBeGreaterThanOrEqual(64);
      expect(followUpPosition!.y + followUpPosition!.height).toBeLessThan(geometry[2]!.y);
      await expectNoHorizontalOverflow(page, `U08 follow-up tab ${width} ${locale}`);
      await expectNoBlockingA11y(page, `U08 follow-up tab ${width} ${locale}`);
      await tabs
        .getByRole('tab', {
          name: locale === 'ko' ? '개요 및 결과' : 'Overview and outcomes',
          exact: true,
        })
        .click();

      const analysis = page.getByTestId('meeting-recap-analysis-disclosure');
      const toggle = page.getByTestId('meeting-recap-analysis-toggle');
      await expect(analysis).not.toHaveAttribute('open', '');
      await expectMinimumTarget(toggle, 'U08 analysis disclosure');
      await toggle.focus();
      await page.keyboard.press('Enter');
      await expect(analysis).toHaveAttribute('open', '');
      await expect(
        page.getByRole('heading', { name: locale === 'ko' ? '주요 주제' : 'Topics', exact: true })
      ).toBeVisible();
      await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
      await expectNoHorizontalOverflow(page, `U08 ${width} ${locale} 200 percent text`);
      await expectNoBlockingA11y(page, `U08 ${width} ${locale} 200 percent text`);
      await expect(analysis).toHaveAttribute('open', '');
      await page.screenshot({ path: testInfo.outputPath('U08-text-200.png'), fullPage: true });
    });
  }
}
