import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  MEETING_VISUAL_ID,
  mockMeetingVisualAdminReadiness,
  mockMeetingVisualHome,
  mockMeetingVisualPublishedRecap,
  mockMeetingVisualSession,
} from './support/video-meeting-visual-fixtures';

import type { Locator, Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const VIEWPORT = {
  desktop: { width: 1_440, height: 960 },
  tablet: { width: 768, height: 1_024 },
  mobile: { width: 390, height: 844 },
  minimum: { width: 320, height: 720 },
} as const;

const runtimeDiagnostics = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
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

async function expectPageReady(page: Page) {
  const main = page.locator('#dwp-main-content');
  await expect(main).toBeVisible({ timeout: 15_000 });
  await expect(main.locator('.MuiSkeleton-root')).toHaveCount(0, { timeout: 15_000 });
  return main;
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const documentOverflow =
      document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const main = document.querySelector<HTMLElement>('#dwp-main-content');
    const mainOverflow = main ? main.scrollWidth - main.clientWidth : 0;
    return { document: documentOverflow, main: mainOverflow };
  });
  expect(overflow.document, `${label}: document overflow`).toBeLessThanOrEqual(1);
  expect(overflow.main, `${label}: main overflow`).toBeLessThanOrEqual(1);
}

async function expectNoBlockingA11y(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious'
  );
  expect(blocking, `${label}: axe serious/critical violations`).toEqual([]);
}

async function expectCleanMeetingRuntime(page: Page, label: string) {
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

async function expectMinimumTarget(locator: Locator, label: string, minimum = 44) {
  await expect(locator, `${label}: target visible`).toBeVisible();
  const target = await locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { width: bounds.width, height: bounds.height };
  });
  expect(target.width, `${label}: target width`).toBeGreaterThanOrEqual(minimum);
  expect(target.height, `${label}: target height`).toBeGreaterThanOrEqual(minimum);
}

async function expectViewportInset(locator: Locator, label: string, minimum = 12) {
  const geometry = await locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { left: bounds.left, right: innerWidth - bounds.right };
  });
  expect(geometry.left, `${label}: left viewport inset`).toBeGreaterThanOrEqual(minimum);
  expect(geometry.right, `${label}: right viewport inset`).toBeGreaterThanOrEqual(minimum);
}

async function expectFocusClearance(locator: Locator, label: string, minimum = 4) {
  const clearance = await locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const clippingAncestors: Array<{ left: number; right: number }> = [];
    let ancestor = element.parentElement;
    while (ancestor) {
      const style = getComputedStyle(ancestor);
      if (/(?:auto|clip|hidden|scroll)/u.test(style.overflowX)) {
        const ancestorBounds = ancestor.getBoundingClientRect();
        clippingAncestors.push({
          left: bounds.left - ancestorBounds.left,
          right: ancestorBounds.right - bounds.right,
        });
      }
      ancestor = ancestor.parentElement;
    }
    return clippingAncestors.length
      ? {
          left: Math.min(...clippingAncestors.map((item) => item.left)),
          right: Math.min(...clippingAncestors.map((item) => item.right)),
        }
      : null;
  });
  expect(clearance, `${label}: clipping ancestor found`).not.toBeNull();
  expect(clearance!.left, `${label}: left focus clearance`).toBeGreaterThanOrEqual(minimum);
  expect(clearance!.right, `${label}: right focus clearance`).toBeGreaterThanOrEqual(minimum);
}

async function expectKeyboardFocusVisible(page: Page, locator: Locator, label: string) {
  const visualSignature = async () =>
    locator.evaluate((element) => {
      const read = (pseudo?: '::before' | '::after') => {
        const style = getComputedStyle(element, pseudo);
        return {
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
          outlineColor: style.outlineColor,
          boxShadow: style.boxShadow,
          backgroundColor: style.backgroundColor,
          borderColor: style.borderColor,
          borderWidth: style.borderWidth,
          content: style.content,
          opacity: style.opacity,
        };
      };
      return [read(), read('::before'), read('::after')];
    });
  const restingVisual = await visualSignature();
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await locator.evaluate((element) => document.activeElement === element)) break;
    await page.keyboard.press('Tab');
  }
  await expect(locator, `${label}: keyboard focus`).toBeFocused();
  expect(
    await locator.evaluate((element) => element.matches(':focus-visible')),
    `${label}: :focus-visible`
  ).toBe(true);
  const focusedVisual = await visualSignature();
  const hasVisibleOutline = focusedVisual.some(
    (style) => style.outlineStyle !== 'none' && (Number.parseFloat(style.outlineWidth) || 0) >= 2
  );
  expect(
    hasVisibleOutline || JSON.stringify(focusedVisual) !== JSON.stringify(restingVisual),
    `${label}: focus indicator`
  ).toBe(true);
}

