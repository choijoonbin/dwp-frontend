import { expect, test } from '@playwright/test';
import { mockApprovedAdmin } from './support/meeting-approved-frame-evidence-fixtures';
import { expandMeetingPolicySection } from './support/video-meeting-admin-policy';
import {
  mockMeetingVisualSession,
  mockMeetingVisualAdminReadiness,
} from './support/video-meeting-visual-fixtures';
import {
  expectNoBlockingA11y,
  expectNoHorizontalOverflow,
} from './support/video-meeting-visual-accessibility';

test('U14 mobile hierarchy keeps core policies visible and safeguards discoverable', async ({
  page,
}, info) => {
  const mobile = info.project.name === 'mobile';
  await page.setViewportSize({ width: mobile ? 390 : 1440, height: mobile ? 844 : 960 });
  await mockApprovedAdmin(page, false);
  await page.goto('/meetings/admin/policies');
  await expect(page.getByRole('heading', { level: 1, name: '회의 정책' })).toBeVisible();
  for (const title of [
    '접근 및 대기실',
    '녹화 및 AI',
    'AI 회의록 분석 데이터 거버넌스',
    '보존 정책',
  ]) {
    const region = page.getByRole('region', { name: title, exact: true });
    if (mobile && title !== '접근 및 대기실') await expect(region).not.toHaveAttribute('open');
    else await expect(region).toHaveAttribute('open', '');
  }
  for (const title of ['회의 중 협업', '수용 인원 및 한도']) {
    const section = page.getByRole('region', { name: title, exact: true });
    if (mobile) await expect(section).not.toHaveAttribute('open');
    else await expect(section).toHaveAttribute('open', '');
  }
  const governance = page.getByTestId('meeting-policy-unavailable-masking');
  await expect(governance).toContainText('보고되지 않음');
  await expect(governance.locator('button,input,select')).toHaveCount(0);
  await expectNoBlockingA11y(page, 'U14 compact');
  await expectNoHorizontalOverflow(page, 'U14 compact');
  await page.evaluate(() => {
    document.getElementById('dwp-main-content')?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: info.outputPath(`U14-${mobile ? 'M' : 'D'}-viewport.png`) });
  await page.screenshot({
    path: info.outputPath(`U14-${mobile ? 'M' : 'D'}-document.png`),
    fullPage: true,
  });
  if (mobile) {
    await page.setViewportSize({ width: 320, height: 900 });
    await expectNoHorizontalOverflow(page, 'U14 compact 320');
    await expectNoBlockingA11y(page, 'U14 compact 320');
    await page.screenshot({ path: info.outputPath('U14-320-document.png'), fullPage: true });
    const navigation = page.getByRole('navigation', { name: '정책 섹션 선택' });
    await expect(navigation.getByRole('button')).toHaveCount(4);
    for (const [index, title] of [
      '접근 및 대기실',
      '녹화 및 AI',
      'AI 회의록 분석 데이터 거버넌스',
      '보존 정책',
    ].entries()) {
      await navigation.getByRole('button').nth(index).focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('region', { name: title, exact: true })).toHaveAttribute(
        'open',
        ''
      );
      await expect(navigation.getByRole('button').nth(index)).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      await expect(page.locator('details[id^="meeting-policy-section-"][open]')).toHaveCount(1);
      await expectNoHorizontalOverflow(page, `U14 section ${index + 1} 320`);
    }
    await expandMeetingPolicySection(page, '정책 제한 및 사용할 수 없는 제어');
    await expect(
      page.getByText('현재 정책과 다른 항목이 없습니다.', { exact: true })
    ).toBeVisible();
    await expectNoBlockingA11y(page, 'U14 all controls expanded 320');
    await expectNoHorizontalOverflow(page, 'U14 all controls expanded 320');
    await page.screenshot({ path: info.outputPath('U14-320-expanded.png'), fullPage: true });
  }
});

test('U14 section selection preserves the unsaved retention draft and explicit review boundary', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockMeetingVisualSession(page, { locale: 'en', admin: true, reducedMotion: true });
  await mockMeetingVisualAdminReadiness(page, 'BLOCKED');
  await page.goto('/meetings/admin/policies');
  const navigation = page.getByRole('navigation', { name: 'Policy sections' });
  await expect(navigation).toBeVisible({ timeout: 15_000 });
  await expect(navigation.getByRole('button', { name: '01. Access', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await navigation.getByRole('button', { name: '04. Retention', exact: true }).click();
  const retention = page.getByRole('region', { name: 'Retention policy', exact: true });
  const field = retention.getByLabel('Meeting record retention (days)', { exact: true });
  await expect(field).toBeEditable();
  await field.fill('180');
  await navigation.getByRole('button', { name: '01. Access', exact: true }).click();
  await expect(retention).not.toHaveAttribute('open');
  await navigation.getByRole('button', { name: '04. Retention', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(field).toHaveValue('180');
  await page.getByTestId('meeting-admin-policy-savebar').getByRole('button').click();
  const confirmation = page.getByRole('dialog', { name: 'Apply these policy changes?' });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(field).toHaveValue('180');
  await expectNoHorizontalOverflow(page, 'U14 section draft');
  await expectNoBlockingA11y(page, 'U14 section draft');
});
