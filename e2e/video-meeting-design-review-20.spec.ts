import { expect, test } from '@playwright/test';
import { withMeetingDocumentCapture } from './support/meeting-document-capture';
import {
  mockApprovedAdmin,
  mockApprovedFollowUps,
  mockApprovedLiveRoom,
  mockApprovedTemplatesAndPreferences,
} from './support/meeting-approved-frame-evidence-fixtures';
import { mockPersonalRoom } from './support/meeting-personal-room-fixtures';
import {
  MEETING_VISUAL_ID,
  mockMeetingVisualAdminReadiness,
  mockMeetingVisualPublishedRecap,
  mockMeetingVisualSession,
} from './support/video-meeting-visual-fixtures';
import {
  expectNoBlockingA11y,
  expectNoHorizontalOverflow,
} from './support/video-meeting-visual-accessibility';

// These are review artifacts, not self-approved visual goldens. Pixel fidelity must
// be reviewed against the supplied Stitch original; passing axe is not design approval.
const screens = [
  ['U06', `/meetings/room/${MEETING_VISUAL_ID}`],
  ['U07', '/meetings/history'],
  ['U08', `/meetings/history?meeting=${MEETING_VISUAL_ID}`],
  ['U09', '/meetings/follow-ups'],
  ['U10', '/meetings/templates'],
  ['U11', '/meetings/mine?view=personal-room'],
  ['U12', '/meetings/preferences'],
  ['U13', '/meetings/admin/operations'],
  ['U14', '/meetings/admin/policies'],
  ['U15', '/meetings/admin/intelligence'],
] as const;

for (const [screen, path] of screens) {
  test(`${screen} original design review and accessible runtime`, async ({ page }, testInfo) => {
    const mobile = testInfo.project.name === 'mobile';
    await page.setViewportSize({ width: mobile ? 390 : 1440, height: mobile ? 844 : 960 });
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
    const errors: string[] = [];
    page.on('pageerror', ({ message }) => errors.push(message));
    switch (screen) {
      case 'U06':
        await mockApprovedLiveRoom(page, true);
        break;
      case 'U07':
      case 'U08':
        await mockMeetingVisualSession(page, { locale: 'ko', colorScheme: 'light' });
        await mockMeetingVisualPublishedRecap(page, true);
        break;
      case 'U09':
        await mockApprovedFollowUps(page, true);
        break;
      case 'U10':
      case 'U12':
        await mockApprovedTemplatesAndPreferences(page, true);
        break;
      case 'U11':
        await mockPersonalRoom(page, { locale: 'ko', colorScheme: 'light' });
        break;
      case 'U13':
      case 'U14':
        await mockApprovedAdmin(page, screen === 'U13');
        break;
      case 'U15':
        await mockMeetingVisualSession(page, { locale: 'ko', admin: true, colorScheme: 'light' });
        await mockMeetingVisualAdminReadiness(page, 'BLOCKED');
        break;
    }
    await page.goto(path);
    await expect(page.locator('#dwp-main-content')).toBeVisible({ timeout: 30_000 });
    if (screen === 'U06') {
      await page.getByRole('button', { name: '카메라와 마이크 점검', exact: true }).click();
      await page.getByRole('button', { name: '회의 참여', exact: true }).click();
      await expect(page.locator('.dwp-video-meeting-room')).toBeVisible();
      // A visible raster inside an aria-hidden ancestor is not an accessible room.
      await expect(page.getByRole('button', { name: '회의 진행', exact: true })).toBeVisible();
      if (!mobile) {
        await expect(page.getByTestId('meeting-live-tools-embedded')).toBeVisible();
        await expect(page.locator('[id^="meeting-facilitation-timer-title-"]')).toBeVisible();
      }
    } else {
      await expect(page.locator('#dwp-main-content h1')).toBeVisible();
      await expect(page.locator('#dwp-main-content .MuiSkeleton-root')).toHaveCount(0);
    }
    if (screen === 'U09' && !mobile) {
      await page
        .getByTestId(/^follow-up-row-/)
        .first()
        .click();
      await expect(page.getByTestId('meeting-follow-up-detail')).toBeVisible();
      await expect(page.getByTestId('meeting-follow-up-source-evidence')).toBeVisible();
    }
    await page.evaluate(() => document.fonts.ready);
    const label = `${screen}-${mobile ? 'M' : 'D'}`;
    await page.screenshot({
      path: testInfo.outputPath(`${label}-viewport.png`),
      animations: 'disabled',
    });
    await withMeetingDocumentCapture(page, async () => {
      await page.screenshot({
        path: testInfo.outputPath(`${label}-document.png`),
        fullPage: true,
        animations: 'disabled',
      });
    });
    await expectNoHorizontalOverflow(page, label);
    await expectNoBlockingA11y(page, label);
    expect(errors, `${label}: runtime exceptions`).toEqual([]);
    if (screen === 'U06' && mobile) {
      await page.setViewportSize({ width: 320, height: 844 });
      const leave = page.locator('.dwp-meeting-control--leave');
      await expect(leave).toBeInViewport({ ratio: 1 });
      await expect(page.locator('[data-control="chat"]')).toBeInViewport({ ratio: 1 });
      await expectNoHorizontalOverflow(page, `${label}-320`);
      await expectNoBlockingA11y(page, `${label}-320`);
      await page.screenshot({
        path: testInfo.outputPath(`${label}-320.png`),
        animations: 'disabled',
      });
    }
    if (screen === 'U10' && mobile) {
      await expect(page.getByTestId('meeting-mobile-navigation-templates')).toHaveAttribute(
        'aria-current',
        'page'
      );
    }
  });
}
