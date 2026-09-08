import { expect, test } from '@playwright/test';

import { createBrowserZoomSession } from './support/browser-zoom';
import { mockWorkHubFoundation, personalTaskRoute } from './support/work-hub-foundation-fixtures';

// A disposable test-only extension applies browser zoom to an isolated profile.
// Opt in because this requires a Chromium build with extension support.
if (process.env.E2E_BROWSER_ZOOM_EXTENSION) {
  test('native browser 200 percent keeps Work focus clear of fixed navigation', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'chromium');
    test.setTimeout(90_000);
    await page.close();
    const session = await createBrowserZoomSession(
      process.env.E2E_BROWSER_ZOOM_EXTENSION!,
      process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4211'
    );
    try {
      const zoomPage = session.page;
      await mockWorkHubFoundation(zoomPage, { accessReview: true, designDetails: true });
      await zoomPage.emulateMedia({ reducedMotion: 'reduce' });
      for (const width of [1280, 640]) {
        await session.setPhysicalViewport(width, 1024);
        for (const [surface, route, control] of [
          ['personal', personalTaskRoute(), 'In progress'],
          ['today-plan', '/work/day-plan', 'Save plan'],
          [
            'M1',
            '/work/queue?work=IDENTITY_GOVERNANCE%3Af1111111-1111-4111-8111-111111111111%3A',
            'Revoke access',
          ],
        ]) {
          await zoomPage.goto(route);
          expect(await session.setZoom(2)).toBe(2);
          await expect.poll(() => zoomPage.evaluate(() => window.innerWidth)).toBe(width / 2);
          const nav = zoomPage.getByTestId('work-mobile-bottom-navigation');
          await expect(nav).toBeVisible();
          const action = zoomPage
            .getByRole('main')
            .getByRole('button', { name: control, exact: true })
            .first();
          await action.focus();
          await expect(action).toBeFocused();
          await expect
            .poll(async () => {
              const target = await action.boundingBox();
              const bottom = await nav.boundingBox();
              const header = await zoomPage.getByTestId('work-header').boundingBox();
              return Boolean(
                target &&
                bottom &&
                header &&
                target.y >= header.y + header.height &&
                target.y + target.height <= bottom.y
              );
            })
            .toBe(true);
          const metrics = await zoomPage.evaluate(() => ({
            width: window.innerWidth,
            overflow:
              document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
            cssZoom: getComputedStyle(document.documentElement).zoom,
            rootFontSize: getComputedStyle(document.documentElement).fontSize,
          }));
          expect(metrics).toEqual({
            width: width / 2,
            overflow: false,
            cssZoom: '1',
            rootFontSize: '16px',
          });
          await info.attach(`native-zoom-${surface}-${width}`, {
            contentType: 'application/json',
            body: JSON.stringify({ reportedZoom: 2, physicalWidth: width, ...metrics }),
          });
          await session.captureViewport(info.outputPath(`native-zoom200-${surface}-${width}.png`));
        }
      }
    } finally {
      await session.context.close();
    }
  });
}
