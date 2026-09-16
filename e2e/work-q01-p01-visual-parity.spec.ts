import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { mockWorkHubFoundation, WORK_HUB_FIXTURE } from './support/work-hub-foundation-fixtures';

import type { Page, TestInfo } from '@playwright/test';

const approvalReference = `APPROVAL_TASK:${WORK_HUB_FIXTURE.approvalId}:SECURITY_REVIEW`;
const VISUAL_NOW = new Date('2026-09-16T02:29:00.000Z');

async function openWork(page: Page, path: string, options?: { dark?: boolean; forced?: boolean }) {
  await page.clock.setFixedTime(VISUAL_NOW);
  await mockWorkHubFoundation(page, {
    locale: 'ko',
    designDetails: true,
    nativeWorkspace: true,
    mode: options?.dark ? 'dark' : 'light',
    highContrast: options?.forced,
    workspaceGeneratedAt: VISUAL_NOW.toISOString(),
  });
  if (options?.forced)
    await page.emulateMedia({
      colorScheme: options.dark ? 'dark' : 'light',
      forcedColors: 'active',
      reducedMotion: 'reduce',
    });
  await page.goto(path);
  await expect(page.getByRole('main')).toBeVisible({ timeout: 20_000 });
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    )
    .toBeLessThanOrEqual(1);
}

async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(async () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
  await page.screenshot({
    path: info.outputPath(`${name}.png`),
    fullPage: true,
    animations: 'disabled',
  });
}

for (const viewport of [
  { name: '1440', width: 1440, height: 1000, scale: 1 },
  { name: '1280', width: 1280, height: 900, scale: 1 },
] as const) {
  test(`Q01 and P01 keep the Stitch list-detail and candidate-rail proportions at ${viewport.name}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openWork(page, `/work/queue?work=${encodeURIComponent(approvalReference)}`);

    const queue = page.getByTestId('work-hub-queue');
    const detail = page.getByTestId('work-hub-detail-panel');
    await expect(queue).toBeVisible();
    await expect(detail).toBeVisible();
    const [queueBox, detailBox] = await Promise.all([queue.boundingBox(), detail.boundingBox()]);
    expect(queueBox).not.toBeNull();
    expect(detailBox).not.toBeNull();
    // The Stitch desktop frame makes the reviewed detail primary: after the
    // global navigation, the queue uses roughly 5/12 and detail 7/12.
    expect(queueBox!.width / detailBox!.width).toBeGreaterThan(0.62);
    expect(queueBox!.width / detailBox!.width).toBeLessThan(0.9);
    expect(detailBox!.height).toBeLessThanOrEqual(viewport.height - 120);
    if (viewport.width === 1440)
      await expect(queue.getByText('업무 상태 / 처리 기한', { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    if (viewport.width === 1440) {
      // These baselines cover only the Work fixture journeys manually compared with
      // WRK-Q01/P01, rather than blessing the whole application shell.
      await expect(page).toHaveScreenshot('wrk-q01-1440-reference-layout.png', {
        fullPage: true,
        animations: 'disabled',
      });
    }
    await capture(page, info, `wrk-q01-${viewport.name}-light`);

    await page.goto('/work/day-plan');
    const selected = page.getByTestId('work-today-plan-selected');
    const candidates = page.getByTestId('work-today-plan-candidates');
    await expect(selected).toBeVisible();
    await expect(candidates).toBeVisible();
    const [selectedBox, candidateBox] = await Promise.all([
      selected.boundingBox(),
      candidates.boundingBox(),
    ]);
    expect(selectedBox).not.toBeNull();
    expect(candidateBox).not.toBeNull();
    expect(selectedBox!.width / candidateBox!.width).toBeGreaterThan(1.45);
    expect(selectedBox!.width / candidateBox!.width).toBeLessThan(2.2);
    await expect(candidates.getByRole('group', { name: '후보 업무 범위' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    if (viewport.width === 1440) {
      await expect(page).toHaveScreenshot('wrk-p01-1440-reference-layout.png', {
        fullPage: true,
        animations: 'disabled',
      });
    }
    await capture(page, info, `wrk-p01-${viewport.name}-light`);
  });
}

for (const appearance of [
  { name: '390-light', width: 390, height: 844, dark: false, forced: false, scale: 1 },
  { name: '390-dark', width: 390, height: 844, dark: true, forced: false, scale: 1 },
  { name: '320-forced', width: 320, height: 740, dark: false, forced: true, scale: 1 },
  { name: '200-percent', width: 720, height: 500, dark: false, forced: false, scale: 2 },
] as const) {
  test(`Q01 and P01 reflow at ${appearance.name}`, async ({ page }, info) => {
    await page.setViewportSize({ width: appearance.width, height: appearance.height });
    await openWork(page, '/work/queue', appearance);
    if (appearance.scale === 2)
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });

    const queue = page.getByTestId('work-hub-queue');
    await expect(queue).toBeVisible();
    const firstCard = queue.locator('li[data-work-key]').first();
    await expect(firstCard).toBeVisible();
    if (appearance.width <= 390) {
      const cardBox = await firstCard.boundingBox();
      expect(cardBox?.height ?? 0).toBeGreaterThanOrEqual(128);
    }
    await expectNoHorizontalOverflow(page);
    if (appearance.name === '390-light') {
      await expect(page).toHaveScreenshot('wrk-q01-390-reference-layout.png', {
        fullPage: true,
        animations: 'disabled',
      });
    }
    await capture(page, info, `wrk-q01-${appearance.name}`);

    if (appearance.width === 390 && !appearance.dark && !appearance.forced) {
      const opener = firstCard.locator('[data-work-open]');
      await opener.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('work-hub-detail-panel')).toBeVisible();
      const back = page.getByRole('button', { name: '업무 목록으로', exact: true });
      await back.focus();
      await page.keyboard.press('Enter');
      await expect(queue).toBeVisible();
      await expect(opener).toBeFocused();
    }

    const axe = await new AxeBuilder({ page })
      .include('#dwp-main-content')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(
      axe.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))
    ).toEqual([]);

    await page.goto('/work/day-plan');
    await expect(page.getByTestId('work-today-plan-page')).toBeVisible();
    await expect(page.getByTestId('work-today-plan-candidates')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    if (appearance.name === '390-light') {
      await expect(page).toHaveScreenshot('wrk-p01-390-reference-layout.png', {
        fullPage: true,
        animations: 'disabled',
      });
    }
    await capture(page, info, `wrk-p01-${appearance.name}`);
  });
}