async function expectVisualSnapshot(page: Page, name: string) {
  await expect(page).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.002,
    timeout: 15_000,
  });
}

async function expectHomeCommandDeck(page: Page, options: { desktopDominance?: boolean } = {}) {
  const deck = page.getByTestId('meeting-command-deck');
  const primary = page.getByTestId('meeting-command-primary');
  const secondary = page.getByTestId('meeting-command-secondary');
  const insight = page.getByTestId('meeting-insight-strip');
  const lists = page.getByTestId('meeting-day-lists');
  await expect(deck).toBeVisible();
  await expect(primary).toBeVisible();
  await expect(secondary).toBeVisible();
  await expect(insight).toBeVisible();
  await expect(lists).toBeVisible();

  if (options.desktopDominance) {
    const geometry = await deck.evaluate((element) => {
      const primaryElement = element.querySelector<HTMLElement>(
        '[data-testid="meeting-command-primary"]'
      );
      const secondaryElement = element.querySelector<HTMLElement>(
        '[data-testid="meeting-command-secondary"]'
      );
      if (!primaryElement || !secondaryElement) return null;
      const primaryBounds = primaryElement.getBoundingClientRect();
      const secondaryBounds = secondaryElement.getBoundingClientRect();
      return { primaryWidth: primaryBounds.width, secondaryWidth: secondaryBounds.width };
    });
    expect(geometry, 'command deck surfaces are measurable').not.toBeNull();
    expect(geometry!.primaryWidth, 'primary command surface is visually dominant').toBeGreaterThan(
      geometry!.secondaryWidth * 1.12
    );

    const legacyHardGrid = await insight.evaluate((element) => {
      const visible = Array.from(element.children)
        .map((child) => (child as HTMLElement).getBoundingClientRect())
        .filter((bounds) => bounds.width > 0 && bounds.height > 0);
      const positions = (values: number[]) =>
        values.reduce<number[]>((unique, value) => {
          if (!unique.some((candidate) => Math.abs(candidate - value) <= 2)) unique.push(value);
          return unique;
        }, []);
      return {
        childCount: visible.length,
        columns: positions(visible.map((bounds) => bounds.left)).length,
        rows: positions(visible.map((bounds) => bounds.top)).length,
      };
    });
    expect(
      legacyHardGrid.childCount === 4 && legacyHardGrid.columns === 2 && legacyHardGrid.rows === 2,
      'legacy four-cell KPI grid must not return'
    ).toBe(false);
  }
}

async function expectMeaningfulEmptyInsights(page: Page) {
  const insight = page.getByTestId('meeting-insight-strip');
  await expect(insight.locator('[data-meeting-insight]')).toHaveCount(0);
  await expect(insight.locator('[data-meeting-insight-empty="true"]')).toHaveCount(1);
  const text = await insight.innerText();
  expect(text).not.toMatch(/(^|\s)0(?:\s|$)/u);
  expect(text).not.toContain('Not measured');
  expect(text).not.toContain('측정 전');
}

async function expectReducedMotion(locator: Locator, label: string) {
  const durations = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.animationDuration, style.transitionDuration]
      .flatMap((value) => value.split(','))
      .map((value) => Number.parseFloat(value) || 0);
  });
  expect(Math.max(...durations), `${label}: reduced motion duration`).toBeLessThanOrEqual(0.001);
}

