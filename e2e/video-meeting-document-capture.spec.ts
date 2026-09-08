import { expect, test } from '@playwright/test';

import { withMeetingDocumentCapture } from './support/meeting-document-capture';

test('document evidence places the mobile dock at the end and restores the actual viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(
    '<meta name="viewport" content="width=device-width, initial-scale=1" />' +
      '<main style="height:1800px">Content</main><nav data-testid="meeting-mobile-navigation" ' +
      'style="position:fixed;bottom:0;left:0;right:0;height:64px">Navigation</nav>'
  );
  const dock = page.getByTestId('meeting-mobile-navigation');
  await withMeetingDocumentCapture(page, async () => {
    const height = page.viewportSize()!.height;
    expect(height).toBeGreaterThan(1800);
    expect((await dock.boundingBox())!.y).toBe(height - 64);
  });
  expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
  expect((await dock.boundingBox())!.y).toBe(780);
});

test('a failed screenshot still restores the mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.setContent(
    '<meta name="viewport" content="width=device-width, initial-scale=1" />' +
      '<main style="height:1800px">Content</main><footer data-testid="meeting-preferences-save-dock" ' +
      'style="position:fixed;bottom:0;left:0;right:0;height:64px">Save</footer>'
  );
  await expect(
    withMeetingDocumentCapture(page, async () => {
      throw new Error('Expected capture failure');
    })
  ).rejects.toThrow('Expected capture failure');
  expect(page.viewportSize()).toEqual({ width: 320, height: 720 });
});

test('document capture converges when responsive reflow grows content after its first resize', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(
    '<meta name="viewport" content="width=device-width, initial-scale=1" />' +
      '<main style="height:1800px">Content</main><nav data-testid="meeting-mobile-navigation" ' +
      'style="position:fixed;bottom:0;left:0;right:0;height:64px">Navigation</nav>'
  );
  await page.evaluate(() => {
    const reflow = () => {
      if (window.innerHeight <= 900) return;
      document.querySelector('main')!.style.height = '2400px';
      window.removeEventListener('resize', reflow);
    };
    window.addEventListener('resize', reflow);
  });
  await withMeetingDocumentCapture(page, async () => {
    const height = page.viewportSize()!.height;
    expect(height).toBeGreaterThan(2400);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(height);
    expect((await page.getByTestId('meeting-mobile-navigation').boundingBox())!.y).toBe(
      height - 64
    );
  });
  expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
});

test('non-converging document growth fails within four resizes and restores the viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(
    '<meta name="viewport" content="width=device-width, initial-scale=1" />' +
      '<main style="height:1800px">Content</main><nav data-testid="meeting-mobile-navigation" ' +
      'style="position:fixed;bottom:0;left:0;right:0;height:64px">Navigation</nav>'
  );
  await page.evaluate(() => {
    window.addEventListener('resize', () => {
      if (window.innerHeight > 900)
        document.querySelector('main')!.style.height = `${window.innerHeight + 200}px`;
    });
  });
  let captured = false;
  await expect(
    withMeetingDocumentCapture(page, async () => {
      captured = true;
    })
  ).rejects.toThrow();
  expect(captured).toBe(false);
  expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
});

test('a sticky policy savebar is captured after its content without changing the real viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(
    '<meta name="viewport" content="width=device-width, initial-scale=1" />' +
      '<main><section style="height:1800px">Policies</section>' +
      '<footer data-testid="meeting-admin-policy-savebar" ' +
      'style="position:sticky;bottom:0;height:64px;background:white">Save</footer></main>'
  );
  const savebar = page.getByTestId('meeting-admin-policy-savebar');
  expect((await savebar.boundingBox())!.y).toBe(780);
  await withMeetingDocumentCapture(page, async () => {
    expect((await savebar.boundingBox())!.y).toBeGreaterThan(1800);
    expect(await savebar.evaluate((node) => getComputedStyle(node).position)).toBe('sticky');
  });
  expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
  expect((await savebar.boundingBox())!.y).toBe(780);
});

test('desktop evidence does not resize its existing viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.setContent('<main style="height:1800px">Content</main>');
  await withMeetingDocumentCapture(page, async () => {
    expect(page.viewportSize()).toEqual({ width: 1440, height: 960 });
  });
});

test('document evidence remains operable with a deliberately paused media clock', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(
    '<meta name="viewport" content="width=device-width, initial-scale=1" />' +
      '<main style="height:1800px">Content</main><footer class="dwp-meeting-prejoin__admission-actions" ' +
      'style="position:fixed;bottom:0;left:0;right:0;height:64px">Join</footer>'
  );
  await page.clock.install({ time: new Date('2026-09-04T04:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-04T04:00:01Z'));
  await withMeetingDocumentCapture(page, async () => {
    expect(page.viewportSize()!.height).toBeGreaterThan(1800);
  });
  expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
});
