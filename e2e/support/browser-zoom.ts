import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

/** Isolated profile: does not change the user's browser, CSS zoom, or root font size. */
export async function createBrowserZoomSession(extension: string, baseURL: string) {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    baseURL,
    timezoneId: 'Asia/Seoul',
    viewport: null,
    deviceScaleFactor: undefined,
    isMobile: false,
    args: [
      '--window-size=1280,1111',
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const page = await context.newPage();
  const windowChromeHeight = await page.evaluate(() => outerHeight - innerHeight);
  const setPhysicalViewport = async (width: number, height: number) => {
    const session = await context.newCDPSession(page);
    try {
      const { windowId } = await session.send('Browser.getWindowForTarget');
      await session.send('Browser.setWindowBounds', {
        windowId,
        bounds: { width, height: height + windowChromeHeight },
      });
    } finally {
      await session.detach();
    }
  };
  const setZoom = (factor: number) =>
    worker.evaluate(
      async ({ url, zoom }) => {
        const api = (
          globalThis as unknown as {
            chrome: {
              tabs: {
                query: (query: object) => Promise<Array<{ id?: number; url?: string }>>;
                setZoom: (id: number, factor: number) => Promise<void>;
                getZoom: (id: number) => Promise<number>;
              };
            };
          }
        ).chrome;
        const tabs = await api.tabs.query({});
        const tab = tabs.find((candidate) => candidate.url === url);
        if (tab?.id === undefined) throw new Error('The isolated QA tab was not found.');
        await api.tabs.setZoom(tab.id, zoom);
        return api.tabs.getZoom(tab.id);
      },
      { url: page.url(), zoom: factor }
    );
  const captureViewport = async (path: string) => {
    // Native viewport avoids page-offset clipping on a scrolled page at browser zoom.
    const session = await context.newCDPSession(page);
    try {
      const screenshot = await session.send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false,
      });
      await writeFile(path, Buffer.from(screenshot.data, 'base64'));
    } finally {
      await session.detach();
    }
  };
  return { context, page, setZoom, setPhysicalViewport, captureViewport };
}
