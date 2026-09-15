import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  PRODUCT_AUTHORIZATION_REGISTRY_REVISION,
  PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS,
} from '../apps/dwp/src/routes/product-surface-authorization.generated';
import { approvalInformationReceiptBrowserSession } from './support/approval-information-receipt-browser-fixtures';
import { closeApprovalWireTestServers } from './support/approval-wire-test-server';

const completed = '원본 요청의 처리 완료를 확인했습니다.';
const readError = '처리 결과를 확인하지 못했습니다. 원본 요청은 보존됩니다.';
test.afterEach(closeApprovalWireTestServers);

test.describe('canonical generation 14 receipt frontend contract journeys (not live Auth)', () => {
  test.beforeEach(() => {
    expect(PRODUCT_AUTHORIZATION_REGISTRY_REVISION.version).toBe(14);
    const routes = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.filter(
      (entry) => entry.routeContractKey === 'route.approvals.work.information-command-receipt.data'
    );
    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({
      routeKind: 'DATA',
      productId: 'approvals',
      surfaceId: 'approvals.work',
    });
    expect(routes[0]!.gatewayBindings).toEqual([
      {
        method: 'POST',
        path: '/api/approvals/v1/requests/{requestId}/information-commands/{originalKey}/receipt',
      },
    ]);
  });

  test('original Blob wire survives close/resume; fresh DATA confirms historical terminal reply without ACTION retry', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    const s = await approvalInformationReceiptBrowserSession(page);
    s.advance();
    await s.resume();
    await expect(s.dialog.getByRole('button', { name: '답변 제출', exact: true })).toBeDisabled();
    await s.lookup();
    await expect(s.dialog.getByText(completed, { exact: true })).toBeVisible();
    expect(s.receipts).toHaveLength(1);
    expect(s.commands).toHaveLength(1);
    expect(s.evaluations.at(-1)).toBe('route.approvals.work.information-command-receipt.data');
    expect(s.state.detail.payload).toEqual({
      summary: 'Latest saved content',
      costCenter: 'latest-center',
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await s.dialog.screenshot({ path: test.info().outputPath('receipt-confirmed-320.png') });
    await s.dialog.getByRole('button', { name: '닫기', exact: true }).last().click();
    await expect(s.dialog).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: '미확인 보완 요청 다시 열기', exact: true })
    ).toHaveCount(0);
    expect(s.commands).toHaveLength(1);
    s.state.list = [s.state.detail.request];
    await page.goto(`/approvals/requests/archive?request=${s.original.request.requestId}`);
    await expect(
      page.getByRole('dialog').getByText('latest-center', { exact: true })
    ).toBeVisible();
  });

  test('secure 110 uses the same dedicated DATA authority and original bytes without a surface UI fallback', async ({
    page,
  }) => {
    const s = await approvalInformationReceiptBrowserSession(page, '110');
    s.advance();
    await s.resume();
    await s.lookup();
    await expect(s.dialog.getByText(completed, { exact: true })).toBeVisible();
    expect(s.receipts).toHaveLength(1);
    expect(s.commands).toHaveLength(1);
  });

  for (const mode of ['dark', 'forced-colors'] as const) {
    test(`320px ${mode} original receipt confirmation is accessible without enabling a command retry`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 720 });
      await page.emulateMedia({
        colorScheme: mode === 'dark' ? 'dark' : 'light',
        forcedColors: mode === 'forced-colors' ? 'active' : 'none',
        reducedMotion: 'reduce',
      });
      const s = await approvalInformationReceiptBrowserSession(page);
      await expect(page.locator('html')).toHaveAttribute(
        'data-color-scheme',
        mode === 'dark' ? 'dark' : 'light'
      );
      s.advance();
      await s.resume();
      await s.lookup();
      await expect(s.dialog.getByText(completed, { exact: true })).toBeVisible();
      await expect(
        s.dialog.getByRole('button', { name: '원래 보완 요청 재시도', exact: true })
      ).toBeDisabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false
      );
      await s.dialog.screenshot({ path: test.info().outputPath(`receipt-${mode}-320.png`) });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(s.commands).toHaveLength(1);
    });
  }

  for (const status of [403, 503] as const) {
    test(`closing a pending DATA evaluation then current owner ${status} blocks POST and retains the original for qualified recovery`, async ({
      page,
    }) => {
      const s = await approvalInformationReceiptBrowserSession(page);
      let release!: () => void;
      let started!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const evaluating = new Promise<void>((resolve) => {
        started = resolve;
      });
      s.state.beforeReceiptEvaluation = async () => {
        started();
        await gate;
      };
      await s.lookup();
      await evaluating;
      s.state.detailStatus = status;
      try {
        await s.resume();
        await expect(
          s.dialog.getByText('현재 권한으로 원본 처리 결과를 확인할 수 없습니다.', { exact: true })
        ).toBeVisible();
        expect(s.receipts).toHaveLength(0);
        expect(s.commands).toHaveLength(1);
      } finally {
        release();
      }
      s.state.beforeReceiptEvaluation = undefined;
      s.state.detailStatus = 200;
      await s.resume();
      await s.lookup();
      await expect(s.dialog.getByText(completed, { exact: true })).toBeVisible();
      expect(s.receipts).toHaveLength(1);
      expect(s.commands).toHaveLength(1);
    });
  }

  for (const response of [403, 503, 'PENDING'] as const) {
    test(`${response} receipt preserves UNKNOWN and exact original key/bytes for explicit fresh DATA lookup`, async ({
      page,
    }) => {
      const s = await approvalInformationReceiptBrowserSession(page);
      if (response === 'PENDING') s.state.receipt = { status: 'PENDING' };
      else s.state.receiptStatus = response;
      await s.lookup();
      await expect(s.dialog.getByText(readError, { exact: true })).toBeVisible();
      expect(s.commands).toHaveLength(1);
      const bytes = s.commands[0]!.bytes;
      const key = s.commands[0]!.key;
      await s.resume();
      s.state.receiptStatus = 200;
      s.state.receipt = {
        status: 'COMPLETED',
        roundId: s.original.informationRound!.roundId,
        generation: 2,
        requestVersion: 8,
        payloadRevision: 2,
        payloadSha256: s.original.informationRound!.payloadSha256,
        materialChange: false,
      };
      await s.lookup();
      await expect(s.dialog.getByText(completed, { exact: true })).toBeVisible();
      expect(s.receipts).toHaveLength(2);
      for (const receipt of s.receipts) {
        expect(receipt.key).toBe(key);
        expect(receipt.bytes).toEqual(bytes);
      }
      expect(s.commands).toHaveLength(1);
    });
  }

  test('a writable or borrowed grant cannot authorize the readonly receipt POST or erase UNKNOWN', async ({
    page,
  }) => {
    const s = await approvalInformationReceiptBrowserSession(page);
    s.state.invalidReadGrant = true;
    await s.lookup();
    await expect(s.dialog.getByText(readError, { exact: true })).toBeVisible();
    expect(s.receipts).toHaveLength(0);
    expect(s.commands).toHaveLength(1);
    await s.resume();
    s.state.invalidReadGrant = false;
    await s.lookup();
    await expect(s.dialog.getByText(completed, { exact: true })).toBeVisible();
    expect(s.receipts).toHaveLength(1);
    expect(s.commands).toHaveLength(1);
  });
});