test('home EMPTY uses a dominant command deck without zero-value KPI cells at 1440px Korean', async ({
  page,
}) => {
  await page.setViewportSize(VIEWPORT.desktop);
  await mockMeetingVisualSession(page, { locale: 'ko', reducedMotion: true });
  await mockMeetingVisualHome(page, 'EMPTY');

  await page.goto('/meetings/home');
  await expect(
    page.getByRole('heading', { level: 1, name: '오늘의 대화를 더 매끄럽게 운영하세요' })
  ).toBeVisible();
  await expectPageReady(page);
  await expectHomeCommandDeck(page, { desktopDominance: true });
  await expectMeaningfulEmptyInsights(page);
  const primaryAction = page.getByTestId('meeting-command-primary').getByRole('button').first();
  await expectMinimumTarget(primaryAction, 'empty-home primary action');
  await expectKeyboardFocusVisible(page, primaryAction, 'empty-home primary action');
  await expectReducedMotion(
    page.getByTestId('meeting-command-secondary'),
    'empty-home secondary rail'
  );
  await expectNoHorizontalOverflow(page, 'home EMPTY 1440 ko');
  await expectNoBlockingA11y(page, 'home EMPTY 1440 ko');
  await expectCleanMeetingRuntime(page, 'home EMPTY 1440 ko');
  await expectVisualSnapshot(page, 'meeting-home-empty-ko-1440-light.png');
});

test('home NEXT remains usable at 768px and 200 percent English text', async ({ page }) => {
  await page.setViewportSize(VIEWPORT.tablet);
  await mockMeetingVisualSession(page, { locale: 'en', reducedMotion: true });
  await mockMeetingVisualHome(page, 'NEXT');

  await page.goto('/meetings/home');
  await expect(page.getByText('Global launch decision review').first()).toBeVisible();
  await expectPageReady(page);
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
  const heading = page.getByRole('heading', {
    level: 1,
    name: "Run today's conversations with less friction",
  });
  await expectViewportInset(heading, 'home NEXT 200 percent heading');
  await expectHomeCommandDeck(page);
  await expectNoHorizontalOverflow(page, 'home NEXT 768 en 200 percent');
  await expectNoBlockingA11y(page, 'home NEXT 768 en 200 percent');
  await expectCleanMeetingRuntime(page, 'home NEXT 768 en 200 percent');
  await expectVisualSnapshot(page, 'meeting-home-next-en-768-text-200.png');
});

test('home LIVE preserves hierarchy and touch targets at 390px Korean dark mode', async ({
  page,
}) => {
  await page.setViewportSize(VIEWPORT.mobile);
  await mockMeetingVisualSession(page, {
    locale: 'ko',
    colorScheme: 'dark',
    reducedMotion: true,
  });
  await mockMeetingVisualHome(page, 'LIVE');

  await page.goto('/meetings/home');
  await expect(page.getByText('Executive launch room').first()).toBeVisible();
  const heading = page.getByRole('heading', {
    level: 1,
    name: '오늘의 대화를 더 매끄럽게 운영하세요',
  });
  await expect(heading, 'Korean display heading keeps words together').toHaveCSS(
    'word-break',
    'keep-all'
  );
  await expectPageReady(page);
  await expectHomeCommandDeck(page);
  const primaryAction = page.getByTestId('meeting-command-primary').getByRole('button').first();
  await expectMinimumTarget(primaryAction, 'live-home primary action');
  await expectNoHorizontalOverflow(page, 'home LIVE 390 ko dark');
  await expectNoBlockingA11y(page, 'home LIVE 390 ko dark');
  await expectCleanMeetingRuntime(page, 'home LIVE 390 ko dark');
  await expectVisualSnapshot(page, 'meeting-home-live-ko-390-dark.png');
});

