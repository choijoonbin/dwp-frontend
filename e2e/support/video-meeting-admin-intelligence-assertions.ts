import { expect, type Page } from '@playwright/test';

export async function openMeetingIntelligenceMobileDetailsIfVisible(page: Page): Promise<void> {
  const mobileDetails = page.getByTestId('meeting-intelligence-mobile-details');
  if (!(await mobileDetails.isVisible())) return;
  if ((await mobileDetails.getAttribute('open')) === null)
    await mobileDetails.locator(':scope > summary').click();
  await expect(mobileDetails).toHaveAttribute('open', '');
}

export async function expectMeetingAdminRuntimeEvidence(
  page: Page,
  providerCode: string,
  providerModel: string
): Promise<void> {
  await openMeetingIntelligenceMobileDetailsIfVisible(page);
  const evidence = page.getByTestId('meeting-intelligence-mobile-details');
  await expect(
    evidence.getByRole('heading', { name: 'Language model', exact: true })
  ).toBeVisible();
  await expect(evidence.getByText(providerCode, { exact: true })).toBeVisible();
  await expect(evidence.getByText(providerModel, { exact: true })).toBeVisible();
}
