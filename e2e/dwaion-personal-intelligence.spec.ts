import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import {
  DWAION_PERSONAL_PERMISSIONS,
  mockDwaionPersonalIntelligence,
} from './support/dwaion-personal-intelligence-fixtures';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

type SessionPermission = {
  resourceType: string;
  resourceKey: string;
  permissionCode: string;
  effect: 'ALLOW' | 'DENY';
};

type SessionAppearance = {
  mode: 'system' | 'light' | 'dark';
  density: 'compact' | 'standard' | 'comfortable';
  highContrast: boolean;
  reduceMotion: boolean;
};

async function openPersonalIntelligence(
  page: Page,
  path: string,
  permissions: SessionPermission[] = [...FULL_PRODUCT_PERMISSIONS, ...DWAION_PERSONAL_PERMISSIONS],
  appearance?: SessionAppearance
) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'Mina Kim',
    permissions,
    ...(appearance ? { appearance } : {}),
  });
  const probe = await mockDwaionPersonalIntelligence(page);
  await page.goto(path);
  return probe;
}

test('personal routines stay dry-run only and require explicit consent', async ({ page }) => {
  const probe = await openPersonalIntelligence(page, '/dwaion/routines');

  await expect(page.getByRole('heading', { name: 'My AI routines' })).toBeVisible();
  await page.getByRole('button', { name: /Morning priority review/ }).click();
  await expect(page.getByText('Scheduled execution is not connected yet.')).toBeVisible();
  await expect(page.getByText('Validation only').first()).toBeVisible();
  await page.getByRole('button', { name: 'Run validation' }).click();
  await expect(
    page.getByRole('heading', { name: 'Access and source binding validated' })
  ).toBeVisible();
  expect(probe.dryRuns).toBe(1);

  const closeRoutineDetails = page.getByRole('button', { name: 'Close details' });
  if (await closeRoutineDetails.isVisible()) await closeRoutineDetails.click();

  await page.getByRole('button', { name: 'Create routine' }).click();
  const dialog = page.getByRole('dialog', { name: 'Routine settings' });
  for (const label of [
    'Source access consent',
    'AI analysis consent',
    'Proposal delivery consent',
  ]) {
    await expect(dialog.getByRole('checkbox', { name: label })).not.toBeChecked();
  }
  await expect(dialog.getByRole('button', { name: 'Save routine' })).toBeDisabled();
});

test('personal AI controls expose real boundaries without claiming runtime memory', async ({
  page,
}) => {
  await openPersonalIntelligence(page, '/dwaion/personal-controls');

  await expect(page.getByRole('heading', { name: 'My AI controls' })).toBeVisible();
  await expect(
    page.getByText(
      'Preferences can be stored and managed, but are not yet applied automatically to answer generation.'
    )
  ).toBeVisible();
  await expect(page.getByText('Use a concise, direct tone.')).toBeVisible();
  await expect(page.getByText('Tone', { exact: true })).toBeVisible();
  await expect(page.getByText('TONE', { exact: true })).toHaveCount(0);
  await expect(page.getByText('No raw content copy')).toHaveCount(3);

  await page.getByRole('button', { name: 'Clean up data' }).click();
  const dialog = page.getByRole('dialog', { name: 'Clean up personal AI data' });
  await expect(dialog.getByText(/create a deletion request/i).first()).toBeVisible();
  await expect(dialog.getByRole('checkbox', { name: 'Personal AI routines' })).not.toBeChecked();
  await expect(dialog.getByRole('button', { name: 'Submit request' })).toBeDisabled();
});

test('personal data controls remain available with privacy-only delegated access', async ({
  page,
}) => {
  await openPersonalIntelligence(page, '/dwaion/personal-controls', [
    ...FULL_PRODUCT_PERMISSIONS,
    {
      resourceType: 'APP',
      resourceKey: 'APP.DWAION_PRIVACY',
      permissionCode: 'VIEW',
      effect: 'ALLOW',
    },
    {
      resourceType: 'APP',
      resourceKey: 'APP.DWAION_PRIVACY',
      permissionCode: 'MANAGE',
      effect: 'ALLOW',
    },
  ]);

  await expect(page.getByRole('heading', { name: 'My AI controls' })).toBeVisible();
  await expect(page.getByText('Explicit memory storage')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Retention boundaries' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Clean up data' })).toBeEnabled();
});

