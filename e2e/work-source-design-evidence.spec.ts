import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mockWorkHubFoundation, WORK_HUB_FIXTURE } from './support/work-hub-foundation-fixtures';

/** Korean design evidence uses allowed fictional source data; live release checks are separate. */
async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.width + 1);
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
  await page.screenshot({ path: testInfo.outputPath(`${name}-full.png`), fullPage: true });
}

test('02 03 04 and M1 Korean source design evidence at 1440 and 390', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await mockWorkHubFoundation(page, { locale: 'ko', designDetails: true, accessReview: true });
  const targets = [
    ['02', `APPROVAL_TASK:${WORK_HUB_FIXTURE.approvalId}:SECURITY_REVIEW`, 'approval'],
    ['03', 'IDENTITY_GOVERNANCE:f1111111-1111-4111-8111-111111111111:', 'review'],
    ['04', `SERVICE_REQUEST:${WORK_HUB_FIXTURE.serviceId}:`, 'service'],
  ] as const;
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const [screen, reference, kind] of targets) {
      await page.goto(`/work/queue?work=${encodeURIComponent(reference)}`);
      await expect(page.getByRole('article').getByRole('heading').first()).toBeVisible({
        timeout: 20_000,
      });
      if (kind === 'review') {
        await expect(page.getByRole('button', { name: '접근 회수', exact: true })).toBeVisible();
      } else {
        const detail = page.getByRole('article');
        await expect(
          detail.getByRole('button', { name: '원본에서 확인', exact: true })
        ).toBeVisible();
        await expect(
          detail.getByRole('button', { name: /승인|반려|보완 내용 검토 및 제출/u })
        ).toHaveCount(0);
        await expect(
          page.getByText('이 업무에 연결된 수행 시간이 없습니다.', { exact: true })
        ).toBeVisible();
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await capture(page, testInfo, `${screen}-${width}-ko`);
      if (kind === 'review' && width === 390) {
        await page.getByRole('button', { name: '접근 회수', exact: true }).click();
        await page
          .getByRole('textbox', { name: '결정 사유' })
          .fill(
            '업무 역할 변경으로 재무 보고 시스템 접근이 더 이상 필요하지 않아 회수를 요청합니다.'
          );
        await page.getByRole('button', { name: '결정 제출 내용 확인' }).click();
        const dialog = page.getByRole('dialog', { name: '이 접근 권한을 회수할까요?' });
        await expect(dialog).toBeVisible();
        await capture(page, testInfo, 'M1-390-ko-decision-preview');
        await dialog.getByRole('button', { name: '접근 회수', exact: true }).click();
        await expect(dialog).toBeHidden();
        await expect(page.getByText('원천 권한 반영 대기', { exact: false })).toBeVisible();
        await page.evaluate(() => window.scrollTo(0, 0));
        await capture(page, testInfo, 'M1-390-ko-decision-receipt');
      }
    }
  }
});
