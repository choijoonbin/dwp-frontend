import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type { AgentComponents } from '../libs/api-contracts/src';

import { PROPOSAL_DESIGN_ITEMS } from './support/dwaion-proposal-design-fixtures';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

type Proposal = AgentComponents['schemas']['AgentProposal'];

const NOW = '2026-09-17T01:30:00.000Z';
const HANDOFF_ID = 'a3f9af2f-c4a4-46fd-af96-62cccb876f73';
const RECEIPT_ID = 'f9a72e5d-1fb1-4bf4-a868-87e5fe3444c2';
const OUTPUT = join(process.cwd(), 'output', 'dwaion-user-advancement-final');

test.beforeAll(() => mkdirSync(OUTPUT, { recursive: true }));

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
    kind: 'APPROVAL',
    actionKey: 'APPROVAL.REQUEST.CREATE',
    expiresAt: '2026-09-18T09:00:00.000Z',
    content: {
      ...structuredClone(PROPOSAL_DESIGN_ITEMS[0].content),
      title: '2026 Q3 클라우드 인프라 오토스케일링 및 GPU 예약 결재 상신',
      summary: '검증된 워크로드·예산·보안 근거를 토대로 전자결재 행동 초안을 검토합니다.',
      rationale:
        '주간 워크로드 85% 초과 감지 및 FinOps 분기 예산 잔여액 충족에 따른 선제 인프라 스케일아웃 권고입니다.',
      actionInputs: {
        currentInfrastructure: '2노드 인프라 · 수동 대기',
        proposedInfrastructure: 'GPU 클러스터 4노드 증설 · g5.2xlarge × 4',
        currentMonthlyCost: '1,800,000 KRW',
        incrementalMonthlyCost: '4,500,000 KRW',
        accountCode: 'EXP-2026-IT-09',
        department: 'IT인프라전략그룹 / 백엔드팀',
        approvers: ['approver@example.test'],
      },
      evidence: [
        {
          sourceType: 'TELEMETRY',
          referenceId: 'tele-infra-prod-kr',
          label: 'AWS CloudWatch 워크로드 메트릭',
          occurredAt: '2026-09-17T01:29:00.000Z',
          route: '/observability/metrics/tele-infra-prod-kr',
        },
        {
          sourceType: 'FINOPS_LEDGER',
          referenceId: '2026-Q3',
          label: 'FinOps 예산 원장 정책 v4.2',
          occurredAt: '2026-09-17T01:25:00.000Z',
          route: '/finance/budgets/2026-Q3',
        },
        {
          sourceType: 'SECURITY_POLICY',
          referenceId: 'SEC-RULE-2026',
          label: '보안 심의 가이드라인',
          occurredAt: '2026-09-17T01:20:00.000Z',
          route: '/security/policies/SEC-RULE-2026',
        },
      ],
    },
  };
  let handoff = {
    handoffId: HANDOFF_ID,
    proposalId: proposal.proposalId,
    actionKey: proposal.actionKey!,
    state: 'REVIEW_REQUIRED',
    version: 1,
    targetRoute: '/approvals/requests/new',
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
  }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const fixture = await mockProposalActionReview(page);
    await page.goto('/dwaion/proposals');

    await expect(page.getByRole('heading', { name: 'AI 제안함', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '전체', exact: true })).toBeVisible();
    if (width === 1440) {
      await expect(page.getByRole('textbox', { name: '제안 검색' })).toBeVisible();
    }
    await expect(
      page
        .getByText('2026 Q3 클라우드 인프라 오토스케일링 및 GPU 예약 결재 상신', {
          exact: true,
        })
        .first()
    ).toBeVisible();
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    await page.screenshot({
      path: join(OUTPUT, `U00-proposal-inbox-${width}.png`),
      fullPage: true,
      animations: 'disabled',
    });

    await page.goto(`/dwaion/proposals?proposal=${fixture.proposalId}`);
    const proposalDialog = page.getByRole('dialog', { name: 'DWAI·ON 제안' });
    await expect(proposalDialog).toBeVisible();
    await proposalDialog.getByRole('button', { name: '검토할 업무로 수락' }).click();

    const review = page.getByTestId('dwaion-proposal-action-review');
    await expect(review).toBeVisible();
    await expect(review.getByText('제안 수락 기반 행동 검토')).toBeVisible();
    await expect(review.getByText('불변 결속 확인', { exact: false })).toBeVisible();
    await expect(review.getByText('응답 계약')).toBeVisible();
    await expect(review.getByText('전송 채널 증명')).toBeVisible();
    await expect(review.getByText('원본 제안 및 근거')).toBeVisible();
    await expect(review.getByText('행동 초안 검토')).toBeVisible();
    await expect(review.getByText('실행 전후 영향 대조')).toBeVisible();
    await expect(review.getByText('원 업무 앱 재검증 필요')).toBeVisible();
    await expect(
      review.getByText('/observability/metrics/tele-infra-prod-kr', { exact: false })
    ).toBeVisible();
    await expect(review.getByText('원본 지표 추이')).toBeVisible();
    await expect(review.getByText('시계열 데이터 미제공')).toBeVisible();
    await expect(review.getByText('승인 필요 계약 · 필수')).toBeVisible();
    await expect(review.getByText('필수 증빙·첨부 검증')).toBeVisible();
    await expect(review.getByText('인계 및 거버넌스 통제')).toBeVisible();
    await expect(review.getByText('인계 버전')).toBeVisible();
    await expect(review.getByText('감사 추적 영수증')).toBeVisible();
    await expect(review.getByText('최종 영수증 대기 중입니다.')).toBeVisible();
    await expect(review.getByText('DWAI·ON 계약 아키텍처 상태')).toBeVisible();
    expect(fixture.handoffRequests).toHaveLength(1);
    expect(fixture.handoffRequests[0]).toMatchObject({
      expectedVersion: 3,
      reviewedInputs: {
        currentInfrastructure: '2노드 인프라 · 수동 대기',
        proposedInfrastructure: 'GPU 클러스터 4노드 증설 · g5.2xlarge × 4',
        currentMonthlyCost: '1,800,000 KRW',
        incrementalMonthlyCost: '4,500,000 KRW',
        accountCode: 'EXP-2026-IT-09',
        department: 'IT인프라전략그룹 / 백엔드팀',
        approvers: ['approver@example.test'],
      },
    });
    expect(fixture.handoffRequests[0]?.commandId).toEqual(expect.any(String));
    expect(fixture.handoffRequests[0]?.idempotencyKey).toEqual(expect.any(String));

    await review.getByRole('button', { name: '초안 임시 보관' }).click();
    await expect(review.getByText(/이 브라우저 세션에 보관됨/)).toBeVisible();
    expect(
      await page.evaluate((proposalId) => {
        const raw = sessionStorage.getItem(`dwaion:proposal-action-draft:${proposalId}`);
        return raw ? JSON.parse(raw) : null;
      }, fixture.proposalId)
    ).toMatchObject({
      proposalId: fixture.proposalId,
      handoffId: HANDOFF_ID,
      reviewedInputs: {
        currentInfrastructure: '2노드 인프라 · 수동 대기',
        proposedInfrastructure: 'GPU 클러스터 4노드 증설 · g5.2xlarge × 4',
        currentMonthlyCost: '1,800,000 KRW',
        incrementalMonthlyCost: '4,500,000 KRW',
        accountCode: 'EXP-2026-IT-09',
        department: 'IT인프라전략그룹 / 백엔드팀',
        approvers: ['approver@example.test'],
      },
    });
    await expect(review.getByRole('button', { name: '전자결재 원본 검토로 인계' })).toBeVisible();

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
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    await page.screenshot({
      path: join(OUTPUT, `U00-proposal-action-review-${width}.png`),
      fullPage: true,
      animations: 'disabled',
    });

    fixture.completeHandoff();
    await expect(review.getByText(RECEIPT_ID, { exact: true })).toBeVisible({ timeout: 6_000 });
    await expect(review.getByText('실제 도메인 완료가 확인된 영수증입니다.')).toBeVisible();
  });
}
