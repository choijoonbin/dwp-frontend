import type { Page } from '@playwright/test';

export async function chooseWorkplaceGovernanceArea(page: Page, name: string) {
  await page.getByRole('combobox', { name: /Workplace governance areas/u }).click();
  await page.getByRole('option', { name, exact: true }).click();
}
