import { expect, test } from '@playwright/test';
import { withMeetingDocumentCapture } from './support/meeting-document-capture';
import { mockApprovedLiveRoom } from './support/meeting-approved-frame-evidence-fixtures';
import {
  MEETING_VISUAL_ID,
  mockMeetingVisualSession,
  mockMeetingVisualPrejoin,
} from './support/video-meeting-visual-fixtures';
import { mockPreparationDesignMetadata } from './support/meeting-preparation-design-fixtures';
import {
  expectNoBlockingA11y,
  expectNoHorizontalOverflow,
} from './support/video-meeting-visual-accessibility';

// Review artifacts only: no self-approved snapshot assertion or canonical PNG update.
for (const screen of ['U04', 'U05'] as const) {
  test(
    screen + ' approved hierarchy retains local and governed boundaries',
    async ({ page }, info) => {
      const mobile = info.project.name === 'mobile';
      await page.setViewportSize({ width: mobile ? 390 : 1440, height: mobile ? 844 : 960 });
      await mockApprovedLiveRoom(page, true);
      await mockPreparationDesignMetadata(page);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      if (screen === 'U04') {
        await page.goto('/meetings/mine?view=preparation&meetingId=' + MEETING_VISUAL_ID);
        await expect(page.getByTestId('meeting-preparation-briefing')).toBeVisible();
        await expect(page.locator('#preparation-agenda')).toBeVisible();
        await expect(page.locator('#preparation-devices')).toBeVisible();
        await expect(
          page.getByRole('button', { name: '카메라와 마이크 점검', exact: true })
        ).toBeEnabled();
        const roster = page.getByTestId('meeting-preparation-roster');
        await expect(roster.locator('li')).toHaveCount(6);
        if (mobile) {
          const first = await roster.locator('li').nth(0).boundingBox();
          const second = await roster.locator('li').nth(1).boundingBox();
          expect(Math.abs(first!.y - second!.y)).toBeLessThan(2);
          expect(second!.x).toBeGreaterThan(first!.x);
          const notice = page
            .locator('details')
            .filter({ has: page.locator('summary', { hasText: '입장 및 콘텐츠 처리 안내' }) })
            .first();
          await expect(notice).not.toHaveAttribute('open');
          await notice.locator('summary').click();
          const material = page.getByTestId('meeting-preparation-material-detail').first();
          await expect(material).not.toHaveAttribute('open');
          await material.locator('summary').click();
          await expect(
            material.getByRole('button', { name: '접근 권한 확인', exact: true })
          ).toBeVisible();
          await expect(material).toContainText('DWP_FILES');
          await material.locator('summary').click();
          await expect(notice).toHaveAttribute('open', '');
          await expect(notice).toContainText('이 화면에서는 미디어를 전송하지 않습니다.');
          await notice.locator('summary').click();
        }
      } else {
        await page.goto('/meetings/room/' + MEETING_VISUAL_ID);
        await page.getByRole('button', { name: '카메라와 마이크 점검', exact: true }).click();
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          '분기 제품 출시 의사결정 (Q3 Final Go/No-Go)'
        );
        const context = page.getByTestId('meeting-prejoin-context');
        if (!mobile) {
          await expect(context).toHaveCSS('border-top-width', '0px');
          await expect(context).toHaveCSS('padding-top', '0px');
        }
        const stage = await page
          .locator('.dwp-meeting-prejoin__stage .lk-video-container')
          .boundingBox();
        expect(stage).not.toBeNull();
        if (!mobile) expect(stage!.width / stage!.height).toBeCloseTo(16 / 9, 1);
        else expect(stage!.height).toBeGreaterThanOrEqual(180);
        await expect(page.getByTestId('meeting-prejoin-device-deck')).toBeVisible();
        await expect(page.getByTestId('meeting-prejoin-agenda')).toContainText('출시 결정');
        await expect(page.getByRole('button', { name: '회의 참여', exact: true })).toBeEnabled();
        await expect(page.getByRole('button', { name: '마이크', exact: true })).toHaveAttribute(
          'aria-pressed',
          'false'
        );
        if (mobile) {
          const action = await page
            .getByRole('button', { name: '회의 참여', exact: true })
            .boundingBox();
          expect(action!.y + action!.height).toBeLessThanOrEqual(844);
        }
      }
      await expectNoHorizontalOverflow(page, screen);
      await expectNoBlockingA11y(page, screen);
      expect(errors).toEqual([]);
      await page.evaluate(() => {
        document.getElementById('dwp-main-content')?.scrollTo(0, 0);
        window.scrollTo(0, 0);
      });
      await page.screenshot({
        path: info.outputPath(screen + (mobile ? '-M' : '-D') + '-viewport.png'),
      });
      await withMeetingDocumentCapture(page, async () => {
        await page.screenshot({
          path: info.outputPath(screen + (mobile ? '-M' : '-D') + '-document.png'),
          fullPage: true,
        });
      });
      await page.setViewportSize({ width: 320, height: 900 });
      await expect
        .poll(() =>
          page
            .locator('#dwp-main-content')
            .evaluate((element) => element.scrollWidth - element.clientWidth)
        )
        .toBeLessThanOrEqual(1)
        .catch(async (error: unknown) => {
          await info.attach('overflow-elements', {
            body: JSON.stringify(
              await page.locator('#dwp-main-content').evaluate((main) =>
                [...main.querySelectorAll('*')]
                  .filter(
                    (element) =>
                      element.getBoundingClientRect().right > main.getBoundingClientRect().right + 1
                  )
                  .slice(0, 20)
                  .map((element) => ({
                    tag: element.tagName,
                    className: element.className,
                    text: element.textContent?.slice(0, 90),
                    width: element.getBoundingClientRect().width,
                    right: element.getBoundingClientRect().right,
                  }))
              ),
              null,
              2
            ),
            contentType: 'application/json',
          });
          throw error;
        });
      await expectNoHorizontalOverflow(page, screen + ' 320');
      await expectNoBlockingA11y(page, screen + ' 320');
      await page.screenshot({ path: info.outputPath(screen + '-320.png'), fullPage: true });
      if (screen === 'U04') {
        const roster = page.getByTestId('meeting-preparation-roster');
        await roster.focus();
        await page.keyboard.press('ArrowRight');
        await expect
          .poll(() => roster.evaluate((element) => element.scrollLeft))
          .toBeGreaterThan(0);
        for (let index = 0; index < 18; index += 1) {
          const closed = page
            .locator('#dwp-main-content details:not([open]) > summary:visible')
            .first();
          if (!(await closed.count())) break;
          await closed.click();
        }
        await expectNoBlockingA11y(page, 'U04 safeguards expanded 320');
        await expectNoHorizontalOverflow(page, 'U04 safeguards expanded 320');
        await page.screenshot({ path: info.outputPath('U04-320-expanded.png'), fullPage: true });
      }
    }
  );
}

test('U05 dark narrow and enlarged text preserve complete controls and private entry', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await mockApprovedLiveRoom(page, true);
  await mockMeetingVisualSession(page, { locale: 'en', colorScheme: 'dark' });
  await mockMeetingVisualPrejoin(page);
  await mockPreparationDesignMetadata(page);
  await page.goto('/meetings/room/' + MEETING_VISUAL_ID);
  await page.getByRole('button', { name: 'Check camera and microphone', exact: true }).click();
  await expect(page.getByTestId('meeting-prejoin-device-deck')).toBeVisible();
  await expectNoHorizontalOverflow(page, 'U05 dark320');
  await expectNoBlockingA11y(page, 'U05 dark320');
  await page.screenshot({ path: info.outputPath('U05-dark-320.png'), fullPage: true });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await expectNoHorizontalOverflow(page, 'U05 text200');
  await expect(page.getByRole('button', { name: 'Join meeting', exact: true })).toBeEnabled();
  await page.screenshot({ path: info.outputPath('U05-text-200.png'), fullPage: true });
});
