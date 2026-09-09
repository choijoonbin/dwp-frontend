import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { AgentActionHandoffOrigin, WorkplaceActionPreview } from '@dwp-frontend/shared-utils';
import { CATALOG_ACTIONS, mockDwaionCatalogs } from './support/dwaion-catalog-fixtures';
import { ASK_RUNTIME_FIXTURE, WORKSPACE_QUEUE_FIXTURE } from './support/runtime-access';

const question = '내일 회의 준비에 필요한 내용을 메일 초안으로 만들어줘';
const answer =
  '내일 오전 제품 검토 회의를 위한 핵심 안건과 사전 확인 자료를 정리했습니다. 수신자는 메일 앱에서 직접 지정해야 합니다.';
const sourceRunId = '00000000-0000-4000-8000-000000000082';
const planHash = 'b'.repeat(64);
const action = CATALOG_ACTIONS.find((item) => item.actionKey === 'MAIL.DRAFT.CREATE')!;
const reviewedInputs = { subject: question, body: answer };
const sourceReferences = ASK_RUNTIME_FIXTURE.citations.map((citation) => citation.sourceId);

type PreviewRequest = {
  requestId: string;
  inputs: Record<string, unknown>;
  sourceReferences: string[];
  origin: AgentActionHandoffOrigin;
};

