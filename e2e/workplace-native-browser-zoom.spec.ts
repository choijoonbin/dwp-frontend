import { mkdtemp, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { chromium, expect, test, type Request } from '@playwright/test';
import { isolateWorkplaceDevelopmentUpdates } from './support/workplace-runtime-isolation';
import { workplaceSourceSnapshot } from './support/workplace-source-snapshot';

test('Workplace remains usable under actual native browser 200 percent zoom', async () => {
  test.skip(
    process.env.WORKPLACE_NATIVE_ZOOM_VERIFY !== '1',
    'Opt in to a read-only native runtime check in a generated isolated Chromium profile.'
  );
  test.setTimeout(300_000);
  const sourcesBefore = await workplaceSourceSnapshot();
  const output = path.resolve('../output/workplace-full-implementation-final/native-browser-zoom');
  await mkdir(output, { recursive: true });
  const profile = await mkdtemp(path.join(os.tmpdir(), 'workplace-owned-native-zoom-'));
  await mkdir(path.join(profile, 'Default'));
  const preferences = path.join(profile, 'Default', 'Preferences');
  const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
  // Chrome's native default zoom preference, not CSS, device metrics, or page-scale emulation.
  // The default storage partition's key is 'x'; native zoom level is log(factor) / log(1.2).
  const launch = () =>
    chromium.launchPersistentContext(profile, {
      channel: 'chromium',
      headless: true,
      viewport: null,
      baseURL,
      args: ['--window-size=1280,900'],
    });
  await writeFile(preferences, JSON.stringify({ partition: { default_zoom_level: { x: 0 } } }));
  let context = await launch();
  try {
    let page = context.pages()[0];
    await page.goto('/sign-in');
    const baseline = await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      dpr: devicePixelRatio,
      visualScale: visualViewport?.scale,
    }));
    const browserVersion = context.browser()?.version();
    await context.close();
    const stored = JSON.parse(await readFile(preferences, 'utf8'));
    stored.partition.default_zoom_level.x = Math.log(2) / Math.log(1.2);
    await writeFile(preferences, JSON.stringify(stored));
    context = await launch();
    page = context.pages()[0];
    const pending = new Set<Request>();
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/platform/v1/')) pending.add(request);
    });
    page.on('requestfinished', (request) => pending.delete(request));
    page.on('requestfailed', (request) => pending.delete(request));
    await isolateWorkplaceDevelopmentUpdates(page);
    const readme = await readFile(path.resolve('../dwp-backend/README.md'), 'utf8');
    const password = readme.match(/공통 비밀번호 `([^`]+)`/)?.[1];
    expect(password).toBeTruthy();
    await page.goto('/sign-in?returnUrl=%2Fworkplace%2Fhome');
    const zoomed = await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      dpr: devicePixelRatio,
      visualScale: visualViewport?.scale,
    }));
    expect(zoomed.dpr / baseline.dpr).toBeCloseTo(2, 2);
    expect(zoomed.width).toBeCloseTo(baseline.width / 2, 0);
    expect(zoomed.visualScale).toBe(1);
    await page.locator('input[name="email"]').fill('joonbin@sk.com');
    await page.locator('input[name="password"]').fill(password!);
    const loginFinished = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/auth/login' &&
        response.request().method() === 'POST'
    );
    await page.locator('#dwp-sign-in-form button[type="submit"]').click();
    expect((await loginFinished).status()).toBe(200);
    await expect(page).toHaveURL(/\/workplace\/home/, { timeout: 45_000 });
    const views = [
      ['01', '/workplace/home'],
      ['02-05', '/workplace/explore'],
      ['04-06', '/workplace/my-bookings'],
      ['07', '/workplace/home?view=team'],
      ['08', '/workplace/admin/overview'],
      ['09', '/workplace/admin/locations'],
      ['10', '/workplace/admin/policies'],
      ['11', '/workplace/admin/operations?view=facilities'],
      ['12', '/workplace/admin/overview?view=insights'],
      ['13', '/workplace/admin/governance?area=access'],
    ];
    const results = [];
    const captureSession = await context.newCDPSession(page);
    for (const [screen, target] of views) {
      await page.goto(target);
      await expect(page.getByTestId('product-surface-loading-shell')).toHaveCount(0, {
        timeout: 20_000,
      });
      const main = page.locator('#dwp-main-content').first();
      await expect(main).toBeVisible();
      await expect.poll(() => pending.size, { timeout: 35_000 }).toBe(0);
      await expect(main.getByRole('progressbar')).toHaveCount(0, { timeout: 20_000 });
      await expect(main.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 20_000 });
      if (screen === '10')
        await expect(main.getByTestId('policy-editor')).toBeVisible({ timeout: 20_000 });
      let last = '';
      let stable = 0;
      await expect
        .poll(
          async () => {
            const text = (await main.innerText()).trim();
            stable = text === last && text.length > 50 ? stable + 1 : 0;
            last = text;
            return stable;
          },
          { intervals: [250, 250, 500], timeout: 20_000 }
        )
        .toBeGreaterThanOrEqual(2);
      const dimensions = await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        dpr: devicePixelRatio,
      }));
      expect(dimensions.dpr / baseline.dpr).toBeCloseTo(2, 2);
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 2);
      const axe = await new AxeBuilder({ page })
        .include('#dwp-main-content')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(axe.violations).toEqual([]);
      const screenshot = path.join(output, `workplace-${screen}-native-200.png`);
      const metrics = await captureSession.send('Page.getLayoutMetrics');
      expect(metrics.visualViewport.zoom).toBeCloseTo(2, 2);
      // Native zoom scales CSS pixels into DIPs. Playwright's fullPage DOM rectangle
      // otherwise clips half the physical width; use Chrome's actual DIP content rectangle.
      const capture = await captureSession.send('Page.captureScreenshot', {
        format: 'png',
        clip: { ...metrics.contentSize, scale: 1 },
        captureBeyondViewport: true,
      });
      const bytes = Buffer.from(capture.data, 'base64');
      const bitmap = { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
      expect(bitmap.width).toBe(Math.round(metrics.contentSize.width));
      expect(bitmap.width).toBeGreaterThanOrEqual(baseline.width);
      await writeFile(screenshot, bytes);
      results.push({
        screen,
        target,
        dimensions,
        screenshot,
        loadedTextLength: last.length,
        axeViolations: axe.violations.length,
        nativeZoom: metrics.visualViewport.zoom,
        bitmap,
      });
    }
    await Promise.all(
      ['ready.json', 'zoom-progress.json'].map((file) =>
        rm(path.join(output, file), { force: true })
      )
    );
    const sourcesAfter = await workplaceSourceSnapshot();
    expect(sourcesAfter).toEqual(sourcesBefore);
    await writeFile(
      path.join(output, 'manifest.json'),
      JSON.stringify(
        {
          status: 'PASS',
          source: 'FULL_CHROMIUM_NATIVE_ZOOM_PREFERENCE_IN_GENERATED_ISOLATED_PROFILE',
          browserVersion,
          baseline,
          zoomed,
          results,
          responseMocks: 0,
          pageScaleEmulation: false,
          rootFontEmulation: false,
          userProfileTouched: false,
          sourcesBefore,
          sourcesAfter,
          preference: 'partition.default_zoom_level.x',
          zoomLevel: Math.log(2) / Math.log(1.2),
          captureMethod: 'CHROMIUM_NATIVE_DIP_CONTENT_RECTANGLE_NO_EMULATION',
          nativeImplementation:
            'https://chromium.googlesource.com/chromium/src/+/lkgr/chrome/browser/ui/zoom/chrome_zoom_level_prefs.cc',
          nativeConversion:
            'https://chromium.googlesource.com/chromium/src/+/938b37a6d2886bf8335fc7db792f1eb46c65b2ae/third_party/blink/common/page/page_zoom.cc',
          limit:
            'Native read-only states; command modal states covered separately. Browser UI interaction was unavailable while macOS was locked.',
        },
        null,
        2
      ) + '\n'
    );
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
