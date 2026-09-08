import { expect, test, type Page } from '@playwright/test';
import { mockApprovedLiveRoom } from './support/meeting-approved-frame-evidence-fixtures';
import { mockPreparationDesignMetadata } from './support/meeting-preparation-design-fixtures';
import { MEETING_VISUAL_ID } from './support/video-meeting-visual-fixtures';
import {
  expectNoBlockingA11y,
  expectNoHorizontalOverflow,
} from './support/video-meeting-visual-accessibility';

async function browserSupportsLocalBackground(page: Page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (
      typeof MediaStream === 'undefined' ||
      typeof WebAssembly === 'undefined' ||
      typeof crypto.subtle?.digest !== 'function' ||
      typeof canvas.captureStream !== 'function' ||
      !context ||
      !('filter' in context)
    )
      return false;
    context.filter = 'blur(16px)';
    return context.filter === 'blur(16px)';
  });
}

test('U05 saves local blur without acquiring a camera and restores it on the next device check', async ({
  page,
  browser,
}, info) => {
  await mockApprovedLiveRoom(page, true);
  await mockPreparationDesignMetadata(page);
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: (constraints: MediaStreamConstraints) => {
        document.documentElement.dataset.cameraRequests = String(
          Number(document.documentElement.dataset.cameraRequests ?? 0) + 1
        );
        return original(constraints);
      },
    });
  });
  const open = async () => {
    await page.goto('/meetings/room/' + MEETING_VISUAL_ID);
    await page.getByRole('button', { name: '카메라와 마이크 점검', exact: true }).click();
  };
  await open();
  const blur = page.getByRole('button', { name: '배경 흐림', exact: true });
  const supported = await browserSupportsLocalBackground(page);
  if (supported) await expect(blur).toBeEnabled();
  else await expect(blur).toBeDisabled();
  await info.attach('runtime-browser', {
    body: JSON.stringify({
      engine: browser.browserType().name(),
      connected: browser.isConnected(),
      project: info.project.name,
      blurDisabled: await blur.isDisabled(),
    }),
    contentType: 'application/json',
  });
  test.skip(!supported, 'The native browser does not support local background processing.');
  await blur.click();
  await expect(blur).toHaveAttribute('aria-pressed', 'true');
  expect(
    await page.evaluate(() => Number(document.documentElement.dataset.cameraRequests ?? 0))
  ).toBe(0);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).some(
        (key) =>
          key.startsWith('dwp:meetings:devices:v1:') &&
          JSON.parse(localStorage.getItem(key)!).backgroundBlur === true
      )
    )
  ).toBe(true);
  await open();
  await expect(page.getByRole('button', { name: '배경 흐림', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(page.getByRole('button', { name: '카메라', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
  expect(
    await page.evaluate(() => Number(document.documentElement.dataset.cameraRequests ?? 0))
  ).toBe(0);
});

test('U05 model failure turns off the native camera and never attaches the raw input to visible preview', async ({
  page,
  browser,
}, info) => {
  await mockApprovedLiveRoom(page, true);
  await mockPreparationDesignMetadata(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const context = canvas.getContext('2d')!;
        context.fillStyle = 'red';
        context.fillRect(0, 0, 640, 360);
        const stream = canvas.captureStream(15);
        const track = stream.getVideoTracks()[0];
        const stop = track.stop.bind(track);
        track.stop = () => {
          document.documentElement.dataset.rawCameraStopped = 'true';
          stop();
        };
        return stream;
      },
    });
  });
  await page.route('**/assets/meeting-background/**', (route) =>
    route.fulfill({ status: 503, body: '' })
  );
  await page.goto('/meetings/room/' + MEETING_VISUAL_ID);
  await page.getByRole('button', { name: '카메라와 마이크 점검', exact: true }).click();
  const blur = page.getByRole('button', { name: '배경 흐림', exact: true });
  const supported = await browserSupportsLocalBackground(page);
  if (supported) await expect(blur).toBeEnabled();
  else await expect(blur).toBeDisabled();
  await info.attach('runtime-browser', {
    body: JSON.stringify({
      engine: browser.browserType().name(),
      connected: browser.isConnected(),
      project: info.project.name,
      blurDisabled: await blur.isDisabled(),
    }),
    contentType: 'application/json',
  });
  test.skip(!supported, 'The native browser does not support local background processing.');
  await blur.click();
  await page.getByRole('button', { name: '카메라', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.rawCameraStopped))
    .toBe('true');
  await expect(page.getByRole('button', { name: '카메라', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
  expect(
    await page
      .locator('.dwp-meeting-prejoin__stage video')
      .evaluate((video: HTMLVideoElement) => video.srcObject === null)
  ).toBe(true);
  await expect(
    page.getByRole('status').filter({
      hasText: '배경 처리가 중단되어 카메라를 껐습니다. 원본 영상으로 전환하지 않았습니다.',
    })
  ).toBeVisible();
  await expectNoHorizontalOverflow(page, 'U05 blur failure');
  await expectNoBlockingA11y(page, 'U05 blur failure');
  await page.screenshot({ path: info.outputPath('U05-background-failure.png'), fullPage: true });
});