for (const width of [1440, 390] as const) {
  test(`bound action review ${width} verifies the source response and only hands off after confirmation`, async ({
    page,
  }, testInfo) => {
    const i18nWarnings: string[] = [];
    page.on('console', (message) => {
      if (/missingKey|i18next::translator/u.test(message.text())) i18nWarnings.push(message.text());
    });
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await mockDwaionCatalogs(page, {
      locale: 'ko',
      actions: [CATALOG_ACTIONS[1], CATALOG_ACTIONS[0], CATALOG_ACTIONS[3]],
    });
    await page.route('**/api/platform/v1/workspace/work-items', (route) =>
      route.fulfill({ json: { success: true, data: WORKSPACE_QUEUE_FIXTURE } })
    );
    let sourceRequestId = '';
    const previews: PreviewRequest[] = [];
    const owningAppWrites: string[] = [];
    page.on('request', (request) => {
      if (
        request.method() !== 'GET' &&
        /\/api\/(?:platform\/v1\/)?(mail|calendar|approval|services)\//.test(
          new URL(request.url()).pathname
        )
      )
        owningAppWrites.push(request.url());
    });
    await page.route('**/api/agent/v1/ask/stream', (route) => {
      const request = route.request().postDataJSON() as { requestId: string };
      sourceRequestId = request.requestId;
      return route.fulfill({
        contentType: 'text/event-stream',
        body: `event: result\ndata: ${JSON.stringify({
          data: {
            ...ASK_RUNTIME_FIXTURE,
            answer,
            requestId: sourceRequestId,
            runId: sourceRunId,
          },
        })}\n\n`,
      });
    });
    const origin = (): AgentActionHandoffOrigin => ({
      appKey: 'APP.ASK',
      route: '/dwaion/new',
      surface: 'action-shelf',
      sourceRunId,
      sourceRequestId,
      sourceCorrelationId: ASK_RUNTIME_FIXTURE.correlationId,
      conversationId: null,
    });
    await page.route('**/api/agent/v1/actions/MAIL.DRAFT.CREATE/preview', (route) => {
      previews.push(route.request().postDataJSON() as PreviewRequest);
      const data: WorkplaceActionPreview = {
        action,
        reviewedInputs,
        plan: {
          runId: '00000000-0000-4000-8000-000000000083',
          auditId: 'AUD-REVIEW-83',
          planHash,
          correlationId: 'correlation-review-83',
          state: 'REVIEW',
          riskTier: 'L1',
          approvalRequired: true,
          mutationAllowed: false,
          summary: '메일 초안을 담당 앱에 안전하게 전달하기 위한 읽기 전용 계획입니다.',
          steps: [
            {
              id: 'verify-sources',
              title: 'Verify source permissions and freshness',
              tool: 'policy.check',
              description: 'Stop if a source is missing, stale, or outside the user scope.',
            },
            {
              id: 'prepare-preview',
              title: 'Prepare the MAIL.DRAFT.CREATE preview',
              tool: 'tool.preview',
              description: 'Build a reversible preview without changing the source system.',
            },
            {
              id: 'human-gate',
              title: 'Wait for explicit user approval',
              tool: 'workflow.human-approval',
              description: 'A separate approved command is required before any mutation.',
            },
          ],
          sourceReferences,
          referenceMode: true,
          agentRegistry: {
            entryKey: 'REFERENCE_PLANNER',
            revision: 1,
            artifactVersion: 'reference-v1',
            riskTier: 'LOW',
            resolution: 'ACTIVE',
          },
          handoffOrigin: origin(),
        },
      };
      return route.fulfill({ json: { success: true, data } });
    });
    await page.goto('/dwaion/new');
    await page.getByRole('textbox', { name: '업무 질문', exact: true }).fill(question);
    await page.getByRole('button', { name: '질문 보내기', exact: true }).click();
    await expect(page.getByTestId('dwaion-workspace-answer')).toContainText(answer);
    expect(previews).toEqual([]);
    const draft = page.getByRole('button', { name: /메일 초안 만들기/ });
    await draft.click();
    await expect(page).toHaveURL(/\/dwaion\/actions\?action=MAIL.DRAFT.CREATE$/);
    const review = page.getByRole('complementary', { name: '메일 초안 검토' });
    await expect(review).toBeVisible();
    await expect(page.getByTestId('dwaion-plan-queue-item')).toContainText(
      '메일 초안을 담당 앱에 안전하게 전달하기 위한 읽기 전용 계획입니다.'
    );
    await expect(review).toContainText('3단계 · mutationAllowed=false');
    await expect(review.getByRole('heading', { name: '검증된 실행 계획' })).toBeVisible();
    await expect(review.getByRole('heading', { name: '사전 점검 체크리스트' })).toBeVisible();
    await expect(review).toContainText('수신자');
    await expect(review).toContainText('미지정 · 필수');
    await expect(review).toContainText('생성 근거');
    await expect(review).toContainText(sourceReferences[0]);
    await expect(review).toContainText(question);
    await expect(review).toContainText(`${answer.length}자`);
    expect(previews).toHaveLength(1);
    expect(previews[0]).toMatchObject({
      inputs: reviewedInputs,
      sourceReferences,
      origin: origin(),
    });
    expect(previews[0].requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(owningAppWrites).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    const box = await page.getByTestId('dwaion-actions').boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(
      (
        await new AxeBuilder({ page })
          .include('[data-testid="dwaion-actions"]')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`U08-bound-action-review-${width}.png`),
      animations: 'disabled',
    });
    await page.screenshot({
      path: testInfo.outputPath(`U08-bound-action-review-full-${width}.png`),
      fullPage: true,
      animations: 'disabled',
    });
    if (width === 390) {
      await review.getByRole('heading', { name: '사전 점검 체크리스트' }).scrollIntoViewIfNeeded();
      await page.screenshot({
        path: testInfo.outputPath('U08-bound-action-review-preflight-390.png'),
        animations: 'disabled',
      });
    }
    await review.getByRole('button', { name: '메일에서 열기 및 최종 확인', exact: true }).click();
    await expect(page).toHaveURL(/\/mail\/inbox\?compose=open$/);
    const handoff = await page.evaluate(() => history.state?.usr?.dwaionHandoff);
    expect(handoff).toMatchObject({
      actionKey: action.actionKey,
      planHash,
      reviewedInputs,
      sourceReferences,
      origin: origin(),
    });
    expect(page.url()).not.toContain(question);
    expect(owningAppWrites).toEqual([]);
    await page.goBack();
    await expect(page).toHaveURL(/\/dwaion\/actions\?action=MAIL.DRAFT.CREATE$/);
    await review.getByRole('button', { name: '검토 취소', exact: true }).click();
    await expect(page).toHaveURL(/\/dwaion\/new$/);
    expect(await page.evaluate(() => history.state?.usr?.dwaionHandoff ?? null)).toBeNull();
    expect(i18nWarnings).toEqual([]);
  });
}
