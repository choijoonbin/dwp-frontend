import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  MEETING_VISUAL_ID,
  mockMeetingVisualPrejoin,
  mockMeetingVisualSession,
} from './support/video-meeting-visual-fixtures';

test('prejoin keeps a local output choice and fails closed when output binding is unsupported', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile';
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1_280, height: 960 });
  await page.addInitScript(
    ({ mobile }) => {
      if (mobile) {
        Object.defineProperty(window, 'AudioContext', {
          configurable: true,
          value: class UnsupportedAudioContext {
            constructor() {
              throw new DOMException('Unavailable on this mobile context', 'NotSupportedError');
            }
          },
        });
      } else if (typeof AudioContext !== 'undefined') {
        Reflect.deleteProperty(AudioContext.prototype, 'setSinkId');
      }
    },
    { mobile }
  );
  await mockMeetingVisualSession(page, { locale: 'en', reducedMotion: true });
  await mockMeetingVisualPrejoin(page);

  await page.goto(`/meetings/room/${MEETING_VISUAL_ID}`);
  await page.getByRole('button', { name: 'Check camera and microphone' }).click();
  const speaker = page.getByTestId('meeting-prejoin-speaker');
  const selector = speaker.getByRole('combobox', { name: 'Speaker' });
  if (!mobile) {
    await selector.click();
    await page.getByRole('option', { name: 'Built-in speakers' }).click();
    await expect(selector).toHaveText(/Built-in speakers/u);

    const localChoice = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((candidate) =>
        candidate.startsWith('dwp:meetings:devices:v1:')
      );
      return key ? JSON.parse(localStorage.getItem(key) ?? 'null') : null;
    });
    expect(localChoice).toMatchObject({ speakerId: 'visual-speaker' });
  } else {
    await expect(selector).toHaveText(/System default device/u);
  }

  const testSound = speaker.getByRole('button', { name: 'Play test sound' });
  await testSound.focus();
  await expect(testSound).toBeFocused();
  await testSound.press('Enter');
  await expect(
    speaker.getByText('Device testing is not supported by this browser or connection context.')
  ).toBeVisible();
  await expect(testSound).toBeEnabled();
  await expect(testSound).not.toHaveAttribute('aria-busy', 'true');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
  const a11y = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    a11y.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
});
