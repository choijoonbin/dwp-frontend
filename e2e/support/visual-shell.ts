import { expect, type Page } from '@playwright/test';

const SHELL_READY_TIMEOUT_MS = 15_000;

export async function expectShellReady(page: Page, applicationName?: string) {
  await expect(page.getByTestId('shell-workspace-identity')).toContainText('DWP Workspace', {
    timeout: SHELL_READY_TIMEOUT_MS,
  });
  if (applicationName) {
    await expect(
      page.getByTestId('shell-application-context').getByText(applicationName, { exact: true })
    ).toBeVisible({ timeout: SHELL_READY_TIMEOUT_MS });
  }
  const notificationButton = page.getByTestId('shell-notification-control').getByRole('button');
  await expect(notificationButton).toBeVisible({ timeout: SHELL_READY_TIMEOUT_MS });
  await expect(notificationButton).toHaveAccessibleName(
    /0 actionable notifications, 0 total unread/i,
    {
      timeout: SHELL_READY_TIMEOUT_MS,
    }
  );
}

export async function settleWorkNavigation(page: Page) {
  await page.getByRole('button', { name: 'Collapse navigation' }).click();
  await expect(page.getByTestId('work-sidebar')).toHaveCSS('width', '72px');
  await expectShellReady(page, 'Work');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Expand navigation' }).blur();
  await expect(page.getByRole('tooltip', { name: 'Expand navigation' })).toBeHidden();
}
