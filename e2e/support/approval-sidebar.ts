import { expect, type Page } from '@playwright/test';

export async function openApprovalQueueSidebar(page: Page) {
  const mobile = (page.viewportSize()?.width ?? 1280) < 1200;
  const sidebar = page.getByTestId(mobile ? 'approvals-mobile-sidebar' : 'approvals-sidebar');
  const trigger = page.getByRole('button', { name: '전자결재 메뉴 열기' });
  if (mobile && (await trigger.getAttribute('aria-expanded')) !== 'true') {
    await expect(sidebar).not.toBeVisible();
    await trigger.click();
  }
  await expect(sidebar).toBeVisible();
  return sidebar;
}
