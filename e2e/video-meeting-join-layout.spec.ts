import { expect, test } from '@playwright/test';

import { mockJ01ResolvedMeeting } from './support/meeting-j01-visual';
import { mockMeetingVisualSession } from './support/video-meeting-visual-fixtures';
import { expectNoHorizontalOverflow } from './support/video-meeting-visual-accessibility';

for (const width of [390, 320]) {
  test(`J01 resolved admission action stays within the scrolling viewport at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 720 });
    await mockMeetingVisualSession(page, { locale: 'ko', reducedMotion: true });
    await mockJ01ResolvedMeeting(page);
    await page.goto('/meetings/join?code=ABCDEFGHJKMN');
    await page.getByTestId('meeting-join-actions').getByRole('button').click();
    await expect(page.getByTestId('meeting-join-summary')).toBeVisible();
    if (width === 320) {
      await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    }
    // Scroll the task itself, without focusing the CTA (focus would hide a broken sticky rule).
    await page
      .locator('form[aria-labelledby="meeting-join-primary-title"]')
      .evaluate((form) => form.scrollIntoView({ block: 'start' }));
    const action = page.getByTestId('meeting-join-actions').getByRole('button');
    await expect
      .poll(async () =>
        action.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.top >= 0 && bounds.bottom <= innerHeight - 8;
        })
      )
      .toBe(true);
    await expect(action).toBeEnabled();
    await expectNoHorizontalOverflow(page, `J01 sticky admission ${width}`);
  });
}
