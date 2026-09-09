import { expect, test, type Page } from '@playwright/test';
import ko from '../libs/shared-i18n/src/locales/ko/meetings.json' with { type: 'json' };
import {
  mockApprovedAdmin,
  mockApprovedFollowUps,
  mockApprovedTemplatesAndPreferences,
} from './support/meeting-approved-frame-evidence-fixtures';
import {
  mockMeetingVisualHome,
  mockMeetingVisualMine,
  mockMeetingVisualPublishedRecap,
} from './support/video-meeting-visual-fixtures';
import {
  expectMinimumTarget,
  expectNoBlockingA11y,
  expectNoHorizontalOverflow,
} from './support/video-meeting-visual-accessibility';
import {
  installMeetingJoinMediaProbe,
  expectNoMeetingJoinMediaCapture,
} from './support/video-meeting-functional-fixtures';

async function openSidebarDestination(page: Page, view: string) {
  const destination = page
    .getByTestId(`meetings-navigation-item-${view}`)
    .filter({ visible: true });
  await expect(page.locator('#dwp-main-content h1')).toBeVisible();
  if ((page.viewportSize()?.width ?? 1440) < 900) {
    await page.getByTestId('meetings-mobile-navigation-trigger').click();
  }
  await expectMinimumTarget(destination, `Meetings sidebar ${view}`);
  await destination.focus();
  await page.keyboard.press('Enter');
}

test('all seven member sidebar destinations remain usable without exposing administration', async ({
  page,
}, info) => {
  await page.setViewportSize(
    info.project.name === 'mobile' ? { width: 320, height: 844 } : { width: 1280, height: 960 }
  );
  await mockApprovedFollowUps(page, true);
  await mockMeetingVisualHome(page, 'next');
  await mockMeetingVisualMine(page);
  await mockMeetingVisualPublishedRecap(page, true);
  await mockApprovedTemplatesAndPreferences(page, true, false);
  await installMeetingJoinMediaProbe(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/meetings/home');
  for (const [view, title] of [
    ['join', ko.join.title],
    ['mine', ko.mine.title],
    ['history', ko.history.title],
    ['follow-ups', ko.followUps.title],
    ['templates', ko.templates.title],
    ['preferences', ko.preferences.title],
    ['home', ko.home.title],
  ]) {
    await openSidebarDestination(page, view);
    await expect(page).toHaveURL((url) => url.pathname === `/meetings/${view}`);
    await expect(page.locator('#dwp-main-content h1')).toHaveText(title);
    await expect(page.getByTestId(`meetings-navigation-item-${view}`).first()).toHaveAttribute(
      'aria-current',
      'page'
    );
    await expect(page.getByTestId('meetings-navigation-item-admin-policies')).toHaveCount(0);
    await expect(page.locator('#dwp-main-content .MuiSkeleton-root')).toHaveCount(0);
    await expectNoHorizontalOverflow(page, `sidebar ${view}`);
    await expectNoBlockingA11y(page, `sidebar ${view}`);
    await expectNoMeetingJoinMediaCapture(page);
  }
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('member-sidebar-home.png'), fullPage: true });
});

test('administrator sidebar connects operation, policy and governance screens with current selection', async ({
  page,
}, info) => {
  await page.setViewportSize(
    info.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 960 }
  );
  await mockApprovedAdmin(page, true);
  await installMeetingJoinMediaProbe(page);
  await page.goto('/meetings/admin/operations');
  for (const [view, path] of [
    ['admin-policies', 'policies'],
    ['admin-intelligence', 'intelligence'],
    ['admin-operations', 'operations'],
  ]) {
    await openSidebarDestination(page, view);
    await expect(page).toHaveURL((url) => url.pathname === `/meetings/admin/${path}`);
    await expect(page.locator('#dwp-main-content h1')).toBeVisible();
    await expect(page.getByTestId(`meetings-navigation-item-${view}`).first()).toHaveAttribute(
      'aria-current',
      'page'
    );
    await expectNoHorizontalOverflow(page, `admin sidebar ${view}`);
    await expectNoBlockingA11y(page, `admin sidebar ${view}`);
    await expectNoMeetingJoinMediaCapture(page);
  }
  await expect(
    page.getByRole('button', { name: ko.admin.design.failover, exact: true })
  ).toBeDisabled();
  await page.screenshot({ path: info.outputPath('admin-sidebar-operations.png'), fullPage: true });
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`published library pipeline remains readable in ${colorScheme} theme`, async ({
    page,
  }, info) => {
    await page.setViewportSize(
      info.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 960 }
    );
    const { mockMeetingVisualSession } = await import('./support/video-meeting-visual-fixtures');
    await mockMeetingVisualSession(page, { locale: 'ko', colorScheme, reducedMotion: true });
    await mockMeetingVisualPublishedRecap(page, true);
    await page.goto('/meetings/history');
    if (info.project.name === 'mobile')
      await page.getByRole('button', { name: ko.history.openRecap, exact: true }).first().click();
    const rail = page.getByTestId('meeting-recap-pipeline');
    await expect(rail).toBeVisible();
    await expect(rail.getByRole('listitem').last()).toHaveAttribute('aria-label', /확인됨/u);
    await expectNoBlockingA11y(page, `published library ${colorScheme}`);
    await expectNoHorizontalOverflow(page, `published library ${colorScheme}`);
    await page.screenshot({
      path: info.outputPath(`U07-published-pipeline-${colorScheme}.png`),
      fullPage: true,
    });
  });
}
