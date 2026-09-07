import { expect, type Page } from '@playwright/test';

export async function openMeetingIntelligenceMobileDetailsIfVisible(page: Page): Promise<void> {
  const mobileDetails = page.getByTestId('meeting-intelligence-mobile-details');
  if (!(await mobileDetails.isVisible())) return;
  await mobileDetails.locator('summary').click();
  await expect(mobileDetails).toHaveAttribute('open', '');
}

export async function expectMeetingAdminRuntimeEvidence(
  page: Page,
  providerCode: string,
  providerModel: string
): Promise<void> {
  await openMeetingIntelligenceMobileDetailsIfVisible(page);
  await expect(page.getByRole('heading', { name: 'Language model', exact: true })).toBeVisible();
  await expect(page.getByText(providerCode)).toBeVisible();
  await expect(page.getByText(providerModel)).toBeVisible();
}
