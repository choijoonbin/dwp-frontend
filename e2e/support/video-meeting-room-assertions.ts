import { expect, type Page } from '@playwright/test';

export async function expectMeetingRoomWorkspaceTools(page: Page) {
  const roomRail = page.getByRole('tablist', { name: 'Meeting workspace panels' });
  await expect(roomRail).toBeVisible();
  for (const tabName of ['Agenda', 'Chat', 'Floor', 'People', 'AI notes'])
    await expect(roomRail.getByRole('tab', { name: tabName })).toBeVisible();
  await expect(page.getByText('Interactive meeting tools')).toBeVisible();
  await roomRail.getByRole('tab', { name: 'AI notes' }).click();
  await expect(page.getByText('Live AI notes are not available')).toBeVisible();
  await expect(page.getByText(/No live transcript text or unreviewed model output/u)).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
}
