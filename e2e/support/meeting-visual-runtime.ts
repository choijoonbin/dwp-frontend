import { expect, test } from '@playwright/test';

import { emulateVisualTransparency } from './visual-media';
import { withMeetingDocumentCapture } from './meeting-document-capture';

import type { Page } from '@playwright/test';

const runtimeDiagnostics = new WeakMap<Page, string[]>();

export function trackMeetingRuntime() {
  test.beforeEach(async ({ page }) => {
    await emulateVisualTransparency(page);
    const diagnostics: string[] = [];
    runtimeDiagnostics.set(page, diagnostics);
    page.on('console', (message) => {
      const text = message.text();
      if (message.type() === 'error' || /\[i18n\]\s+Missing key:/u.test(text)) {
        diagnostics.push(`${message.type()}: ${text}`);
      }
    });
    page.on('pageerror', (error) => diagnostics.push(`pageerror: ${error.message}`));
    page.on('response', (response) => {
      if (response.status() >= 500) {
        diagnostics.push(`http ${response.status()}: ${response.url()}`);
      }
    });
  });
}

export async function expectPageReady(page: Page) {
  await expect(
    page.getByRole('progressbar', { name: /Loading page|페이지 불러오는 중/u })
  ).toHaveCount(0, { timeout: 15_000 });
  const main = page.locator('#dwp-main-content');
  await expect(main).toBeVisible({ timeout: 15_000 });
  await expect(main.locator('.MuiSkeleton-root')).toHaveCount(0, { timeout: 15_000 });
  return main;
}

export async function expectCleanMeetingRuntime(page: Page, label: string) {
  expect(runtimeDiagnostics.get(page) ?? [], `${label}: runtime diagnostics`).toEqual([]);
  const visibleDiagnosticText = await page.evaluate(() => {
    const findings = new Set<string>();
    const visit = (root: Document | ShadowRoot) => {
      for (const element of root.querySelectorAll<HTMLElement>('*')) {
        if (element.shadowRoot) visit(element.shadowRoot);
        if (element.children.length > 0) continue;
        const bounds = element.getBoundingClientRect();
        if (bounds.width <= 0 || bounds.height <= 0) continue;
        const text = (element.innerText || element.textContent || '').trim();
        if (/^\d+\s*\/\s*\d+$/u.test(text)) findings.add(`checker badge: ${text}`);
        for (const match of text.matchAll(
          /\b(?:admin|history|home|join|lobby|prejoin|room|schedule)\.[a-z][\w.-]*/gu
        )) {
          findings.add(`raw i18n key: ${match[0]}`);
        }
        for (const match of text.matchAll(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+){2,}\b/gu)) {
          findings.add(`raw internal code: ${match[0]}`);
        }
      }
    };
    visit(document);
    return [...findings];
  });
  expect(visibleDiagnosticText, `${label}: visible checker/i18n diagnostics`).toEqual([]);
}

export async function expectVisualSnapshot(
  page: Page,
  name: string,
  options: Readonly<{ fullPage?: boolean }> = {}
) {
  await page.evaluate(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.querySelector<HTMLElement>('#dwp-main-content')?.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto',
    });
  });
  await expect
    .poll(() =>
      page.evaluate(() => ({
        page: window.scrollY,
        main: document.querySelector<HTMLElement>('#dwp-main-content')?.scrollTop ?? 0,
      }))
    )
    .toEqual({ page: 0, main: 0 });
  const capture = () =>
    expect.soft(page).toHaveScreenshot(name, {
      animations: 'disabled',
      caret: 'hide',
      fullPage: options.fullPage ?? true,
      maxDiffPixelRatio: 0.002,
      timeout: 15_000,
    });
  if (options.fullPage === false) await capture();
  else if (await page.getByTestId('meeting-join-actions').isVisible()) {
    await withJ01DocumentCapture(page, capture);
  } else await withMeetingDocumentCapture(page, capture);
}

// The J01 viewport is checked separately. Expand only the full-document evidence
// capture so its working sticky action does not cover the middle of the document.
async function withJ01DocumentCapture(page: Page, capture: () => Promise<void>) {
  const original = page.viewportSize();
  if (!original || original.width >= 600) return capture();
  try {
    for (let pass = 0; pass < 4; pass += 1) {
      const height = await page.evaluate(async () => {
        await document.fonts.ready;
        const main = document.querySelector<HTMLElement>('#dwp-main-content');
        return Math.ceil(
          Math.max(
            document.documentElement.scrollHeight,
            document.body.scrollHeight,
            main ? main.scrollHeight + main.getBoundingClientRect().top : 0
          )
        );
      });
      if (height <= (page.viewportSize()?.height ?? 0)) break;
      await page.setViewportSize({ width: original.width, height });
    }
    await capture();
  } finally {
    await page.setViewportSize(original);
  }
}
