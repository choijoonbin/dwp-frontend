import { expect, test } from '@playwright/test';
import {
  mockWorkHubFoundation,
  WORK_HUB_FIXTURE as fixture,
} from './support/work-hub-foundation-fixtures';

for (const width of [1440, 1280]) {
  test(`07 candidate deadline and state filters combine without changing work at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    const runtime = await mockWorkHubFoundation(page);
    await page.goto('/work/day-plan');
    const plan = page.getByTestId('work-today-plan-page');
    const candidates = plan.getByRole('region', { name: 'Work to add' });
    await expect(candidates).toBeVisible();
    await expect(candidates.getByText(/Plan date .*Asia\/Seoul/)).toBeVisible();
    await candidates.getByRole('combobox', { name: 'Candidate deadline' }).click();
    await page.getByRole('option', { name: 'No due date', exact: true }).click();
    await candidates.getByRole('combobox', { name: 'Candidate status' }).click();
    await page.getByRole('option', { name: 'Not started', exact: true }).click();
    await candidates.getByRole('textbox', { name: 'Search plan candidates' }).fill('next week');
    await expect(candidates.locator('ul > li')).toHaveCount(1);
    await expect(candidates).toContainText(fixture.secondaryTitle);
    await candidates.getByRole('combobox', { name: 'Candidate deadline' }).click();
    await page.getByRole('option', { name: 'Due today', exact: true }).click();
    await expect(
      candidates.getByText('No candidates match your search.', { exact: true })
    ).toBeVisible();
    expect(runtime.mutations).toHaveLength(0);
    expect(runtime.planSaves).toHaveLength(0);
    await page.screenshot({
      path: info.outputPath(`07-candidate-filters-${width}.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    ).toBeLessThanOrEqual(1);
  });
}

for (const width of [390, 320]) {
  test(`07 mobile search select add returns to the plan and preserves source fields at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    const runtime = await mockWorkHubFoundation(page);
    await page.goto('/work/day-plan');
    const plan = page.getByTestId('work-today-plan-page');
    const openCandidates = plan.getByRole('button', {
      name: 'Find work to add to the plan',
      exact: true,
    });
    await openCandidates.click();
    const picker = page.getByRole('dialog', { name: 'Work to add', exact: true });
    const search = picker.getByRole('textbox', { name: 'Search plan candidates' });
    await expect(search).toBeFocused();
    await search.fill('next week');
    await picker.getByRole('checkbox', { name: fixture.secondaryTitle, exact: true }).check();
    await page.setViewportSize({ width, height: 440 });
    const add = picker.getByRole('button', {
      name: 'Add selected work (1)',
      exact: true,
    });
    await expect(add).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: info.outputPath(`07-mobile-candidates-${width}-keyboard.png`) });
    expect(runtime.planSaves).toHaveLength(0);
    await add.click();
    await expect(picker).not.toBeVisible();
    const added = plan.locator('ol > li').filter({ hasText: fixture.secondaryTitle });
    await expect(
      added.getByRole('button', { name: fixture.secondaryTitle, exact: true })
    ).toBeFocused();
    expect(runtime.planSaves).toHaveLength(0);
    await plan.getByRole('button', { name: 'Save plan', exact: true }).last().click();
    await expect.poll(() => runtime.planSaves.length).toBe(1);
    expect(runtime.planSaves[0]?.items).toEqual(
      expect.arrayContaining([
        { sourceSystem: 'PERSONAL_TASK', sourceReference: fixture.secondaryPersonalId },
      ])
    );
    expect(runtime.planSaves[0]?.idempotencyKey).toBeTruthy();
    expect(runtime.mutations).toHaveLength(0);
    expect(runtime.calendarCommands).toHaveLength(0);
    await page.screenshot({ path: info.outputPath(`07-mobile-plan-return-${width}.png`) });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    ).toBeLessThanOrEqual(1);
  });
}

test('07 mobile candidate cancellation preserves plan and returns keyboard focus in dark high contrast', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 844 });
  const runtime = await mockWorkHubFoundation(page, { mode: 'dark', highContrast: true });
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.goto('/work/day-plan');
  const plan = page.getByTestId('work-today-plan-page');
  const openCandidates = plan.getByRole('button', {
    name: 'Find work to add to the plan',
    exact: true,
  });
  const initialCount = await plan.locator('ol > li').count();
  await openCandidates.focus();
  await page.keyboard.press('Enter');
  const picker = page.getByRole('dialog', { name: 'Work to add', exact: true });
  await picker.getByRole('checkbox', { name: fixture.secondaryTitle, exact: true }).check();
  await page.screenshot({ path: info.outputPath('07-mobile-picker-dark-forced-colors.png') });
  await page.keyboard.press('Escape');
  await expect(picker).not.toBeVisible();
  await expect(openCandidates).toBeFocused();
  await expect(plan.locator('ol > li')).toHaveCount(initialCount);
  expect(runtime.planSaves).toHaveLength(0);
});
