import { expect, test } from '@playwright/test';

import { mockWorkHubFoundation } from './support/work-hub-foundation-fixtures';

const reviewRef = 'IDENTITY_GOVERNANCE:f1111111-1111-4111-8111-111111111111:';
const reviewRoute = `/work/queue?work=${encodeURIComponent(reviewRef)}`;
test.setTimeout(60_000);

const reason = '조직 변경과 현재 역할의 업무 범위를 검토했으며 접근 권한 회수가 필요합니다.';

for (const width of [390, 320]) {
  test(`M1 ${width}px exposes a compact decision and retains draft through evidence and keyboard changes`, async ({
    page,
  }, testInfo) => {
    const runtime = await mockWorkHubFoundation(page, {
      locale: 'ko',
      designDetails: true,
      accessReview: true,
    });
    await page.setViewportSize({ width, height: 844 });
    await page.goto(reviewRoute);
    await expect(
      page.getByRole('heading', { name: /^(접근 권한 검토|Access review)$/u })
    ).toBeVisible({ timeout: 20_000 });
    const progress = page.getByRole('navigation', { name: '접근권한 검토 진행 단계' });
    await expect(progress).toBeVisible();
    await expect(progress.getByText('큐 선택', { exact: true })).toBeVisible();
    await expect(progress.getByText('상세 검토', { exact: true })).toBeVisible();
    await expect(progress.getByText('결정 제출', { exact: true })).toBeVisible();
    await expect(progress.getByText('결과 반영', { exact: true })).toBeVisible();
    await expect(page.getByText('검토 마감', { exact: true })).toBeVisible();
    await expect(page.getByText('재경팀 · EMP-88219', { exact: true })).toBeVisible();
    await expect(page.getByText('REV-3', { exact: true })).toBeVisible();
    const evidence = page.getByRole('button', { name: '캠페인 및 권한 근거' });
    await expect(evidence).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByText('최근 로그인', { exact: true })).toBeHidden();
    const keep = page.getByRole('button', { name: '접근 유지', exact: true });
    const revoke = page.getByRole('button', { name: '접근 회수', exact: true });
    await expect(keep).toBeVisible();
    await expect(revoke).toBeVisible();
    const keepBox = await keep.boundingBox();
    const revokeBox = await revoke.boundingBox();
    expect(Math.abs(keepBox!.y - revokeBox!.y)).toBeLessThan(2);
    await revoke.click();
    const rationale = page.getByRole('textbox', { name: '결정 사유' });
    await expect(rationale).toHaveAttribute('maxlength', '500');
    await rationale.fill(reason);
    await evidence.focus();
    await page.keyboard.press('Enter');
    await expect(evidence).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('최근 로그인', { exact: true })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(evidence).toHaveAttribute('aria-expanded', 'false');
    await expect(rationale).toHaveValue(reason);
    await rationale.focus();
    await page.setViewportSize({ width, height: 440 });
    await rationale.scrollIntoViewIfNeeded();
    await expect(rationale).toBeFocused();
    const preview = page.getByRole('button', { name: '결정 제출 내용 확인' });
    await expect(preview).toBeEnabled();
    await preview.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: '이 접근 권한을 회수할까요?' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: '이 접근 권한을 회수할까요?' })).toBeHidden();
    await expect(rationale).toHaveValue(reason);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
    ).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`M1-${width}-keyboard.png`) });
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath(`M1-${width}-compact.png`), fullPage: true });
    const backToQueue = page.getByRole('button', { name: '업무 목록으로' });
    await backToQueue.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(
      (url) => url.pathname === '/work/queue' && !url.searchParams.has('work')
    );
    expect(runtime.sourceMutations).toEqual([]);
  });
}

for (const width of [1440, 1280]) {
  test(`03 ${width}px preserves visible access evidence in dark high contrast`, async ({
    page,
  }, testInfo) => {
    await mockWorkHubFoundation(page, {
      locale: 'en',
      designDetails: true,
      accessReview: true,
      mode: 'dark',
      highContrast: true,
    });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(reviewRoute);
    await expect(
      page.getByRole('heading', { name: /^(접근 권한 검토|Access review)$/u })
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Last sign-in', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Campaign and access evidence' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Keep access', exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`03-${width}-dark-contrast.png`),
      fullPage: true,
    });
  });
}

test('M1 enlarged text remains operable at 200 percent', async ({ page }, testInfo) => {
  await mockWorkHubFoundation(page, { locale: 'ko', designDetails: true, accessReview: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(reviewRoute);
  await expect(
    page.getByRole('heading', { name: /^(접근 권한 검토|Access review)$/u })
  ).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: '접근 회수', exact: true }).click();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  const rationale = page.getByRole('textbox', { name: '결정 사유' });
  await rationale.fill(reason);
  const preview = page.getByRole('button', { name: '결정 제출 내용 확인' });
  await preview.click();
  await expect(page.getByRole('dialog', { name: '이 접근 권한을 회수할까요?' })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('M1-390-text-200-preview.png'),
    fullPage: true,
  });
});
