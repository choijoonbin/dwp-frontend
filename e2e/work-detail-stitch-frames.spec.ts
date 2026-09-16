import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  mockWorkHubFoundation,
  personalTaskRoute,
  WORK_HUB_FIXTURE,
} from './support/work-hub-foundation-fixtures';

import type { Page, TestInfo } from '@playwright/test';

const approvalRoute = `/work/queue?work=${encodeURIComponent(
  `APPROVAL_TASK:${WORK_HUB_FIXTURE.approvalId}:SECURITY_REVIEW`
)}`;
const serviceRoute = `/work/queue?work=${encodeURIComponent(
  `SERVICE_REQUEST:${WORK_HUB_FIXTURE.serviceId}:`
)}`;

const variants = [
  { name: '1440', width: 1440, height: 1000 },
  { name: '1280', width: 1280, height: 900 },
  { name: '390', width: 390, height: 844 },
  { name: '320', width: 320, height: 740 },
  { name: 'zoom-200', width: 1280, height: 900, zoom: 2 },
  { name: 'dark-390', width: 390, height: 844, mode: 'dark' as const },
  { name: 'forced-colors-390', width: 390, height: 844, forcedColors: true },
];

async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo(0, 0);
    document
      .querySelectorAll<HTMLElement>('[data-testid="work-hub-detail-panel"]')
      .forEach((node) => {
        node.scrollTop = 0;
      });
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
  const layout = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    activeLabel:
      document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent,
  }));
  expect(layout.documentWidth - layout.viewportWidth, JSON.stringify(layout)).toBeLessThanOrEqual(
    1
  );
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: false, animations: 'disabled' });
  await info.attach(name, { path, contentType: 'image/png' });
  await info.attach(`${name}-layout`, {
    body: JSON.stringify(layout, null, 2),
    contentType: 'application/json',
  });
}

async function expectKeyboardReachable(page: Page, name: RegExp) {
  const control = page.getByRole('button', { name }).first();
  await control.scrollIntoViewIfNeeded();
  await control.focus();
  await expect(control).toBeFocused();
}

for (const variant of variants) {
  test(`D01/D03/D04 ${variant.name} preserve the source-owned hierarchy and safe actions`, async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'chromium', 'Remaining Stitch frame coverage runs once.');
    test.setTimeout(90_000);
    await page.setViewportSize({ width: variant.width, height: variant.height });
    await page.emulateMedia({
      colorScheme: variant.mode ?? 'light',
      forcedColors: variant.forcedColors ? 'active' : 'none',
      reducedMotion: 'reduce',
    });
    await mockWorkHubFoundation(page, {
      locale: 'ko',
      designDetails: true,
      nativeWorkspace: true,
      mode: variant.mode,
      highContrast: variant.forcedColors,
    });
    if (variant.zoom) {
      await page.addInitScript((zoom) => {
        window.addEventListener('DOMContentLoaded', () => {
          document.documentElement.style.zoom = String(zoom);
        });
      }, variant.zoom);
    }

    await page.goto(approvalRoute);
    const approval = page.getByRole('article');
    await expect(approval.getByRole('heading', { name: /고객 지원 장비 구매 승인/ })).toBeVisible({
      timeout: 20_000,
    });
    await expect(approval).toContainText('구매 목적');
    await expect(approval).toContainText('1,850,000');
    await expect(approval).toContainText('공급 업체');
    await expect(approval).toContainText('결정에 필요한 결재 맥락');
    await expectKeyboardReachable(page, /원본에서 확인/);
    await capture(page, info, `wrk-d01-${variant.name}`);

    await page.goto(serviceRoute);
    const service = page.getByRole('article');
    await expect(service.getByRole('heading', { name: /원격접속\(VPN\)/ })).toBeVisible({
      timeout: 20_000,
    });
    await expect(service).toContainText('내 보완 의무와 요청 진행');
    await expect(service.getByTestId('service-information-response')).toBeVisible();
    await expect(
      service.getByRole('textbox', { name: '담당자에게 전달할 보완 답변', exact: true })
    ).toBeVisible();
    const responseMessage = service.getByRole('textbox', {
      name: '담당자에게 전달할 보완 답변',
      exact: true,
    });
    await responseMessage.focus();
    await expect(responseMessage).toBeFocused();
    await capture(page, info, `wrk-d03-${variant.name}`);

    await page.goto(personalTaskRoute());
    const personal = page.getByRole('article');
    await expect(personal.getByRole('heading', { name: '분기 고객 안내 초안 정리' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(personal).toContainText('체크리스트');
    await expect(personal).toContainText('변경 이력');
    await expect(personal.getByRole('button', { name: '진행 중', exact: true })).toBeEnabled();
    await expectKeyboardReachable(page, /편집/);
    await capture(page, info, `wrk-d04-${variant.name}`);

    if (variant.name === '1440') {
      const result = await new AxeBuilder({ page })
        .include('[data-testid="work-hub-detail-panel"]')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      await info.attach('wrk-detail-accessibility', {
        body: JSON.stringify(result.violations, null, 2),
        contentType: 'application/json',
      });
      expect(
        result.violations.filter((violation) =>
          ['serious', 'critical'].includes(violation.impact ?? '')
        )
      ).toEqual([]);
    }
  });
}
