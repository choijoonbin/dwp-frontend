import { expect, type Page } from '@playwright/test';

export const MEETING_MEMBER_PERMISSIONS = ['VIEW', 'CREATE', 'UPDATE'].map((permissionCode) => ({
  resourceType: 'APP',
  resourceKey: 'APP.MEETINGS',
  permissionCode,
  effect: 'ALLOW' as const,
}));

export async function expandMeetingPolicySection(page: Page, title: string) {
  const section = page.getByRole('region', { name: title, exact: true });
  await expect(section).toBeVisible();
  // Await the disclosure itself: checking an asynchronously loaded control can
  // race the initial render and accidentally close an already expanded section.
  if (!(await section.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await section.locator(':scope > summary').focus();
    await page.keyboard.press('Enter');
    await expect(section).toHaveAttribute('open', '');
  }
  return section;
}

export async function openUnsupportedRecordingPolicyEditor(page: Page) {
  const recordingPolicy = await openMeetingRecordingPolicy(page);
  await expect(
    page.getByText('LiveKit Egress is not configured. Recording cannot be enabled.')
  ).toBeVisible();
  await expect(recordingPolicy).toBeDisabled();
  await expandMeetingPolicySection(page, 'In-meeting collaboration');
  await page.getByRole('switch', { name: 'Allow participant chat' }).uncheck();
  await expandMeetingPolicySection(page, 'Retention policy');
  return page.getByLabel('Meeting chat retention (days)');
}

export async function openMeetingRecordingPolicy(page: Page) {
  const section = await expandMeetingPolicySection(page, 'Recording and AI');
  // MUI Select's accessible name includes the visible selected option.
  const recordingPolicy = section.getByRole('combobox', { name: /^Allow recording\b/u });
  await expect(recordingPolicy).toBeVisible();
  return recordingPolicy;
}
