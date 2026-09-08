import { expect, type Page } from '@playwright/test';

export async function expectMeetingChatOverlayKeyboardBoundary(page: Page) {
  await expect(page.locator('.dwp-meeting-conference__stage')).toHaveAttribute('inert', '');
  for (const selector of [
    '.dwp-video-meeting-room__header',
    '.dwp-video-meeting-room__interactions',
  ]) {
    await expect(page.locator(selector)).toHaveAttribute('inert', '');
    await expect(page.locator(selector)).toHaveAttribute('aria-hidden', 'true');
  }
  const close = page.getByRole('button', { name: 'Close meeting chat', exact: true });
  const selectedRailTab = page
    .getByRole('tablist', { name: 'Meeting workspace panels' })
    .getByRole('tab', { name: 'Chat', exact: true });
  const composer = page.getByRole('textbox', { name: 'Type a message' });
  await close.press('Shift+Tab');
  await expect(selectedRailTab).toBeFocused();
  await selectedRailTab.press('Shift+Tab');
  await expect(composer).toBeFocused();
  await composer.press('Tab');
  await expect(selectedRailTab).toBeFocused();
  // Native WebKit may skip ordinary buttons on Tab. Endpoints above verify
  // containment; close/Escape focus restoration is an independent assertion.
  await close.focus();
  await close.press('Escape');
  await expect(page.getByRole('button', { name: 'Open meeting chat' })).toBeFocused();
}

export async function expectMeetingRoomWorkspaceTools(page: Page) {
  const roomRail = page.getByRole('tablist', { name: 'Meeting workspace panels' });
  await expect(roomRail).toBeVisible();
  for (const tabName of ['Agenda', 'Chat', 'Floor', 'People', 'AI notes'])
    await expect(roomRail.getByRole('tab', { name: tabName })).toBeVisible();
  await expect(page.getByTestId('meeting-live-tools-embedded')).toBeVisible();
  await roomRail.getByRole('tab', { name: 'AI notes' }).click();
  await expect(page.getByText('Live AI notes are not available')).toBeVisible();
  await expect(page.getByText(/No live transcript text or unreviewed model output/u)).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
}
