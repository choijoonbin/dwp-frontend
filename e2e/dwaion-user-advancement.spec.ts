import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type { AgentComponents } from '../libs/api-contracts/src';

import { PROPOSAL_DESIGN_ITEMS } from './support/dwaion-proposal-design-fixtures';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

type Proposal = AgentComponents['schemas']['AgentProposal'];

const NOW = '2026-09-17T01:30:00.000Z';
const HANDOFF_ID = 'a3f9af2f-c4a4-46fd-af96-62cccb876f73';
const RECEIPT_ID = 'f9a72e5d-1fb1-4bf4-a868-87e5fe3444c2';

async function mockProposalActionReview(page: Page) {
  await page.clock.setFixedTime(new Date(NOW));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'ko',
    displayName: '최준빈',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });

  let proposal: Proposal = {
    ...structuredClone(PROPOSAL_DESIGN_ITEMS[0]),
    expiresAt: '2026-09-18T09:00:00.000Z',
    content: {
      ...structuredClone(PROPOSAL_DESIGN_ITEMS[0].content),
      title: '내일 회의 준비 항목 확인',
      summary: '고객 미팅 전 미완료된 준비 항목을 검토합니다.',
      rationale: '회의가 내일로 예정되어 있고 준비 업무 2건이 완료되지 않았습니다.',
      actionInputs: {
        catalogItemId: 'customer-meeting-preparation',
        requestedFor: 'me',
      },
    },
  };
  let handoff = {
    handoffId: HANDOFF_ID,
    proposalId: proposal.proposalId,
    actionKey: proposal.actionKey!,
    state: 'REVIEW_REQUIRED',
    version: 1,
    targetRoute: '/services/catalog',
    approvalRequired: true,
    receiptId: null as string | null,
    createdAt: NOW,
    updatedAt: NOW,
  };
  const handoffRequests: Array<Record<string, unknown>> = [];

  await page.route('**/api/agent/v1/proposals/preferences', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { proactiveAnalysisEnabled: false, revision: 0, updatedAt: null },
      },
    })
  );
  await page.route('**/api/agent/v1/proposals?**', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          items: [proposal],
          summary: {
            active: proposal.state === 'PENDING' ? 1 : 0,
            highPriority: 1,
            snoozed: 0,
            handled: proposal.state === 'ACCEPTED' ? 1 : 0,
          },
          nextCursor: null,
        },
      },
    })
  );
  await page.route('**/api/agent/v1/proposals/*/decisions', async (route) => {
    proposal = {
      ...proposal,
      state: 'ACCEPTED',
      revision: proposal.revision + 1,
      decidedAt: NOW,
    };
    return route.fulfill({
      json: { success: true, data: { proposal, actionReviewRequired: true } },
    });
  });
  await page.route(`**/api/agent/v1/proposals/${proposal.proposalId}/handoff`, async (route) => {
    if (route.request().method() === 'POST') {
      handoffRequests.push(route.request().postDataJSON() as Record<string, unknown>);
      return route.fulfill({ json: { success: true, data: handoff } });
    }
    if (proposal.state !== 'ACCEPTED')
      return route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
    return route.fulfill({ json: { success: true, data: handoff } });
  });

  return {
    proposalId: proposal.proposalId,
    handoffRequests,
    completeHandoff: () => {
      handoff = {
        ...handoff,
        state: 'COMPLETED',
        version: handoff.version + 1,
        receiptId: RECEIPT_ID,
        updatedAt: '2026-09-17T01:34:00.000Z',
      };
    },
  };
}