test('artifact autosave invalidates stale publication preflight and never implies sharing', async ({
  page,
}) => {
  const probe = await openPersonalIntelligence(page, '/dwaion/artifacts');

  await expect(page.getByRole('heading', { name: 'Artifact studio' })).toBeVisible();
  await expect(
    page.getByText('Recipient sharing and external writes are unavailable.')
  ).toBeVisible();
  const openSourceReferences = page.getByRole('button', { name: 'Open source references' });
  if (await openSourceReferences.isVisible()) await openSourceReferences.click();
  await expect(
    page.getByText('Source authenticity and freshness verification are not connected yet.')
  ).toBeVisible();
  if (await page.getByRole('button', { name: 'Close panel' }).isVisible()) {
    await page.getByRole('button', { name: 'Close panel' }).click();
  }
  const publish = page.getByRole('button', { name: 'Publish personally' });
  await expect(publish).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Request export' })).toBeDisabled();

  await page.getByRole('textbox', { name: 'Title' }).fill('Launch readiness plan revised');
  await expect.poll(() => probe.artifactAutosaves).toBe(1);
  await expect(page.getByText('Autosaved')).toBeVisible();
  await expect(publish).toBeDisabled();
  await expect(
    page.getByText('Run preflight against the current immutable version.')
  ).toBeVisible();
  await expect(page.getByText(/download a file/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /share/i })).toHaveCount(0);
});

for (const surface of [
  { path: '/dwaion/routines', heading: 'My AI routines' },
  { path: '/dwaion/personal-controls', heading: 'My AI controls' },
  { path: '/dwaion/artifacts', heading: 'Artifact studio' },
] as const) {
  test(`${surface.heading} reflows at 390px and has no serious accessibility violations`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPersonalIntelligence(page, surface.path);
    await expect(page.getByRole('heading', { name: surface.heading })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => window.innerWidth)
    );
    const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((entry) =>
      ['critical', 'serious'].includes(entry.impact ?? '')
    );
    expect(violations).toEqual([]);
  });
}

for (const surface of [
  { path: '/dwaion/routines', heading: 'My AI routines' },
  { path: '/dwaion/personal-controls', heading: 'My AI controls' },
  { path: '/dwaion/artifacts', heading: 'Artifact studio' },
] as const) {
  for (const scenario of [
    { name: '320px', width: 320, height: 740 },
    { name: '768px', width: 768, height: 1024 },
    { name: '200% text', width: 640, height: 900, largeText: true },
    { name: 'dark mode', width: 1280, height: 900, dark: true },
    { name: 'forced colors', width: 390, height: 844, forcedColors: true },
  ] as const) {
    test(`${surface.heading} remains operable in ${scenario.name}`, async ({ page }) => {
      await page.setViewportSize({ width: scenario.width, height: scenario.height });
      if ('forcedColors' in scenario) await page.emulateMedia({ forcedColors: 'active' });
      await openPersonalIntelligence(
        page,
        surface.path,
        [...FULL_PRODUCT_PERMISSIONS, ...DWAION_PERSONAL_PERMISSIONS],
        {
          mode: 'dark' in scenario ? 'dark' : 'light',
          density: 'standard',
          highContrast: 'forcedColors' in scenario,
          reduceMotion: true,
        }
      );
      if ('largeText' in scenario) {
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
      }

      await expect(page.getByRole('heading', { name: surface.heading })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
      ).toBe(true);
      const clippedLabels = await page
        .locator(
          '#dwp-main-content button, #dwp-main-content a, #dwp-main-content h1, #dwp-main-content h2'
        )
        .evaluateAll((elements) =>
          elements
            .filter((element) => element.scrollWidth > element.clientWidth + 2)
            .map((element) => element.textContent?.trim())
        );
      expect(clippedLabels).toEqual([]);
      const violations = (
        await new AxeBuilder({ page }).include('#dwp-main-content').analyze()
      ).violations.filter((entry) => ['critical', 'serious'].includes(entry.impact ?? ''));
      expect(violations).toEqual([]);
    });
  }
}