test('home service blocker stays explicit at the 320px English forced-colors boundary', async ({
  browserName,
  page,
}) => {
  await page.setViewportSize(VIEWPORT.minimum);
  await mockMeetingVisualSession(page, {
    locale: 'en',
    forcedColors: 'active',
    reducedMotion: true,
  });
  await mockMeetingVisualHome(page, 'BLOCKED');

  await page.goto('/meetings/home');
  if (browserName === 'chromium') {
    expect(
      await page.evaluate(() => matchMedia('(forced-colors: active)').matches),
      'Chromium forced-colors emulation is active'
    ).toBe(true);
  }
  await expectPageReady(page);
  await expectHomeCommandDeck(page);
  await expect(page.getByRole('button', { name: 'Start now' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Schedule meeting' })).toBeDisabled();
  await expectNoHorizontalOverflow(page, 'home BLOCKED 320 en forced colors');
  await expectNoBlockingA11y(page, 'home BLOCKED 320 en forced colors');
  await expectCleanMeetingRuntime(page, 'home BLOCKED 320 en forced colors');
  await expectVisualSnapshot(page, 'meeting-home-blocked-en-320-forced-colors.png');
});

test('join focus form has visible keyboard focus and a 44px action at 390px Korean', async ({
  page,
}) => {
  await page.setViewportSize(VIEWPORT.mobile);
  await mockMeetingVisualSession(page, { locale: 'ko', reducedMotion: true });

  await page.goto('/meetings/join');
  await expect(page.getByRole('heading', { level: 1, name: '회의 참여' })).toBeVisible();
  await expectPageReady(page);
  const code = page.locator('input[autocomplete="one-time-code"]');
  await code.fill('DWPX-MEET-2026');
  const findMeeting = page.getByRole('button', { name: '회의 찾기' });
  await expectMinimumTarget(findMeeting, 'join primary action');
  await expectKeyboardFocusVisible(page, findMeeting, 'join primary action');
  await expectNoHorizontalOverflow(page, 'join 390 ko');
  await expectNoBlockingA11y(page, 'join 390 ko');
  await expectCleanMeetingRuntime(page, 'join 390 ko');
  await expectVisualSnapshot(page, 'meeting-join-ko-390-light.png');
});

test('published AI recap remains evidence-led at 1440px English dark mode', async ({ page }) => {
  await page.setViewportSize(VIEWPORT.desktop);
  await mockMeetingVisualSession(page, {
    locale: 'en',
    colorScheme: 'dark',
    reducedMotion: true,
  });
  await mockMeetingVisualPublishedRecap(page);

  await page.goto(`/meetings/history?meeting=${MEETING_VISUAL_ID}`);
  await expect(
    page.getByRole('heading', { name: 'Regional launch readiness review' })
  ).toBeVisible();
  await expect(page.getByText('The group approved a staged launch')).toBeVisible();
  await expect(page.getByText('Launch the internal pilot on Monday.')).toBeVisible();
  await expectPageReady(page);
  const overviewTab = page.getByRole('tab', { name: 'Overview' });
  await expectMinimumTarget(overviewTab, 'recap overview tab');
  await expectKeyboardFocusVisible(page, overviewTab, 'recap overview tab');
  await expectFocusClearance(overviewTab, 'recap overview tab');
  await expectNoHorizontalOverflow(page, 'published recap 1440 en dark');
  await expectNoBlockingA11y(page, 'published recap 1440 en dark');
  await expectCleanMeetingRuntime(page, 'published recap 1440 en dark');
  await expectVisualSnapshot(page, 'meeting-recap-published-en-1440-dark.png');
});

test('blocked AI administration makes every release dependency legible at 1440px Korean', async ({
  page,
}) => {
  await page.setViewportSize(VIEWPORT.desktop);
  await mockMeetingVisualSession(page, { locale: 'ko', admin: true, reducedMotion: true });
  await mockMeetingVisualAdminReadiness(page, 'BLOCKED');

  await page.goto('/meetings/admin/intelligence');
  await expect(
    page.getByRole('heading', { level: 1, name: 'AI 및 데이터 거버넌스' })
  ).toBeVisible();
  await expectPageReady(page);
  await expect(page.locator('[data-state="BLOCKED"]').first()).toBeVisible();
  await expectNoHorizontalOverflow(page, 'admin BLOCKED 1440 ko');
  await expectNoBlockingA11y(page, 'admin BLOCKED 1440 ko');
  await expectCleanMeetingRuntime(page, 'admin BLOCKED 1440 ko');
  await expectVisualSnapshot(page, 'meeting-admin-intelligence-blocked-ko-1440-light.png');
});

test('ready AI administration stays readable at 390px English dark mode', async ({ page }) => {
  await page.setViewportSize(VIEWPORT.mobile);
  await mockMeetingVisualSession(page, {
    locale: 'en',
    admin: true,
    colorScheme: 'dark',
    reducedMotion: true,
  });
  await mockMeetingVisualAdminReadiness(page, 'READY');

  await page.goto('/meetings/admin/intelligence');
  await expect(
    page.getByRole('heading', { level: 1, name: 'AI and data governance' })
  ).toBeVisible();
  await expectPageReady(page);
  await expect(page.locator('[data-state="READY"]').first()).toBeVisible();
  await expect(page.locator('[data-state="BLOCKED"]')).toHaveCount(0);
  await expectNoHorizontalOverflow(page, 'admin READY 390 en dark');
  await expectNoBlockingA11y(page, 'admin READY 390 en dark');
  await expectCleanMeetingRuntime(page, 'admin READY 390 en dark');
  await expectVisualSnapshot(page, 'meeting-admin-intelligence-ready-en-390-dark.png');
});