function assertCanvasUsesAvailableWidth(page: Page, testId: string) {
  return page.getByTestId(testId).evaluate((surface) => {
    const canvas = surface.closest<HTMLElement>('[data-dwp-page-canvas="workspace"]');
    if (!canvas) throw new Error('Expected the shared workspace canvas.');
    const surfaceBounds = surface.getBoundingClientRect();
    const canvasBounds = canvas.getBoundingClientRect();
    const style = getComputedStyle(canvas);
    const innerLeft = canvasBounds.left + Number.parseFloat(style.paddingInlineStart);
    const innerRight = canvasBounds.right - Number.parseFloat(style.paddingInlineEnd);
    return {
      startDelta: surfaceBounds.left - innerLeft,
      endDelta: innerRight - surfaceBounds.right,
      usableWidth: surfaceBounds.width,
      availableWidth: innerRight - innerLeft,
    };
  });
}

for (const width of [1440, 390] as const) {
  test(`U00 proposal inbox and governed action review match the approved hierarchy at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const fixture = await mockProposalActionReview(page);
    await page.goto('/dwaion/proposals');

    await expect(page.getByRole('heading', { name: 'AI 제안함', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /전체/ })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '제안 검색' })).toBeVisible();
    await expect(page.getByText('내일 회의 준비 항목 확인', { exact: true })).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`U00-proposal-inbox-${width}.png`),
      fullPage: true,
      animations: 'disabled',
    });

    await page.goto(`/dwaion/proposals?proposal=${fixture.proposalId}`);
    const proposalDialog = page.getByRole('dialog', { name: 'DWAI·ON 제안' });
    await expect(proposalDialog).toBeVisible();
    await proposalDialog.getByRole('button', { name: '검토할 업무로 수락' }).click();

    const review = page.getByTestId('dwaion-proposal-action-review');
    await expect(review).toBeVisible();
    await expect(review.getByText('원본 제안 및 근거')).toBeVisible();
    await expect(review.getByText('행동 초안 검토')).toBeVisible();
    await expect(review.getByText('인계 및 거버넌스 통제')).toBeVisible();
    await expect(review.getByText('감사 추적 영수증')).toBeVisible();
    await expect(review.getByText('최종 영수증 대기 중입니다.')).toBeVisible();
    expect(fixture.handoffRequests).toHaveLength(1);
    expect(fixture.handoffRequests[0]).toMatchObject({
      expectedVersion: 3,
      reviewedInputs: {
        catalogItemId: 'customer-meeting-preparation',
        requestedFor: 'me',
      },
    });
    expect(fixture.handoffRequests[0]?.commandId).toEqual(expect.any(String));
    expect(fixture.handoffRequests[0]?.idempotencyKey).toEqual(expect.any(String));

    const geometry = await assertCanvasUsesAvailableWidth(page, 'dwaion-proposal-action-review');
    expect(Math.abs(geometry.startDelta)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(geometry.endDelta)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(geometry.usableWidth - geometry.availableWidth)).toBeLessThanOrEqual(1.5);

    const panels = review.locator('[data-testid="dwaion-proposal-action-grid"] > *');
    if (width === 1440) {
      const first = await panels.nth(0).boundingBox();
      const second = await panels.nth(1).boundingBox();
      const third = await panels.nth(2).boundingBox();
      expect(Math.abs((first?.y ?? 0) - (second?.y ?? 0))).toBeLessThanOrEqual(1.5);
      expect(Math.abs((second?.y ?? 0) - (third?.y ?? 0))).toBeLessThanOrEqual(1.5);
    } else {
      for (const button of await review.getByRole('button').all()) {
        const bounds = await button.boundingBox();
        expect(bounds?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
      ).toBe(true);
    }

    const audit = await new AxeBuilder({ page })
      .include('[data-testid="dwaion-proposal-action-review"]')
      .analyze();
    expect(
      audit.violations.filter((issue) => ['serious', 'critical'].includes(issue.impact ?? ''))
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`U00-proposal-action-review-${width}.png`),
      fullPage: true,
      animations: 'disabled',
    });

    fixture.completeHandoff();
    await expect(review.getByText(RECEIPT_ID, { exact: true })).toBeVisible({ timeout: 6_000 });
    await expect(review.getByText('실제 도메인 완료가 확인된 영수증입니다.')).toBeVisible();
  });
}
