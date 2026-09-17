import { expect, type Page } from '@playwright/test';

export async function assertApprovalSubmissionBlocked(page: Page) {
  const review = page.getByRole('button', { name: '검토', exact: true });
  await expect(review).toBeVisible();
  if (await review.isEnabled()) {
    await review.click();
    const preflight = page.getByRole('dialog', { name: '상신 전 통제', exact: true });
    if ((await preflight.count()) > 0) {
      await expect(preflight.getByRole('button', { name: '결재 상신', exact: true })).toHaveCount(
        0
      );
      await preflight.getByRole('button', { name: '취소', exact: true }).click();
      await expect(preflight).toHaveCount(0);
    }
  } else await expect(review).toBeDisabled();
  await expect(page.getByRole('button', { name: '결재 상신', exact: true })).toHaveCount(0);
}
