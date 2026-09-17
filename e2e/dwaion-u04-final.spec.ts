import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import {
  DWAION_PERSONAL_PERMISSIONS,
  mockDwaionPersonalIntelligence,
} from './support/dwaion-personal-intelligence-fixtures';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

const OUTPUT = join(process.cwd(), 'output', 'dwaion-user-advancement-final');

test.beforeAll(() => mkdirSync(OUTPUT, { recursive: true }));

for (const viewport of [
  { width: 1440, height: 1000, label: '1440' },
  { width: 720, height: 450, label: '200-percent' },
  { width: 390, height: 844, label: '390' },
  { width: 320, height: 760, label: '320' },
] as const) {
  test(`U04 editor, workspace discovery, and inline comments use live paths at ${viewport.label}`, async ({
    page,
  }) => {
    await prepare(page, viewport);
    const probe = await mockDwaionPersonalIntelligence(page);
    await page.goto('/dwaion/artifacts');
    await expect(page.getByRole('heading', { name: 'Artifact studio' })).toBeVisible();
    await expect(page.locator('#dwp-main-content .MuiSkeleton-root')).toHaveCount(0);

    const openArtifactList = page.getByRole('button', { name: 'Open artifact list' });
    if (await openArtifactList.isVisible()) await openArtifactList.click();
    const list = page.getByRole('region', { name: 'My artifacts' });
    await expect(list.getByRole('tab', { name: /My drafts \(1\)/ })).toBeVisible();
    await list.getByRole('tab', { name: /Team workspace \(1\)/ }).click();
    await expect(list.getByText('Launch readiness plan', { exact: true })).toBeVisible();
    await list.getByRole('textbox', { name: 'Search artifacts' }).fill('does-not-exist');
    await expect(
      list.getByText('No artifacts match these conditions', { exact: true })
    ).toBeVisible();
    await list.getByRole('textbox', { name: 'Search artifacts' }).fill('Launch readiness');
    await list.getByText('Launch readiness plan', { exact: true }).click();

    const editor = page.getByRole('region', { name: 'Launch readiness plan' });
    const body = editor.getByRole('textbox', { name: 'Artifact body' });
    await body.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(0, 0));
    await editor.getByRole('button', { name: 'Heading 1' }).click();
    await expect(body).toHaveValue(/^# Review access boundaries/u);
    await body.evaluate((element: HTMLTextAreaElement) => {
      const end = element.value.length;
      element.setSelectionRange(end, end);
    });
    await editor.getByRole('button', { name: 'Insert citation' }).click();
    await page.getByRole('menuitem', { name: 'WORK_ITEM · WK-1042' }).click();
    await expect(body).toHaveValue(/\[WORK_ITEM · WK-1042\]$/u);
    await expect.poll(() => probe.artifactAutosaves).toBeGreaterThan(0);
    await expect.poll(() => probe.lastArtifactBody).toMatch(/\[WORK_ITEM · WK-1042\]$/u);

    const comments = page.getByTestId('dwaion-artifact-inline-comments');
    await expect(comments).toBeVisible();
    await expect(
      comments.getByText('Please reconfirm the baseline date for the exchange-rate stress test.')
    ).toBeVisible();
    await comments
      .getByRole('textbox', { name: 'Document anchor (optional)' })
      .fill('Executive summary');
    await comments
      .getByRole('textbox', { name: 'New comment' })
      .fill('Add the approved budget owner.');
    await comments.getByRole('button', { name: 'Add comment' }).click();
    await expect(
      comments.getByText('Add the approved budget owner.', { exact: true })
    ).toBeVisible();

    const originalComment = comments.getByTestId(
      'dwaion-artifact-comment-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    );
    await originalComment.getByRole('button', { name: 'Reply', exact: true }).click();
    await originalComment
      .getByRole('textbox', { name: 'Reply' })
      .fill('Finance confirmed the baseline.');
    await originalComment.getByRole('button', { name: 'Add reply' }).click();
    await expect(
      comments.getByText('Finance confirmed the baseline.', { exact: true })
    ).toBeVisible();
    await originalComment.getByRole('button', { name: 'Resolve', exact: true }).click();
    await expect(
      comments.getByText('Please reconfirm the baseline date for the exchange-rate stress test.')
    ).toHaveCount(0);
    expect(probe.artifactCommentMutations).toBe(3);

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => window.innerWidth + 1)
    );
    const audit = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
    expect(
      audit.violations.filter((violation) =>
        ['serious', 'critical'].includes(violation.impact ?? '')
      )
    ).toEqual([]);
    await page.screenshot({
      path: join(OUTPUT, `U04-complete-${viewport.label}.png`),
      fullPage: true,
      animations: 'disabled',
      caret: 'hide',
    });
  });
}

async function prepare(page: Page, viewport: { readonly width: number; readonly height: number }) {
  await page.setViewportSize(viewport);
  await page.clock.setFixedTime(new Date('2026-09-17T03:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'Mina Kim',
    permissions: [...FULL_PRODUCT_PERMISSIONS, ...DWAION_PERSONAL_PERMISSIONS],
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  await page.route('**/api/platform/v1/workspace/work-items**', (route) =>
    route.fulfill({ json: { success: true, data: [] } })
  );
}
